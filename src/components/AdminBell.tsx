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
    load()
    try{
      ch = (supabase as any).channel('wd-bell').on('postgres_changes',{event:'*',schema:'public',table:'withdrawals'},load).subscribe()
    }catch{}
    const t = setInterval(load, 15000)
    return ()=>{ alive=false; clearInterval(t); try{ if(ch) (supabase as any).removeChannel(ch) }catch{} }
  },[isAdmin])
  if(!isAdmin || count===0) return null
  return <span style={{background:'#ff3b5e',color:'#fff',fontSize:10,fontWeight:900,padding:'2px 6px',borderRadius:999,minWidth:18,textAlign:'center',lineHeight:1.4}}>{count>99?'99+':count}</span>
}
