import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';
const { requireLocalSupabase } = createRequire(import.meta.url)('./scripts/lib/require-local-supabase.cjs');
requireLocalSupabase(process.env.SUPABASE_URL, 'test-db.js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data } = await supabase.from('live_classes').select('*');
  console.log(data);
}
run();
