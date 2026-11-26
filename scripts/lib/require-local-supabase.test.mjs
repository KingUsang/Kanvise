import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

const { isLocalSupabaseUrl } = createRequire(import.meta.url)('./require-local-supabase.cjs')

test('accepts local Supabase hosts', () => {
  for (const url of ['http://127.0.0.1:54321', 'http://localhost:54321', 'http://[::1]:54321', 'http://host.docker.internal:54321', 'http://db.localhost:54321']) {
    assert.equal(isLocalSupabaseUrl(url), true, url)
  }
})

test('rejects hosted, look-alike, empty and malformed URLs', () => {
  for (const url of ['https://abc.supabase.co', 'http://localhost.evil.com', 'https://127.0.0.1.evil.com', '', undefined, 'not a url']) {
    assert.equal(isLocalSupabaseUrl(url), false, String(url))
  }
})
