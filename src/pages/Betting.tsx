import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, type Match, type Bet } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const STAKE_MIN = 10000
const STAKE_MAX = 500000
const CHIPS = [10000, 50000, 100000, 250000, 500000] as const
const STEP = 10000

const FALLBACK_ICONS: Record<string, string> = {
  'FC 25': '⚽',
  'FC 24': '⚽',
  'FIFA': '⚽',
  'eFootball': '🎮',
  'PES': '🎮',
  'Dota 2': '🐉',
  'CS2': '🔫',
  'CS:GO': '🔫',
  'Valorant': '🎯',
  'League of Legends': '🏆',
  'PUBG': '🪂',
  'default': '🎮',
}

type Receipt = { id:string; title:string; game:string; pick:string; amount:number; odds:number; payout:number; at:string }
function BetModal({
  match,
  initialPick,
  balance,
  onClose,
  onPlaced,
}: {
  match: Match
  initialPick: 'team_a' | 'team_b' | 'draw'
  balance: number
  onClose: () => void
  onPlaced: (r?: Receipt) => void
}) {
  const [pick, setPick] = useState<'team_a' | 'team_b' | 'draw'>(initialPick)
  const [amount, setAmount] = useState<number>(50000)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  // no-scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // keep pick in sync if opened with different initial
  useEffect(() => { setPick(initialPick) }, [initialPick])

  const odds: number | null =
    pick === 'team_a' ? Number(match.odds_a)
    : pick === 'team_b' ? Number(match.odds_b)
    : match.odds_draw != null ? Number(match.odds_draw) : null

  const payout = odds != null ? Math.floor(amount * odds) : 0
  const profit = payout - amount

  const clamp = (n: number) => Math.min(STAKE_MAX, Math.max(STAKE_MIN, Math.round(n / STEP) * STEP))

  const submit = async () => {
    setErr(null); setOk(null)
    if (!amount || isNaN(amount)) { setErr('مبلغ را وارد کنید'); return }
    if (amount < STAKE_MIN) { setErr(`حداقل مبلغ ${STAKE_MIN.toLocaleString('fa-IR')} تومان است`); return }
    if (amount > STAKE_MAX) { setErr(`حداکثر مبلغ ${STAKE_MAX.toLocaleString('fa-IR')} تومان است`); return }
    if (amount % STEP !== 0) { setErr(`مبلغ باید ضریبی از ${STEP.toLocaleString('fa-IR')} باشد`); return }
    if (balance < amount) { setErr('موجودی کافی نیست — لطفاً کیف پول را شارژ کنید'); return }
    if (odds == null) { setErr('ضریب این گزینه در دسترس نیست'); return }
    if (match.status !== 'upcoming') { setErr('این مسابقه بسته است — شرط جدید پذیرفته نمی‌شود'); return }
    setBusy(true)
    const { error, data } = await supabase.rpc('place_bet', { p_match_id: match.id, p_pick: pick, p_amount: amount })
    if (error) {
      const msg = error.message || ''
      if (msg.includes('insufficient balance') || msg.includes('موجودی کافی نیست')) setErr('موجودی کافی نیست — لطفاً کیف پول را شارژ کنید')
      else if (msg.includes('match not open')) setErr('این مسابقه بسته است — شرط جدید پذیرفته نمی‌شود')
      else if (msg.includes('amount must be')) setErr('مبلغ نامعتبر است')
      else if (msg.includes('not authenticated')) setErr('وارد حساب خود شوید')
      else if (msg.includes('حداقل') || msg.includes('ظرفیت')) setErr(msg)
      else setErr(msg || 'خطا در ثبت شرط — دوباره تلاش کنید')
      setBusy(false)
      return
    }
    const rid = String(data||'').slice(0,12) || Math.random().toString(36).slice(2,8)
    const pickLabel = pick==='team_a' ? match.team_a : pick==='team_b' ? match.team_b : 'مساوی'
    setOk('✅ شرط با موفقیت ثبت شد — ' + rid.slice(0, 8))
    onPlaced({ id: rid, title: match.title, game: match.game, pick: pickLabel, amount, odds: odds!, payout, at: new Date().toISOString() } as any)
    setTimeout(() => onClose(), 900)
    setBusy(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(5,8,18,.72)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ width: 'min(520px,100%)', maxHeight: 'none', overflow: 'visible', background: '#111c33', border: '1px solid rgba(255,255,255,.12)', borderRadius: 20, padding: 20, boxShadow: '0 24px 60px rgba(0,0,0,.65)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: 18, lineHeight: 1.3, color: '#f1f5f9', letterSpacing: '-.02em' }}>ثبت پیش‌بینی</div>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#e2e8f0', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{match.title}</div>
            <div style={{ fontSize: 13, color: '#cbd5e1', marginTop: 4, fontWeight: 500 }}>{match.game} · {match.team_a} — {match.team_b}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{new Date(match.starts_at).toLocaleString('fa-IR')}</div>
          </div>
          <button onClick={onClose} aria-label="close" style={{ width: 36, height: 36, borderRadius: 999, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.08)', color: '#fff', cursor: 'pointer', fontSize: 18, lineHeight: 1, flexShrink: 0 }}>×</button>
        </div>

        {/* picks grid — high contrast for readability */}
        <div style={{ display: 'grid', gridTemplateColumns: match.odds_draw != null ? '1fr 1fr 1fr' : '1fr 1fr', gap: 10, marginTop: 16 }}>
          <button
            onClick={() => setPick('team_a')}
            style={{ padding: '14px 10px', borderRadius: 16, border: pick === 'team_a' ? '2px solid #22c55e' : '1px solid rgba(255,255,255,.12)', background: pick === 'team_a' ? 'rgba(34,197,94,.18)' : '#15223d', cursor: 'pointer', textAlign: 'center', transition: 'all .15s' }}
          >
            <div style={{ fontWeight: 900, fontSize: 14, color: '#f1f5f9', lineHeight: 1.2, wordBreak: 'break-word' }}>{match.team_a}</div>
            <div className="odds" style={{ color: '#22c55e', fontWeight: 900, fontSize: 18, marginTop: 6, letterSpacing: '-.02em' }}>{Number(match.odds_a).toFixed(2)}×</div>
            <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 2, fontWeight: 600 }}>برد {match.team_a.slice(0,10)}</div>
          </button>
          {match.odds_draw != null && (
            <button
              onClick={() => setPick('draw')}
              style={{ padding: '14px 10px', borderRadius: 16, border: pick === 'draw' ? '2px solid #22c55e' : '1px solid rgba(255,255,255,.12)', background: pick === 'draw' ? 'rgba(34,197,94,.18)' : '#15223d', cursor: 'pointer', textAlign: 'center', transition: 'all .15s' }}
            >
              <div style={{ fontWeight: 900, fontSize: 14, color: '#f1f5f9' }}>مساوی</div>
              <div className="odds" style={{ color: '#22c55e', fontWeight: 900, fontSize: 18, marginTop: 6, letterSpacing: '-.02em' }}>{Number(match.odds_draw).toFixed(2)}×</div>
              <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 2, fontWeight: 600 }}>Draw</div>
            </button>
          )}
          <button
            onClick={() => setPick('team_b')}
            style={{ padding: '14px 10px', borderRadius: 16, border: pick === 'team_b' ? '2px solid #22c55e' : '1px solid rgba(255,255,255,.12)', background: pick === 'team_b' ? 'rgba(34,197,94,.18)' : '#15223d', cursor: 'pointer', textAlign: 'center', transition: 'all .15s' }}
          >
            <div style={{ fontWeight: 900, fontSize: 14, color: '#f1f5f9', lineHeight: 1.2, wordBreak: 'break-word' }}>{match.team_b}</div>
            <div className="odds" style={{ color: '#22c55e', fontWeight: 900, fontSize: 18, marginTop: 6, letterSpacing: '-.02em' }}>{Number(match.odds_b).toFixed(2)}×</div>
            <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 2, fontWeight: 600 }}>برد {match.team_b.slice(0,10)}</div>
          </button>
        </div>

        {/* amount controls — high contrast */}
        <div style={{ marginTop: 18, background: '#0d1730', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: '14px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: '#f1f5f9' }}>مبلغ شرط</span>
            <span style={{ fontSize: 15, fontWeight: 900, color: '#22c55e', letterSpacing: '-.02em' }}>{amount.toLocaleString('fa-IR')} <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>تومان</span></span>
          </div>
          <input type="range" min={STAKE_MIN} max={STAKE_MAX} step={STEP} value={amount} onChange={e => setAmount(clamp(Number(e.target.value)))} style={{ width: '100%', marginTop: 12, accentColor: '#22c55e', height: 6 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginTop: 4, fontWeight: 600 }}>
            <span>{STAKE_MIN.toLocaleString('fa-IR')}</span><span>{STAKE_MAX.toLocaleString('fa-IR')}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {CHIPS.map(c => (
              <button key={c} onClick={() => setAmount(c)} style={{ padding: '8px 14px', borderRadius: 999, border: amount === c ? '1px solid #22c55e' : '1px solid rgba(255,255,255,.12)', background: amount === c ? '#22c55e' : '#15223d', color: amount === c ? '#052e16' : '#e2e8f0', fontWeight: 900, fontSize: 13, cursor: 'pointer', minWidth: 62 }}>
                {(c / 1000).toLocaleString('fa-IR')}k
              </button>
            ))}
          </div>
          <input className="input" type="number" min={STAKE_MIN} max={STAKE_MAX} step={STEP} value={amount} onChange={e => { const v = Number(String(e.target.value).replace(/[^0-9]/g, '')); if (!v) { setAmount(STAKE_MIN); return } setAmount(clamp(v)) }} dir="ltr" inputMode="numeric" style={{ marginTop: 12, textAlign: 'center', fontWeight: 900, fontSize: 16, letterSpacing: '.02em', background: '#111c33', borderColor: 'rgba(255,255,255,.12)', color: '#f1f5f9' } as any} />
          <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 6, fontWeight: 500 }}>حداقل {STAKE_MIN.toLocaleString('fa-IR')} — حداکثر {STAKE_MAX.toLocaleString('fa-IR')} · گام {STEP.toLocaleString('fa-IR')}</div>
        </div>

        {/* payout / profit — large & legible */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
          <div style={{ background: '#15223d', border: '1px solid rgba(255,255,255,.12)', borderRadius: 14, padding: '14px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700, letterSpacing: '.02em' }}>دریافتی احتمالی</div>
            <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6, color: '#f1f5f9', letterSpacing: '-.03em' }}>{payout.toLocaleString('fa-IR')} <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700 }}>تومان</span></div>
            <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 4, fontWeight: 600 }}>ضریب {odds != null ? odds.toFixed(2) : '—'}× · {pick === 'team_a' ? match.team_a : pick === 'team_b' ? match.team_b : 'مساوی'}</div>
          </div>
          <div style={{ background: profit >= 0 ? 'rgba(34,197,94,.14)' : 'rgba(255,60,90,.10)', border: `1px solid ${profit >= 0 ? 'rgba(34,197,94,.35)' : 'rgba(255,60,90,.28)'}`, borderRadius: 14, padding: '14px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: profit >= 0 ? '#86efac' : '#fda4af', fontWeight: 800 }}>سود خالص شما</div>
            <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6, color: profit >= 0 ? '#22c55e' : '#ff6b7a', letterSpacing: '-.03em' }}>{profit >= 0 ? '+' : ''}{profit.toLocaleString('fa-IR')} <span style={{ fontSize: 12, fontWeight: 700, color: profit >= 0 ? '#86efac' : '#fda4af' }}>تومان</span></div>
            <div style={{ fontSize: 11, color: profit >= 0 ? '#86efac' : '#fda4af', marginTop: 4, fontWeight: 600 }}>دریافتی − مبلغ شرط</div>
          </div>
        </div>

        {err && <div style={{ marginTop: 12, background: 'rgba(255,60,90,.12)', border: '1px solid rgba(255,60,90,.3)', color: '#ff8a9a', padding: '9px 12px', borderRadius: 10, fontSize: 13, textAlign: 'center' }}>{err}</div>}
        {ok && <div style={{ marginTop: 12, background: 'rgba(0,229,160,.12)', border: '1px solid rgba(0,229,160,.3)', color: 'var(--accent)', padding: '9px 12px', borderRadius: 10, fontSize: 13, textAlign: 'center' }}>{ok}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose} disabled={busy}>انصراف</button>
          <button className="btn btn-primary" style={{ flex: 1.6, flexDirection:'column', lineHeight:1.2, padding:'10px 14px' }} onClick={submit} disabled={busy}>
            <span style={{fontWeight:900, fontSize:14}}>{busy ? 'در حال ثبت…' : `ثبت شرط ${amount.toLocaleString('fa-IR')} ت`}</span>
            {!busy && <span style={{fontSize:11, opacity:.85, fontWeight:600}}>انتخاب: {pick==='team_a'?match.team_a:pick==='team_b'?match.team_b:'مساوی'} · دریافتی {payout.toLocaleString('fa-IR')} ت</span>}
          </button>
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 8, fontWeight:500 }}>موجودی شما: {balance.toLocaleString('fa-IR')} تومان</div>
      </div>
    </div>
  )
}


