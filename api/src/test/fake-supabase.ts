// Tiny programmable stand-in for the Supabase query builder, used by route tests.
// Results are looked up by `table:op` (op is select, insert, update, delete or upsert)
// and then by `table`. A function result receives the recorded payload.
export type FakeResult = { data?: any; error?: any; count?: number | null }
type Resolver = FakeResult | ((payload: any) => FakeResult)

export type FakeDb = {
  tables: Record<string, Resolver>
  rpc: Record<string, Resolver>
  calls: Array<{ table: string; op: string; payload?: any }>
  rpcCalls: Array<{ name: string; args: any }>
}

export function createFakeDb(): FakeDb {
  return { tables: {}, rpc: {}, calls: [], rpcCalls: [] }
}

const passthrough = ['select', 'eq', 'neq', 'in', 'is', 'not', 'or', 'order', 'limit', 'range', 'gte', 'lte', 'gt', 'lt', 'ilike', 'like', 'contains', 'overlaps', 'filter', 'match']

function resolve(r: Resolver | undefined, payload: any): FakeResult {
  const value = typeof r === 'function' ? r(payload) : r
  return { data: null, error: null, ...(value || {}) }
}

export function createFakeSupabase(db: FakeDb) {
  return {
    from(table: string) {
      let op = 'select'
      let payload: any
      const run = () => {
        const result = resolve(db.tables[`${table}:${op}`] ?? db.tables[table], payload)
        return result
      }
      const chain: any = {}
      for (const name of passthrough) chain[name] = () => chain
      for (const write of ['insert', 'update', 'delete', 'upsert']) {
        chain[write] = (value?: any) => { op = write; payload = value; db.calls.push({ table, op, payload }); return chain }
      }
      chain.maybeSingle = async () => { const r = run(); return { ...r, data: Array.isArray(r.data) ? r.data[0] ?? null : r.data } }
      chain.single = chain.maybeSingle
      chain.then = (onFulfilled: any, onRejected: any) => Promise.resolve(run()).then(onFulfilled, onRejected)
      return chain
    },
    async rpc(name: string, args: any) {
      db.rpcCalls.push({ name, args })
      return resolve(db.rpc[name], args)
    },
  }
}
