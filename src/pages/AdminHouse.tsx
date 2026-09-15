import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, type Match } from '../lib/supabase'

export default function AdminHouse(){
  const [matches,setMatches]=useState<Match[]>([])
  const [house,setHouse]=useState<{byMatch:Record<string,{total:number,paid:number,profit:number,count:number}>, totalProfit:number, totalStakes:number, totalPaid:number}>({byMatch:{},totalProfit:0,totalStakes:0,totalPaid:0})

  useEffect(()=>{
    (async()=>{
      const { data:ms } = await supabase.from('matches').select('id,title,team_a,team_b,status,winner,starts_at').order('starts_at',{ascending:false})
      setMatches((ms as Match[])||[])
      const { data: settled } = await supabase.from('bets').select('match_id,amount,potential_payout,status').in('status',['won','lost'])
      const by: Record<string,{total:number,paid:number,profit:number,count:number}> = {}
      let ts=0, td=0
      for(const b of (settled as any[]||[])){
        const mid=b.match_id as string
        if(!by[mid]) by[mid]={total:0,paid:0,profit:0,count:0}
        by[mid].total+=Number(b.amount); by[mid].count+=1
        if(b.status==='won') by[mid].paid+=Number(b.potential_payout)
        ts+=Number(b.amount); if(b.status==='won') td+=Number(b.potential_payout)
      }
      for(const k of Object.keys(by)) by[k].profit = by[k].total - by[k].paid
      setHouse({byMatch:by,totalProfit: ts-td, totalStakes: ts, totalPaid: td})
    })()
  },[])

  const finished = matches.filter(m=> m.status==='finished' && house.byMatch[m.id])

  return (
    <div className="container" style={{padding:'20px 14px 28px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <h2 style={{fontWeight:900,fontSize:22}}>سود خانه — همه مسابقات</h2>
        <Link to="/admin" className="btn btn-ghost btn-sm">← بازگشت به پنل</Link>
      </div>
      <div className="card" style={{marginTop:14,padding:14,background: house.totalProfit>=0?'linear-gradient(135deg,#0f2a22,#162040)':'linear-gradient(135deg,#2a0f1a,#1e1430)',borderColor: house.totalProfit>=0?'rgba(0,229,160,.25)':'rgba(255,60,90,.25)'}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
          <div style={{background:'rgba(255,255,255,.06)',border:'1px solid var(--line)',borderRadius:12,padding:'12px 10px',textAlign:'center'}}>
            <div style={{fontSize:10,color:'var(--muted)'}}>کل شرط‌ها</div><div style={{fontWeight:900,fontSize:13,marginTop:4}}>{house.totalStakes.toLocaleString('fa-IR')} ت</div><div style={{fontSize:10,color:'var(--muted)',marginTop:2}}>{Object.values(house.byMatch).reduce((s,v)=>s+v.count,0).toLocaleString('fa-IR')} شرط</div>
          </div>
          <div style={{background:'rgba(255,255,255,.06)',border:'1px solid var(--line)',borderRadius:12,padding:'12px 10px',textAlign:'center'}}>
            <div style={{fontSize:10,color:'var(--muted)'}}>پرداختی</div><div style={{fontWeight:900,fontSize:13,marginTop:4}}>{house.totalPaid.toLocaleString('fa-IR')} ت</div>
          </div>
          <div style={{background: house.totalProfit>=0?'rgba(0,229,160,.10)':'rgba(255,60,90,.10)',border:`1px solid ${house.totalProfit>=0?'rgba(0,229,160,.3)':'rgba(255,60,90,.3)'}`,borderRadius:12,padding:'12px 10px',textAlign:'center'}}>
            <div style={{fontSize:10,color: house.totalProfit>=0?'var(--accent)':'#ff6b7a',fontWeight:700}}>سود خالص</div><div style={{fontWeight:900,fontSize:16,marginTop:4,color: house.totalProfit>=0?'var(--accent)':'#ff6b7a'}}>{house.totalProfit>=0?'+':''}{house.totalProfit.toLocaleString('fa-IR')} ت</div>
          </div>
        </div>
      </div>

      <div style={{display:'grid',gap:8,marginTop:14}}>
        {finished.length===0 ? <div className="card" style={{padding:'18px 14px',textAlign:'center',color:'var(--muted)',fontSize:13}}>مسابقه‌ی تمام‌شده‌ای نیست.</div> :
          finished.map(m=>{
            const h = house.byMatch[m.id]
            return (
              <div key={m.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,background:'rgba(255,255,255,.05)',border:'1px solid var(--line)',borderRadius:10,padding:'10px 12px',flexWrap:'wrap'}}>
                <div style={{minWidth:0}}><div style={{fontWeight:800,fontSize:12,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{m.title}</div><div style={{fontSize:11,color:'var(--muted)'}}>{m.team_a} vs {m.team_b} · 🏆 {m.winner==='team_a'?m.team_a:m.winner==='team_b'?m.team_b:'مساوی'} · {h.count} شرط · {new Date(m.starts_at).toLocaleString('fa-IR')}</div></div>
                <div style={{textAlign:'left',flexShrink:0}}><div style={{fontSize:10,color:'var(--muted)'}}>سود این مسابقه</div><div style={{fontWeight:900,fontSize:13,color: h.profit>=0?'var(--accent)':'#ff6b7a'}}>{h.profit>=0?'+':''}{h.profit.toLocaleString('fa-IR')} ت</div><div style={{fontSize:10,color:'var(--muted)'}}>{h.total.toLocaleString('fa-IR')} دریافت · {h.paid.toLocaleString('fa-IR')} پرداخت</div></div>
              </div>
            )
          })
        }
      </div>
    </div>
  )
}
