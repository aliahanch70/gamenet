// ponytail: Map dedup+TTL — 30s default, per-key pending shares one promise
type Entry<T> = { data?: T; expires: number; pending?: Promise<T> }
const store = new Map<string, Entry<unknown>>()
export function cachedFetch<T>(key: string, fetcher: () => Promise<T>, ttlMs = 30000): Promise<T> {
  const now = Date.now()
  const e = store.get(key) as Entry<T> | undefined
  if (e) {
    if (e.pending) return e.pending
    if (e.data !== undefined && e.expires > now) return Promise.resolve(e.data)
  }
  const p = fetcher().then((data) => {
    store.set(key, { data, expires: Date.now() + ttlMs })
    return data
  }).catch((err) => {
    const cur = store.get(key)
    if (cur && (cur as Entry<T>).pending === p) store.delete(key)
    throw err
  })
  store.set(key, { data: e?.data, expires: e?.expires ?? 0, pending: p } as Entry<T>)
  return p
}
export function invalidate(key: string) { store.delete(key) }
export function clearCache() { store.clear() }
