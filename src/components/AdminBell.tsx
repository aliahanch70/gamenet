import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function AdminBell(){
  const { isAdmin } = useAuth() as any
  const [count,setCount]=useState(0)
  useEffect(()=>{
    if(!isAdmin) return
    let ch:any = null
    let alive = true
    const load = async()=>{
      try{
        const { count: c } = await supabase.from('withdrawals').select('*',{count:'exact',head:true}).eq('status','pending')
        if(alive) setCount(c||0)
      }catch{ if(alive) setCount(0) }
    }
    // request permission once
    try{ if('Notification' in window && Notification.permission==='default') Notification.requestPermission() }catch{}
    const ping = ()=>{ try{ const a=new (window as any).Audio(); a.src='data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQigAAA=='; a.volume=.35; a.play() }catch{} }
    const handleInsert=(payload:any)=>{ const r=payload?.new; if(payload?.eventType==='INSERT' && r?.status==='pending'){ load(); ping(); try{ if(Notification.permission==='granted') new Notification('برداشت جدید',{body: Number(r.amount||0).toLocaleString('fa-IR')+' ت'}) }catch{} return } load() }
    load()
    try{
      ch = (supabase as any).channel('wd-bell').on('postgres_changes',{event:'INSERT',schema:'public',table:'withdrawals'},handleInsert).on('postgres_changes',{event:'UPDATE',schema:'public',table:'withdrawals'},load).on('postgres_changes',{event:'DELETE',schema:'public',table:'withdrawals'},load).subscribe()
    }catch{}
    const t = setInterval(load, 15000)
    return ()=>{ alive=false; clearInterval(t); try{ if(ch) (supabase as any).removeChannel(ch) }catch{} }
  },[isAdmin])
  if(!isAdmin || count===0) return null
  return <span style={{background:'#ff3b5e',color:'#fff',fontSize:10,fontWeight:900,padding:'2px 6px',borderRadius:999,minWidth:18,textAlign:'center',lineHeight:1.4,boxShadow:'0 0 0 2px rgba(255,59,94,.35)'}}>{count>99?'99+':count}</span>
}
