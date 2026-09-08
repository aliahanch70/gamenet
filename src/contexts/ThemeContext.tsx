import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { DEFAULT_DESIGN, type DesignId, DESIGN_IDS } from '../theme/designRegistry'

type Ctx = {
  design: DesignId
  setDesign: (d: DesignId) => Promise<void>
  loading: boolean
}
const ThemeCtx = createContext<Ctx>({ design: DEFAULT_DESIGN, setDesign: async()=>{}, loading: true })

function isDesignId(x: any): x is DesignId { return DESIGN_IDS.includes(x) }

export const ThemeProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [design, setDesignState] = useState<DesignId>(DEFAULT_DESIGN)
  const [loading, setLoading] = useState(true)

  const apply = (d: DesignId) => {
    setDesignState(d)
    document.documentElement.setAttribute('data-design', d)
    // keep for instant boot on next reload (not source of truth)
    try { localStorage.setItem('gv_design', d) } catch {}
  }

  useEffect(()=>{
    // instant paint from cache before supabase
    try {
      const cached = localStorage.getItem('gv_design')
      if (cached && isDesignId(cached)) apply(cached as DesignId)
    } catch {}
    let ch: any = null
    const boot = async()=>{
      try {
        const { data, error } = await supabase.from('site_settings').select('design').eq('id',1).maybeSingle() as any
        if(!error && data && isDesignId(data.design)){
          apply(data.design as DesignId)
        } else if(error){
          // column missing -> keep default
          console.warn('[theme] site_settings.design missing — run migration', error.message)
        }
      } catch {}
      setLoading(false)
      // realtime: all clients update without refresh
      try {
        ch = supabase.channel('site-design')
          .on('postgres_changes',{event:'*', schema:'public', table:'site_settings', filter:'id=eq.1'}, (p:any)=>{
            const nd = p.new?.design
            if(nd && isDesignId(nd)) apply(nd as DesignId)
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
    // source of truth: Supabase
    const { error } = await (supabase.from('site_settings') as any).update({ design: d, updated_at: new Date().toISOString() }).eq('id',1)
    if(error){
      // row may not exist -> upsert
      const { error: e2 } = await (supabase.from('site_settings') as any).upsert({ id:1, design: d } as any, { onConflict:'id' })
      if(e2) console.warn('[theme] save failed', e2.message)
    }
  }

  return <ThemeCtx.Provider value={{ design, setDesign, loading }}>{children}</ThemeCtx.Provider>
}

export const useTheme = ()=> useContext(ThemeCtx)
