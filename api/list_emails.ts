import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('../scripts/lib/require-local-supabase.cjs').requireLocalSupabase(process.env.SUPABASE_URL, 'list_emails.ts');

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data, error } = await supabase.from('email_deliveries').select('recipient_email, event_type, status, sent_at').order('created_at', { ascending: false });
  if (error) {
    console.error(error);
    return;
  }
  if (data.length === 0) {
    console.log("No emails sent yet.");
  } else {
    console.table(data);
  }
}
run();
