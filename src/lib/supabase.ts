import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anon) console.warn('[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing — check .env')

export const supabase = createClient(url, anon, {
  auth: { persistSession: true, autoRefreshToken: true },
})

// انواع
export type Profile = { id:string; username:string|null; display_name:string|null; is_admin:boolean; balance:number; created_at:string }
export type Match = {
  id:string; title:string; game:string; team_a:string; team_b:string;
  status:'upcoming'|'live'|'finished'; odds_a:number; odds_b:number; odds_draw:number|null;
  odds_mode:'manual'|'auto'; margin:number;
  winner:'team_a'|'team_b'|'draw'|null; starts_at:string; created_at:string
}
export type Bet = {
  id:string; user_id:string; match_id:string; pick:'team_a'|'team_b'|'draw';
  amount:number; odds:number; potential_payout:number; status:'pending'|'won'|'lost'|'refunded'; created_at:string;
  matches?: Match
}
export type Withdrawal = { id:string; user_id:string; amount:number; account:string; status:'pending'|'approved'|'rejected'; note:string|null; created_at:string; decided_at:string|null }
export type Notification = { id:string; user_id:string; title:string; body:string|null; link:string|null; is_read:boolean; created_at:string }
