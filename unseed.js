const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  console.log('Cleaning up seed data...');

  // 1. Delete all users created for seeding
  const { data: users, error: listError } = await supabase.auth.admin.listUsers();
  if (!listError && users && users.users) {
    for (const u of users.users) {
      if (u.email && u.email.endsWith('@seed.kanvise.test')) {
        await supabase.auth.admin.deleteUser(u.id);
        console.log(`Deleted auth user: ${u.email}`);
      }
    }
  }

  // 2. Delete seed schools (this cascades to all related entities if FKs have ON DELETE CASCADE)
  const { error: schoolError } = await supabase
    .from('schools')
    .delete()
    .like('slug', '%-seed');
    
  if (schoolError) {
    console.error('Failed to delete seed schools:', schoolError.message);
  } else {
    console.log('Deleted seed schools');
  }

  console.log('Unseed complete. You can now safely run seed.js again.');
}

run().catch(console.error);
