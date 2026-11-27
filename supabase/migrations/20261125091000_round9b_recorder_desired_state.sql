-- Round 9B: durable recorder desired state (DEV-REC-002, DEV-REC-003). Service-role
-- only. Nothing here depends on legacy RLS policies or current_user_school_id().

CREATE TABLE IF NOT EXISTS public.recorder_fleet_desired_state (
  singleton boolean PRIMARY KEY DEFAULT true,
  desired_capacity integer NOT NULL DEFAULT 0,
  desired_version bigint NOT NULL DEFAULT 0,
  command_id uuid,
  demand integer NOT NULL DEFAULT 0,
  capacity_exceeded_at timestamptz,
  last_alert_at timestamptz,
  acknowledged_command_id uuid,
  acknowledged_version bigint NOT NULL DEFAULT 0,
  acknowledged_at timestamptz,
  reason text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recorder_fleet_desired_state_singleton_check CHECK (singleton),
  CONSTRAINT recorder_fleet_desired_state_capacity_check CHECK (desired_capacity >= 0),
  CONSTRAINT recorder_fleet_desired_state_demand_check CHECK (demand >= 0)
);

ALTER TABLE public.recorder_fleet_desired_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.recorder_fleet_desired_state FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.recorder_fleet_desired_state TO service_role;

-- Persist the desired state and decide whether the controller needs a command.
-- A command is sent when the desired capacity changed, the last command was never
-- acknowledged, the last acknowledgement is older than p_refresh_seconds (so a
-- crashed instance is still recovered), or p_force is set (class entry).
-- Also records demand and reports once per p_alert_interval_seconds while demand
-- exceeds the capture slots.
CREATE OR REPLACE FUNCTION public.plan_recorder_command(
  p_desired integer,
  p_demand integer,
  p_reason text,
  p_capture_slots integer DEFAULT 2,
  p_refresh_seconds integer DEFAULT 600,
  p_force boolean DEFAULT false,
  p_alert_interval_seconds integer DEFAULT 1800
) RETURNS TABLE (out_command_id uuid, out_version bigint, out_send boolean, out_capacity_alert boolean)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.recorder_fleet_desired_state%ROWTYPE;
  v_command uuid;
  v_version bigint;
  v_send boolean;
  v_alert boolean := false;
  v_exceeded_at timestamptz;
  v_alert_at timestamptz;
BEGIN
  INSERT INTO public.recorder_fleet_desired_state (singleton) VALUES (true) ON CONFLICT (singleton) DO NOTHING;
  SELECT * INTO v_row FROM public.recorder_fleet_desired_state WHERE singleton FOR UPDATE;

  v_command := v_row.command_id;
  v_version := v_row.desired_version;
  IF v_command IS NULL OR v_row.desired_capacity <> p_desired THEN
    v_command := gen_random_uuid();
    v_version := v_row.desired_version + 1;
  END IF;

  v_send := p_force
    OR v_command IS DISTINCT FROM v_row.acknowledged_command_id
    OR v_row.acknowledged_at IS NULL
    OR v_row.acknowledged_at < now() - make_interval(secs => p_refresh_seconds);

  v_exceeded_at := v_row.capacity_exceeded_at;
  v_alert_at := v_row.last_alert_at;
  IF p_demand > p_capture_slots THEN
    v_exceeded_at := COALESCE(v_exceeded_at, now());
    IF v_alert_at IS NULL OR v_alert_at < now() - make_interval(secs => p_alert_interval_seconds) THEN
      v_alert := true;
      v_alert_at := now();
    END IF;
  ELSE
    v_exceeded_at := NULL;
    v_alert_at := NULL;
  END IF;

  UPDATE public.recorder_fleet_desired_state
  SET desired_capacity = p_desired, desired_version = v_version, command_id = v_command,
      demand = p_demand, capacity_exceeded_at = v_exceeded_at, last_alert_at = v_alert_at,
      reason = p_reason, updated_at = now()
  WHERE singleton;

  RETURN QUERY SELECT v_command, v_version, v_send, v_alert;
END;
$$;

-- Record the controller's acknowledgement. Only the current command can be acknowledged.
CREATE OR REPLACE FUNCTION public.acknowledge_recorder_command(p_command_id uuid, p_version bigint) RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH updated AS (
    UPDATE public.recorder_fleet_desired_state
    SET acknowledged_command_id = p_command_id, acknowledged_version = p_version,
        acknowledged_at = now(), updated_at = now()
    WHERE singleton AND command_id = p_command_id
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM updated);
$$;

REVOKE ALL ON FUNCTION public.plan_recorder_command(integer, integer, text, integer, integer, boolean, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.acknowledge_recorder_command(uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.plan_recorder_command(integer, integer, text, integer, integer, boolean, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.acknowledge_recorder_command(uuid, bigint) TO service_role;
