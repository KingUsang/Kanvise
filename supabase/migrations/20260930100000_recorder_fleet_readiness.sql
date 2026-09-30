-- One private, durable view of the recorder worker lifecycle. The API writes
-- EC2 start requests; the recorder VM reports its own service health over an
-- HMAC-authenticated outbound request. No browser role can read this table.
CREATE TABLE IF NOT EXISTS public.recorder_fleet_readiness (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  vm_state text NOT NULL DEFAULT 'unknown' CHECK (vm_state IN ('unknown', 'stopped', 'starting', 'running')),
  service_state text NOT NULL DEFAULT 'unknown' CHECK (service_state IN ('unknown', 'starting', 'healthy', 'unhealthy')),
  start_requested_at timestamptz,
  vm_running_at timestamptz,
  service_healthy_at timestamptz,
  last_heartbeat_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recorder_fleet_readiness ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.recorder_fleet_readiness FROM PUBLIC;
REVOKE ALL ON TABLE public.recorder_fleet_readiness FROM anon;
REVOKE ALL ON TABLE public.recorder_fleet_readiness FROM authenticated;
GRANT ALL ON TABLE public.recorder_fleet_readiness TO service_role;
