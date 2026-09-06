import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, type Profile } from '../lib/supabase'

type Ctx = {
  userId: string | null
  email: string | null
  profile: Profile | null
  loading: boolean
  isAdmin: boolean
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}
const AuthCtx = createContext<Ctx>({ userId: null, email: null, profile: null, loading: true, isAdmin: false, refresh: async()=>{}, signOut: async()=>{} })

export const AuthProvider: React.FC<{children:React.ReactNode}> = ({children})=>{
  const [userId,setUserId]=useState<string|null>(null)
  const [email,setEmail]=useState<string|null>(null)
  const [profile,setProfile]=useState<Profile|null>(null)
  const [isAdmin,setIsAdmin]=useState(false)
  const [loading,setLoading]=useState(true)

  const load = async()=>{
    setLoading(true)
    const { data:{ session } } = await supabase.auth.getSession()
    const uid = session?.user?.id ?? null
    setUserId(uid); setEmail(session?.user?.email ?? null)
    if(uid){
      const { data, error } = await supabase.from('profiles').select('*').eq('id',uid).single()
      if(error) console.warn('[profiles]', error.message)
      setProfile(data as Profile ?? null)
      // ponytail: RPC is source of truth — profile cache can be stale after manual SQL update
      const { data: adm } = await supabase.rpc('is_admin')
      setIsAdmin(!!adm || !!(data as any)?.is_admin)
    } else { setProfile(null); setIsAdmin(false) }
    setLoading(false)
  }
  useEffect(()=>{
    load()
    const { data:sub } = supabase.auth.onAuthStateChange(()=>load())
    // re-fetch on focus — fixes "made admin in SQL but still not admin" without logout
    const onFocus = ()=> load()
    window.addEventListener('focus', onFocus)
    const onVis = ()=> { if(document.visibilityState==='visible') load() }
    document.addEventListener('visibilitychange', onVis)
    return ()=>{ sub.subscription.unsubscribe(); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onVis) }
  },[])

  const signOut = async()=>{ await supabase.auth.signOut(); setProfile(null); setUserId(null); setIsAdmin(false) }

  return <AuthCtx.Provider value={{ userId, email, profile, loading, isAdmin, refresh: load, signOut }}>{children}</AuthCtx.Provider>
}
export const useAuth = ()=> useContext(AuthCtx)
