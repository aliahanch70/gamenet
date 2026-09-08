export type DesignId = 'minimal' | 'esports' | 'glass' | 'sportsbook' | 'neon' | 'midnight' | 'arctic' | 'stadium'

export const DESIGNS: Record<DesignId, { label: string; desc: string; icon: string; accent: string }> = {
  minimal:    { label: 'Minimal Modern',   icon: '◐', desc: 'تمیز · فضای باز · تایپوگرافی قوی',     accent: '#0ea5e9' },
  esports:    { label: 'Premium Esports',  icon: '◆', desc: 'تیره · حرفه‌ای · نئون سبز',              accent: '#22c55e' },
  glass:      { label: 'Glass Futuristic', icon: '⬢', desc: 'شیشه‌ای · Blur · آینده‌نگر',             accent: '#8b5cf6' },
  sportsbook: { label: 'Bold Sportsbook',  icon: '▣', desc: 'متراکم · Odds باکس · جدولی',             accent: '#f59e0b' },
  neon:       { label: 'Neon Cyber',       icon: '⬣', desc: 'سایبرپانک · نئون فیروزه‌ای/سرخابی',      accent: '#00e5ff' },
  midnight:   { label: 'Midnight OLED',    icon: '●', desc: 'مشکی مطلق · اولد · بسیار مینیمال',        accent: '#ffffff' },
  arctic:     { label: 'Arctic Frost',     icon: '❄', desc: 'روشنِ یخی · سایه نرم · آبی',             accent: '#2563eb' },
  stadium:    { label: 'Stadium Live',     icon: '◈', desc: 'گرم · برادکست · چمن و نور استادیوم',      accent: '#facc15' },
}

export const DESIGN_IDS = Object.keys(DESIGNS) as DesignId[]
export const DEFAULT_DESIGN: DesignId = 'minimal'
