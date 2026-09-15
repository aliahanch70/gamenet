import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase, type Profile } from '../lib/supabase'

const PROFILE_COLS = 'id,username,display_name,email,phone,is_admin,balance,created_at'

type Ctx = {
  userId: string | null
  email: string | null
  profile: Profile | null
  loading: boolean
  isAdmin: boolean
  refresh: () => Promise<void>
  signOut: () => Promise<void>
  updateBalance: (delta:number)=>void
  patchProfile: (patch: Partial<Profile>)=>void
}
const AuthCtx = createContext<Ctx>({ userId: null, email: null, profile: null, loading: true, isAdmin: false, refresh: async()=>{}, signOut: async()=>{}, updateBalance: ()=>{}, patchProfile: ()=>{} })

export const AuthProvider: React.FC<{children:React.ReactNode}> = ({children})=>{
  const [userId,setUserId]=useState<string|null>(null)
  const [email,setEmail]=useState<string|null>(null)
  const [profile,setProfile]=useState<Profile|null>(null)
  const [isAdmin,setIsAdmin]=useState(false)
  const [loading,setLoading]=useState(true)
  const pendingRef = useRef<Promise<void>|null>(null)

  const load = async(silent=false): Promise<void>=>{
    if(pendingRef.current) return pendingRef.current
    const p = (async()=>{
      if(!silent) setLoading(true)
      const { data:{ session } } = await supabase.auth.getSession()
      const uid = session?.user?.id ?? null
      setUserId(uid); setEmail(session?.user?.email ?? null)
      if(uid){
        const { data, error } = await supabase.from('profiles').select(PROFILE_COLS).eq('id',uid).single()
        if(error) console.warn('[profiles]', error.message)
        setProfile(data as Profile ?? null)
        if((data as any)?.is_admin){
          setIsAdmin(true)
        } else {
          const { data: adm } = await supabase.rpc('is_admin')
          setIsAdmin(!!adm)
        }
      } else { setProfile(null); setIsAdmin(false) }
      if(!silent) setLoading(false)
    })()
    pendingRef.current = p
    try { await p } finally { pendingRef.current = null }
  }
  const updateBalance = (delta:number)=> setProfile(p=> p ? { ...p, balance: (Number(p.balance)||0)+delta } as Profile : p)
  const patchProfile = (patch: Partial<Profile>)=> setProfile(p=> p ? { ...p, ...patch } as Profile : p)

  useEffect(()=>{
    load()
    let timer: number | undefined
    const { data:sub } = supabase.auth.onAuthStateChange((event)=>{
      if(event==='INITIAL_SESSION') return
      if(timer) window.clearTimeout(timer)
      timer = window.setTimeout(()=>{ load(true) }, 80) as unknown as number
    })
    return ()=>{ sub.subscription.unsubscribe(); if(timer) window.clearTimeout(timer) }
  },[])

  const signOut = async()=>{ await supabase.auth.signOut(); setProfile(null); setUserId(null); setIsAdmin(false) }

  return <AuthCtx.Provider value={{ userId, email, profile, loading, isAdmin, refresh: load, signOut, updateBalance, patchProfile }}>{children}</AuthCtx.Provider>
}
export const useAuth = ()=> useContext(AuthCtx)
