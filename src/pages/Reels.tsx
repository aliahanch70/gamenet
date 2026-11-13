import { useEffect, useRef, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

type Reel = {
  id: string
  user_id: string
  video_url: string
  caption: string | null
  hashtags: string | null
  likes_count: number
  comments_count: number
  created_at: string
  is_published?: boolean
  username?: string
}
type CommentRow = { id:string; body:string; created_at:string; user_id:string; username?:string }

const PAGE = 10

export default function Reels(){
  const navigate = useNavigate()
  const { userId, isAdmin } = useAuth() as any
  const [reels,setReels]=useState<Reel[]>([])
  const [loading,setLoading]=useState(true)
  const [loadingMore,setLoadingMore]=useState(false)
  const [hasMore,setHasMore]=useState(true)
  const [active,setActive]=useState(0)
  const [muted,setMuted]=useState(true)
  const [fit,setFit]=useState<'cover'|'contain'>(()=>{ try{ const v=localStorage.getItem('reels_fit'); return v==='contain' ? 'contain' : 'cover' } catch{ return 'cover' } })
  const [liked,setLiked]=useState<Set<string>>(new Set())
  const likedRef = useRef<Set<string>>(new Set())
  useEffect(()=>{ likedRef.current = liked }, [liked])
  const [counts,setCounts]=useState<Record<string,number>>({})
  const [burst,setBurst]=useState<string|null>(null)
  const [busyLike,setBusyLike]=useState<string|null>(null)
  const [progress,setProgress]=useState<Record<string,number>>({})
  const progressRef = useRef<Record<string,number>>({})
  const progressTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const [cmOpen,setCmOpen]=useState<string|null>(null)
  const [comments,setComments]=useState<CommentRow[]>([])
  const [cmLoading,setCmLoading]=useState(false)
  const [cmText,setCmText]=useState('')
  const [addOpen,setAddOpen]=useState(false)
  const [newUrl,setNewUrl]=useState('')
  const [newCap,setNewCap]=useState('')
  const [newTags,setNewTags]=useState('')
  const [file,setFile]=useState<File|null>(null)
  const [saving,setSaving]=useState(false)
  const [upPct,setUpPct]=useState<number|null>(null)
  // admin manage modal
  const [manageOpen,setManageOpen]=useState(false)
  const [mgmtReels,setMgmtReels]=useState<Reel[]>([])
  const [mgmtLoading,setMgmtLoading]=useState(false)
  const [mgmtDel,setMgmtDel]=useState<string|null>(null)

  const scrollerRef = useRef<HTMLDivElement|null>(null)
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map())
  const offsetRef = useRef(0)
  const seedRef = useRef(0)

  useEffect(()=>{ try{ localStorage.setItem('reels_fit', fit) } catch{} },[fit])
  useEffect(()=>{
    document.body.classList.add('has-reels')
    return ()=> document.body.classList.remove('has-reels')
  },[])

  const enrichUsernames = async(rows: Reel[]): Promise<Reel[]>=>{
    if(!rows.length) return rows
    const ids=[...new Set(rows.map(r=>r.user_id))]
    const { data: profs } = await supabase.from('profiles').select('id,username,display_name').in('id', ids)
    const m=new Map((profs as any[]||[]).map((p:any)=>[p.id, p.username||p.display_name||'کاربر']))
    return rows.map(r=> ({...r, username:(m.get(r.user_id) as string)||'gamenet'}))
  }

  // smart fetch: if user has likes, mix related + random; else pure random
    const fetchPage = useCallback(async(reset=false)=>{
      const off = reset ? 0 : offsetRef.current
      if(reset) setLoading(true); else setLoadingMore(true)

      let rows: Reel[] = []
      const currentLiked = likedRef.current
      if(userId && currentLiked.size > 0){
      // get liked reels' authors & hashtags
      const { data: myLikes } = await supabase.from('reel_likes').select('reel_id').eq('user_id', userId)
      const likedIds = (myLikes as any[]||[]).map(l=>l.reel_id)
      if(likedIds.length){
        const { data: likedReels } = await supabase.from('reels').select('user_id,hashtags').in('id', likedIds)
        const authors = [...new Set((likedReels as any[]||[]).map(r=>r.user_id))]
        const tags = [...new Set((likedReels as any[]||[]).flatMap(r=> (r.hashtags||'').split(' ').filter(Boolean)))]

        // 1) same authors - random order
        const { data: byAuthor } = await supabase.from('reels')
          .select('id,user_id,video_url,caption,hashtags,likes_count,comments_count,created_at')
          .eq('is_published', true)
          .in('user_id', authors)
          .not('id', 'in', `(${likedIds.join(',')})`)
          .order('created_at',{ascending:false})  // fallback order
          .limit(Math.ceil(PAGE*0.6))
        // 2) similar hashtags - random order
        const { data: byTag } = await supabase.from('reels')
          .select('id,user_id,video_url,caption,hashtags,likes_count,comments_count,created_at')
          .eq('is_published', true)
          .not('id', 'in', `(${likedIds.join(',')})`)
          .or(tags.map(t=>`hashtags.ilike.%${t}%`).join(','))
          .order('created_at',{ascending:false})
          .limit(Math.ceil(PAGE*0.4))
        // 3) pure random pool (exclude liked)
        const { data: randomPool } = await supabase.from('reels')
          .select('id,user_id,video_url,caption,hashtags,likes_count,comments_count,created_at')
          .eq('is_published', true)
          .not('id', 'in', `(${likedIds.join(',')})`)
          .order('created_at',{ascending:false})
          .limit(100)

        const all = [...((byAuthor as any[])||[]), ...((byTag as any[])||[]), ...((randomPool as any[])||[])]
        // dedupe + shuffle
        const seen = new Set<string>()
        rows = all.filter(r=>{ if(seen.has(r.id)) return false; seen.add(r.id); return true })
        rows = rows.sort(()=> Math.random()-0.5).slice(0, PAGE)
      }
    }
    // no likes or no rows -> pure random
    if(!rows.length){
      const { data } = await supabase.from('reels')
        .select('id,user_id,video_url,caption,hashtags,likes_count,comments_count,created_at')
        .eq('is_published', true)
        .order('created_at',{ascending:false})
        .limit(100)
      rows = ((data as any as Reel[])||[]).sort(()=> Math.random()-0.5).slice(off, off+PAGE)
    }

    if(rows.length && !reset && offsetRef.current===0 && seedRef.current===0){
      rows = rows.sort(()=> Math.random()-0.5)
      seedRef.current = 1
    }

    rows = await enrichUsernames(rows)
    if(reset){
      setReels(rows)
      offsetRef.current = rows.length
      setHasMore(rows.length===PAGE)
      const c:Record<string,number>={}; rows.forEach(r=> c[r.id]=Number(r.likes_count)||0)
      setCounts(c)
      setActive(0)
      setLoading(false)
    } else {
      if(!rows.length) setHasMore(false)
      else {
        setReels(prev=> { const seen=new Set(prev.map(p=>p.id)); const add=rows.filter(r=>!seen.has(r.id)); return [...prev, ...add] })
        offsetRef.current += rows.length
        if(rows.length < PAGE) setHasMore(false)
        setCounts(prev=>{ const n={...prev}; rows.forEach(r=>{ if(n[r.id]==null) n[r.id]=Number(r.likes_count)||0 }); return n })
      }
      setLoadingMore(false)
    }
  },[userId])

  const fetchLikes = useCallback(async()=>{
    if(!userId){ setLiked(new Set()); return }
    const { data } = await supabase.from('reel_likes').select('reel_id').eq('user_id', userId)
    setLiked(new Set(((data as any[])||[]).map((r:any)=>r.reel_id)))
  },[userId])

  // admin: load all reels for management
  const fetchMgmt = useCallback(async()=>{
    if(!isAdmin) return
    setMgmtLoading(true)
    const { data } = await supabase.from('reels')
      .select('id,user_id,video_url,caption,hashtags,likes_count,comments_count,created_at,is_published')
      .order('created_at',{ascending:false})
      .limit(200)
    let rows = (data as any as Reel[])||[]
    rows = await enrichUsernames(rows)
    setMgmtReels(rows)
    setMgmtLoading(false)
  },[isAdmin])

  useEffect(()=>{ fetchPage(true) },[fetchPage])
  useEffect(()=>{ fetchLikes() },[fetchLikes])
  useEffect(()=>{ if(isAdmin) fetchMgmt() },[isAdmin, fetchMgmt])

  // infinite: near-bottom observer
  useEffect(()=>{
    const root=scrollerRef.current; if(!root || !hasMore) return
    const sentinel=root.querySelector('[data-sentinel]') as HTMLElement|null
    if(!sentinel) return
    const io=new IntersectionObserver((entries)=>{
      if(entries[0]?.isIntersecting && !loadingMore && !loading) fetchPage(false)
    },{ root, rootMargin:'600px' })
    io.observe(sentinel)
    return ()=> io.disconnect()
  },[reels, hasMore, loadingMore, loading, fetchPage])

  // active detection + autoplay
  useEffect(()=>{
    if(!reels.length) return
    const root=scrollerRef.current; if(!root) return
    const els=[...root.querySelectorAll('[data-reel]')] as HTMLElement[]
    const io=new IntersectionObserver((entries)=>{
      let best:IntersectionObserverEntry|null=null
      for(const e of entries) if(e.isIntersecting) if(!best || e.intersectionRatio > best.intersectionRatio) best=e
      if(best) setActive(Number((best.target as HTMLElement).dataset.idx||0))
    },{ root, threshold:[0.5,0.75,0.9] })
    els.forEach(el=> io.observe(el))
    return ()=> io.disconnect()
  },[reels])

  useEffect(()=>{
    videoRefs.current.forEach((vid,id)=>{
      const idx=reels.findIndex(r=> r.id===id)
      if(idx===active){ vid.muted=muted; const p=vid.play(); if(p) p.catch(()=>{}) }
      else vid.pause()
    })
  },[active, muted, reels])

  const shouldLoad=(idx:number)=> Math.abs(idx-active) <= 2

  const toggleLike=async(reelId:string)=>{
    if(!userId){ navigate('/auth'); return }
    if(busyLike) return
    setBusyLike(reelId)
    const was=liked.has(reelId)
    const nxt=new Set(liked); if(was) nxt.delete(reelId); else nxt.add(reelId); setLiked(nxt)
    setCounts(c=> ({...c, [reelId]: Math.max(0,(c[reelId]??0)+(was?-1:1))}))
    if(!was){ setBurst(reelId); setTimeout(()=> setBurst(b=> b===reelId?null:b), 700) }
    try{
      const { data, error } = await (supabase as any).rpc('toggle_reel_like',{ p_reel_id: reelId })
      if(error) throw error
      if(data){ const cnt=Number((data as any).likes_count ?? data); if(!isNaN(cnt)) setCounts(c=> ({...c,[reelId]:cnt})); const l=(data as any).liked; if(typeof l==='boolean') setLiked(s=>{ const n=new Set(s); if(l) n.add(reelId); else n.delete(reelId); return n }) }
    } catch{
      setLiked(s=>{ const n=new Set(s); if(was) n.add(reelId); else n.delete(reelId); return n })
      setCounts(c=> ({...c,[reelId]: Math.max(0,(c[reelId]??0)+(was?1:-1))}))
    } finally{ setBusyLike(null) }
    // after like change, just refresh liked set for next fetchPage call
    if(!was){ seedRef.current = 0 }
  }

  const openComments=async(reelId:string)=>{
    setCmOpen(reelId); setCmLoading(true); setComments([])
    const { data } = await supabase.from('reel_comments').select('id,body,created_at,user_id').eq('reel_id', reelId).order('created_at',{ascending:false}).limit(50)
    let rows=(data as any as CommentRow[])||[]
    if(rows.length){
      const ids=[...new Set(rows.map(r=>r.user_id))]
      const { data: profs } = await supabase.from('profiles').select('id,username').in('id', ids)
      const m=new Map((profs as any[]||[]).map((p:any)=>[p.id,p.username]))
      rows=rows.map(r=> ({...r, username:(m.get(r.user_id) as string)||'کاربر'}))
    }
    setComments(rows); setCmLoading(false)
  }
  const postComment=async()=>{
    if(!cmOpen || !cmText.trim() || !userId) return
    const body=cmText.trim().slice(0,500)
    setCmText('')
    const tmp:CommentRow={ id:'tmp-'+Date.now(), body, created_at:new Date().toISOString(), user_id:userId, username:'شما' }
    setComments(c=> [tmp, ...c])
    const { data, error } = await supabase.from('reel_comments').insert({ reel_id: cmOpen, user_id: userId, body } as any).select('id,body,created_at,user_id').single()
    if(error){ setComments(c=> c.filter(x=> x.id!==tmp.id)); alert('خطا: '+error.message); return }
    if(data) setComments(c=> [ {...(data as any), username: tmp.username }, ...c.filter(x=> x.id!==tmp.id)])
    setReels(rs=> rs.map(r=> r.id===cmOpen ? {...r, comments_count:(r.comments_count||0)+1}:r))
  }
  const share=async(reelId:string)=>{
    const url=location.origin+'/reels#'+reelId
    try{ if((navigator as any).share) await (navigator as any).share({title:'Reel',url}); else { await navigator.clipboard.writeText(url); alert('لینک کپی شد') } } catch{}
  }

  const uploadFileToStorage = (f: File, onPct:(p:number)=>void): Promise<string>=>{
    return new Promise((resolve,reject)=>{
      const ext=(f.name.split('.').pop()||'mp4').toLowerCase()
      const path=`${Date.now()}-${Math.random().toString(36).slice(2,7)}.${ext}`
      let pct=0
      const tick=setInterval(()=>{ pct=Math.min(92, pct+ Math.random()*14+4); onPct(Math.round(pct)) }, 280)
      supabase.storage.from('reels').upload(path, f, { cacheControl:'3600', upsert:false, contentType: f.type||'video/mp4' }).then(async ({ error })=>{
        clearInterval(tick)
        if(error){ onPct(0); reject(new Error(error.message)); return }
        onPct(100)
        const { data } = supabase.storage.from('reels').getPublicUrl(path)
        resolve(data.publicUrl)
      }).catch(e=>{ clearInterval(tick); reject(e) })
    })
  }

  const handleAdd=async()=>{
    if(!userId) return
    let videoUrl=newUrl.trim()
    if(file){
      if(file.size > 90*1024*1024) return alert('حجم ویدیو حداکثر ۹۰MB')
      if(!file.type.startsWith('video/')) return alert('فقط فایل ویدیویی')
      setSaving(true); setUpPct(0)
      try{ videoUrl = await uploadFileToStorage(file, p=> setUpPct(p)) }
      catch(e:any){ setSaving(false); setUpPct(null); alert('آپلود ناموفق: '+(e?.message||e)); return }
    } else { if(!videoUrl) return alert('آدرس ویدیو یا فایل را انتخاب کن') }
    setSaving(true)
    const { error } = await supabase.from('reels').insert({ user_id:userId, video_url: videoUrl, caption: newCap.trim(), hashtags: newTags.trim() } as any)
    setSaving(false); setUpPct(null)
    if(error){ alert(error.message); return }
    setAddOpen(false); setNewUrl(''); setNewCap(''); setNewTags(''); setFile(null)
    fetchPage(true); fetchMgmt()
  }

  const delReel=async(id:string)=>{ if(!confirm('حذف شود؟')) return; const { error } = await supabase.from('reels').delete().eq('id', id); if(error) alert(error.message); else { setReels(r=> r.filter(x=> x.id!==id)); fetchMgmt() } }

  const mgmtDelete=async(id:string)=>{ if(!confirm('حذف از دیتابیس؟')) return; setMgmtDel(id); const { error } = await supabase.from('reels').delete().eq('id', id); setMgmtDel(null); if(error) alert(error.message); else { setMgmtReels(r=> r.filter(x=> x.id!==id)); fetchPage(true) } }

  const mgmtTogglePub=async(r:Reel)=>{
    const { error } = await supabase.from('reels').update({ is_published: !r.is_published }).eq('id', r.id)
    if(error) alert(error.message); else { setMgmtReels(rs=> rs.map(x=> x.id===r.id ? {...x, is_published: !x.is_published}:x)); fetchPage(true) }
  }

  if(loading) return <div style={{minHeight:'80dvh',display:'grid',placeItems:'center',color:'var(--muted)'}}>در حال بارگذاری…</div>
  if(!reels.length) return (
    <div style={{minHeight:'80dvh',display:'grid',placeItems:'center',textAlign:'center',padding:24}}>
      <div>
        <div style={{fontSize:42,marginBottom:8}}>🎬</div>
        <div style={{fontWeight:900}}>هنوز ریلزی نیست</div>
        <p style={{color:'var(--muted)',fontSize:13,marginTop:6}}>اولین ریلز را اضافه کن تا فید شروع شود.</p>
        {isAdmin && <button className="btn btn-primary" style={{marginTop:14}} onClick={()=>setAddOpen(true)}>＋ افزودن ریلز</button>}
        {!isAdmin && <Link to="/" className="btn btn-ghost" style={{marginTop:14}}>بازگشت</Link>}
      </div>
      {addOpen && (
        <div className="modal-overlay" onClick={()=> setAddOpen(false)} style={{position:'fixed',inset:0,zIndex:80,background:'rgba(5,8,18,.72)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div className="card" onClick={e=>e.stopPropagation()} style={{width:'min(520px,96vw)',padding:16,borderRadius:16}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}><b>افزودن ریلز</b><button className="btn btn-ghost btn-sm" onClick={()=> setAddOpen(false)}>✕</button></div>
            <div style={{display:'grid',gap:10}}>
              <div><label style={{fontSize:11,color:'var(--muted)'}}>فایل ویدیو (ترجیحاً) — تا ۹۰MB</label><input type="file" accept="video/*" onChange={e=> setFile(e.target.files?.[0]||null)} style={{width:'100%',fontSize:13}} /><div style={{fontSize:11,color:'var(--muted)',marginTop:4}}>{file ? `${file.name} — ${(file.size/1024/1024).toFixed(1)}MB` : 'یا آدرس مستقیم mp4 را زیر وارد کن'}</div></div>
              <div><label style={{fontSize:11,color:'var(--muted)'}}>آدرس ویدیو (https://...mp4)</label><input className="input" value={newUrl} onChange={e=>setNewUrl(e.target.value)} dir="ltr" placeholder="https://...mp4" /></div>
              <div><label style={{fontSize:11,color:'var(--muted)'}}>کپشن</label><input className="input" value={newCap} onChange={e=>setNewCap(e.target.value)} placeholder="کپشن کوتاه" /></div>
              <div><label style={{fontSize:11,color:'var(--muted)'}}>هشتگ‌ها</label><input className="input" value={newTags} onChange={e=>setNewTags(e.target.value)} placeholder="#گیم #gamenet" /></div>
              {upPct!=null && <div style={{height:6,borderRadius:999,background:'var(--surface2)',overflow:'hidden',border:'1px solid var(--line)'}}><div style={{height:'100%',width:`${upPct}%`,background:'var(--accent)',transition:'width .2s'}}/></div>}
              <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}><button className="btn btn-ghost" onClick={()=> setAddOpen(false)}>لغو</button><button className="btn btn-primary" onClick={handleAdd} disabled={saving || (!newUrl.trim() && !file)}>{saving?(upPct!=null?`${upPct}% در حال آپلود…`:'در حال ذخیره…'):'ذخیره'}</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="reels-root">
      <div className="reels-topbar">
        <Link to="/" className="reels-back" aria-label="بازگشت">‹</Link>
        <span className="reels-title">Reels</span>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <button className="reels-mute" title={fit==='cover'?'حالت کراپ — بزن برای نمایش کامل':'حالت فیت — بزن برای کراپ'} onClick={()=> setFit(f=> f==='cover' ? 'contain' : 'cover')} aria-label="fit">{fit==='cover' ? '⛶' : '◫'}</button>
          <button className="reels-mute" onClick={()=> setMuted(m=>!m)} aria-label={muted?'unmute':'mute'}>{muted ? '🔇' : '🔊'}</button>
          {isAdmin && (
            <>
              <button className="btn btn-primary btn-sm" onClick={()=>setAddOpen(true)} style={{borderRadius:999}}>＋</button>
              <button className="btn btn-ghost btn-sm" onClick={()=>{ setManageOpen(true); fetchMgmt() }} style={{borderRadius:999}}>⚙ مدیریت</button>
            </>
          )}
        </div>
      </div>

      <div ref={scrollerRef} className="reels-scroller">
        {reels.map((r, idx)=>(
          <section key={r.id} data-reel data-idx={idx} className="reel-item">
            <div className="reel-frame">
              {shouldLoad(idx) ? (
                <video
                  ref={el=> { if(el) videoRefs.current.set(r.id, el); else videoRefs.current.delete(r.id) }}
                  src={r.video_url}
                  playsInline
                  loop
                  muted={muted}
                  preload={idx===active ? 'auto' : 'metadata'}
                  poster=""
                  onClick={()=> { const v=videoRefs.current.get(r.id); if(v){ if(v.paused) v.play().catch(()=>{}); else v.pause() } }}
                  onDoubleClick={()=> toggleLike(r.id)}
                  className="reel-video"
                  style={{objectFit: fit as any, background:'#000'}}
                  onTimeUpdate={e=>{
                    if(idx!==active) return
                    const v=e.currentTarget
                    const p=v.duration ? (v.currentTime/v.duration)*100 : 0
                    progressRef.current = {...progressRef.current, [r.id]: p}
                    if(progressTimerRef.current) clearTimeout(progressTimerRef.current)
                    progressTimerRef.current = setTimeout(()=>{
                      setProgress(progressRef.current)
                    }, 300)
                  }}
                />
              ) : (
                <div className="reel-video" style={{display:'grid',placeItems:'center',background:'#0a0f1f',color:'var(--muted)',fontSize:12}}>⋯</div>
              )}
              <div className="reel-gradient" />
              <div style={{position:'absolute',left:0,right:0,top:0,height:2,background:'rgba(255,255,255,.14)',zIndex:3}}>
                <div style={{height:'100%',width:`${progress[r.id]??0}%`,background:'#fff',transition:'width .08s linear'}}/></div>
              <div className="reel-actions">
                <button className={`ra-btn ${liked.has(r.id)?'liked':''} ${burst===r.id?'burst':''}`} onClick={()=> toggleLike(r.id)} disabled={!!busyLike} aria-label="like">
                  <span className="ra-icon">{liked.has(r.id) ? '❤' : '♡'}</span>
                  <span className="ra-count">{(counts[r.id] ?? r.likes_count).toLocaleString('fa-IR')}</span>
                </button>
                <button className="ra-btn" onClick={()=> openComments(r.id)} aria-label="comment">
                  <span className="ra-icon">💬</span>
                  <span className="ra-count">{Number(r.comments_count||0).toLocaleString('fa-IR')}</span>
                </button>
                <button className="ra-btn" onClick={()=> share(r.id)} aria-label="share">
                  <span className="ra-icon">↗</span>
                  <span className="ra-count" style={{fontSize:10}}>اشتراک</span>
                </button>
                {isAdmin && <button className="ra-btn" onClick={()=> delReel(r.id)} aria-label="delete" style={{opacity:.7}}>🗑</button>}
              </div>
              <div className="reel-bottom">
                <div className="reel-user">@{r.username || 'gamenet'} {isAdmin && <span style={{opacity:.6,fontSize:11}}>· {new Date(r.created_at).toLocaleDateString('fa-IR')}</span>}</div>
                {r.caption && <div className="reel-caption">{r.caption}</div>}
                {r.hashtags && <div className="reel-tags">{r.hashtags}</div>}
              </div>
              <button className="reel-tap-mute" onClick={()=> setMuted(m=>!m)} aria-label="mute">{muted ? '🔇' : '🔊'}</button>
              <button onClick={()=> setFit(f=> f==='cover' ? 'contain' : 'cover')} title={fit==='cover'?'نمایش کامل':'پر کردن قاب'} style={{position:'absolute',top:60,left:12,zIndex:2,height:34,padding:'0 10px',borderRadius:999,display:'grid',placeItems:'center',background:'rgba(0,0,0,.38)',border:'1px solid rgba(255,255,255,.14)',color:'#fff',fontSize:12,backdropFilter:'blur(8px)',cursor:'pointer'}}>{fit==='cover' ? '⛶ فیت' : '◫ کراپ'}</button>
            </div>
          </section>
        ))}
        <div data-sentinel style={{height:1}} />
        {loadingMore && <div style={{padding:'14px 0',textAlign:'center',color:'rgba(255,255,255,.7)',fontSize:12,position:'sticky',bottom:0,zIndex:10,background:'linear-gradient(to top, #080d1c 60%, transparent)'}}>در حال بارگذاری…</div>}
        {!hasMore && reels.length>=PAGE && <div style={{padding:'12px 0',textAlign:'center',color:'rgba(255,255,255,.45)',fontSize:11,position:'sticky',bottom:0,zIndex:10,background:'linear-gradient(to top, #080d1c 60%, transparent)'}}>پایان ریلز</div>}
      </div>

      {cmOpen && (
        <div className="reels-sheet-overlay" onClick={()=> setCmOpen(null)}>
          <div className="reels-sheet" onClick={e=>e.stopPropagation()}>
            <div className="sheet-head"><b>نظرات</b><button className="btn btn-ghost btn-sm" onClick={()=> setCmOpen(null)}>✕</button></div>
            <div className="sheet-list">
              {cmLoading ? <div style={{padding:16,color:'var(--muted)',fontSize:12}}>در حال بارگذاری…</div> : comments.length===0 ? <div style={{padding:16,color:'var(--muted)',fontSize:12,textAlign:'center'}}>هنوز نظری نیست — اولین نظر را تو بنویس</div> : comments.map(c=>(
                <div key={c.id} style={{padding:'10px 14px',display:'flex',gap:8,alignItems:'flex-start',borderBottom:'1px solid var(--line)'}}>
                  <span style={{width:28,height:28,borderRadius:999,background:'var(--surface2)',display:'grid',placeItems:'center',fontSize:11,fontWeight:800,flexShrink:0}}>{(c.username||'ک')[0]}</span>
                  <div style={{minWidth:0}}><div style={{fontSize:12,fontWeight:800}}>{c.username||'کاربر'}</div><div style={{fontSize:13,lineHeight:1.6,wordBreak:'break-word'}}>{c.body}</div><div style={{fontSize:10,color:'var(--muted)',marginTop:2}}>{new Date(c.created_at).toLocaleString('fa-IR')}</div></div>
                </div>
              ))}
            </div>
            <div className="sheet-input"><input className="input" value={cmText} onChange={e=>setCmText(e.target.value)} placeholder={userId?'نظر بنویس…':'برای نظر دادن وارد شو'} onKeyDown={e=>{ if(e.key==='Enter') postComment() }} disabled={!userId} /><button className="btn btn-primary btn-sm" onClick={postComment} disabled={!cmText.trim() || !userId}>ارسال</button></div>
            {!userId && <div style={{padding:'0 14px 10px',fontSize:11,color:'var(--muted)'}}><Link to="/auth" style={{color:'var(--accent)',fontWeight:800}}>ورود</Link> برای ارسال نظر</div>}
          </div>
        </div>
      )}

      {addOpen && (
        <div className="modal-overlay" onClick={()=> setAddOpen(false)} style={{position:'fixed',inset:0,zIndex:80,background:'rgba(5,8,18,.72)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div className="card" onClick={e=>e.stopPropagation()} style={{width:'min(520px,96vw)',padding:16,borderRadius:16}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}><b>افزودن ریلز</b><button className="btn btn-ghost btn-sm" onClick={()=> setAddOpen(false)}>✕</button></div>
            <div style={{display:'grid',gap:10}}>
              <div><label style={{fontSize:11,color:'var(--muted)'}}>فایل ویدیو (ترجیحاً) — تا ۹۰MB، mp4/webm</label><input type="file" accept="video/*" onChange={e=> setFile(e.target.files?.[0]||null)} style={{width:'100%',fontSize:13}} /><div style={{fontSize:11,color:'var(--muted)',marginTop:4}}>{file ? `${file.name} — ${(file.size/1024/1024).toFixed(1)}MB` : 'یا آدرس مستقیم mp4 را زیر وارد کن'}</div></div>
              <div><label style={{fontSize:11,color:'var(--muted)'}}>آدرس ویدیو (https://...mp4)</label><input className="input" value={newUrl} onChange={e=>setNewUrl(e.target.value)} dir="ltr" placeholder="https://...mp4" /></div>
              <div><label style={{fontSize:11,color:'var(--muted)'}}>کپشن</label><input className="input" value={newCap} onChange={e=>setNewCap(e.target.value)} placeholder="کپشن کوتاه" /></div>
              <div><label style={{fontSize:11,color:'var(--muted)'}}>هشتگ‌ها</label><input className="input" value={newTags} onChange={e=>setNewTags(e.target.value)} placeholder="#گیم #gamenet" /></div>
              {upPct!=null && <div style={{height:6,borderRadius:999,background:'var(--surface2)',overflow:'hidden',border:'1px solid var(--line)'}}><div style={{height:'100%',width:`${upPct}%`,background:'var(--accent)',transition:'width .2s'}}/></div>}
              <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}><button className="btn btn-ghost" onClick={()=> setAddOpen(false)}>لغو</button><button className="btn btn-primary" onClick={handleAdd} disabled={saving || (!newUrl.trim() && !file)}>{saving?(upPct!=null?`${upPct}% در حال آپلود…`:'در حال ذخیره…'):'ذخیره'}</button></div>
              <p style={{fontSize:11,color:'var(--muted)',lineHeight:1.6,margin:0}}>ویدیو به باکت <code>reels</code> آپلود و URL عمومی ذخیره می‌شود. ۹:۱۶، ۷۲۰p H.264 پیشنهاد می‌شود.</p>
            </div>
          </div>
        </div>
      )}

      {/* Admin Manage Modal — only in /reels */}
      {manageOpen && isAdmin && (
        <div className="modal-overlay" onClick={()=> setManageOpen(false)} style={{position:'fixed',inset:0,zIndex:90,background:'rgba(5,8,18,.8)',backdropFilter:'blur(10px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div className="card" onClick={e=>e.stopPropagation()} style={{width:'min(720px,96vw)',maxHeight:'85vh',padding:16,borderRadius:16,display:'flex',flexDirection:'column'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,borderBottom:'1px solid var(--line)',paddingBottom:10}}>
              <b>⚙ مدیریت ریلزها</b>
              <button className="btn btn-ghost btn-sm" onClick={()=> setManageOpen(false)}>✕</button>
            </div>
            <div style={{overflow:'auto',flex:1}}>
              {mgmtLoading ? <div style={{padding:16,color:'var(--muted)',textAlign:'center'}}>بارگذاری…</div> : (
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead><tr style={{borderBottom:'1px solid var(--line)',color:'var(--muted)'}}><th style={{padding:8,textAlign:'right'}}>پیش‌نمایش</th><th style={{padding:8,textAlign:'right'}}>نویسنده</th><th style={{padding:8,textAlign:'right'}}>کپشن</th><th style={{padding:8,textAlign:'right'}}>لایک/کامنت</th><th style={{padding:8,textAlign:'right'}}>وضعیت</th><th style={{padding:8,textAlign:'right'}}>عملیات</th></tr></thead>
                  <tbody>
                    {mgmtReels.map(r=>(
                      <tr key={r.id} style={{borderBottom:'1px solid var(--line)'}}>
                        <td style={{padding:8}}><video src={r.video_url} style={{width:80,height:80,objectFit:'cover',borderRadius:8}} muted playsInline/></td>
                        <td style={{padding:8}}>@{r.username||'gamenet'}</td>
                        <td style={{padding:8,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.caption||''}</td>
                        <td style={{padding:8}}>❤ {r.likes_count} · 💬 {r.comments_count}</td>
                        <td style={{padding:8}}><span style={{padding:'2px 8px',borderRadius:999,fontSize:10,background:r.is_published?'rgba(34,197,94,.2)':'rgba(244,63,94,.2)',color:r.is_published?'#22c55e':'#f43f5e',border:`1px solid ${r.is_published?'#22c55e':'#f43f5e'}`}}>{r.is_published?'منتشر':'مخفی'}</span></td>
                        <td style={{padding:8,display:'flex',gap:6,justifyContent:'flex-end'}}>
                          <button className="btn btn-ghost btn-sm" onClick={()=> mgmtTogglePub(r)} disabled={mgmtDel===r.id} style={{padding:'4px 8px'}}>{r.is_published?'مخفی':'انتشار'}</button>
                          <button className="btn btn-ghost btn-sm" onClick={()=> mgmtDelete(r.id)} disabled={mgmtDel===r.id} style={{padding:'4px 8px',color:'#f43f5e',borderColor:'#f43f5e'}}>🗑 حذف</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
