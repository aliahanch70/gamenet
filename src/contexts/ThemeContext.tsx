import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { DEFAULT_DESIGN, type DesignId, DESIGN_IDS } from '../theme/designRegistry'

export type Brand = { name:string; title:string; description:string; keywords:string; og_image:string; favicon:string; logo_url:string; logo_text:string }
export const DEFAULT_BRAND: Brand = { name:'PLAYSTREET', title:'GAMEVERSE — گیم‌نت حرفه‌ای', description:'GAMEVERSE — گیم‌نت حرفه‌ای با شرط‌بندی زنده و کیف پول تومانی', keywords:'گیم نت, شرط بندی, بازی', og_image:'', favicon:'', logo_url:'', logo_text:'PLAYSTREET' }

function upsertMeta(name:string, content:string){
  if(!content) return
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null
  if(!el){ el = document.createElement('meta'); el.name = name; document.head.appendChild(el) }
  el.content = content
}
function upsertMetaProp(prop:string, content:string){
  let el = document.querySelector(`meta[property="${prop}"]`) as HTMLMetaElement | null
  if(content){
    if(!el){ el = document.createElement('meta'); el.setAttribute('property', prop); document.head.appendChild(el) }
    el.content = content
  } else if(el) el.remove()
}
function setFavicon(href:string){
  if(!href) return
  let el = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null
  if(!el){ el = document.createElement('link'); el.rel='icon'; document.head.appendChild(el) }
  el.href = href
}
function applyBrand(b: Brand){
  document.title = b.title || b.name || DEFAULT_BRAND.title
  upsertMeta('description', b.description)
  if(b.keywords) upsertMeta('keywords', b.keywords)
  upsertMetaProp('og:title', b.title || b.name)
  upsertMetaProp('og:description', b.description)
  upsertMetaProp('og:image', b.og_image)
  if(b.favicon) setFavicon(b.favicon)
}

type Ctx = {
  design: DesignId
  setDesign: (d: DesignId) => Promise<void>
  brand: Brand
  setBrand: (b: Brand) => Promise<void>
  loading: boolean
}
const ThemeCtx = createContext<Ctx>({ design: DEFAULT_DESIGN, setDesign: async()=>{}, brand: DEFAULT_BRAND, setBrand: async()=>{}, loading: true })

function isDesignId(x: any): x is DesignId { return DESIGN_IDS.includes(x) }
function normalizeBrand(x:any): Brand {
  if(!x || typeof x!=='object') return DEFAULT_BRAND
  return {
    name: String(x.name||DEFAULT_BRAND.name),
    title: String(x.title||DEFAULT_BRAND.title),
    description: String(x.description||DEFAULT_BRAND.description),
    keywords: String(x.keywords||''),
    og_image: String(x.og_image||''),
    favicon: String(x.favicon||''),
    logo_url: String(x.logo_url||''),
    logo_text: String(x.logo_text||DEFAULT_BRAND.logo_text),
  }
}

export const ThemeProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [design, setDesignState] = useState<DesignId>(DEFAULT_DESIGN)
  const [brand, setBrandState] = useState<Brand>(DEFAULT_BRAND)
  const [loading, setLoading] = useState(true)
  const apply = (d: DesignId) => {
    setDesignState(d)
    document.documentElement.setAttribute('data-design', d)
    try { localStorage.setItem('gv_design', d) } catch {}
  }
  const applyB = (b: Brand) => { const nb = normalizeBrand(b); setBrandState(nb); applyBrand(nb) }

  useEffect(()=>{
    try {
      const cached = localStorage.getItem('gv_design')
      if (cached && isDesignId(cached)) apply(cached as DesignId)
    } catch {}
    // instant brand from cache if saved
    try { const cb = localStorage.getItem('gv_brand'); if(cb) applyB(JSON.parse(cb)) } catch {}
    let ch: any = null
    const boot = async()=>{
      try {
        const { data, error } = await supabase.from('site_settings').select('design,brand').eq('id',1).maybeSingle() as any
        if(!error && data){
          if(isDesignId(data.design)) apply(data.design as DesignId)
          if(data.brand) applyB(data.brand as Brand)
          try{ if(data.brand) localStorage.setItem('gv_brand', JSON.stringify(normalizeBrand(data.brand))) } catch{}
        } else if(error){
          console.warn('[theme] site_settings missing — run migration', error.message)
        }
      } catch {}
      setLoading(false)
      try {
        ch = supabase.channel('site-design')
          .on('postgres_changes',{event:'*', schema:'public', table:'site_settings', filter:'id=eq.1'}, (p:any)=>{
            const nd = p.new?.design
            if(nd && isDesignId(nd)) apply(nd as DesignId)
            if(p.new?.brand) applyB(p.new.brand as Brand)
          })
          .subscribe()
      } catch {}
    }
    boot()
    return ()=>{ if(ch) try{ supabase.removeChannel(ch) } catch{} }
  },[])

  const setDesign = async(d: DesignId)=>{
    if(!isDesignId(d)) return
    apply(d)
    const { error } = await (supabase.from('site_settings') as any).update({ design: d, updated_at: new Date().toISOString() }).eq('id',1)
    if(error){
      const { error: e2 } = await (supabase.from('site_settings') as any).upsert({ id:1, design: d } as any, { onConflict:'id' })
      if(e2) console.warn('[theme] save failed', e2.message)
    }
  }
  const setBrand = async(b: Brand)=>{
    const nb = normalizeBrand(b)
    applyB(nb)
    try{ localStorage.setItem('gv_brand', JSON.stringify(nb)) } catch{}
    const { error } = await (supabase.from('site_settings') as any).update({ brand: nb, updated_at: new Date().toISOString() }).eq('id',1)
    if(error){
      const { error: e2 } = await (supabase.from('site_settings') as any).upsert({ id:1, brand: nb } as any, { onConflict:'id' })
      if(e2) console.warn('[brand] save failed', e2.message)
    }
  }

  return <ThemeCtx.Provider value={{ design, setDesign, brand, setBrand, loading }}>{children}</ThemeCtx.Provider>
}

export const useTheme = ()=> useContext(ThemeCtx)