function MatchCard({
  m,
  icon,
  onPick,
}: {
  m: Match
  icon: string
  onPick: (p: 'team_a' | 'team_b' | 'draw') => void
}) {
  const disabled = m.status !== 'upcoming'

  const teamA = m.team_a.trim()
  const teamB = m.team_b.trim()

  return (
    <div
      className="match-card"
      style={{
        position: 'relative',
        padding: 16,
        borderRadius: 18,
        background: 'linear-gradient(145deg, rgba(255,255,255,.055), rgba(255,255,255,.025))',
        border: '1px solid rgba(255,255,255,.09)',
        boxShadow: '0 8px 30px rgba(0,0,0,.12)',
        opacity: disabled ? 0.7 : 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        overflow: 'hidden',
      }}
    >
      {/* subtle top accent */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 24,
          right: 24,
          height: 1,
          background:
            m.status === 'live'
              ? 'var(--accent)'
              : 'rgba(255,255,255,.08)',
        }}
      />

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            minWidth: 0,
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 10,
              display: 'grid',
              placeItems: 'center',
              background: 'rgba(255,255,255,.05)',
              border: '1px solid rgba(255,255,255,.06)',
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            {icon}
          </div>

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {m.title}
            </div>

            <div
              style={{
                marginTop: 2,
                fontSize: 10,
                color: 'var(--muted)',
              }}
            >
              {m.game} ·{' '}
              {new Date(m.starts_at).toLocaleString('fa-IR', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
        </div>

        <span
          className={'status status-' + m.status}
          style={{
            fontSize: 10,
            fontWeight: 800,
            padding: '4px 8px',
            borderRadius: 999,
            flexShrink: 0,
          }}
        >
          {m.status === 'upcoming'
            ? 'پیش‌رو'
            : m.status === 'live'
              ? '● زنده'
              : 'پایان'}
        </span>
      </div>

      {/* Matchup */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: 10,
          padding: '4px 0',
        }}
      >
        {/* Team A */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            minWidth: 0,
          }}
        >
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              display: 'grid',
              placeItems: 'center',
              background:
                'linear-gradient(145deg, rgba(40,100,180,.35), rgba(20,40,70,.5))',
              border: '1px solid rgba(255,255,255,.08)',
              fontSize: 17,
              fontWeight: 900,
            }}
          >
            {teamA.charAt(0) || 'A'}
          </div>

          <div
            style={{
              maxWidth: 110,
              textAlign: 'center',
              fontSize: 12,
              fontWeight: 800,
              lineHeight: 1.25,
              wordBreak: 'break-word',
            }}
          >
            {teamA}
          </div>

          <div
            style={{
              fontSize: 14,
              fontWeight: 900,
              color: 'var(--accent)',
            }}
          >
            {Number(m.odds_a).toFixed(2)}×
          </div>
        </div>

        {/* VS */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span
            style={{
              fontSize: 9,
              fontWeight: 900,
              color: 'var(--muted)',
              letterSpacing: '.08em',
            }}
          >
            VS
          </span>

          <div
            style={{
              width: 1,
              height: 24,
              background: 'var(--line)',
            }}
          />
        </div>

        {/* Team B */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            minWidth: 0,
          }}
        >
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              display: 'grid',
              placeItems: 'center',
              background:
                'linear-gradient(145deg, rgba(170,45,75,.35), rgba(70,20,35,.5))',
              border: '1px solid rgba(255,255,255,.08)',
              fontSize: 17,
              fontWeight: 900,
            }}
          >
            {teamB.charAt(0) || 'B'}
          </div>

          <div
            style={{
              maxWidth: 110,
              textAlign: 'center',
              fontSize: 12,
              fontWeight: 800,
              lineHeight: 1.25,
              wordBreak: 'break-word',
            }}
          >
            {teamB}
          </div>

          <div
            style={{
              fontSize: 14,
              fontWeight: 900,
              color: 'var(--accent)',
            }}
          >
            {Number(m.odds_b).toFixed(2)}×
          </div>
        </div>
      </div>

      {/* Draw */}
      {m.odds_draw != null && (
        <button
          onClick={() => !disabled && onPick('draw')}
          disabled={disabled}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: 10,
            border: '1px solid var(--line)',
            background: 'rgba(255,255,255,.035)',
            color: disabled ? 'var(--muted)' : 'inherit',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: 11,
            transition: 'all .2s ease',
          }}
        >
          مساوی
          <span
            style={{
              marginRight: 6,
              color: 'var(--accent)',
              fontWeight: 900,
              fontSize: 12,
            }}
          >
            {Number(m.odds_draw).toFixed(2)}×
          </span>
        </button>
      )}

      {/* Winner */}
      {m.winner && (
        <div
          style={{
            textAlign: 'center',
            padding: '7px 10px',
            borderRadius: 9,
            background: 'rgba(0,229,160,.06)',
            color: 'var(--muted)',
            fontSize: 10,
          }}
        >
          برنده:{' '}
          <strong style={{ color: 'var(--accent)' }}>
            {m.winner === 'team_a'
              ? teamA
              : m.winner === 'team_b'
                ? teamB
                : 'مساوی'}
          </strong>
        </div>
      )}

      {/* Betting Actions */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: m.odds_draw != null ? '1fr .65fr 1fr' : '1fr 1fr',
          gap: 6,
        }}
      >
        <button
          disabled={disabled}
          onClick={() => onPick('team_a')}
          style={{
            minWidth: 0,
            padding: '9px 6px',
            borderRadius: 10,
            border: '1px solid rgba(0,229,160,.2)',
            background: 'rgba(0,229,160,.08)',
            color: 'var(--accent)',
            fontSize: 11,
            fontWeight: 800,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          {teamA.slice(0, 12)}
        </button>

        {m.odds_draw != null && (
          <button
            disabled={disabled}
            onClick={() => onPick('draw')}
            style={{
              padding: '9px 6px',
              borderRadius: 10,
              border: '1px solid var(--line)',
              background: 'rgba(255,255,255,.04)',
              color: 'inherit',
              fontSize: 11,
              fontWeight: 800,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            مساوی
          </button>
        )}

        <button
          disabled={disabled}
          onClick={() => onPick('team_b')}
          style={{
            minWidth: 0,
            padding: '9px 6px',
            borderRadius: 10,
            border: '1px solid rgba(0,229,160,.2)',
            background: 'rgba(0,229,160,.08)',
            color: 'var(--accent)',
            fontSize: 11,
            fontWeight: 800,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          {teamB.slice(0, 12)}
        </button>
      </div>

      {/* Closed */}
      {disabled && (
        <div
          style={{
            textAlign: 'center',
            fontSize: 10,
            color: 'var(--muted)',
          }}
        >
          این مسابقه بسته است
        </div>
      )}
    </div>
  )
}


export default function Betting() {
  const { profile, refresh, userId } = useAuth() as any
  const [matches, setMatches] = useState<Match[]>([])
  const [bets, setBets] = useState<Bet[]>([])
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [gameIcons, setGameIcons] = useState<Record<string, string>>(FALLBACK_ICONS)
  const [modal, setModal] = useState<{ m: Match; pick: 'team_a' | 'team_b' | 'draw' } | null>(null)
  const [gameFilter, setGameFilter] = useState<string>('all')
  const [betFilter, setBetFilter] = useState<'all'|'pending'|'won'|'lost'|'refunded'>('all')
  const [receipt, setReceipt] = useState<Receipt|null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const { data: ms } = await supabase.from('matches').select('*').order('starts_at', { ascending: true })
    setMatches((ms as Match[]) || [])
    if (!userId) { setBets([]); return }
    const { data: bs } = await supabase.from('bets').select('*, matches(*)').eq('user_id', userId).order('created_at', { ascending: false }).limit(50)
    setBets((bs as any[]) || [])
    setLoading(false)
  }

  const loadIcons = async () => {
    try {
      const { data } = await supabase.from('site_settings').select('games').limit(1).maybeSingle() as any
      if (data?.games && typeof data.games === 'object') {
        setGameIcons({ ...FALLBACK_ICONS, ...data.games })
        return
      }
      const { data: kv } = await supabase.from('site_settings').select('value').eq('key', 'games').maybeSingle() as any
      if (kv?.value && typeof kv.value === 'object') setGameIcons({ ...FALLBACK_ICONS, ...kv.value })
    } catch {
      // keep FALLBACK_ICONS
    }
  }

  useEffect(() => { load() }, [userId])
  useEffect(() => { loadIcons() }, [])
  useEffect(()=>{
    if(!userId) return
    const ch = supabase.channel('betting-live')
      .on('postgres_changes',{event:'*',schema:'public',table:'matches'}, (p:any)=>{
        const n = p.new as any, o = p.old as any
        if(p.eventType==='INSERT' && n) setMatches((s: Match[])=> [...s, n as Match])
        else if(p.eventType==='UPDATE' && n) setMatches((s: Match[])=> s.map(m=> m.id===n.id ? n as Match : m))
        else if(p.eventType==='DELETE' && o) setMatches((s: Match[])=> s.filter(m=> m.id!==o.id))
      })
      .on('postgres_changes',{event:'*',schema:'public',table:'bets', filter:`user_id=eq.${userId}`}, ()=>{
        supabase.from('bets').select('*, matches(*)').eq('user_id', userId).order('created_at',{ascending:false}).limit(50).then(({data}:any)=> setBets((data as any[])||[]))
        refresh()
      })
      .subscribe()
    return ()=>{ supabase.removeChannel(ch) }
  },[userId])

  const onPlaced = async (r?: Receipt) => { if(r) setReceipt(r); await load(); await refresh() }

  const cancel = async (b: Bet) => {
    const st = (b as any).matches?.status
    if (st !== 'upcoming') { alert('این مسابقه دیگر قابل لغو نیست'); return }
    if (!confirm('لغو این شرط؟ مبلغ به کیف پول برمی‌گردد.')) return
    setCancelId(b.id)
    const { error } = await supabase.rpc('cancel_bet', { p_bet_id: b.id })
    if (error) alert(error.message)
    else await onPlaced()
    setCancelId(null)
  }

  const open = matches.filter(m => m.status === 'upcoming')
  const closed = matches.filter(m => m.status !== 'upcoming')
  const games = Array.from(new Set(matches.map(m=> m.game))).filter(Boolean) as string[]
  const openF = gameFilter==='all' ? open : open.filter(m=> m.game===gameFilter)
  const closedF = gameFilter==='all' ? closed : closed.filter(m=> m.game===gameFilter)
  const filteredBets = betFilter==='all' ? bets : bets.filter(b=> (b as any).status===betFilter)

  return (
    <div className="container" style={{ padding: '20px 14px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ fontWeight: 900, fontSize: 22 }}>پیشبینی مسابقات</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="badge">موجودی: {profile ? profile.balance.toLocaleString('fa-IR') + ' ت' : '—'}</span>
          <Link className="btn btn-ghost btn-sm" to="/wallet">کیف پول</Link>
        </div>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6 }}>فقط مسابقات «قابل پیش‌بینی» باز هستند. بقیه بسته شده‌اند.</p>

      {receipt && (
        <div className="card" style={{ marginTop:14, padding:14, borderColor:'rgba(34,197,94,.35)', background:'linear-gradient(135deg,rgba(34,197,94,.10),rgba(255,255,255,.03))', display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
            <div style={{fontWeight:900,fontSize:13}}>🧾 رسید شرط — {receipt.id.slice(0,8)} <span style={{fontWeight:600,color:'var(--muted)',fontSize:11}}>· {new Date(receipt.at).toLocaleString('fa-IR')}</span></div>
            <button className="btn btn-ghost btn-sm" onClick={()=> setReceipt(null)} style={{minHeight:28,padding:'4px 10px'}}>×</button>
          </div>
          <div style={{fontSize:12,color:'#cbd5e1'}}>{receipt.game} · {receipt.title} — انتخاب: <b style={{color:'#f1f5f9'}}>{receipt.pick}</b></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
            <div style={{background:'rgba(255,255,255,.05)',border:'1px solid var(--line)',borderRadius:10,padding:'8px',textAlign:'center'}}><div style={{fontSize:10,color:'var(--muted)'}}>مبلغ</div><div style={{fontWeight:900,fontSize:13}}>{receipt.amount.toLocaleString('fa-IR')} ت</div></div>
            <div style={{background:'rgba(255,255,255,.05)',border:'1px solid var(--line)',borderRadius:10,padding:'8px',textAlign:'center'}}><div style={{fontSize:10,color:'var(--muted)'}}>ضریب</div><div style={{fontWeight:900,fontSize:13,color:'var(--accent)'}}>{receipt.odds.toFixed(2)}×</div></div>
            <div style={{background:'rgba(0,229,160,.10)',border:'1px solid rgba(0,229,160,.25)',borderRadius:10,padding:'8px',textAlign:'center'}}><div style={{fontSize:10,color:'var(--muted)'}}>دریافتی</div><div style={{fontWeight:900,fontSize:13}}>{receipt.payout.toLocaleString('fa-IR')} ت</div></div>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <button className="btn btn-primary btn-sm" onClick={()=>{ const txt=`رسید GAMEVERSE\n${receipt.title} — ${receipt.game}\nانتخاب: ${receipt.pick}\nمبلغ: ${receipt.amount.toLocaleString('fa-IR')} ت · ضریب ${receipt.odds.toFixed(2)}× · دریافتی ${receipt.payout.toLocaleString('fa-IR')} ت\nکد: ${receipt.id} — ${new Date(receipt.at).toLocaleString('fa-IR')}`; navigator.clipboard.writeText(txt) }}>📋 کپی رسید</button>
            <button className="btn btn-ghost btn-sm" onClick={async()=>{ const txt=`رسید GAMEVERSE\n${receipt.title} — ${receipt.game}\nانتخاب: ${receipt.pick}\nمبلغ: ${receipt.amount.toLocaleString('fa-IR')} ت · ضریب ${receipt.odds.toFixed(2)}×\nکد: ${receipt.id}`; if((navigator as any).share) try{ await (navigator as any).share({title:'رسید شرط GAMEVERSE', text: txt}) }catch{} else navigator.clipboard.writeText(txt) }}>↗️ اشتراک</button>
          </div>
        </div>
      )}

      {(games.length>0 || open.length>0) && (
        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:14,alignItems:'center'}}>
          <span style={{fontSize:11,color:'var(--muted)',fontWeight:700}}>فیلتر بازی:</span>
          <button onClick={()=> setGameFilter('all')} className={gameFilter==='all' ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} style={{borderRadius:999, minHeight:30}}>همه ({matches.length})</button>
          {games.map(g=> (
            <button key={g} onClick={()=> setGameFilter(g)} className={gameFilter===g ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} style={{borderRadius:999, minHeight:30}}>
              {gameIcons[g]||'🎮'} {g} ({matches.filter(m=> m.game===g).length})
            </button>
          ))}
          {gameFilter!=='all' && <button className="btn btn-ghost btn-sm" onClick={()=> setGameFilter('all')} style={{color:'var(--muted)'}}>پاک کردن ✕</button>}
        </div>
      )}

      <h3 style={{ fontWeight: 800, marginTop: 18, marginBottom: 10, fontSize: 15 }}>✅ قابل پیش‌بینی ({openF.length}{gameFilter!=='all'?` / ${open.length}`:''})</h3>
      {loading ? <div className="bet-grid">{[0,1,2,3].map(i=> <div key={i} className="skeleton skeleton-card" />)}</div> : openF.length === 0 ? <div style={{ color: 'var(--muted)', fontSize: 13, padding: '12px 0' }}>{open.length===0?'مسابقه‌ی بازی وجود ندارد.':'در این بازی مسابقه‌ای نیست.'}</div> :
        <div className="bet-grid">{openF.map(m => <MatchCard key={m.id} m={m} icon={gameIcons[m.game] || gameIcons['default'] || FALLBACK_ICONS['default']} onPick={p => setModal({ m, pick: p })} />)}</div>
      }

      <h3 style={{ fontWeight: 800, marginTop: 20, marginBottom: 10, fontSize: 15 }}>🔒 پیش‌بینی بسته شده ({closedF.length}{gameFilter!=='all'?` / ${closed.length}`:''})</h3>
      {loading ? <div className="bet-grid">{[0,1].map(i=> <div key={i} className="skeleton skeleton-card" style={{height:110}} />)}</div> : closedF.length === 0 ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>موردی نیست.</div> :
        <div className="bet-grid">{closedF.map(m => <MatchCard key={m.id} m={m} icon={gameIcons[m.game] || gameIcons['default'] || FALLBACK_ICONS['default']} onPick={p => setModal({ m, pick: p })} />)}</div>
      }

      <div className="divider" />
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
        <h3 style={{ fontWeight: 800, fontSize: 15 }}>شرط‌های من {bets.length > 0 && <span style={{ fontWeight: 600, color: 'var(--muted)', fontSize: 12 }}>· {filteredBets.length}{betFilter!=='all'?` / ${bets.length}`:''} شرط</span>}</h3>
        {bets.length>0 && (
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {(['all','pending','won','lost','refunded'] as const).map(k=>{
              const label = k==='all'?'همه':k==='pending'?'در انتظار':k==='won'?'برده':k==='lost'?'باخته':'لغو'
              const cnt = k==='all'? bets.length : bets.filter(b=> (b as any).status===k).length
              return <button key={k} onClick={()=> setBetFilter(k as any)} className={betFilter===k ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} style={{borderRadius:999, minHeight:28, fontSize:12, padding:'4px 10px'}}>{label} ({cnt})</button>
            })}
          </div>
        )}
      </div>
      {loading ? <div style={{display:'grid',gap:10,marginTop:10}}>{[0,1,2].map(i=> <div key={i} className="skeleton skeleton-row" />)}</div> : filteredBets.length === 0 ? <div className="card" style={{ padding: '18px 14px', textAlign: 'center', color: 'var(--muted)', fontSize: 13, marginTop:10 }}>{bets.length===0?'هنوز شرطی ثبت نکرده‌اید — از بالا یک مسابقه را انتخاب کنید.':'در این فیلتر شرطی نیست.'}</div> :
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 10, marginTop:10 }}>
          {filteredBets.map(b => {
            const canCancel = b.status === 'pending' && (b as any).matches?.status === 'upcoming'
            const st = b.status
            const stCfg = st === 'won' ? { label: 'برد ✅', bg: 'rgba(0,229,160,.15)', color: 'var(--accent)', border: 'rgba(0,229,160,.35)' } : st === 'lost' ? { label: 'باخت', bg: 'rgba(255,60,90,.12)', color: '#ff6b7a', border: 'rgba(255,90,110,.3)' } : st === 'refunded' ? { label: 'لغو شد', bg: 'rgba(255,255,255,.06)', color: 'var(--muted)', border: 'var(--line)' } : { label: 'در انتظار', bg: 'rgba(245,166,35,.14)', color: '#ffb84d', border: 'rgba(245,166,35,.35)' }
            const pickLabel = b.pick === 'team_a' ? ((b as any).matches?.team_a || 'تیم A') : b.pick === 'team_b' ? ((b as any).matches?.team_b || 'تیم B') : 'مساوی'
            return (
              <div key={b.id} className="card" style={{ padding: 14, borderRight: `3px solid ${stCfg.border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(b as any).matches?.title || 'مسابقه ' + b.match_id.slice(0, 8)}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{(b as any).matches?.game || ''} {(b as any).matches ? '·' : ''} {new Date(b.created_at).toLocaleDateString('fa-IR')}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 999, background: stCfg.bg, color: stCfg.color, border: `1px solid ${stCfg.border}`, whiteSpace: 'nowrap', flexShrink: 0 }}>{stCfg.label}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, background: 'rgba(255,255,255,.05)', border: '1px solid var(--line)', borderRadius: 10, padding: '7px 10px' }}>
                  <span style={{ color: 'var(--muted)' }}>انتخاب:</span><b>{pickLabel}</b>
                  <span style={{ marginRight: 'auto', fontSize: 11, color: 'var(--muted)' }}>{b.pick === 'draw' ? '⚖️' : b.pick === 'team_a' ? '🔵' : '🔴'}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 6px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>مبلغ</div><div style={{ fontWeight: 800, fontSize: 12, marginTop: 2 }}>{Number(b.amount).toLocaleString('fa-IR')} <span style={{ fontSize: 10, color: 'var(--muted)' }}>ت</span></div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 6px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>ضریب</div><div className="odds" style={{ fontWeight: 900, fontSize: 13, marginTop: 2, color: 'var(--accent)' }}>{Number(b.odds).toFixed(2)}×</div>
                  </div>
                  <div style={{ background: st === 'won' ? 'rgba(0,229,160,.10)' : 'rgba(255,255,255,.04)', border: `1px solid ${st === 'won' ? 'rgba(0,229,160,.25)' : 'var(--line)'}`, borderRadius: 10, padding: '8px 6px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>{st === 'won' ? 'دریافتی' : 'برد احتمالی'}</div><div style={{ fontWeight: 800, fontSize: 12, marginTop: 2 }}>{Number(b.potential_payout).toLocaleString('fa-IR')} <span style={{ fontSize: 10, color: 'var(--muted)' }}>ت</span></div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 2 }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{new Date(b.created_at).toLocaleString('fa-IR')}</span>
                  {canCancel
                    ? <button className="btn btn-ghost btn-sm" style={{ fontSize: 12, color: '#ff6b7a', borderColor: 'rgba(255,90,110,.35)', minHeight: 32, padding: '6px 14px' }} disabled={cancelId === b.id} onClick={() => cancel(b)}>{cancelId === b.id ? '…' : 'لغو شرط'}</button>
                    : <span style={{ fontSize: 11, color: 'var(--muted)' }}>{st === 'refunded' ? '↩️ برگشت خورد' : st === 'won' ? '💰 واریز شد' : st === 'lost' ? '—' : ''}</span>
                  }
                </div>
              </div>
            )
          })}
        </div>
      }

      {modal && (
        <BetModal
          match={modal.m}
          initialPick={modal.pick}
          balance={profile?.balance ?? 0}
          onClose={() => setModal(null)}
          onPlaced={onPlaced}
        />
      )}
    </div>
  )
}
