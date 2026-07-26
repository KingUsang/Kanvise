export type KanviseUser = {
  id: string
  supabase_auth_id: string
  role: string
  school_id: string | null
  kanvise_user_id: string
  first_name?: string
  last_name?: string
}

// For routers behind tenantMiddleware, which rejects requests without a school.
export type TenantUser = KanviseUser & { school_id: string }

export type AppVariables = {
  user: KanviseUser
  jwt_payload: any
  tenant?: {
    id: string
    // other tenant fields if needed
  }
}

export type TenantVariables = AppVariables & { user: TenantUser }
