export type KanviseUser = {
  id: string
  supabase_auth_id: string
  role: string
  school_id: string | null
  kanvise_user_id: string
  first_name?: string
  last_name?: string
}

export type AppVariables = {
  user: KanviseUser
  jwt_payload: any
  tenant?: {
    id: string
    // other tenant fields if needed
  }
}
