'use strict';

// Service-role utilities (seed, unseed, ad hoc reads) must never touch a hosted
// Supabase project by accident. They call this before creating a client and
// refuse to continue unless the URL points at this machine.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1', 'host.docker.internal']);

function isLocalSupabaseUrl(value) {
  if (!value) return false;
  try {
    const { hostname } = new URL(value);
    return LOCAL_HOSTS.has(hostname) || hostname.endsWith('.localhost');
  } catch {
    return false;
  }
}

function requireLocalSupabase(url, scriptName) {
  if (isLocalSupabaseUrl(url)) return url;
  let host = 'missing or invalid';
  try {
    host = new URL(url).hostname;
  } catch {
    // Keep the generic description; never echo a malformed value.
  }
  console.error(
    `${scriptName} refuses to run: SUPABASE_URL host is "${host}", not a local Supabase host. ` +
      'Start the local stack (supabase start) and point SUPABASE_URL at it.',
  );
  process.exit(1);
}

module.exports = { isLocalSupabaseUrl, requireLocalSupabase };
