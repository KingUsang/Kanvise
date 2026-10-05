const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');
const envConfig = dotenv.parse(fs.readFileSync('api/.env'));

const supabase = createClient(envConfig.SUPABASE_URL, envConfig.SUPABASE_SERVICE_ROLE_KEY);

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
