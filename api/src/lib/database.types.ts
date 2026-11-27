
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {

  "public": {
          Tables: {
            "account_invitations": {
                  Row: {
                    "accepted_at": string | null,"auth_started_at": string | null,"created_at": string,"email": string,"expires_at": string,"id": string,"invited_by": string,"metadata": NonNullable<Json>,"role": string,"school_id": string,"status": string,"student_profile_id": string | null,"supabase_auth_id": string | null,"token_hash": string,"tutor_invite_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"auth_started_at"?: string | null,"created_at"?: string,"email": string,"expires_at": string,"id"?: string,"invited_by": string,"metadata"?: NonNullable<Json>,"role": string,"school_id": string,"status"?: string,"student_profile_id"?: string | null,"supabase_auth_id"?: string | null,"token_hash": string,"tutor_invite_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "accepted_at"?: string | null,"auth_started_at"?: string | null,"created_at"?: string,"email"?: string,"expires_at"?: string,"id"?: string,"invited_by"?: string,"metadata"?: NonNullable<Json>,"role"?: string,"school_id"?: string,"status"?: string,"student_profile_id"?: string | null,"supabase_auth_id"?: string | null,"token_hash"?: string,"tutor_invite_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "account_invitations_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "account_invitations_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "account_invitations_student_profile_id_fkey"
      columns: ["student_profile_id"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "account_invitations_tutor_invite_id_fkey"
      columns: ["tutor_invite_id"]
isOneToOne: false
      referencedRelation: "tutor_invites"
      referencedColumns: ["id"]
    }
                  ]
                },account_memberships: {
        Row: {
          created_at: string
          id: string
          joined_at: string
          person_id: string
          revoked_at: string | null
          role: string
          school_id: string
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          joined_at?: string
          person_id: string
          revoked_at?: string | null
          role: string
          school_id: string
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          joined_at?: string
          person_id?: string
          revoked_at?: string | null
          role?: string
          school_id?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_memberships_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_memberships_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      },"assignments": {
                  Row: {
                    "attachment_file_key": string | null,"attachment_file_name": string | null,"course_id": string,"created_at": string,"deadline_at": string,"description": string,"id": string,"is_published": boolean,"school_id": string,"title": string,"tutor_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attachment_file_key"?: string | null,"attachment_file_name"?: string | null,"course_id": string,"created_at"?: string,"deadline_at": string,"description": string,"id"?: string,"is_published"?: boolean,"school_id": string,"title": string,"tutor_id": string,"updated_at"?: string
                  }
                  Update: {
                    "attachment_file_key"?: string | null,"attachment_file_name"?: string | null,"course_id"?: string,"created_at"?: string,"deadline_at"?: string,"description"?: string,"id"?: string,"is_published"?: boolean,"school_id"?: string,"title"?: string,"tutor_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "assignments_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assignments_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assignments_tutor_id_fkey"
      columns: ["tutor_id"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },attendance_records: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          joined_at: string
          left_at: string | null
          live_class_id: string
          school_id: string
          source: string
          student_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          joined_at: string
          left_at?: string | null
          live_class_id: string
          school_id: string
          source?: string
          student_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          joined_at?: string
          left_at?: string | null
          live_class_id?: string
          school_id?: string
          source?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_live_class_id_fkey"
            columns: ["live_class_id"]
            isOneToOne: false
            referencedRelation: "live_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_school_live_class_fkey"
            columns: ["school_id", "live_class_id"]
            isOneToOne: false
            referencedRelation: "live_classes"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      },"avatar_configs": {
                  Row: {
                    "accessory": string | null,"created_at": string,"face_shape": string,"hair_colour": string,"hair_style": string,"headwear": string | null,"id": string,"outfit_colour": string,"school_id": string,"skin_tone": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accessory"?: string | null,"created_at"?: string,"face_shape": string,"hair_colour": string,"hair_style": string,"headwear"?: string | null,"id"?: string,"outfit_colour"?: string,"school_id": string,"skin_tone": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "accessory"?: string | null,"created_at"?: string,"face_shape"?: string,"hair_colour"?: string,"hair_style"?: string,"headwear"?: string | null,"id"?: string,"outfit_colour"?: string,"school_id"?: string,"skin_tone"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "avatar_configs_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "avatar_configs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"bank_question_option_versions": {
                  Row: {
                    "content_blocks": NonNullable<Json>,"created_at": string,"id": string,"is_correct": boolean,"order_index": number,"plain_text": string,"question_version_id": string,"school_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content_blocks"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"is_correct"?: boolean,"order_index": number,"plain_text"?: string,"question_version_id": string,"school_id": string
                  }
                  Update: {
                    "content_blocks"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"is_correct"?: boolean,"order_index"?: number,"plain_text"?: string,"question_version_id"?: string,"school_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bank_question_option_versions_question_version_id_fkey"
      columns: ["question_version_id"]
isOneToOne: false
      referencedRelation: "bank_question_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bank_question_option_versions_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"bank_question_version_media": {
                  Row: {
                    "created_at": string,"id": string,"media_id": string,"question_version_id": string,"school_id": string,"usage_key": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"media_id": string,"question_version_id": string,"school_id": string,"usage_key": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"media_id"?: string,"question_version_id"?: string,"school_id"?: string,"usage_key"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bank_question_version_media_media_school_fkey"
      columns: ["media_id","school_id"]
isOneToOne: false
      referencedRelation: "question_media"
      referencedColumns: ["id","school_id"]
    },{
      foreignKeyName: "bank_question_version_media_question_version_id_fkey"
      columns: ["question_version_id"]
isOneToOne: false
      referencedRelation: "bank_question_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bank_question_version_media_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"bank_question_versions": {
                  Row: {
                    "content_blocks": NonNullable<Json>,"created_at": string,"created_by": string,"explanation_blocks": NonNullable<Json>,"grading_rubric_blocks": NonNullable<Json>,"id": string,"marks": number,"plain_text": string,"question_id": string,"school_id": string,"stimulus_id": string | null,"version_number": number
                  }
                  ComputedFields: never
                  Insert: {
                    "content_blocks"?: NonNullable<Json>,"created_at"?: string,"created_by": string,"explanation_blocks"?: NonNullable<Json>,"grading_rubric_blocks"?: NonNullable<Json>,"id"?: string,"marks"?: number,"plain_text"?: string,"question_id": string,"school_id": string,"stimulus_id"?: string | null,"version_number": number
                  }
                  Update: {
                    "content_blocks"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string,"explanation_blocks"?: NonNullable<Json>,"grading_rubric_blocks"?: NonNullable<Json>,"id"?: string,"marks"?: number,"plain_text"?: string,"question_id"?: string,"school_id"?: string,"stimulus_id"?: string | null,"version_number"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "bank_question_versions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bank_question_versions_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "bank_questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bank_question_versions_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bank_question_versions_stimulus_id_fkey"
      columns: ["stimulus_id"]
isOneToOne: false
      referencedRelation: "question_stimuli"
      referencedColumns: ["id"]
    }
                  ]
                },"bank_questions": {
                  Row: {
                    "archived_at": string | null,"author_id": string,"bank_id": string,"course_id": string | null,"created_at": string,"current_version_id": string | null,"id": string,"question_type": string,"school_id": string,"search_text": string,"status": string,"subject_name": string | null,"subtopic": string | null,"topic": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"author_id": string,"bank_id": string,"course_id"?: string | null,"created_at"?: string,"current_version_id"?: string | null,"id"?: string,"question_type": string,"school_id": string,"search_text"?: string,"status"?: string,"subject_name"?: string | null,"subtopic"?: string | null,"topic"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"author_id"?: string,"bank_id"?: string,"course_id"?: string | null,"created_at"?: string,"current_version_id"?: string | null,"id"?: string,"question_type"?: string,"school_id"?: string,"search_text"?: string,"status"?: string,"subject_name"?: string | null,"subtopic"?: string | null,"topic"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bank_questions_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bank_questions_bank_id_fkey"
      columns: ["bank_id"]
isOneToOne: false
      referencedRelation: "question_banks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bank_questions_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bank_questions_current_version_fkey"
      columns: ["current_version_id","id"]
isOneToOne: false
      referencedRelation: "bank_question_versions"
      referencedColumns: ["id","question_id"]
    },{
      foreignKeyName: "bank_questions_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"class_timetable_slots": {
                  Row: {
                    "course_id": string,"created_at": string,"created_by": string | null,"deleted_at": string | null,"duration_minutes": number,"ends_on": string | null,"id": string,"published_at": string | null,"recurrence_group_id": string | null,"school_id": string,"source": string,"start_time": string,"starts_on": string,"timetable_id": string | null,"timezone": string,"title": string | null,"tutor_id": string,"updated_at": string,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id": string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"duration_minutes"?: number,"ends_on"?: string | null,"id"?: string,"published_at"?: string | null,"recurrence_group_id"?: string | null,"school_id": string,"source"?: string,"start_time": string,"starts_on": string,"timetable_id"?: string | null,"timezone"?: string,"title"?: string | null,"tutor_id": string,"updated_at"?: string,"weekday": number
                  }
                  Update: {
                    "course_id"?: string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"duration_minutes"?: number,"ends_on"?: string | null,"id"?: string,"published_at"?: string | null,"recurrence_group_id"?: string | null,"school_id"?: string,"source"?: string,"start_time"?: string,"starts_on"?: string,"timetable_id"?: string | null,"timezone"?: string,"title"?: string | null,"tutor_id"?: string,"updated_at"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_timetable_slots_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_timetable_slots_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_timetable_slots_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_timetable_slots_timetable_id_fkey"
      columns: ["timetable_id"]
isOneToOne: false
      referencedRelation: "class_timetables"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_timetable_slots_tutor_id_fkey"
      columns: ["tutor_id"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"class_timetables": {
                  Row: {
                    "created_at": string,"created_by": string,"has_unpublished_changes": boolean,"id": string,"programme_id": string | null,"published_at": string | null,"published_slots": NonNullable<Json>,"school_id": string,"standalone_course_id": string | null,"status": string,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"has_unpublished_changes"?: boolean,"id"?: string,"programme_id"?: string | null,"published_at"?: string | null,"published_slots"?: NonNullable<Json>,"school_id": string,"standalone_course_id"?: string | null,"status"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"has_unpublished_changes"?: boolean,"id"?: string,"programme_id"?: string | null,"published_at"?: string | null,"published_slots"?: NonNullable<Json>,"school_id"?: string,"standalone_course_id"?: string | null,"status"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_timetables_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_timetables_programme_id_fkey"
      columns: ["programme_id"]
isOneToOne: false
      referencedRelation: "programmes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_timetables_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_timetables_standalone_course_id_fkey"
      columns: ["standalone_course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    }
                  ]
                },courses: {
        Row: {
          created_at: string
          created_by: string
          currency: string
          description: string | null
          id: string
          is_available_separately: boolean
          is_published: boolean
          name: string
          price: number
          programme_id: string | null
          school_id: string
          slug: string
          sort_order: number
          sub_programme_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          currency?: string
          description?: string | null
          id?: string
          is_available_separately?: boolean
          is_published?: boolean
          name: string
          price?: number
          programme_id?: string | null
          school_id: string
          slug: string
          sort_order?: number
          sub_programme_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          currency?: string
          description?: string | null
          id?: string
          is_available_separately?: boolean
          is_published?: boolean
          name?: string
          price?: number
          programme_id?: string | null
          school_id?: string
          slug?: string
          sort_order?: number
          sub_programme_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_school_programme_fkey"
            columns: ["school_id", "programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "courses_school_sub_programme_fkey"
            columns: ["school_id", "sub_programme_id"]
            isOneToOne: false
            referencedRelation: "sub_programmes"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "courses_sub_programme_id_fkey"
            columns: ["sub_programme_id"]
            isOneToOne: false
            referencedRelation: "sub_programmes"
            referencedColumns: ["id"]
          },
        ]
      },"direct_assignment_submissions": {
                  Row: {
                    "created_at": string,"direct_assignment_id": string,"feedback": string | null,"file_key": string | null,"file_name": string | null,"file_size_bytes": number | null,"file_type": string | null,"guest_email": string | null,"guest_name": string,"id": string,"response_text": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"school_id": string,"score": number | null,"submitted_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"direct_assignment_id": string,"feedback"?: string | null,"file_key"?: string | null,"file_name"?: string | null,"file_size_bytes"?: number | null,"file_type"?: string | null,"guest_email"?: string | null,"guest_name": string,"id"?: string,"response_text"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"school_id": string,"score"?: number | null,"submitted_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"direct_assignment_id"?: string,"feedback"?: string | null,"file_key"?: string | null,"file_name"?: string | null,"file_size_bytes"?: number | null,"file_type"?: string | null,"guest_email"?: string | null,"guest_name"?: string,"id"?: string,"response_text"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"school_id"?: string,"score"?: number | null,"submitted_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "direct_assignment_submissions_direct_assignment_id_fkey"
      columns: ["direct_assignment_id"]
isOneToOne: false
      referencedRelation: "direct_assignments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "direct_assignment_submissions_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "direct_assignment_submissions_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"direct_assignments": {
                  Row: {
                    "attachment_file_key": string | null,"attachment_file_name": string | null,"attachment_file_size_bytes": number | null,"attachment_file_type": string | null,"created_at": string,"deadline_at": string,"description": string,"expires_at": string,"id": string,"revoked_at": string | null,"school_id": string,"share_token_hash": string,"title": string,"tutor_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attachment_file_key"?: string | null,"attachment_file_name"?: string | null,"attachment_file_size_bytes"?: number | null,"attachment_file_type"?: string | null,"created_at"?: string,"deadline_at": string,"description": string,"expires_at": string,"id"?: string,"revoked_at"?: string | null,"school_id": string,"share_token_hash": string,"title": string,"tutor_id": string,"updated_at"?: string
                  }
                  Update: {
                    "attachment_file_key"?: string | null,"attachment_file_name"?: string | null,"attachment_file_size_bytes"?: number | null,"attachment_file_type"?: string | null,"created_at"?: string,"deadline_at"?: string,"description"?: string,"expires_at"?: string,"id"?: string,"revoked_at"?: string | null,"school_id"?: string,"share_token_hash"?: string,"title"?: string,"tutor_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "direct_assignments_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "direct_assignments_tutor_id_fkey"
      columns: ["tutor_id"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"durable_jobs": {
                  Row: {
                    "attempts": number,"completed_at": string | null,"created_at": string,"dedupe_key": string,"id": string,"job_type": string,"last_error": string | null,"locked_by": string | null,"locked_until": string | null,"max_attempts": number,"payload": NonNullable<Json>,"run_at": string,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"completed_at"?: string | null,"created_at"?: string,"dedupe_key": string,"id"?: string,"job_type": string,"last_error"?: string | null,"locked_by"?: string | null,"locked_until"?: string | null,"max_attempts"?: number,"payload"?: NonNullable<Json>,"run_at"?: string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "attempts"?: number,"completed_at"?: string | null,"created_at"?: string,"dedupe_key"?: string,"id"?: string,"job_type"?: string,"last_error"?: string | null,"locked_by"?: string | null,"locked_until"?: string | null,"max_attempts"?: number,"payload"?: NonNullable<Json>,"run_at"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [

                  ]
                },"email_deliveries": {
                  Row: {
                    "attempt_count": number,"claimed_until": string | null,"created_at": string,"event_type": string,"id": string,"idempotency_key": string,"last_error": string | null,"provider_message_id": string | null,"recipient_email": string,"sent_at": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempt_count"?: number,"claimed_until"?: string | null,"created_at"?: string,"event_type": string,"id"?: string,"idempotency_key": string,"last_error"?: string | null,"provider_message_id"?: string | null,"recipient_email": string,"sent_at"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "attempt_count"?: number,"claimed_until"?: string | null,"created_at"?: string,"event_type"?: string,"id"?: string,"idempotency_key"?: string,"last_error"?: string | null,"provider_message_id"?: string | null,"recipient_email"?: string,"sent_at"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [

                  ]
                },"email_provider_daily_usage": {
                  Row: {
                    "attempted_recipient_count": number,"cooldown_until": string | null,"created_at": string,"failed_recipient_count": number,"last_error": string | null,"provider": string,"quota_failure_count": number,"sent_recipient_count": number,"updated_at": string,"usage_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempted_recipient_count"?: number,"cooldown_until"?: string | null,"created_at"?: string,"failed_recipient_count"?: number,"last_error"?: string | null,"provider": string,"quota_failure_count"?: number,"sent_recipient_count"?: number,"updated_at"?: string,"usage_date"?: string
                  }
                  Update: {
                    "attempted_recipient_count"?: number,"cooldown_until"?: string | null,"created_at"?: string,"failed_recipient_count"?: number,"last_error"?: string | null,"provider"?: string,"quota_failure_count"?: number,"sent_recipient_count"?: number,"updated_at"?: string,"usage_date"?: string
                  }
                  Relationships: [

                  ]
                },enrolments: {
        Row: {
          course_id: string | null
          created_at: string
          enrolled_at: string
          granted_by: string | null
          id: string
          imported_at: string | null
          membership_id: string
          payment_id: string | null
          programme_id: string | null
          school_id: string
          source: string
          student_id: string
          sub_programme_id: string | null
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          enrolled_at?: string
          granted_by?: string | null
          id?: string
          imported_at?: string | null
          membership_id: string
          payment_id?: string | null
          programme_id?: string | null
          school_id: string
          source?: string
          student_id: string
          sub_programme_id?: string | null
        }
        Update: {
          course_id?: string | null
          created_at?: string
          enrolled_at?: string
          granted_by?: string | null
          id?: string
          imported_at?: string | null
          membership_id?: string
          payment_id?: string | null
          programme_id?: string | null
          school_id?: string
          source?: string
          student_id?: string
          sub_programme_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrolments_account_membership_fkey"
            columns: ["student_id", "school_id"]
            isOneToOne: false
            referencedRelation: "account_memberships"
            referencedColumns: ["person_id", "school_id"]
          },
          {
            foreignKeyName: "enrolments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrolments_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrolments_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "student_centre_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrolments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrolments_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrolments_school_course_fkey"
            columns: ["school_id", "course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "enrolments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrolments_school_programme_fkey"
            columns: ["school_id", "programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "enrolments_school_sub_programme_fkey"
            columns: ["school_id", "sub_programme_id"]
            isOneToOne: false
            referencedRelation: "sub_programmes"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "enrolments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrolments_sub_programme_id_fkey"
            columns: ["sub_programme_id"]
            isOneToOne: false
            referencedRelation: "sub_programmes"
            referencedColumns: ["id"]
          },
        ]
      },"feature_suggestions": {
                  Row: {
                    "created_at": string,"email": string | null,"id": string,"status": string,"suggestion": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"id"?: string,"status"?: string,"suggestion": string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"id"?: string,"status"?: string,"suggestion"?: string
                  }
                  Relationships: [

                  ]
                },"feedback_reports": {
                  Row: {
                    "attempted_action": string | null,"created_at": string,"description": string,"id": string,"kind": string,"page_url": string | null,"receipt_sent_at": string | null,"reporter_id": string,"resolution_sent_at": string | null,"resolved_at": string | null,"school_id": string | null,"screenshot_key": string | null,"sentry_event_id": string | null,"severity": string | null,"status": string,"user_agent": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attempted_action"?: string | null,"created_at"?: string,"description": string,"id"?: string,"kind": string,"page_url"?: string | null,"receipt_sent_at"?: string | null,"reporter_id": string,"resolution_sent_at"?: string | null,"resolved_at"?: string | null,"school_id"?: string | null,"screenshot_key"?: string | null,"sentry_event_id"?: string | null,"severity"?: string | null,"status"?: string,"user_agent"?: string | null
                  }
                  Update: {
                    "attempted_action"?: string | null,"created_at"?: string,"description"?: string,"id"?: string,"kind"?: string,"page_url"?: string | null,"receipt_sent_at"?: string | null,"reporter_id"?: string,"resolution_sent_at"?: string | null,"resolved_at"?: string | null,"school_id"?: string | null,"screenshot_key"?: string | null,"sentry_event_id"?: string | null,"severity"?: string | null,"status"?: string,"user_agent"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "feedback_reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "feedback_reports_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"guest_live_class_attendance": {
                  Row: {
                    "created_at": string,"duration_seconds": number | null,"guest_id": string,"id": string,"joined_at": string,"left_at": string | null,"live_class_id": string,"school_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"duration_seconds"?: number | null,"guest_id": string,"id"?: string,"joined_at": string,"left_at"?: string | null,"live_class_id": string,"school_id": string
                  }
                  Update: {
                    "created_at"?: string,"duration_seconds"?: number | null,"guest_id"?: string,"id"?: string,"joined_at"?: string,"left_at"?: string | null,"live_class_id"?: string,"school_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "guest_live_class_attendance_guest_id_fkey"
      columns: ["guest_id"]
isOneToOne: false
      referencedRelation: "live_class_guests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "guest_live_class_attendance_live_class_id_fkey"
      columns: ["live_class_id"]
isOneToOne: false
      referencedRelation: "live_classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "guest_live_class_attendance_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"guest_mock_attempts": {
                  Row: {
                    "attempt_id": string,"created_at": string,"guest_id": string,"id": string,"offer_id": string,"transferred_at": string | null,"transferred_to": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attempt_id": string,"created_at"?: string,"guest_id": string,"id"?: string,"offer_id": string,"transferred_at"?: string | null,"transferred_to"?: string | null
                  }
                  Update: {
                    "attempt_id"?: string,"created_at"?: string,"guest_id"?: string,"id"?: string,"offer_id"?: string,"transferred_at"?: string | null,"transferred_to"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "guest_mock_attempts_attempt_id_fkey"
      columns: ["attempt_id"]
isOneToOne: true
      referencedRelation: "mock_attempts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "guest_mock_attempts_guest_id_fkey"
      columns: ["guest_id"]
isOneToOne: false
      referencedRelation: "guest_mock_learners"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "guest_mock_attempts_offer_id_fkey"
      columns: ["offer_id"]
isOneToOne: false
      referencedRelation: "mock_access_offers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "guest_mock_attempts_transferred_to_fkey"
      columns: ["transferred_to"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"guest_mock_learners": {
                  Row: {
                    "claimed_at": string | null,"claimed_by": string | null,"created_at": string,"expires_at": string,"id": string,"last_seen_at": string,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "claimed_at"?: string | null,"claimed_by"?: string | null,"created_at"?: string,"expires_at": string,"id"?: string,"last_seen_at"?: string,"token_hash": string
                  }
                  Update: {
                    "claimed_at"?: string | null,"claimed_by"?: string | null,"created_at"?: string,"expires_at"?: string,"id"?: string,"last_seen_at"?: string,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "guest_mock_learners_claimed_by_fkey"
      columns: ["claimed_by"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"guest_mock_start_limits": {
                  Row: {
                    "attempts": number,"fingerprint_hash": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"fingerprint_hash": string,"window_start": string
                  }
                  Update: {
                    "attempts"?: number,"fingerprint_hash"?: string,"window_start"?: string
                  }
                  Relationships: [

                  ]
                },"kanvise_id_sequences": {
                  Row: {
                    "last_value": number,"role": string
                  }
                  ComputedFields: never
                  Insert: {
                    "last_value"?: number,"role": string
                  }
                  Update: {
                    "last_value"?: number,"role"?: string
                  }
                  Relationships: [

                  ]
                },"kanvise_subscriptions": {
                  Row: {
                    "amount": number,"created_at": string,"currency": string,"expires_at": string | null,"id": string,"paid_at": string | null,"paystack_reference": string,"school_id": string,"started_at": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"currency"?: string,"expires_at"?: string | null,"id"?: string,"paid_at"?: string | null,"paystack_reference": string,"school_id": string,"started_at"?: string | null,"status": string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"currency"?: string,"expires_at"?: string | null,"id"?: string,"paid_at"?: string | null,"paystack_reference"?: string,"school_id"?: string,"started_at"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "kanvise_subscriptions_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"landing_analytics_events": {
                  Row: {
                    "created_at": string,"device_type": string,"event_name": string,"event_properties": NonNullable<Json>,"id": string,"page_path": string,"referrer_host": string | null,"session_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"device_type": string,"event_name": string,"event_properties"?: NonNullable<Json>,"id"?: string,"page_path"?: string,"referrer_host"?: string | null,"session_id": string
                  }
                  Update: {
                    "created_at"?: string,"device_type"?: string,"event_name"?: string,"event_properties"?: NonNullable<Json>,"id"?: string,"page_path"?: string,"referrer_host"?: string | null,"session_id"?: string
                  }
                  Relationships: [

                  ]
                },"live_class_guests": {
                  Row: {
                    "created_at": string,"display_name": string,"expires_at": string,"id": string,"last_seen_at": string,"live_class_id": string,"revoked_at": string | null,"school_id": string,"session_token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name": string,"expires_at": string,"id"?: string,"last_seen_at"?: string,"live_class_id": string,"revoked_at"?: string | null,"school_id": string,"session_token_hash": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"expires_at"?: string,"id"?: string,"last_seen_at"?: string,"live_class_id"?: string,"revoked_at"?: string | null,"school_id"?: string,"session_token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "live_class_guests_live_class_id_fkey"
      columns: ["live_class_id"]
isOneToOne: false
      referencedRelation: "live_classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "live_class_guests_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"live_class_jobs": {
                  Row: {
                    "attempts": number,"available_at": string,"completed_at": string | null,"created_at": string,"id": string,"job_type": string,"last_error": string | null,"live_class_id": string | null,"locked_by": string | null,"locked_until": string | null,"payload": NonNullable<Json>,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"available_at"?: string,"completed_at"?: string | null,"created_at"?: string,"id"?: string,"job_type": string,"last_error"?: string | null,"live_class_id"?: string | null,"locked_by"?: string | null,"locked_until"?: string | null,"payload"?: NonNullable<Json>,"status"?: string
                  }
                  Update: {
                    "attempts"?: number,"available_at"?: string,"completed_at"?: string | null,"created_at"?: string,"id"?: string,"job_type"?: string,"last_error"?: string | null,"live_class_id"?: string | null,"locked_by"?: string | null,"locked_until"?: string | null,"payload"?: NonNullable<Json>,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "live_class_jobs_live_class_id_fkey"
      columns: ["live_class_id"]
isOneToOne: false
      referencedRelation: "live_classes"
      referencedColumns: ["id"]
    }
                  ]
                },"live_class_presentations": {
                  Row: {
                    "annotations": NonNullable<Json>,"created_at": string,"current_page": number,"file_key": string,"file_size_bytes": number,"filename": string,"id": string,"is_active": boolean,"live_class_id": string,"page_count": number | null,"page_image_dimensions": NonNullable<Json>,"page_image_keys": NonNullable<Json>,"processing_error": string | null,"processing_started_at": string | null,"processing_status": string,"school_id": string,"sort_order": number,"updated_at": string,"uploaded_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "annotations"?: NonNullable<Json>,"created_at"?: string,"current_page"?: number,"file_key": string,"file_size_bytes": number,"filename": string,"id"?: string,"is_active"?: boolean,"live_class_id": string,"page_count"?: number | null,"page_image_dimensions"?: NonNullable<Json>,"page_image_keys"?: NonNullable<Json>,"processing_error"?: string | null,"processing_started_at"?: string | null,"processing_status"?: string,"school_id": string,"sort_order"?: number,"updated_at"?: string,"uploaded_by": string
                  }
                  Update: {
                    "annotations"?: NonNullable<Json>,"created_at"?: string,"current_page"?: number,"file_key"?: string,"file_size_bytes"?: number,"filename"?: string,"id"?: string,"is_active"?: boolean,"live_class_id"?: string,"page_count"?: number | null,"page_image_dimensions"?: NonNullable<Json>,"page_image_keys"?: NonNullable<Json>,"processing_error"?: string | null,"processing_started_at"?: string | null,"processing_status"?: string,"school_id"?: string,"sort_order"?: number,"updated_at"?: string,"uploaded_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "live_class_presentations_live_class_id_fkey"
      columns: ["live_class_id"]
isOneToOne: false
      referencedRelation: "live_classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "live_class_presentations_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "live_class_presentations_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"live_class_quick_checks": {
                  Row: {
                    "candidate_id": string,"created_at": string,"id": string,"live_class_id": string,"provider_poll_id": string | null,"published_at": string | null,"questions": NonNullable<Json>,"status": string,"tutor_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "candidate_id": string,"created_at"?: string,"id"?: string,"live_class_id": string,"provider_poll_id"?: string | null,"published_at"?: string | null,"questions": NonNullable<Json>,"status"?: string,"tutor_id": string
                  }
                  Update: {
                    "candidate_id"?: string,"created_at"?: string,"id"?: string,"live_class_id"?: string,"provider_poll_id"?: string | null,"published_at"?: string | null,"questions"?: NonNullable<Json>,"status"?: string,"tutor_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "live_class_quick_checks_live_class_id_fkey"
      columns: ["live_class_id"]
isOneToOne: false
      referencedRelation: "live_classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "live_class_quick_checks_tutor_id_fkey"
      columns: ["tutor_id"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"live_class_recaps": {
                  Row: {
                    "approved_by": string | null,"course_id": string | null,"created_at": string,"draft_body": string | null,"failure_reason": string | null,"id": string,"live_class_id": string,"model_metadata": Json | null,"published_at": string | null,"published_body": string | null,"raw_transcript_key": string | null,"school_id": string,"status": string,"tutor_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_by"?: string | null,"course_id"?: string | null,"created_at"?: string,"draft_body"?: string | null,"failure_reason"?: string | null,"id"?: string,"live_class_id": string,"model_metadata"?: Json | null,"published_at"?: string | null,"published_body"?: string | null,"raw_transcript_key"?: string | null,"school_id": string,"status"?: string,"tutor_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "approved_by"?: string | null,"course_id"?: string | null,"created_at"?: string,"draft_body"?: string | null,"failure_reason"?: string | null,"id"?: string,"live_class_id"?: string,"model_metadata"?: Json | null,"published_at"?: string | null,"published_body"?: string | null,"raw_transcript_key"?: string | null,"school_id"?: string,"status"?: string,"tutor_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "live_class_recaps_approved_by_fkey"
      columns: ["approved_by"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "live_class_recaps_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "live_class_recaps_live_class_id_fkey"
      columns: ["live_class_id"]
isOneToOne: true
      referencedRelation: "live_classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "live_class_recaps_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "live_class_recaps_tutor_id_fkey"
      columns: ["tutor_id"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"live_class_recording_segments": {
                  Row: {
                    "checksum": string | null,"content_type": string,"created_at": string,"ended_at": string | null,"file_size_bytes": number | null,"id": string,"live_class_id": string,"provider_recording_id": string,"r2_file_key": string | null,"started_at": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "checksum"?: string | null,"content_type"?: string,"created_at"?: string,"ended_at"?: string | null,"file_size_bytes"?: number | null,"id"?: string,"live_class_id": string,"provider_recording_id": string,"r2_file_key"?: string | null,"started_at"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "checksum"?: string | null,"content_type"?: string,"created_at"?: string,"ended_at"?: string | null,"file_size_bytes"?: number | null,"id"?: string,"live_class_id"?: string,"provider_recording_id"?: string,"r2_file_key"?: string | null,"started_at"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "live_class_recording_segments_live_class_id_fkey"
      columns: ["live_class_id"]
isOneToOne: false
      referencedRelation: "live_classes"
      referencedColumns: ["id"]
    }
                  ]
                },live_class_recording_share_links: {
        Row: {
          created_at: string
          id: string
          live_class_id: string
          revoked_at: string | null
          school_id: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          id?: string
          live_class_id: string
          revoked_at?: string | null
          school_id: string
          token_hash: string
        }
        Update: {
          created_at?: string
          id?: string
          live_class_id?: string
          revoked_at?: string | null
          school_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_class_recording_share_links_live_class_id_fkey"
            columns: ["live_class_id"]
            isOneToOne: false
            referencedRelation: "live_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_class_recording_share_links_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      },"live_class_recordings": {
                  Row: {
                    "checksum": string | null,"content_type": string | null,"created_at": string,"ended_at": string | null,"file_size_bytes": number | null,"id": string,"live_class_id": string,"provider_recording_id": string | null,"r2_file_key": string | null,"started_at": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "checksum"?: string | null,"content_type"?: string | null,"created_at"?: string,"ended_at"?: string | null,"file_size_bytes"?: number | null,"id"?: string,"live_class_id": string,"provider_recording_id"?: string | null,"r2_file_key"?: string | null,"started_at"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "checksum"?: string | null,"content_type"?: string | null,"created_at"?: string,"ended_at"?: string | null,"file_size_bytes"?: number | null,"id"?: string,"live_class_id"?: string,"provider_recording_id"?: string | null,"r2_file_key"?: string | null,"started_at"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "live_class_recordings_live_class_id_fkey"
      columns: ["live_class_id"]
isOneToOne: true
      referencedRelation: "live_classes"
      referencedColumns: ["id"]
    }
                  ]
                },"live_class_transcript_chunks": {
                  Row: {
                    "created_at": string,"ended_at": string | null,"id": string,"is_final": boolean,"live_class_id": string,"sequence_number": number,"speaker": string,"started_at": string | null,"text": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"ended_at"?: string | null,"id"?: string,"is_final"?: boolean,"live_class_id": string,"sequence_number": number,"speaker"?: string,"started_at"?: string | null,"text": string
                  }
                  Update: {
                    "created_at"?: string,"ended_at"?: string | null,"id"?: string,"is_final"?: boolean,"live_class_id"?: string,"sequence_number"?: number,"speaker"?: string,"started_at"?: string | null,"text"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "live_class_transcript_chunks_live_class_id_fkey"
      columns: ["live_class_id"]
isOneToOne: false
      referencedRelation: "live_classes"
      referencedColumns: ["id"]
    }
                  ]
                },"live_class_transcription_sessions": {
                  Row: {
                    "created_at": string,"ended_at": string | null,"id": string,"live_class_id": string,"provider_egress_id": string | null,"started_at": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"ended_at"?: string | null,"id"?: string,"live_class_id": string,"provider_egress_id"?: string | null,"started_at"?: string | null,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"ended_at"?: string | null,"id"?: string,"live_class_id"?: string,"provider_egress_id"?: string | null,"started_at"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "live_class_transcription_sessions_live_class_id_fkey"
      columns: ["live_class_id"]
isOneToOne: true
      referencedRelation: "live_classes"
      referencedColumns: ["id"]
    }
                  ]
                },live_classes: {
        Row: {
          access_mode: string
          classroom_provider: string
          course_id: string | null
          created_at: string
          created_by: string
          duration_minutes: number
          ended_at: string | null
          id: string
          last_provider_event_at: string | null
          livekit_room_name: string | null
          notification_sent: boolean
          occurrence_date: string | null
          provider_error_at: string | null
          provider_error_message: string | null
          provider_generation: number
          provider_room_checked_at: string | null
          provider_room_id: string | null
          provider_room_status: string
          room_ready_at: string | null
          scheduled_at: string
          school_id: string
          share_link_revoked_at: string | null
          share_token_encrypted: string | null
          share_token_hash: string | null
          start_requested_at: string | null
          started_at: string | null
          status: string
          teaching_mode: string
          timetable_slot_id: string | null
          title: string
          tutor_id: string
          updated_at: string
        }
        Insert: {
          access_mode?: string
          classroom_provider?: string
          course_id?: string | null
          created_at?: string
          created_by: string
          duration_minutes: number
          ended_at?: string | null
          id?: string
          last_provider_event_at?: string | null
          livekit_room_name?: string | null
          notification_sent?: boolean
          occurrence_date?: string | null
          provider_error_at?: string | null
          provider_error_message?: string | null
          provider_generation?: number
          provider_room_checked_at?: string | null
          provider_room_id?: string | null
          provider_room_status?: string
          room_ready_at?: string | null
          scheduled_at: string
          school_id: string
          share_link_revoked_at?: string | null
          share_token_encrypted?: string | null
          share_token_hash?: string | null
          start_requested_at?: string | null
          started_at?: string | null
          status?: string
          teaching_mode?: string
          timetable_slot_id?: string | null
          title: string
          tutor_id: string
          updated_at?: string
        }
        Update: {
          access_mode?: string
          classroom_provider?: string
          course_id?: string | null
          created_at?: string
          created_by?: string
          duration_minutes?: number
          ended_at?: string | null
          id?: string
          last_provider_event_at?: string | null
          livekit_room_name?: string | null
          notification_sent?: boolean
          occurrence_date?: string | null
          provider_error_at?: string | null
          provider_error_message?: string | null
          provider_generation?: number
          provider_room_checked_at?: string | null
          provider_room_id?: string | null
          provider_room_status?: string
          room_ready_at?: string | null
          scheduled_at?: string
          school_id?: string
          share_link_revoked_at?: string | null
          share_token_encrypted?: string | null
          share_token_hash?: string | null
          start_requested_at?: string | null
          started_at?: string | null
          status?: string
          teaching_mode?: string
          timetable_slot_id?: string | null
          title?: string
          tutor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_classes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_classes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_classes_school_course_fkey"
            columns: ["school_id", "course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "live_classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_classes_timetable_slot_id_fkey"
            columns: ["timetable_slot_id"]
            isOneToOne: false
            referencedRelation: "class_timetable_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_classes_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      },"mock_access_offer_students": {
                  Row: {
                    "created_at": string,"offer_id": string,"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"offer_id": string,"student_id": string
                  }
                  Update: {
                    "created_at"?: string,"offer_id"?: string,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mock_access_offer_students_offer_id_fkey"
      columns: ["offer_id"]
isOneToOne: false
      referencedRelation: "mock_access_offers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_access_offer_students_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"mock_access_offers": {
                  Row: {
                    "access_code_hash": string | null,"access_mode": string,"attempts_included": number,"audience_scope": string,"available_from": string | null,"closes_at": string | null,"course_id": string | null,"created_at": string,"created_by": string,"currency": string,"expires_after_days": number | null,"id": string,"is_active": boolean,"mock_exam_id": string,"mock_exam_version_id": string,"price_kobo": number,"programme_id": string | null,"school_id": string,"slug": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "access_code_hash"?: string | null,"access_mode": string,"attempts_included"?: number,"audience_scope": string,"available_from"?: string | null,"closes_at"?: string | null,"course_id"?: string | null,"created_at"?: string,"created_by": string,"currency"?: string,"expires_after_days"?: number | null,"id"?: string,"is_active"?: boolean,"mock_exam_id": string,"mock_exam_version_id": string,"price_kobo"?: number,"programme_id"?: string | null,"school_id": string,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "access_code_hash"?: string | null,"access_mode"?: string,"attempts_included"?: number,"audience_scope"?: string,"available_from"?: string | null,"closes_at"?: string | null,"course_id"?: string | null,"created_at"?: string,"created_by"?: string,"currency"?: string,"expires_after_days"?: number | null,"id"?: string,"is_active"?: boolean,"mock_exam_id"?: string,"mock_exam_version_id"?: string,"price_kobo"?: number,"programme_id"?: string | null,"school_id"?: string,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mock_access_offers_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_access_offers_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_access_offers_mock_exam_id_fkey"
      columns: ["mock_exam_id"]
isOneToOne: false
      referencedRelation: "mock_exams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_access_offers_mock_exam_version_id_fkey"
      columns: ["mock_exam_version_id"]
isOneToOne: false
      referencedRelation: "mock_exam_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_access_offers_programme_id_fkey"
      columns: ["programme_id"]
isOneToOne: false
      referencedRelation: "programmes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_access_offers_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"mock_answers": {
                  Row: {
                    "attempt_id": string,"created_at": string,"id": string,"is_correct": boolean | null,"is_flagged": boolean,"mock_version_question_id": string | null,"question_id": string | null,"saved_at": string | null,"school_id": string,"selected_option_id": string | null,"selected_option_version_id": string | null,"theory_answer_text": string | null,"tutor_feedback": string | null,"tutor_score": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attempt_id": string,"created_at"?: string,"id"?: string,"is_correct"?: boolean | null,"is_flagged"?: boolean,"mock_version_question_id"?: string | null,"question_id"?: string | null,"saved_at"?: string | null,"school_id": string,"selected_option_id"?: string | null,"selected_option_version_id"?: string | null,"theory_answer_text"?: string | null,"tutor_feedback"?: string | null,"tutor_score"?: number | null
                  }
                  Update: {
                    "attempt_id"?: string,"created_at"?: string,"id"?: string,"is_correct"?: boolean | null,"is_flagged"?: boolean,"mock_version_question_id"?: string | null,"question_id"?: string | null,"saved_at"?: string | null,"school_id"?: string,"selected_option_id"?: string | null,"selected_option_version_id"?: string | null,"theory_answer_text"?: string | null,"tutor_feedback"?: string | null,"tutor_score"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "mock_answers_attempt_id_fkey"
      columns: ["attempt_id"]
isOneToOne: false
      referencedRelation: "mock_attempts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_answers_mock_version_question_id_fkey"
      columns: ["mock_version_question_id"]
isOneToOne: false
      referencedRelation: "mock_version_questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_answers_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "mock_questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_answers_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_answers_selected_option_id_fkey"
      columns: ["selected_option_id"]
isOneToOne: false
      referencedRelation: "mock_question_options"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_answers_selected_option_version_id_fkey"
      columns: ["selected_option_version_id"]
isOneToOne: false
      referencedRelation: "bank_question_option_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"mock_attempt_grants": {
                  Row: {
                    "additional_attempts": number,"created_at": string,"granted_by": string,"id": string,"mock_exam_version_id": string,"reason": string | null,"revoked_at": string | null,"revoked_by": string | null,"school_id": string,"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "additional_attempts"?: number,"created_at"?: string,"granted_by": string,"id"?: string,"mock_exam_version_id": string,"reason"?: string | null,"revoked_at"?: string | null,"revoked_by"?: string | null,"school_id": string,"student_id": string
                  }
                  Update: {
                    "additional_attempts"?: number,"created_at"?: string,"granted_by"?: string,"id"?: string,"mock_exam_version_id"?: string,"reason"?: string | null,"revoked_at"?: string | null,"revoked_by"?: string | null,"school_id"?: string,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mock_attempt_grants_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_attempt_grants_mock_exam_version_id_fkey"
      columns: ["mock_exam_version_id"]
isOneToOne: false
      referencedRelation: "mock_exam_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_attempt_grants_revoked_by_fkey"
      columns: ["revoked_by"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_attempt_grants_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_attempt_grants_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"mock_attempt_questions": {
                  Row: {
                    "attempt_id": string,"created_at": string,"id": string,"mock_version_question_id": string,"school_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempt_id": string,"created_at"?: string,"id"?: string,"mock_version_question_id": string,"school_id": string
                  }
                  Update: {
                    "attempt_id"?: string,"created_at"?: string,"id"?: string,"mock_version_question_id"?: string,"school_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mock_attempt_questions_attempt_id_fkey"
      columns: ["attempt_id"]
isOneToOne: false
      referencedRelation: "mock_attempts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_attempt_questions_mock_version_question_id_fkey"
      columns: ["mock_version_question_id"]
isOneToOne: false
      referencedRelation: "mock_version_questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_attempt_questions_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"mock_attempts": {
                  Row: {
                    "access_source": string,"attempt_number": number,"correct_mcq_answers": number | null,"created_at": string,"deadline_at": string | null,"entitlement_id": string | null,"finalized_at": string | null,"guest_email": string | null,"guest_name": string | null,"guest_phone": string | null,"id": string,"last_saved_at": string | null,"mcq_score": number | null,"mock_exam_id": string,"mock_exam_version_id": string | null,"school_id": string,"selected_subject_names": (string)[],"started_at": string,"status": string,"student_id": string | null,"submission_reason": string | null,"submitted_at": string | null,"theory_score": number | null,"total_marks": number | null,"total_mcq_questions": number | null,"total_score": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "access_source"?: string,"attempt_number"?: number,"correct_mcq_answers"?: number | null,"created_at"?: string,"deadline_at"?: string | null,"entitlement_id"?: string | null,"finalized_at"?: string | null,"guest_email"?: string | null,"guest_name"?: string | null,"guest_phone"?: string | null,"id"?: string,"last_saved_at"?: string | null,"mcq_score"?: number | null,"mock_exam_id": string,"mock_exam_version_id"?: string | null,"school_id": string,"selected_subject_names"?: (string)[],"started_at"?: string,"status"?: string,"student_id"?: string | null,"submission_reason"?: string | null,"submitted_at"?: string | null,"theory_score"?: number | null,"total_marks"?: number | null,"total_mcq_questions"?: number | null,"total_score"?: number | null
                  }
                  Update: {
                    "access_source"?: string,"attempt_number"?: number,"correct_mcq_answers"?: number | null,"created_at"?: string,"deadline_at"?: string | null,"entitlement_id"?: string | null,"finalized_at"?: string | null,"guest_email"?: string | null,"guest_name"?: string | null,"guest_phone"?: string | null,"id"?: string,"last_saved_at"?: string | null,"mcq_score"?: number | null,"mock_exam_id"?: string,"mock_exam_version_id"?: string | null,"school_id"?: string,"selected_subject_names"?: (string)[],"started_at"?: string,"status"?: string,"student_id"?: string | null,"submission_reason"?: string | null,"submitted_at"?: string | null,"theory_score"?: number | null,"total_marks"?: number | null,"total_mcq_questions"?: number | null,"total_score"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "mock_attempts_entitlement_id_fkey"
      columns: ["entitlement_id"]
isOneToOne: false
      referencedRelation: "mock_entitlements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_attempts_mock_exam_id_fkey"
      columns: ["mock_exam_id"]
isOneToOne: false
      referencedRelation: "mock_exams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_attempts_mock_exam_version_id_fkey"
      columns: ["mock_exam_version_id"]
isOneToOne: false
      referencedRelation: "mock_exam_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_attempts_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_attempts_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"mock_entitlements": {
                  Row: {
                    "attempts_consumed": number,"attempts_granted": number,"created_at": string,"expires_at": string | null,"granted_at": string,"id": string,"mock_exam_version_id": string,"offer_id": string,"order_id": string | null,"revoked_at": string | null,"revoked_by": string | null,"source": string,"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts_consumed"?: number,"attempts_granted": number,"created_at"?: string,"expires_at"?: string | null,"granted_at"?: string,"id"?: string,"mock_exam_version_id": string,"offer_id": string,"order_id"?: string | null,"revoked_at"?: string | null,"revoked_by"?: string | null,"source": string,"student_id": string
                  }
                  Update: {
                    "attempts_consumed"?: number,"attempts_granted"?: number,"created_at"?: string,"expires_at"?: string | null,"granted_at"?: string,"id"?: string,"mock_exam_version_id"?: string,"offer_id"?: string,"order_id"?: string | null,"revoked_at"?: string | null,"revoked_by"?: string | null,"source"?: string,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mock_entitlements_mock_exam_version_id_fkey"
      columns: ["mock_exam_version_id"]
isOneToOne: false
      referencedRelation: "mock_exam_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_entitlements_offer_id_fkey"
      columns: ["offer_id"]
isOneToOne: false
      referencedRelation: "mock_access_offers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_entitlements_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "mock_orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_entitlements_revoked_by_fkey"
      columns: ["revoked_by"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_entitlements_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"mock_exam_versions": {
                  Row: {
                    "created_at": string,"id": string,"mock_exam_id": string,"published_at": string,"published_by": string,"school_id": string,"settings": NonNullable<Json>,"total_marks": number,"total_questions": number,"version_number": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"mock_exam_id": string,"published_at"?: string,"published_by": string,"school_id": string,"settings"?: NonNullable<Json>,"total_marks"?: number,"total_questions"?: number,"version_number": number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"mock_exam_id"?: string,"published_at"?: string,"published_by"?: string,"school_id"?: string,"settings"?: NonNullable<Json>,"total_marks"?: number,"total_questions"?: number,"version_number"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "mock_exam_versions_mock_exam_id_fkey"
      columns: ["mock_exam_id"]
isOneToOne: false
      referencedRelation: "mock_exams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_exam_versions_published_by_fkey"
      columns: ["published_by"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_exam_versions_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"mock_exams": {
                  Row: {
                    "audience_scope": string,"available_from": string | null,"calculator_mode": string,"closes_at": string | null,"course_id": string | null,"created_at": string,"delivery_mode": string,"description": string | null,"direct_link_access_mode": string,"direct_link_enabled": boolean,"direct_link_price_kobo": number,"direct_link_slug": string | null,"id": string,"max_attempts": number,"notification_sent": boolean,"pass_mark": number | null,"programme_id": string | null,"publish_at": string | null,"result_release_mode": string,"school_id": string,"shuffle_options": boolean,"shuffle_questions": boolean,"status": string,"subject_name": string | null,"time_limit_minutes": number | null,"title": string,"total_mcq_questions": number,"total_theory_questions": number,"tutor_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "audience_scope"?: string,"available_from"?: string | null,"calculator_mode"?: string,"closes_at"?: string | null,"course_id"?: string | null,"created_at"?: string,"delivery_mode"?: string,"description"?: string | null,"direct_link_access_mode"?: string,"direct_link_enabled"?: boolean,"direct_link_price_kobo"?: number,"direct_link_slug"?: string | null,"id"?: string,"max_attempts"?: number,"notification_sent"?: boolean,"pass_mark"?: number | null,"programme_id"?: string | null,"publish_at"?: string | null,"result_release_mode"?: string,"school_id": string,"shuffle_options"?: boolean,"shuffle_questions"?: boolean,"status"?: string,"subject_name"?: string | null,"time_limit_minutes"?: number | null,"title": string,"total_mcq_questions"?: number,"total_theory_questions"?: number,"tutor_id": string,"updated_at"?: string
                  }
                  Update: {
                    "audience_scope"?: string,"available_from"?: string | null,"calculator_mode"?: string,"closes_at"?: string | null,"course_id"?: string | null,"created_at"?: string,"delivery_mode"?: string,"description"?: string | null,"direct_link_access_mode"?: string,"direct_link_enabled"?: boolean,"direct_link_price_kobo"?: number,"direct_link_slug"?: string | null,"id"?: string,"max_attempts"?: number,"notification_sent"?: boolean,"pass_mark"?: number | null,"programme_id"?: string | null,"publish_at"?: string | null,"result_release_mode"?: string,"school_id"?: string,"shuffle_options"?: boolean,"shuffle_questions"?: boolean,"status"?: string,"subject_name"?: string | null,"time_limit_minutes"?: number | null,"title"?: string,"total_mcq_questions"?: number,"total_theory_questions"?: number,"tutor_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mock_exams_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_exams_programme_id_fkey"
      columns: ["programme_id"]
isOneToOne: false
      referencedRelation: "programmes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_exams_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_exams_tutor_id_fkey"
      columns: ["tutor_id"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"mock_import_jobs": {
                  Row: {
                    "attempts": number,"available_at": string,"completed_at": string | null,"created_at": string,"discovered_subjects": NonNullable<Json>,"error_code": string | null,"error_message": string | null,"id": string,"page_count": number | null,"pages_processed": number,"phase": string,"question_count": number,"result": Json | null,"review_question_count": number,"school_id": string,"source_content_type": string,"source_file_key": string,"source_filename": string,"source_kind": string,"source_size_bytes": number,"started_at": string | null,"status": string,"tutor_id": string,"updated_at": string,"warnings": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"available_at"?: string,"completed_at"?: string | null,"created_at"?: string,"discovered_subjects"?: NonNullable<Json>,"error_code"?: string | null,"error_message"?: string | null,"id"?: string,"page_count"?: number | null,"pages_processed"?: number,"phase"?: string,"question_count"?: number,"result"?: Json | null,"review_question_count"?: number,"school_id": string,"source_content_type": string,"source_file_key": string,"source_filename": string,"source_kind": string,"source_size_bytes": number,"started_at"?: string | null,"status"?: string,"tutor_id": string,"updated_at"?: string,"warnings"?: NonNullable<Json>
                  }
                  Update: {
                    "attempts"?: number,"available_at"?: string,"completed_at"?: string | null,"created_at"?: string,"discovered_subjects"?: NonNullable<Json>,"error_code"?: string | null,"error_message"?: string | null,"id"?: string,"page_count"?: number | null,"pages_processed"?: number,"phase"?: string,"question_count"?: number,"result"?: Json | null,"review_question_count"?: number,"school_id"?: string,"source_content_type"?: string,"source_file_key"?: string,"source_filename"?: string,"source_kind"?: string,"source_size_bytes"?: number,"started_at"?: string | null,"status"?: string,"tutor_id"?: string,"updated_at"?: string,"warnings"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "mock_import_jobs_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_import_jobs_tutor_id_fkey"
      columns: ["tutor_id"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"mock_orders": {
                  Row: {
                    "amount_kobo": number,"authorization_url": string | null,"created_at": string,"currency": string,"id": string,"idempotency_key": string,"mock_exam_version_id": string,"offer_id": string,"paid_at": string | null,"paystack_reference": string,"paystack_transaction_id": string | null,"status": string,"student_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_kobo": number,"authorization_url"?: string | null,"created_at"?: string,"currency"?: string,"id"?: string,"idempotency_key": string,"mock_exam_version_id": string,"offer_id": string,"paid_at"?: string | null,"paystack_reference": string,"paystack_transaction_id"?: string | null,"status"?: string,"student_id": string,"updated_at"?: string
                  }
                  Update: {
                    "amount_kobo"?: number,"authorization_url"?: string | null,"created_at"?: string,"currency"?: string,"id"?: string,"idempotency_key"?: string,"mock_exam_version_id"?: string,"offer_id"?: string,"paid_at"?: string | null,"paystack_reference"?: string,"paystack_transaction_id"?: string | null,"status"?: string,"student_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mock_orders_mock_exam_version_id_fkey"
      columns: ["mock_exam_version_id"]
isOneToOne: false
      referencedRelation: "mock_exam_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_orders_offer_id_fkey"
      columns: ["offer_id"]
isOneToOne: false
      referencedRelation: "mock_access_offers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_orders_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"mock_question_options": {
                  Row: {
                    "created_at": string,"id": string,"is_correct": boolean,"option_text": string,"order_index": number,"question_id": string,"school_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_correct"?: boolean,"option_text": string,"order_index": number,"question_id": string,"school_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_correct"?: boolean,"option_text"?: string,"order_index"?: number,"question_id"?: string,"school_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mock_question_options_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "mock_questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_question_options_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"mock_question_rules": {
                  Row: {
                    "bank_id": string,"created_at": string,"id": string,"question_count": number,"question_type": string | null,"school_id": string,"section_id": string,"subject_name": string | null,"subtopic": string | null,"topic": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bank_id": string,"created_at"?: string,"id"?: string,"question_count": number,"question_type"?: string | null,"school_id": string,"section_id": string,"subject_name"?: string | null,"subtopic"?: string | null,"topic"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "bank_id"?: string,"created_at"?: string,"id"?: string,"question_count"?: number,"question_type"?: string | null,"school_id"?: string,"section_id"?: string,"subject_name"?: string | null,"subtopic"?: string | null,"topic"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mock_question_rules_bank_id_fkey"
      columns: ["bank_id"]
isOneToOne: false
      referencedRelation: "question_banks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_question_rules_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_question_rules_section_id_fkey"
      columns: ["section_id"]
isOneToOne: false
      referencedRelation: "mock_sections"
      referencedColumns: ["id"]
    }
                  ]
                },"mock_questions": {
                  Row: {
                    "created_at": string,"grading_rubric": string | null,"id": string,"marks": number,"mock_exam_id": string,"order_index": number,"question_text": string,"question_type": string,"school_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"grading_rubric"?: string | null,"id"?: string,"marks"?: number,"mock_exam_id": string,"order_index": number,"question_text": string,"question_type": string,"school_id": string
                  }
                  Update: {
                    "created_at"?: string,"grading_rubric"?: string | null,"id"?: string,"marks"?: number,"mock_exam_id"?: string,"order_index"?: number,"question_text"?: string,"question_type"?: string,"school_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mock_questions_mock_exam_id_fkey"
      columns: ["mock_exam_id"]
isOneToOne: false
      referencedRelation: "mock_exams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_questions_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"mock_section_questions": {
                  Row: {
                    "created_at": string,"id": string,"marks_override": number | null,"order_index": number,"question_id": string,"question_version_id": string,"school_id": string,"section_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"marks_override"?: number | null,"order_index": number,"question_id": string,"question_version_id": string,"school_id": string,"section_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"marks_override"?: number | null,"order_index"?: number,"question_id"?: string,"question_version_id"?: string,"school_id"?: string,"section_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mock_section_questions_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "bank_questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_section_questions_question_version_id_question_id_fkey"
      columns: ["question_version_id","question_id"]
isOneToOne: false
      referencedRelation: "bank_question_versions"
      referencedColumns: ["id","question_id"]
    },{
      foreignKeyName: "mock_section_questions_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_section_questions_section_id_fkey"
      columns: ["section_id"]
isOneToOne: false
      referencedRelation: "mock_sections"
      referencedColumns: ["id"]
    }
                  ]
                },"mock_sections": {
                  Row: {
                    "course_id": string | null,"created_at": string,"id": string,"instructions": string | null,"mock_exam_id": string,"order_index": number,"school_id": string,"subject_name": string | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id"?: string | null,"created_at"?: string,"id"?: string,"instructions"?: string | null,"mock_exam_id": string,"order_index": number,"school_id": string,"subject_name"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "course_id"?: string | null,"created_at"?: string,"id"?: string,"instructions"?: string | null,"mock_exam_id"?: string,"order_index"?: number,"school_id"?: string,"subject_name"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mock_sections_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_sections_mock_exam_id_fkey"
      columns: ["mock_exam_id"]
isOneToOne: false
      referencedRelation: "mock_exams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_sections_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"mock_version_questions": {
                  Row: {
                    "created_at": string,"id": string,"marks": number,"mock_exam_version_id": string,"order_index": number,"question_version_id": string,"school_id": string,"section_course_id": string | null,"section_order_index": number,"section_title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"marks": number,"mock_exam_version_id": string,"order_index": number,"question_version_id": string,"school_id": string,"section_course_id"?: string | null,"section_order_index": number,"section_title": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"marks"?: number,"mock_exam_version_id"?: string,"order_index"?: number,"question_version_id"?: string,"school_id"?: string,"section_course_id"?: string | null,"section_order_index"?: number,"section_title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mock_version_questions_mock_exam_version_id_fkey"
      columns: ["mock_exam_version_id"]
isOneToOne: false
      referencedRelation: "mock_exam_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_version_questions_question_version_id_fkey"
      columns: ["question_version_id"]
isOneToOne: false
      referencedRelation: "bank_question_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_version_questions_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mock_version_questions_section_course_id_fkey"
      columns: ["section_course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    }
                  ]
                },"notes": {
                  Row: {
                    "course_id": string,"created_at": string,"description": string | null,"file_key": string,"file_name": string,"file_size_bytes": number,"file_type": string,"id": string,"school_id": string,"title": string,"tutor_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id": string,"created_at"?: string,"description"?: string | null,"file_key": string,"file_name": string,"file_size_bytes": number,"file_type": string,"id"?: string,"school_id": string,"title": string,"tutor_id": string,"updated_at"?: string
                  }
                  Update: {
                    "course_id"?: string,"created_at"?: string,"description"?: string | null,"file_key"?: string,"file_name"?: string,"file_size_bytes"?: number,"file_type"?: string,"id"?: string,"school_id"?: string,"title"?: string,"tutor_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notes_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notes_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notes_tutor_id_fkey"
      columns: ["tutor_id"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string,"created_at": string,"id": string,"is_read": boolean,"related_entity_id": string | null,"related_entity_type": string | null,"school_id": string,"title": string,"type": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"id"?: string,"is_read"?: boolean,"related_entity_id"?: string | null,"related_entity_type"?: string | null,"school_id": string,"title": string,"type": string,"user_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: string,"is_read"?: boolean,"related_entity_id"?: string | null,"related_entity_type"?: string | null,"school_id"?: string,"title"?: string,"type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount": number,"centre_amount": number,"checkout_idempotency_key": string | null,"course_id": string | null,"created_at": string,"currency": string,"id": string,"kanvise_fee": number,"paid_at": string | null,"paystack_access_code": string | null,"paystack_authorization_url": string | null,"paystack_reference": string,"paystack_transaction_id": string | null,"programme_id": string | null,"school_id": string,"status": string,"student_id": string,"sub_programme_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"centre_amount": number,"checkout_idempotency_key"?: string | null,"course_id"?: string | null,"created_at"?: string,"currency"?: string,"id"?: string,"kanvise_fee": number,"paid_at"?: string | null,"paystack_access_code"?: string | null,"paystack_authorization_url"?: string | null,"paystack_reference": string,"paystack_transaction_id"?: string | null,"programme_id"?: string | null,"school_id": string,"status"?: string,"student_id": string,"sub_programme_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"centre_amount"?: number,"checkout_idempotency_key"?: string | null,"course_id"?: string | null,"created_at"?: string,"currency"?: string,"id"?: string,"kanvise_fee"?: number,"paid_at"?: string | null,"paystack_access_code"?: string | null,"paystack_authorization_url"?: string | null,"paystack_reference"?: string,"paystack_transaction_id"?: string | null,"programme_id"?: string | null,"school_id"?: string,"status"?: string,"student_id"?: string,"sub_programme_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_programme_id_fkey"
      columns: ["programme_id"]
isOneToOne: false
      referencedRelation: "programmes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_sub_programme_id_fkey"
      columns: ["sub_programme_id"]
isOneToOne: false
      referencedRelation: "sub_programmes"
      referencedColumns: ["id"]
    }
                  ]
                },"paystack_subaccounts": {
                  Row: {
                    "account_number": string,"bank_code": string,"business_name": string,"created_at": string,"id": string,"percentage_charge": number,"school_id": string,"subaccount_code": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_number": string,"bank_code": string,"business_name": string,"created_at"?: string,"id"?: string,"percentage_charge"?: number,"school_id": string,"subaccount_code": string
                  }
                  Update: {
                    "account_number"?: string,"bank_code"?: string,"business_name"?: string,"created_at"?: string,"id"?: string,"percentage_charge"?: number,"school_id"?: string,"subaccount_code"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "paystack_subaccounts_school_id_fkey"
      columns: ["school_id"]
isOneToOne: true
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"plugnmeet_webhook_inbox": {
                  Row: {
                    "attempts": number,"event_name": string,"id": string,"last_error": string | null,"outcome": string | null,"payload": NonNullable<Json>,"processed_at": string | null,"provider_event_id": string,"received_at": string,"room_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"event_name": string,"id"?: string,"last_error"?: string | null,"outcome"?: string | null,"payload": NonNullable<Json>,"processed_at"?: string | null,"provider_event_id": string,"received_at"?: string,"room_id"?: string | null
                  }
                  Update: {
                    "attempts"?: number,"event_name"?: string,"id"?: string,"last_error"?: string | null,"outcome"?: string | null,"payload"?: NonNullable<Json>,"processed_at"?: string | null,"provider_event_id"?: string,"received_at"?: string,"room_id"?: string | null
                  }
                  Relationships: [

                  ]
                },pending_student_enrolments: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          programme_id: string
          school_id: string
          student_profile_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          programme_id: string
          school_id: string
          student_profile_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          programme_id?: string
          school_id?: string
          student_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_student_enrolments_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_student_enrolments_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_student_enrolments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_student_enrolments_student_profile_id_fkey"
            columns: ["student_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      },"programmes": {
                  Row: {
                    "created_at": string,"created_by": string,"creation_key": string | null,"currency": string,"description": string | null,"id": string,"is_published": boolean,"name": string,"price": number,"school_id": string,"slug": string,"teaching_mode": string,"thumbnail_url": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"creation_key"?: string | null,"currency"?: string,"description"?: string | null,"id"?: string,"is_published"?: boolean,"name": string,"price"?: number,"school_id": string,"slug": string,"teaching_mode"?: string,"thumbnail_url"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"creation_key"?: string | null,"currency"?: string,"description"?: string | null,"id"?: string,"is_published"?: boolean,"name"?: string,"price"?: number,"school_id"?: string,"slug"?: string,"teaching_mode"?: string,"thumbnail_url"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "programmes_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "programmes_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"push_deliveries": {
                  Row: {
                    "attempt_count": number,"claimed_until": string | null,"created_at": string,"event_type": string,"id": string,"idempotency_key": string,"last_error": string | null,"school_id": string,"sent_at": string | null,"status": string,"subscription_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempt_count"?: number,"claimed_until"?: string | null,"created_at"?: string,"event_type": string,"id"?: string,"idempotency_key": string,"last_error"?: string | null,"school_id": string,"sent_at"?: string | null,"status"?: string,"subscription_id": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "attempt_count"?: number,"claimed_until"?: string | null,"created_at"?: string,"event_type"?: string,"id"?: string,"idempotency_key"?: string,"last_error"?: string | null,"school_id"?: string,"sent_at"?: string | null,"status"?: string,"subscription_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_deliveries_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "push_deliveries_subscription_id_fkey"
      columns: ["subscription_id"]
isOneToOne: false
      referencedRelation: "push_subscriptions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "push_deliveries_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"expiration_time": string | null,"id": string,"p256dh": string,"school_id": string,"updated_at": string,"user_agent": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"expiration_time"?: string | null,"id"?: string,"p256dh": string,"school_id": string,"updated_at"?: string,"user_agent"?: string | null,"user_id": string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"expiration_time"?: string | null,"id"?: string,"p256dh"?: string,"school_id"?: string,"updated_at"?: string,"user_agent"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_subscriptions_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "push_subscriptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"question_banks": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"description": string | null,"id": string,"name": string,"owner_id": string,"school_id": string,"source_mock_exam_id": string | null,"updated_at": string,"visibility": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"description"?: string | null,"id"?: string,"name": string,"owner_id": string,"school_id": string,"source_mock_exam_id"?: string | null,"updated_at"?: string,"visibility"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"description"?: string | null,"id"?: string,"name"?: string,"owner_id"?: string,"school_id"?: string,"source_mock_exam_id"?: string | null,"updated_at"?: string,"visibility"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_banks_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_banks_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_banks_source_mock_exam_id_fkey"
      columns: ["source_mock_exam_id"]
isOneToOne: true
      referencedRelation: "mock_exams"
      referencedColumns: ["id"]
    }
                  ]
                },"question_media": {
                  Row: {
                    "alt_text": string | null,"byte_size": number,"checksum": string,"created_at": string,"height": number | null,"id": string,"mime_type": string,"original_filename": string,"owner_id": string,"processing_status": string,"school_id": string,"storage_key": string,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "alt_text"?: string | null,"byte_size": number,"checksum": string,"created_at"?: string,"height"?: number | null,"id"?: string,"mime_type": string,"original_filename": string,"owner_id": string,"processing_status"?: string,"school_id": string,"storage_key": string,"width"?: number | null
                  }
                  Update: {
                    "alt_text"?: string | null,"byte_size"?: number,"checksum"?: string,"created_at"?: string,"height"?: number | null,"id"?: string,"mime_type"?: string,"original_filename"?: string,"owner_id"?: string,"processing_status"?: string,"school_id"?: string,"storage_key"?: string,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_media_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_media_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"question_stimuli": {
                  Row: {
                    "author_id": string,"content_blocks": NonNullable<Json>,"created_at": string,"id": string,"plain_text": string,"school_id": string,"title": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"content_blocks"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"plain_text"?: string,"school_id": string,"title"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "author_id"?: string,"content_blocks"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"plain_text"?: string,"school_id"?: string,"title"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_stimuli_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_stimuli_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"question_stimulus_media": {
                  Row: {
                    "created_at": string,"id": string,"media_id": string,"school_id": string,"stimulus_id": string,"usage_key": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"media_id": string,"school_id": string,"stimulus_id": string,"usage_key": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"media_id"?: string,"school_id"?: string,"stimulus_id"?: string,"usage_key"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_stimulus_media_media_school_fkey"
      columns: ["media_id","school_id"]
isOneToOne: false
      referencedRelation: "question_media"
      referencedColumns: ["id","school_id"]
    },{
      foreignKeyName: "question_stimulus_media_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_stimulus_media_stimulus_id_fkey"
      columns: ["stimulus_id"]
isOneToOne: false
      referencedRelation: "question_stimuli"
      referencedColumns: ["id"]
    }
                  ]
                },"recorder_fleet_readiness": {
                  Row: {
                    "last_heartbeat_at": string | null,"service_healthy_at": string | null,"service_state": string,"singleton": boolean,"start_requested_at": string | null,"updated_at": string,"vm_running_at": string | null,"vm_state": string
                  }
                  ComputedFields: never
                  Insert: {
                    "last_heartbeat_at"?: string | null,"service_healthy_at"?: string | null,"service_state"?: string,"singleton"?: boolean,"start_requested_at"?: string | null,"updated_at"?: string,"vm_running_at"?: string | null,"vm_state"?: string
                  }
                  Update: {
                    "last_heartbeat_at"?: string | null,"service_healthy_at"?: string | null,"service_state"?: string,"singleton"?: boolean,"start_requested_at"?: string | null,"updated_at"?: string,"vm_running_at"?: string | null,"vm_state"?: string
                  }
                  Relationships: [

                  ]
                },"registration_intents": {
                  Row: {
                    "consumed_at": string | null,"consumed_by": string | null,"created_at": string,"expires_at": string,"id": string,"kind": string,"return_to": string,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "consumed_at"?: string | null,"consumed_by"?: string | null,"created_at"?: string,"expires_at": string,"id"?: string,"kind": string,"return_to": string,"token_hash": string
                  }
                  Update: {
                    "consumed_at"?: string | null,"consumed_by"?: string | null,"created_at"?: string,"expires_at"?: string,"id"?: string,"kind"?: string,"return_to"?: string,"token_hash"?: string
                  }
                  Relationships: [

                  ]
                },"reviews": {
                  Row: {
                    "course_id": string | null,"created_at": string,"id": string,"is_published": boolean,"programme_id": string | null,"rating": number,"review_text": string | null,"school_id": string,"student_id": string,"sub_programme_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id"?: string | null,"created_at"?: string,"id"?: string,"is_published"?: boolean,"programme_id"?: string | null,"rating": number,"review_text"?: string | null,"school_id": string,"student_id": string,"sub_programme_id"?: string | null
                  }
                  Update: {
                    "course_id"?: string | null,"created_at"?: string,"id"?: string,"is_published"?: boolean,"programme_id"?: string | null,"rating"?: number,"review_text"?: string | null,"school_id"?: string,"student_id"?: string,"sub_programme_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "reviews_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_programme_id_fkey"
      columns: ["programme_id"]
isOneToOne: false
      referencedRelation: "programmes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_sub_programme_id_fkey"
      columns: ["sub_programme_id"]
isOneToOne: false
      referencedRelation: "sub_programmes"
      referencedColumns: ["id"]
    }
                  ]
                },"scheduler_leases": {
                  Row: {
                    "expires_at": string,"holder": string,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "expires_at": string,"holder": string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "expires_at"?: string,"holder"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [

                  ]
                },"school_promos": {
                  Row: {
                    "created_at": string,"id": string,"image_key": string,"is_active": boolean,"link_id": string,"link_type": string,"order_index": number,"school_id": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"image_key": string,"is_active"?: boolean,"link_id": string,"link_type": string,"order_index"?: number,"school_id": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"image_key"?: string,"is_active"?: boolean,"link_id"?: string,"link_type"?: string,"order_index"?: number,"school_id"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "school_promos_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"school_slug_redirects": {
                  Row: {
                    "created_at": string,"old_slug": string,"school_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"old_slug": string,"school_id": string
                  }
                  Update: {
                    "created_at"?: string,"old_slug"?: string,"school_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "school_slug_redirects_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"schools": {
                  Row: {
                    "account_type": string,"address": string | null,"banner_url": string | null,"contact_email": string | null,"contact_phone": string | null,"created_at": string,"description": string | null,"facebook_url": string | null,"id": string,"instagram_url": string | null,"is_active": boolean,"logo_url": string | null,"name": string,"paystack_subaccount_code": string | null,"slug": string,"twitter_url": string | null,"updated_at": string,"video_intro_url": string | null,"website_url": string | null,"whatsapp_number": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "account_type"?: string,"address"?: string | null,"banner_url"?: string | null,"contact_email"?: string | null,"contact_phone"?: string | null,"created_at"?: string,"description"?: string | null,"facebook_url"?: string | null,"id"?: string,"instagram_url"?: string | null,"is_active"?: boolean,"logo_url"?: string | null,"name": string,"paystack_subaccount_code"?: string | null,"slug": string,"twitter_url"?: string | null,"updated_at"?: string,"video_intro_url"?: string | null,"website_url"?: string | null,"whatsapp_number"?: string | null
                  }
                  Update: {
                    "account_type"?: string,"address"?: string | null,"banner_url"?: string | null,"contact_email"?: string | null,"contact_phone"?: string | null,"created_at"?: string,"description"?: string | null,"facebook_url"?: string | null,"id"?: string,"instagram_url"?: string | null,"is_active"?: boolean,"logo_url"?: string | null,"name"?: string,"paystack_subaccount_code"?: string | null,"slug"?: string,"twitter_url"?: string | null,"updated_at"?: string,"video_intro_url"?: string | null,"website_url"?: string | null,"whatsapp_number"?: string | null
                  }
                  Relationships: [

                  ]
                },"student_centre_memberships": {
                  Row: {
                    "created_at": string,"id": string,"joined_at": string,"revoked_at": string | null,"school_id": string,"source": string,"status": string,"student_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"joined_at"?: string,"revoked_at"?: string | null,"school_id": string,"source"?: string,"status"?: string,"student_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"joined_at"?: string,"revoked_at"?: string | null,"school_id"?: string,"source"?: string,"status"?: string,"student_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "student_centre_memberships_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_centre_memberships_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },student_programme_subjects: {
        Row: {
          course_id: string
          created_at: string
          id: string
          programme_id: string
          school_id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          programme_id: string
          school_id: string
          student_id: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          programme_id?: string
          school_id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_programme_subjects_account_membership_fkey"
            columns: ["student_id", "school_id"]
            isOneToOne: false
            referencedRelation: "account_memberships"
            referencedColumns: ["person_id", "school_id"]
          },
          {
            foreignKeyName: "student_programme_subjects_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_programme_subjects_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_programme_subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_programme_subjects_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      },sub_programmes: {
        Row: {
          created_at: string
          created_by: string
          currency: string
          description: string | null
          id: string
          is_available_separately: boolean
          is_published: boolean
          name: string
          price: number
          programme_id: string
          school_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          currency?: string
          description?: string | null
          id?: string
          is_available_separately?: boolean
          is_published?: boolean
          name: string
          price?: number
          programme_id: string
          school_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          currency?: string
          description?: string | null
          id?: string
          is_available_separately?: boolean
          is_published?: boolean
          name?: string
          price?: number
          programme_id?: string
          school_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_programmes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_programmes_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_programmes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_programmes_school_programme_fkey"
            columns: ["school_id", "programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["school_id", "id"]
          },
        ]
      },"submissions": {
                  Row: {
                    "assignment_id": string,"created_at": string,"feedback": string | null,"file_key": string,"file_name": string,"id": string,"is_late": boolean,"reviewed_at": string | null,"reviewed_by": string | null,"school_id": string,"score": number | null,"student_id": string,"submitted_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assignment_id": string,"created_at"?: string,"feedback"?: string | null,"file_key": string,"file_name": string,"id"?: string,"is_late"?: boolean,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"school_id": string,"score"?: number | null,"student_id": string,"submitted_at"?: string
                  }
                  Update: {
                    "assignment_id"?: string,"created_at"?: string,"feedback"?: string | null,"file_key"?: string,"file_name"?: string,"id"?: string,"is_late"?: boolean,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"school_id"?: string,"score"?: number | null,"student_id"?: string,"submitted_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "submissions_assignment_id_fkey"
      columns: ["assignment_id"]
isOneToOne: false
      referencedRelation: "assignments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "submissions_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "submissions_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "submissions_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"telegram_attendance_checkins": {
                  Row: {
                    "attendance_window_id": string,"checked_in_at": string,"created_at": string,"id": string,"student_id": string,"telegram_user_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "attendance_window_id": string,"checked_in_at"?: string,"created_at"?: string,"id"?: string,"student_id": string,"telegram_user_id": number
                  }
                  Update: {
                    "attendance_window_id"?: string,"checked_in_at"?: string,"created_at"?: string,"id"?: string,"student_id"?: string,"telegram_user_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "telegram_attendance_checkins_attendance_window_id_fkey"
      columns: ["attendance_window_id"]
isOneToOne: false
      referencedRelation: "telegram_attendance_windows"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "telegram_attendance_checkins_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"telegram_attendance_windows": {
                  Row: {
                    "closed_at": string | null,"closes_at": string,"created_at": string,"id": string,"live_class_id": string,"opened_by": string,"school_id": string,"status": string,"telegram_chat_id": number,"telegram_message_id": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "closed_at"?: string | null,"closes_at": string,"created_at"?: string,"id"?: string,"live_class_id": string,"opened_by": string,"school_id": string,"status"?: string,"telegram_chat_id": number,"telegram_message_id"?: number | null
                  }
                  Update: {
                    "closed_at"?: string | null,"closes_at"?: string,"created_at"?: string,"id"?: string,"live_class_id"?: string,"opened_by"?: string,"school_id"?: string,"status"?: string,"telegram_chat_id"?: number,"telegram_message_id"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "telegram_attendance_windows_live_class_id_fkey"
      columns: ["live_class_id"]
isOneToOne: false
      referencedRelation: "live_classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "telegram_attendance_windows_opened_by_fkey"
      columns: ["opened_by"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "telegram_attendance_windows_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "telegram_attendance_windows_telegram_chat_id_fkey"
      columns: ["telegram_chat_id"]
isOneToOne: false
      referencedRelation: "telegram_chats"
      referencedColumns: ["telegram_chat_id"]
    }
                  ]
                },"telegram_chats": {
                  Row: {
                    "chat_type": string,"connected_at": string,"connected_by": string,"created_at": string,"id": string,"purpose": string,"school_id": string,"status": string,"telegram_chat_id": number,"title": string | null,"updated_at": string,"username": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "chat_type": string,"connected_at"?: string,"connected_by": string,"created_at"?: string,"id"?: string,"purpose"?: string,"school_id": string,"status"?: string,"telegram_chat_id": number,"title"?: string | null,"updated_at"?: string,"username"?: string | null
                  }
                  Update: {
                    "chat_type"?: string,"connected_at"?: string,"connected_by"?: string,"created_at"?: string,"id"?: string,"purpose"?: string,"school_id"?: string,"status"?: string,"telegram_chat_id"?: number,"title"?: string | null,"updated_at"?: string,"username"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "telegram_chats_connected_by_fkey"
      columns: ["connected_by"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "telegram_chats_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"telegram_connection_codes": {
                  Row: {
                    "code_hash": string,"consumed_at": string | null,"consumed_by_telegram_user_id": number | null,"consumed_chat_id": number | null,"created_at": string,"expires_at": string,"id": string,"kind": string,"school_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code_hash": string,"consumed_at"?: string | null,"consumed_by_telegram_user_id"?: number | null,"consumed_chat_id"?: number | null,"created_at"?: string,"expires_at": string,"id"?: string,"kind": string,"school_id": string,"user_id": string
                  }
                  Update: {
                    "code_hash"?: string,"consumed_at"?: string | null,"consumed_by_telegram_user_id"?: number | null,"consumed_chat_id"?: number | null,"created_at"?: string,"expires_at"?: string,"id"?: string,"kind"?: string,"school_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "telegram_connection_codes_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "telegram_connection_codes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"telegram_deliveries": {
                  Row: {
                    "action_text": string | null,"action_url": string | null,"attempt_count": number,"created_at": string,"event_type": string,"id": string,"idempotency_key": string,"last_error": string | null,"message_text": string,"school_id": string,"sent_at": string | null,"status": string,"telegram_chat_id": number,"telegram_identity_id": string | null,"telegram_message_id": number | null,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action_text"?: string | null,"action_url"?: string | null,"attempt_count"?: number,"created_at"?: string,"event_type": string,"id"?: string,"idempotency_key": string,"last_error"?: string | null,"message_text": string,"school_id": string,"sent_at"?: string | null,"status"?: string,"telegram_chat_id": number,"telegram_identity_id"?: string | null,"telegram_message_id"?: number | null,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "action_text"?: string | null,"action_url"?: string | null,"attempt_count"?: number,"created_at"?: string,"event_type"?: string,"id"?: string,"idempotency_key"?: string,"last_error"?: string | null,"message_text"?: string,"school_id"?: string,"sent_at"?: string | null,"status"?: string,"telegram_chat_id"?: number,"telegram_identity_id"?: string | null,"telegram_message_id"?: number | null,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "telegram_deliveries_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "telegram_deliveries_telegram_identity_id_fkey"
      columns: ["telegram_identity_id"]
isOneToOne: false
      referencedRelation: "telegram_identities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "telegram_deliveries_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"telegram_identities": {
                  Row: {
                    "created_at": string,"first_name": string | null,"id": string,"last_interaction_at": string,"linked_at": string,"private_chat_id": number,"reminders_enabled": boolean,"school_id": string,"telegram_user_id": number,"updated_at": string,"user_id": string,"username": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"first_name"?: string | null,"id"?: string,"last_interaction_at"?: string,"linked_at"?: string,"private_chat_id": number,"reminders_enabled"?: boolean,"school_id": string,"telegram_user_id": number,"updated_at"?: string,"user_id": string,"username"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"first_name"?: string | null,"id"?: string,"last_interaction_at"?: string,"linked_at"?: string,"private_chat_id"?: number,"reminders_enabled"?: boolean,"school_id"?: string,"telegram_user_id"?: number,"updated_at"?: string,"user_id"?: string,"username"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "telegram_identities_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "telegram_identities_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"telegram_link_challenges": {
                  Row: {
                    "completed_at": string | null,"confirmation_code_hash": string | null,"confirmation_expires_at": string | null,"created_at": string,"expires_at": string,"id": string,"private_chat_id": number | null,"school_id": string,"telegram_first_name": string | null,"telegram_user_id": number | null,"telegram_username": string | null,"token_hash": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"confirmation_code_hash"?: string | null,"confirmation_expires_at"?: string | null,"created_at"?: string,"expires_at": string,"id"?: string,"private_chat_id"?: number | null,"school_id": string,"telegram_first_name"?: string | null,"telegram_user_id"?: number | null,"telegram_username"?: string | null,"token_hash": string,"user_id": string
                  }
                  Update: {
                    "completed_at"?: string | null,"confirmation_code_hash"?: string | null,"confirmation_expires_at"?: string | null,"created_at"?: string,"expires_at"?: string,"id"?: string,"private_chat_id"?: number | null,"school_id"?: string,"telegram_first_name"?: string | null,"telegram_user_id"?: number | null,"telegram_username"?: string | null,"token_hash"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "telegram_link_challenges_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "telegram_link_challenges_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },tutor_course_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          course_id: string
          created_at: string
          id: string
          school_id: string
          tutor_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          course_id: string
          created_at?: string
          id?: string
          school_id: string
          tutor_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          course_id?: string
          created_at?: string
          id?: string
          school_id?: string
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_course_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_course_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_course_assignments_school_course_fkey"
            columns: ["school_id", "course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "tutor_course_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_course_assignments_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      },"tutor_invites": {
                  Row: {
                    "accepted_at": string | null,"created_at": string,"email": string,"expires_at": string,"id": string,"invited_by": string,"school_id": string,"status": string,"supabase_auth_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"created_at"?: string,"email": string,"expires_at": string,"id"?: string,"invited_by": string,"school_id": string,"status"?: string,"supabase_auth_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "accepted_at"?: string | null,"created_at"?: string,"email"?: string,"expires_at"?: string,"id"?: string,"invited_by"?: string,"school_id"?: string,"status"?: string,"supabase_auth_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tutor_invites_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tutor_invites_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"user_profiles": {
                  Row: {
                    "activated_at": string | null,"added_by": string | null,"bio": string | null,"created_at": string,"email": string | null,"first_name": string,"id": string,"is_active": boolean,"kanvise_user_id": string,"last_name": string,"onboarding_source": string,"onboarding_status": string,"phone": string | null,"profile_photo_key": string | null,"profile_photo_url": string | null,"role": string,"school_id": string | null,"supabase_auth_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activated_at"?: string | null,"added_by"?: string | null,"bio"?: string | null,"created_at"?: string,"email"?: string | null,"first_name": string,"id"?: string,"is_active"?: boolean,"kanvise_user_id": string,"last_name": string,"onboarding_source"?: string,"onboarding_status"?: string,"phone"?: string | null,"profile_photo_key"?: string | null,"profile_photo_url"?: string | null,"role": string,"school_id"?: string | null,"supabase_auth_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "activated_at"?: string | null,"added_by"?: string | null,"bio"?: string | null,"created_at"?: string,"email"?: string | null,"first_name"?: string,"id"?: string,"is_active"?: boolean,"kanvise_user_id"?: string,"last_name"?: string,"onboarding_source"?: string,"onboarding_status"?: string,"phone"?: string | null,"profile_photo_key"?: string | null,"profile_photo_url"?: string | null,"role"?: string,"school_id"?: string | null,"supabase_auth_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_profiles_added_by_fkey"
      columns: ["added_by"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_profiles_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"waitlist_signups": {
                  Row: {
                    "centre_name": string,"contact_email": string,"contact_name": string,"contact_phone": string | null,"created_at": string,"estimated_student_count": number | null,"id": string,"status": string,"updated_at": string,"wants_beta_testing": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "centre_name": string,"contact_email": string,"contact_name": string,"contact_phone"?: string | null,"created_at"?: string,"estimated_student_count"?: number | null,"id"?: string,"status"?: string,"updated_at"?: string,"wants_beta_testing"?: boolean
                  }
                  Update: {
                    "centre_name"?: string,"contact_email"?: string,"contact_name"?: string,"contact_phone"?: string | null,"created_at"?: string,"estimated_student_count"?: number | null,"id"?: string,"status"?: string,"updated_at"?: string,"wants_beta_testing"?: boolean
                  }
                  Relationships: [

                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "acquire_scheduler_lease":
{ Args: { "p_holder": string,"p_name": string,"p_ttl_seconds": number }; Returns: boolean
                           },
"add_programme_subject":
{ Args: { "p_created_by": string,"p_description": string,"p_name": string,"p_programme_id": string,"p_school_id": string,"p_slug": string,"p_tutor_ids": (string)[] }; Returns: Json
                           },
"bind_question_block_media":
{ Args: { "p_blocks": Json,"p_question_version_id": string,"p_school_id": string,"p_usage_prefix": string }; Returns: undefined
                           },
"cancel_recurring_live_class":
{ Args: { "p_actor_id": string,"p_school_id": string,"p_slot_id": string }; Returns: number
                           },
"cancel_student_invitation":
{ Args: { "p_school_id": string,"p_student_id": string }; Returns: Json
                           },
"claim_free_mock_offer":
{ Args: { "p_now": string,"p_offer_id": string,"p_student_id": string }; Returns: {
              "entitlement_id": string,"newly_claimed": boolean
            }[]
                           },
"claim_durable_jobs":
{ Args: { "p_job_types": (string)[],"p_lease_seconds"?: number,"p_limit"?: number,"p_worker": string }; Returns: {
              "attempts": number,"completed_at": string | null,"created_at": string,"dedupe_key": string,"id": string,"job_type": string,"last_error": string | null,"locked_by": string | null,"locked_until": string | null,"max_attempts": number,"payload": NonNullable<Json>,"run_at": string,"status": string,"updated_at": string
            }[]
                           },
"claim_email_delivery":
{ Args: { "p_key": string,"p_lease_seconds"?: number }; Returns: boolean
                           },
"claim_push_delivery":
{ Args: { "p_key": string,"p_lease_seconds"?: number }; Returns: boolean
                           },
"complete_durable_job":
{ Args: { "p_id": string,"p_worker": string }; Returns: boolean
                           },
"complete_student_invitation":
{ Args: { "p_email": string,"p_first_name": string,"p_last_name": string,"p_supabase_auth_id": string,"p_token_hash": string }; Returns: Json
                           },
"confirm_mock_order_payment":
{ Args: { "p_amount_kobo": number,"p_now": string,"p_paystack_reference": string,"p_paystack_transaction_id": string }; Returns: {
              "already_processed": boolean,"entitlement_id": string,"offer_title": string,"order_id": string,"student_email": string,"student_first_name": string,"student_id": string
            }[]
                           },
"confirm_student_payment":
{ Args: { "p_amount_kobo": number,"p_paystack_reference": string,"p_paystack_transaction_id": string }; Returns: Json
                           },
"consume_account_invitation":
{ Args: { "p_email": string,"p_supabase_auth_id": string,"p_token_hash": string }; Returns: {
              "accepted_at": string | null,
"auth_started_at": string | null,
"created_at": string,
"email": string,
"expires_at": string,
"id": string,
"invited_by": string,
"metadata": NonNullable<Json>,
"role": string,
"school_id": string,
"status": string,
"student_profile_id": string | null,
"supabase_auth_id": string | null,
"token_hash": string,
"tutor_invite_id": string | null,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "account_invitations"
        isOneToOne: true
        isSetofReturn: false
      } },
"consume_guest_mock_start_limit":
{ Args: { "p_fingerprint_hash": string,"p_max_attempts"?: number,"p_now": string }; Returns: boolean
                           },
"consume_tutor_invite":
{ Args: { "p_email": string,"p_invite_id": string,"p_supabase_auth_id": string }; Returns: string
                           },
"create_bank_question_versioned":
{ Args: { "p_author_id": string,"p_bank_id": string,"p_content_blocks": Json,"p_course_id": string,"p_explanation_blocks": Json,"p_grading_rubric_blocks": Json,"p_marks": number,"p_options": Json,"p_plain_text": string,"p_question_type": string,"p_school_id": string,"p_stimulus_id": string,"p_subject_name": string,"p_subtopic": string,"p_topic": string }; Returns: {
              "question_id": string,"version_id": string
            }[]
                           },
"create_recurring_live_class":
{ Args: { "p_actor_id": string,"p_course_id": string,"p_duration_minutes": number,"p_school_id": string,"p_start_time": string,"p_starts_on": string,"p_timezone": string,"p_title": string,"p_tutor_id": string }; Returns: string
                           },
"create_recurring_live_class_series":
{ Args: { "p_actor_id": string,"p_course_id": string,"p_duration_minutes": number,"p_school_id": string,"p_start_time": string,"p_starts_on": string,"p_timezone": string,"p_title": string,"p_tutor_id": string,"p_weekdays": (number)[] }; Returns: string
                           },
"create_school_for_admin":
{ Args: { "p_account_type": string,"p_admin_id": string,"p_contact_email"?: string,"p_contact_phone"?: string,"p_description"?: string,"p_name": string,"p_slug": string }; Returns: Json
                           },
"delete_programme_checked":
{ Args: { "p_programme_id": string,"p_school_id": string }; Returns: string
                           },
"current_user_school_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"enqueue_durable_job":
{ Args: { "p_dedupe_key": string,"p_job_type": string,"p_max_attempts"?: number,"p_payload"?: Json,"p_run_at"?: string }; Returns: string
                           },
"extend_durable_job_lease":
{ Args: { "p_id": string,"p_lease_seconds"?: number,"p_worker": string }; Returns: boolean
                           },
"fail_durable_job":
{ Args: { "p_error": string,"p_id": string,"p_retry_seconds"?: number,"p_worker": string }; Returns: boolean
                           },
"import_roster_students":
{ Args: { "p_invited_by": string,"p_rows": Json,"p_school_id": string }; Returns: Json
                           },
"increment_user_sequence":
{ Args: { "p_role": string }; Returns: number
                           },
"issue_account_invitation":
{ Args: { "p_email": string,"p_expires_at": string,"p_invited_by": string,"p_metadata"?: Json,"p_role": string,"p_school_id": string,"p_student_profile_id"?: string,"p_token_hash": string }; Returns: Json
                           },
"materialize_class_timetable":
{ Args: { "p_horizon_days"?: number,"p_school_id": string,"p_timetable_id": string }; Returns: number
                           },
"materialize_direct_class_series":
{ Args: { "p_horizon_days"?: number,"p_school_id": string,"p_slot_id": string }; Returns: number
                           },
"materialize_published_class_timetables":
{ Args: { "p_horizon_days"?: number }; Returns: number
                           },
"publish_class_timetable":
{ Args: { "p_published_by": string,"p_school_id": string,"p_timetable_id": string }; Returns: number
                           },
"publish_versioned_mock":
{ Args: { "p_mock_exam_id": string,"p_published_at": string,"p_published_by": string,"p_school_id": string }; Returns: {
              "mock_exam_version_id": string,"total_marks": number,"total_questions": number,"version_number": number
            }[]
                           },
"publish_versioned_mock_with_offer":
{ Args: { "p_create_direct_offer": boolean,"p_direct_access_mode": string,"p_direct_price_kobo": number,"p_direct_slug": string,"p_mock_exam_id": string,"p_published_at": string,"p_published_by": string,"p_school_id": string }; Returns: {
              "direct_offer_id": string,"direct_offer_slug": string,"mock_exam_version_id": string,"total_marks": number,"total_questions": number,"version_number": number
            }[]
                           },
"record_email_provider_result":
{ Args: { "p_cooldown_until"?: string,"p_error"?: string,"p_provider": string,"p_quota_failure"?: boolean,"p_recipient_count": number,"p_succeeded": boolean }; Returns: undefined
                           },
"record_invitation_start":
{ Args: { "p_invitation_id": string,"p_supabase_auth_id": string }; Returns: Json
                           },
"record_telegram_attendance_checkin":
{ Args: { "p_chat_id": number,"p_telegram_user_id": number,"p_window_id": string }; Returns: Json
                           },
"register_user_profile":
{ Args: { "p_email": string,"p_first_name": string,"p_intent_token_hash"?: string,"p_invitation_token_hash"?: string,"p_last_name": string,"p_role": string,"p_supabase_auth_id": string }; Returns: Json
                           },
"release_scheduler_lease":
{ Args: { "p_holder": string,"p_name": string }; Returns: undefined
                           },
"remove_user_from_school":
{ Args: { "p_school_id": string,"p_target_user_id": string }; Returns: Json
                           },
"replace_authored_mock_questions":
{ Args: { "p_author_id": string,"p_mock_exam_id": string,"p_questions": Json,"p_school_id": string }; Returns: {
              "bank_id": string,"question_count": number,"section_id": string
            }[]
                           },
"replace_versioned_mock_assembly":
{ Args: { "p_mock_exam_id": string,"p_school_id": string,"p_sections": Json }; Returns: {
              "fixed_question_count": number,"rule_count": number,"section_count": number
            }[]
                           },
"reserve_email_provider_capacity":
{ Args: { "p_daily_limit": number,"p_provider": string,"p_recipient_count"?: number,"p_threshold_percent": number }; Returns: Json
                           },
"revise_bank_question_versioned":
{ Args: { "p_content_blocks": Json,"p_course_id": string,"p_editor_id": string,"p_explanation_blocks": Json,"p_grading_rubric_blocks": Json,"p_marks": number,"p_options": Json,"p_plain_text": string,"p_question_id": string,"p_school_id": string,"p_stimulus_id": string,"p_subject_name": string,"p_subtopic": string,"p_topic": string }; Returns: {
              "question_id": string,"version_id": string,"version_number": number
            }[]
                           },
"revoke_tutor_invitation":
{ Args: { "p_school_id": string,"p_tutor_invite_id": string }; Returns: Json
                           },
"save_guest_mock_answer":
{ Args: { "p_attempt_id": string,"p_guest_id": string,"p_is_flagged": boolean,"p_mock_version_question_id": string,"p_now": string,"p_selected_option_version_id": string,"p_theory_answer_text": string }; Returns: {
              "answer_id": string,"saved_at": string
            }[]
                           },
"save_versioned_mock_answer":
{ Args: { "p_attempt_id": string,"p_is_flagged": boolean,"p_mock_version_question_id": string,"p_now": string,"p_school_id": string,"p_selected_option_version_id": string,"p_student_id": string,"p_theory_answer_text": string }; Returns: {
              "answer_id": string,"saved_at": string
            }[]
                           },
"setup_programme":
{ Args: { "p_created_by": string,"p_creation_key": string,"p_currency": string,"p_description": string,"p_name": string,"p_price": number,"p_school_id": string,"p_slug": string,"p_subjects": Json }; Returns: Json
                           },
"start_or_resume_guest_mock_attempt":
{ Args: { "p_guest_id": string,"p_now": string,"p_offer_id": string }; Returns: {
              "attempt_id": string,"deadline_at": string,"mock_exam_version_id": string,"resumed": boolean,"started_at": string
            }[]
                           },
"start_or_resume_guest_mock_attempt_with_subjects":
{ Args: { "p_guest_id": string,"p_now": string,"p_offer_id": string,"p_selected_subject_names": (string)[] }; Returns: {
              "attempt_id": string,"deadline_at": string,"mock_exam_version_id": string,"resumed": boolean,"started_at": string
            }[]
                           },
"start_or_resume_mock_offer_attempt":
{ Args: { "p_now": string,"p_offer_id": string,"p_student_id": string }; Returns: {
              "attempt_id": string,"attempt_number": number,"deadline_at": string,"mock_exam_version_id": string,"resumed": boolean,"started_at": string
            }[]
                           },
"start_or_resume_mock_offer_attempt_with_subjects":
{ Args: { "p_now": string,"p_offer_id": string,"p_selected_subject_names": (string)[],"p_student_id": string }; Returns: {
              "attempt_id": string,"attempt_number": number,"deadline_at": string,"mock_exam_version_id": string,"resumed": boolean,"started_at": string
            }[]
                           },
"start_or_resume_versioned_mock_attempt":
{ Args: { "p_mock_exam_id": string,"p_now": string,"p_school_id": string,"p_student_id": string }; Returns: {
              "attempt_id": string,"attempt_number": number,"deadline_at": string,"mock_exam_version_id": string,"resumed": boolean,"started_at": string
            }[]
                           },
"submit_guest_mock_attempt":
{ Args: { "p_attempt_id": string,"p_guest_id": string,"p_now": string,"p_reason": string }; Returns: {
              "mcq_score": number,"status": string,"submitted_at": string,"total_marks": number,"total_score": number
            }[]
                           } |
{ Args: { "p_attempt_id": string,"p_guest_email"?: string,"p_guest_id": string,"p_guest_name"?: string,"p_guest_phone"?: string,"p_now": string,"p_reason": string }; Returns: {
              "mcq_score": number,"status": string,"submitted_at": string,"total_marks": number,"total_score": number
            }[]
                           },
"submit_versioned_mock_attempt":
{ Args: { "p_attempt_id": string,"p_now": string,"p_reason": string,"p_school_id": string,"p_student_id": string }; Returns: {
              "mcq_score": number,"status": string,"submitted_at": string,"total_marks": number,"total_score": number
            }[]
                           },
"transfer_guest_mock_attempt":
{ Args: { "p_attempt_id": string,"p_guest_id": string,"p_now": string,"p_student_id": string }; Returns: {
              "already_transferred": boolean,"attempt_id": string,"entitlement_id": string
            }[]
                           },
"unpublish_class_timetable":
{ Args: { "p_actor_id": string,"p_school_id": string,"p_timetable_id": string }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {

          }
        }
} as const
