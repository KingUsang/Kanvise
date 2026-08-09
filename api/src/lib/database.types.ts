export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      assignments: {
        Row: {
          attachment_file_key: string | null
          attachment_file_name: string | null
          course_id: string
          created_at: string
          deadline_at: string
          description: string
          id: string
          is_published: boolean
          school_id: string
          title: string
          tutor_id: string
          updated_at: string
        }
        Insert: {
          attachment_file_key?: string | null
          attachment_file_name?: string | null
          course_id: string
          created_at?: string
          deadline_at: string
          description: string
          id?: string
          is_published?: boolean
          school_id: string
          title: string
          tutor_id: string
          updated_at?: string
        }
        Update: {
          attachment_file_key?: string | null
          attachment_file_name?: string | null
          course_id?: string
          created_at?: string
          deadline_at?: string
          description?: string
          id?: string
          is_published?: boolean
          school_id?: string
          title?: string
          tutor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          joined_at: string
          left_at: string | null
          live_class_id: string
          school_id: string
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
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      avatar_configs: {
        Row: {
          accessory: string | null
          created_at: string
          face_shape: string
          hair_colour: string
          hair_style: string
          headwear: string | null
          id: string
          outfit_colour: string
          school_id: string
          skin_tone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accessory?: string | null
          created_at?: string
          face_shape: string
          hair_colour: string
          hair_style: string
          headwear?: string | null
          id?: string
          outfit_colour: string
          school_id: string
          skin_tone: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accessory?: string | null
          created_at?: string
          face_shape?: string
          hair_colour?: string
          hair_style?: string
          headwear?: string | null
          id?: string
          outfit_colour?: string
          school_id?: string
          skin_tone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "avatar_configs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avatar_configs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_question_option_versions: {
        Row: {
          content_blocks: Json
          created_at: string
          id: string
          is_correct: boolean
          order_index: number
          plain_text: string
          question_version_id: string
          school_id: string
        }
        Insert: {
          content_blocks?: Json
          created_at?: string
          id?: string
          is_correct?: boolean
          order_index: number
          plain_text?: string
          question_version_id: string
          school_id: string
        }
        Update: {
          content_blocks?: Json
          created_at?: string
          id?: string
          is_correct?: boolean
          order_index?: number
          plain_text?: string
          question_version_id?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_question_option_versions_question_version_id_fkey"
            columns: ["question_version_id"]
            isOneToOne: false
            referencedRelation: "bank_question_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_question_option_versions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_question_version_media: {
        Row: {
          created_at: string
          id: string
          media_id: string
          question_version_id: string
          school_id: string
          usage_key: string
        }
        Insert: {
          created_at?: string
          id?: string
          media_id: string
          question_version_id: string
          school_id: string
          usage_key: string
        }
        Update: {
          created_at?: string
          id?: string
          media_id?: string
          question_version_id?: string
          school_id?: string
          usage_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_question_version_media_media_school_fkey"
            columns: ["media_id", "school_id"]
            isOneToOne: false
            referencedRelation: "question_media"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "bank_question_version_media_question_version_id_fkey"
            columns: ["question_version_id"]
            isOneToOne: false
            referencedRelation: "bank_question_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_question_version_media_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_question_versions: {
        Row: {
          content_blocks: Json
          created_at: string
          created_by: string
          explanation_blocks: Json
          grading_rubric_blocks: Json
          id: string
          marks: number
          plain_text: string
          question_id: string
          school_id: string
          stimulus_id: string | null
          version_number: number
        }
        Insert: {
          content_blocks?: Json
          created_at?: string
          created_by: string
          explanation_blocks?: Json
          grading_rubric_blocks?: Json
          id?: string
          marks?: number
          plain_text?: string
          question_id: string
          school_id: string
          stimulus_id?: string | null
          version_number: number
        }
        Update: {
          content_blocks?: Json
          created_at?: string
          created_by?: string
          explanation_blocks?: Json
          grading_rubric_blocks?: Json
          id?: string
          marks?: number
          plain_text?: string
          question_id?: string
          school_id?: string
          stimulus_id?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "bank_question_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_question_versions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "bank_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_question_versions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_question_versions_stimulus_id_fkey"
            columns: ["stimulus_id"]
            isOneToOne: false
            referencedRelation: "question_stimuli"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_questions: {
        Row: {
          archived_at: string | null
          author_id: string
          bank_id: string
          course_id: string | null
          created_at: string
          current_version_id: string | null
          id: string
          question_type: string
          school_id: string
          search_text: string
          status: string
          subject_name: string | null
          subtopic: string | null
          topic: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          author_id: string
          bank_id: string
          course_id?: string | null
          created_at?: string
          current_version_id?: string | null
          id?: string
          question_type: string
          school_id: string
          search_text?: string
          status?: string
          subject_name?: string | null
          subtopic?: string | null
          topic?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          author_id?: string
          bank_id?: string
          course_id?: string | null
          created_at?: string
          current_version_id?: string | null
          id?: string
          question_type?: string
          school_id?: string
          search_text?: string
          status?: string
          subject_name?: string | null
          subtopic?: string | null
          topic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_questions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_questions_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "question_banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_questions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_questions_current_version_fkey"
            columns: ["current_version_id", "id"]
            isOneToOne: false
            referencedRelation: "bank_question_versions"
            referencedColumns: ["id", "question_id"]
          },
          {
            foreignKeyName: "bank_questions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
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
          price: number
          programme_id?: string | null
          school_id: string
          slug: string
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
            foreignKeyName: "courses_sub_programme_id_fkey"
            columns: ["sub_programme_id"]
            isOneToOne: false
            referencedRelation: "sub_programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      email_deliveries: {
        Row: {
          attempt_count: number
          created_at: string
          event_type: string
          id: string
          idempotency_key: string
          last_error: string | null
          provider_message_id: string | null
          recipient_email: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          event_type: string
          id?: string
          idempotency_key: string
          last_error?: string | null
          provider_message_id?: string | null
          recipient_email: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          event_type?: string
          id?: string
          idempotency_key?: string
          last_error?: string | null
          provider_message_id?: string | null
          recipient_email?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      enrolments: {
        Row: {
          course_id: string | null
          created_at: string
          enrolled_at: string
          granted_by: string | null
          id: string
          imported_at: string | null
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
          payment_id?: string | null
          programme_id?: string | null
          school_id?: string
          source?: string
          student_id?: string
          sub_programme_id?: string | null
        }
        Relationships: [
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
            foreignKeyName: "enrolments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
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
      }
      feature_suggestions: {
        Row: {
          created_at: string
          email: string | null
          id: string
          status: string | null
          suggestion: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          status?: string | null
          suggestion: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          status?: string | null
          suggestion?: string
        }
        Relationships: []
      }
      kanvise_id_sequences: {
        Row: {
          last_value: number
          role: string
        }
        Insert: {
          last_value?: number
          role: string
        }
        Update: {
          last_value?: number
          role?: string
        }
        Relationships: []
      }
      kanvise_subscriptions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          expires_at: string | null
          id: string
          paid_at: string | null
          paystack_reference: string
          school_id: string
          started_at: string | null
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          paid_at?: string | null
          paystack_reference: string
          school_id: string
          started_at?: string | null
          status: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          paid_at?: string | null
          paystack_reference?: string
          school_id?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanvise_subscriptions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      live_classes: {
        Row: {
          course_id: string
          created_at: string
          created_by: string
          duration_minutes: number
          ended_at: string | null
          id: string
          livekit_room_name: string | null
          notification_sent: boolean
          scheduled_at: string
          school_id: string
          slides_urls: string[] | null
          started_at: string | null
          status: string
          title: string
          tutor_id: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by: string
          duration_minutes: number
          ended_at?: string | null
          id?: string
          livekit_room_name?: string | null
          notification_sent?: boolean
          scheduled_at: string
          school_id: string
          slides_urls?: string[] | null
          started_at?: string | null
          status?: string
          title: string
          tutor_id: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string
          duration_minutes?: number
          ended_at?: string | null
          id?: string
          livekit_room_name?: string | null
          notification_sent?: boolean
          scheduled_at?: string
          school_id?: string
          slides_urls?: string[] | null
          started_at?: string | null
          status?: string
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
            foreignKeyName: "live_classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
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
      }
      mock_answers: {
        Row: {
          attempt_id: string
          created_at: string
          id: string
          is_correct: boolean | null
          is_flagged: boolean
          mock_version_question_id: string | null
          question_id: string | null
          saved_at: string | null
          school_id: string
          selected_option_id: string | null
          selected_option_version_id: string | null
          theory_answer_text: string | null
          tutor_feedback: string | null
          tutor_score: number | null
        }
        Insert: {
          attempt_id: string
          created_at?: string
          id?: string
          is_correct?: boolean | null
          is_flagged?: boolean
          mock_version_question_id?: string | null
          question_id?: string | null
          saved_at?: string | null
          school_id: string
          selected_option_id?: string | null
          selected_option_version_id?: string | null
          theory_answer_text?: string | null
          tutor_feedback?: string | null
          tutor_score?: number | null
        }
        Update: {
          attempt_id?: string
          created_at?: string
          id?: string
          is_correct?: boolean | null
          is_flagged?: boolean
          mock_version_question_id?: string | null
          question_id?: string | null
          saved_at?: string | null
          school_id?: string
          selected_option_id?: string | null
          selected_option_version_id?: string | null
          theory_answer_text?: string | null
          tutor_feedback?: string | null
          tutor_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mock_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "mock_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_answers_mock_version_question_id_fkey"
            columns: ["mock_version_question_id"]
            isOneToOne: false
            referencedRelation: "mock_version_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "mock_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_answers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_answers_selected_option_id_fkey"
            columns: ["selected_option_id"]
            isOneToOne: false
            referencedRelation: "mock_question_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_answers_selected_option_version_id_fkey"
            columns: ["selected_option_version_id"]
            isOneToOne: false
            referencedRelation: "bank_question_option_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_attempt_grants: {
        Row: {
          additional_attempts: number
          created_at: string
          granted_by: string
          id: string
          mock_exam_version_id: string
          reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          school_id: string
          student_id: string
        }
        Insert: {
          additional_attempts?: number
          created_at?: string
          granted_by: string
          id?: string
          mock_exam_version_id: string
          reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          school_id: string
          student_id: string
        }
        Update: {
          additional_attempts?: number
          created_at?: string
          granted_by?: string
          id?: string
          mock_exam_version_id?: string
          reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_attempt_grants_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_attempt_grants_mock_exam_version_id_fkey"
            columns: ["mock_exam_version_id"]
            isOneToOne: false
            referencedRelation: "mock_exam_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_attempt_grants_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_attempt_grants_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_attempt_grants_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_attempts: {
        Row: {
          access_source: string
          attempt_number: number
          correct_mcq_answers: number | null
          created_at: string
          deadline_at: string | null
          finalized_at: string | null
          id: string
          last_saved_at: string | null
          marketplace_entitlement_id: string | null
          mcq_score: number | null
          mock_exam_id: string
          mock_exam_version_id: string | null
          school_id: string
          started_at: string
          status: string
          student_id: string
          submission_reason: string | null
          submitted_at: string | null
          theory_score: number | null
          total_marks: number | null
          total_mcq_questions: number | null
          total_score: number | null
        }
        Insert: {
          access_source?: string
          attempt_number?: number
          correct_mcq_answers?: number | null
          created_at?: string
          deadline_at?: string | null
          finalized_at?: string | null
          id?: string
          last_saved_at?: string | null
          marketplace_entitlement_id?: string | null
          mcq_score?: number | null
          mock_exam_id: string
          mock_exam_version_id?: string | null
          school_id: string
          started_at?: string
          status?: string
          student_id: string
          submission_reason?: string | null
          submitted_at?: string | null
          theory_score?: number | null
          total_marks?: number | null
          total_mcq_questions?: number | null
          total_score?: number | null
        }
        Update: {
          access_source?: string
          attempt_number?: number
          correct_mcq_answers?: number | null
          created_at?: string
          deadline_at?: string | null
          finalized_at?: string | null
          id?: string
          last_saved_at?: string | null
          marketplace_entitlement_id?: string | null
          mcq_score?: number | null
          mock_exam_id?: string
          mock_exam_version_id?: string | null
          school_id?: string
          started_at?: string
          status?: string
          student_id?: string
          submission_reason?: string | null
          submitted_at?: string | null
          theory_score?: number | null
          total_marks?: number | null
          total_mcq_questions?: number | null
          total_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mock_attempts_marketplace_entitlement_id_fkey"
            columns: ["marketplace_entitlement_id"]
            isOneToOne: false
            referencedRelation: "mock_marketplace_entitlements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_attempts_mock_exam_id_fkey"
            columns: ["mock_exam_id"]
            isOneToOne: false
            referencedRelation: "mock_exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_attempts_mock_exam_version_id_fkey"
            columns: ["mock_exam_version_id"]
            isOneToOne: false
            referencedRelation: "mock_exam_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_attempts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_exam_versions: {
        Row: {
          created_at: string
          id: string
          mock_exam_id: string
          published_at: string
          published_by: string
          school_id: string
          settings: Json
          total_marks: number
          total_questions: number
          version_number: number
        }
        Insert: {
          created_at?: string
          id?: string
          mock_exam_id: string
          published_at?: string
          published_by: string
          school_id: string
          settings?: Json
          total_marks?: number
          total_questions?: number
          version_number: number
        }
        Update: {
          created_at?: string
          id?: string
          mock_exam_id?: string
          published_at?: string
          published_by?: string
          school_id?: string
          settings?: Json
          total_marks?: number
          total_questions?: number
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "mock_exam_versions_mock_exam_id_fkey"
            columns: ["mock_exam_id"]
            isOneToOne: false
            referencedRelation: "mock_exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_exam_versions_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_exam_versions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_exams: {
        Row: {
          audience_scope: string
          available_from: string | null
          calculator_mode: string
          closes_at: string | null
          course_id: string | null
          created_at: string
          description: string | null
          delivery_mode: string
          distribution_mode: string
          id: string
          marketplace_approval_status: string
          marketplace_approved_at: string | null
          marketplace_approved_by: string | null
          marketplace_rejection_reason: string | null
          marketplace_submitted_at: string | null
          max_attempts: number
          notification_sent: boolean
          pass_mark: number | null
          programme_id: string | null
          publish_at: string | null
          result_release_mode: string
          school_id: string
          shuffle_options: boolean
          shuffle_questions: boolean
          status: string
          time_limit_minutes: number | null
          title: string
          total_mcq_questions: number
          total_theory_questions: number
          tutor_id: string
          updated_at: string
        }
        Insert: {
          audience_scope?: string
          available_from?: string | null
          calculator_mode?: string
          closes_at?: string | null
          course_id?: string | null
          created_at?: string
          description?: string | null
          delivery_mode?: string
          distribution_mode?: string
          id?: string
          marketplace_approval_status?: string
          marketplace_approved_at?: string | null
          marketplace_approved_by?: string | null
          marketplace_rejection_reason?: string | null
          marketplace_submitted_at?: string | null
          max_attempts?: number
          notification_sent?: boolean
          pass_mark?: number | null
          programme_id?: string | null
          publish_at?: string | null
          result_release_mode?: string
          school_id: string
          shuffle_options?: boolean
          shuffle_questions?: boolean
          status?: string
          time_limit_minutes?: number | null
          title: string
          total_mcq_questions?: number
          total_theory_questions?: number
          tutor_id: string
          updated_at?: string
        }
        Update: {
          audience_scope?: string
          available_from?: string | null
          calculator_mode?: string
          closes_at?: string | null
          course_id?: string | null
          created_at?: string
          description?: string | null
          delivery_mode?: string
          distribution_mode?: string
          id?: string
          marketplace_approval_status?: string
          marketplace_approved_at?: string | null
          marketplace_approved_by?: string | null
          marketplace_rejection_reason?: string | null
          marketplace_submitted_at?: string | null
          max_attempts?: number
          notification_sent?: boolean
          pass_mark?: number | null
          programme_id?: string | null
          publish_at?: string | null
          result_release_mode?: string
          school_id?: string
          shuffle_options?: boolean
          shuffle_questions?: boolean
          status?: string
          time_limit_minutes?: number | null
          title?: string
          total_mcq_questions?: number
          total_theory_questions?: number
          tutor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_exams_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_exams_marketplace_approved_by_fkey"
            columns: ["marketplace_approved_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_exams_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_exams_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_exams_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_marketplace_creator_events: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          listing_id: string
          reason: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: string
          listing_id: string
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          listing_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mock_marketplace_creator_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_marketplace_creator_events_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "mock_marketplace_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_marketplace_entitlements: {
        Row: {
          attempts_consumed: number
          attempts_granted: number
          created_at: string
          expires_at: string | null
          granted_at: string
          id: string
          listing_id: string
          mock_version_id: string
          order_id: string | null
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          source: string
          student_id: string
        }
        Insert: {
          attempts_consumed?: number
          attempts_granted: number
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          id?: string
          listing_id: string
          mock_version_id: string
          order_id?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          source: string
          student_id: string
        }
        Update: {
          attempts_consumed?: number
          attempts_granted?: number
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          id?: string
          listing_id?: string
          mock_version_id?: string
          order_id?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          source?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_marketplace_entitlements_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "mock_marketplace_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_marketplace_entitlements_mock_version_id_fkey"
            columns: ["mock_version_id"]
            isOneToOne: false
            referencedRelation: "mock_exam_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_marketplace_entitlements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "mock_marketplace_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_marketplace_entitlements_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_marketplace_entitlements_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_marketplace_ledger_entries: {
        Row: {
          created_at: string
          creator_amount_kobo: number
          currency: string
          effective_at: string
          entry_type: string
          id: string
          listing_id: string
          mock_price_kobo: number
          order_id: string
          platform_fee_kobo: number
          student_processing_fee_kobo: number
          total_charged_kobo: number
        }
        Insert: {
          created_at?: string
          creator_amount_kobo: number
          currency?: string
          effective_at?: string
          entry_type: string
          id?: string
          listing_id: string
          mock_price_kobo: number
          order_id: string
          platform_fee_kobo: number
          student_processing_fee_kobo: number
          total_charged_kobo: number
        }
        Update: {
          created_at?: string
          creator_amount_kobo?: number
          currency?: string
          effective_at?: string
          entry_type?: string
          id?: string
          listing_id?: string
          mock_price_kobo?: number
          order_id?: string
          platform_fee_kobo?: number
          student_processing_fee_kobo?: number
          total_charged_kobo?: number
        }
        Relationships: [
          {
            foreignKeyName: "mock_marketplace_ledger_entries_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "mock_marketplace_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_marketplace_ledger_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "mock_marketplace_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_marketplace_listings: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          attempts_included: number
          available_from: string | null
          calculator_mode: string
          closes_at: string | null
          cover_image_key: string | null
          created_at: string
          creator_school_id: string
          creator_user_id: string
          currency: string
          difficulty: string | null
          duration_minutes: number | null
          examination: string | null
          id: string
          instructions: string | null
          listed_at: string | null
          mock_version_id: string
          preview_question_ids: string[]
          price_kobo: number
          pricing_type: string
          publication_status: string
          question_count: number
          rejection_reason: string | null
          result_release_mode: string
          rights_confirmed_at: string | null
          short_description: string
          slug: string
          source_mock_id: string
          subjects: string[]
          submitted_at: string | null
          suspended_at: string | null
          suspension_reason: string | null
          tags: string[]
          title: string
          total_marks: number
          updated_at: string
          withdrawn_at: string | null
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          attempts_included: number
          available_from?: string | null
          calculator_mode: string
          closes_at?: string | null
          cover_image_key?: string | null
          created_at?: string
          creator_school_id: string
          creator_user_id: string
          currency?: string
          difficulty?: string | null
          duration_minutes?: number | null
          examination?: string | null
          id?: string
          instructions?: string | null
          listed_at?: string | null
          mock_version_id: string
          preview_question_ids?: string[]
          price_kobo?: number
          pricing_type?: string
          publication_status?: string
          question_count: number
          rejection_reason?: string | null
          result_release_mode: string
          rights_confirmed_at?: string | null
          short_description?: string
          slug: string
          source_mock_id: string
          subjects?: string[]
          submitted_at?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          tags?: string[]
          title: string
          total_marks: number
          updated_at?: string
          withdrawn_at?: string | null
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          attempts_included?: number
          available_from?: string | null
          calculator_mode?: string
          closes_at?: string | null
          cover_image_key?: string | null
          created_at?: string
          creator_school_id?: string
          creator_user_id?: string
          currency?: string
          difficulty?: string | null
          duration_minutes?: number | null
          examination?: string | null
          id?: string
          instructions?: string | null
          listed_at?: string | null
          mock_version_id?: string
          preview_question_ids?: string[]
          price_kobo?: number
          pricing_type?: string
          publication_status?: string
          question_count?: number
          rejection_reason?: string | null
          result_release_mode?: string
          rights_confirmed_at?: string | null
          short_description?: string
          slug?: string
          source_mock_id?: string
          subjects?: string[]
          submitted_at?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          tags?: string[]
          title?: string
          total_marks?: number
          updated_at?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mock_marketplace_listings_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_marketplace_listings_creator_school_id_fkey"
            columns: ["creator_school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_marketplace_listings_creator_user_id_fkey"
            columns: ["creator_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_marketplace_listings_mock_version_id_fkey"
            columns: ["mock_version_id"]
            isOneToOne: true
            referencedRelation: "mock_exam_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_marketplace_listings_source_mock_id_fkey"
            columns: ["source_mock_id"]
            isOneToOne: false
            referencedRelation: "mock_exams"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_marketplace_moderation_events: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          listing_id: string
          reason: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: string
          listing_id: string
          reason: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          listing_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_marketplace_moderation_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_marketplace_moderation_events_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "mock_marketplace_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_marketplace_orders: {
        Row: {
          authorization_url: string | null
          created_at: string
          creator_amount_kobo: number
          creator_school_id: string
          currency: string
          failed_at: string | null
          id: string
          idempotency_key: string
          listing_id: string
          mock_price_kobo: number
          mock_version_id: string
          paid_at: string | null
          paystack_reference: string
          paystack_transaction_id: string | null
          platform_fee_kobo: number
          refunded_at: string | null
          status: string
          student_id: string
          student_processing_fee_kobo: number
          total_charged_kobo: number
          updated_at: string
        }
        Insert: {
          authorization_url?: string | null
          created_at?: string
          creator_amount_kobo: number
          creator_school_id: string
          currency?: string
          failed_at?: string | null
          id?: string
          idempotency_key: string
          listing_id: string
          mock_price_kobo: number
          mock_version_id: string
          paid_at?: string | null
          paystack_reference: string
          paystack_transaction_id?: string | null
          platform_fee_kobo?: number
          refunded_at?: string | null
          status?: string
          student_id: string
          student_processing_fee_kobo?: number
          total_charged_kobo: number
          updated_at?: string
        }
        Update: {
          authorization_url?: string | null
          created_at?: string
          creator_amount_kobo?: number
          creator_school_id?: string
          currency?: string
          failed_at?: string | null
          id?: string
          idempotency_key?: string
          listing_id?: string
          mock_price_kobo?: number
          mock_version_id?: string
          paid_at?: string | null
          paystack_reference?: string
          paystack_transaction_id?: string | null
          platform_fee_kobo?: number
          refunded_at?: string | null
          status?: string
          student_id?: string
          student_processing_fee_kobo?: number
          total_charged_kobo?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_marketplace_orders_creator_school_id_fkey"
            columns: ["creator_school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_marketplace_orders_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "mock_marketplace_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_marketplace_orders_mock_version_id_fkey"
            columns: ["mock_version_id"]
            isOneToOne: false
            referencedRelation: "mock_exam_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_marketplace_orders_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_marketplace_reports: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          reason: string
          reporter_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          reason: string
          reporter_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          reason?: string
          reporter_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_marketplace_reports_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "mock_marketplace_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_marketplace_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_question_options: {
        Row: {
          created_at: string
          id: string
          is_correct: boolean
          option_text: string
          order_index: number
          question_id: string
          school_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_correct?: boolean
          option_text: string
          order_index: number
          question_id: string
          school_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_correct?: boolean
          option_text?: string
          order_index?: number
          question_id?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_question_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "mock_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_question_options_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_question_rules: {
        Row: {
          bank_id: string
          created_at: string
          id: string
          question_count: number
          question_type: string | null
          school_id: string
          section_id: string
          subject_name: string | null
          subtopic: string | null
          topic: string | null
          updated_at: string
        }
        Insert: {
          bank_id: string
          created_at?: string
          id?: string
          question_count: number
          question_type?: string | null
          school_id: string
          section_id: string
          subject_name?: string | null
          subtopic?: string | null
          topic?: string | null
          updated_at?: string
        }
        Update: {
          bank_id?: string
          created_at?: string
          id?: string
          question_count?: number
          question_type?: string | null
          school_id?: string
          section_id?: string
          subject_name?: string | null
          subtopic?: string | null
          topic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_question_rules_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "question_banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_question_rules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_question_rules_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "mock_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_questions: {
        Row: {
          created_at: string
          grading_rubric: string | null
          id: string
          marks: number
          mock_exam_id: string
          order_index: number
          question_text: string
          question_type: string
          school_id: string
        }
        Insert: {
          created_at?: string
          grading_rubric?: string | null
          id?: string
          marks?: number
          mock_exam_id: string
          order_index: number
          question_text: string
          question_type: string
          school_id: string
        }
        Update: {
          created_at?: string
          grading_rubric?: string | null
          id?: string
          marks?: number
          mock_exam_id?: string
          order_index?: number
          question_text?: string
          question_type?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_questions_mock_exam_id_fkey"
            columns: ["mock_exam_id"]
            isOneToOne: false
            referencedRelation: "mock_exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_questions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_section_questions: {
        Row: {
          created_at: string
          id: string
          marks_override: number | null
          order_index: number
          question_id: string
          question_version_id: string
          school_id: string
          section_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          marks_override?: number | null
          order_index: number
          question_id: string
          question_version_id: string
          school_id: string
          section_id: string
        }
        Update: {
          created_at?: string
          id?: string
          marks_override?: number | null
          order_index?: number
          question_id?: string
          question_version_id?: string
          school_id?: string
          section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_section_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "bank_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_section_questions_question_version_id_question_id_fkey"
            columns: ["question_version_id", "question_id"]
            isOneToOne: false
            referencedRelation: "bank_question_versions"
            referencedColumns: ["id", "question_id"]
          },
          {
            foreignKeyName: "mock_section_questions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_section_questions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "mock_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_sections: {
        Row: {
          course_id: string | null
          created_at: string
          id: string
          instructions: string | null
          mock_exam_id: string
          order_index: number
          school_id: string
          subject_name: string | null
          title: string
          updated_at: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          id?: string
          instructions?: string | null
          mock_exam_id: string
          order_index: number
          school_id: string
          subject_name?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          id?: string
          instructions?: string | null
          mock_exam_id?: string
          order_index?: number
          school_id?: string
          subject_name?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_sections_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_sections_mock_exam_id_fkey"
            columns: ["mock_exam_id"]
            isOneToOne: false
            referencedRelation: "mock_exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_sections_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_version_questions: {
        Row: {
          created_at: string
          id: string
          marks: number
          mock_exam_version_id: string
          order_index: number
          question_version_id: string
          school_id: string
          section_order_index: number
          section_title: string
        }
        Insert: {
          created_at?: string
          id?: string
          marks: number
          mock_exam_version_id: string
          order_index: number
          question_version_id: string
          school_id: string
          section_order_index: number
          section_title: string
        }
        Update: {
          created_at?: string
          id?: string
          marks?: number
          mock_exam_version_id?: string
          order_index?: number
          question_version_id?: string
          school_id?: string
          section_order_index?: number
          section_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_version_questions_mock_exam_version_id_fkey"
            columns: ["mock_exam_version_id"]
            isOneToOne: false
            referencedRelation: "mock_exam_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_version_questions_question_version_id_fkey"
            columns: ["question_version_id"]
            isOneToOne: false
            referencedRelation: "bank_question_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_version_questions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          file_key: string
          file_name: string
          file_size_bytes: number
          file_type: string
          id: string
          school_id: string
          title: string
          tutor_id: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          file_key: string
          file_name: string
          file_size_bytes: number
          file_type: string
          id?: string
          school_id: string
          title: string
          tutor_id: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          file_key?: string
          file_name?: string
          file_size_bytes?: number
          file_type?: string
          id?: string
          school_id?: string
          title?: string
          tutor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          is_read: boolean
          related_entity_id: string | null
          related_entity_type: string | null
          school_id: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_read?: boolean
          related_entity_id?: string | null
          related_entity_type?: string | null
          school_id: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          related_entity_id?: string | null
          related_entity_type?: string | null
          school_id?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          centre_amount: number
          checkout_idempotency_key: string | null
          course_id: string | null
          created_at: string
          currency: string
          id: string
          kanvise_fee: number
          paid_at: string | null
          paystack_access_code: string | null
          paystack_authorization_url: string | null
          paystack_reference: string
          paystack_transaction_id: string | null
          programme_id: string | null
          school_id: string
          status: string
          student_id: string
          sub_programme_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          centre_amount: number
          checkout_idempotency_key?: string | null
          course_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          kanvise_fee: number
          paid_at?: string | null
          paystack_access_code?: string | null
          paystack_authorization_url?: string | null
          paystack_reference: string
          paystack_transaction_id?: string | null
          programme_id?: string | null
          school_id: string
          status?: string
          student_id: string
          sub_programme_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          centre_amount?: number
          checkout_idempotency_key?: string | null
          course_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          kanvise_fee?: number
          paid_at?: string | null
          paystack_access_code?: string | null
          paystack_authorization_url?: string | null
          paystack_reference?: string
          paystack_transaction_id?: string | null
          programme_id?: string | null
          school_id?: string
          status?: string
          student_id?: string
          sub_programme_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_sub_programme_id_fkey"
            columns: ["sub_programme_id"]
            isOneToOne: false
            referencedRelation: "sub_programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      paystack_subaccounts: {
        Row: {
          account_number: string
          bank_code: string
          business_name: string
          created_at: string
          id: string
          percentage_charge: number
          school_id: string
          subaccount_code: string
        }
        Insert: {
          account_number: string
          bank_code: string
          business_name: string
          created_at?: string
          id?: string
          percentage_charge: number
          school_id: string
          subaccount_code: string
        }
        Update: {
          account_number?: string
          bank_code?: string
          business_name?: string
          created_at?: string
          id?: string
          percentage_charge?: number
          school_id?: string
          subaccount_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "paystack_subaccounts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      programmes: {
        Row: {
          created_at: string
          created_by: string
          currency: string
          description: string | null
          id: string
          is_published: boolean
          name: string
          price: number
          school_id: string
          slug: string
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          currency?: string
          description?: string | null
          id?: string
          is_published?: boolean
          name: string
          price: number
          school_id: string
          slug: string
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          currency?: string
          description?: string | null
          id?: string
          is_published?: boolean
          name?: string
          price?: number
          school_id?: string
          slug?: string
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programmes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programmes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      question_banks: {
        Row: {
          archived_at: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          school_id: string
          source_mock_exam_id: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
          school_id: string
          source_mock_exam_id?: string | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          school_id?: string
          source_mock_exam_id?: string | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_banks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_banks_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_banks_source_mock_exam_id_fkey"
            columns: ["source_mock_exam_id"]
            isOneToOne: true
            referencedRelation: "mock_exams"
            referencedColumns: ["id"]
          },
        ]
      }
      question_media: {
        Row: {
          alt_text: string | null
          byte_size: number
          checksum: string
          created_at: string
          height: number | null
          id: string
          mime_type: string
          original_filename: string
          owner_id: string
          processing_status: string
          school_id: string
          storage_key: string
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          byte_size: number
          checksum: string
          created_at?: string
          height?: number | null
          id?: string
          mime_type: string
          original_filename: string
          owner_id: string
          processing_status?: string
          school_id: string
          storage_key: string
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          byte_size?: number
          checksum?: string
          created_at?: string
          height?: number | null
          id?: string
          mime_type?: string
          original_filename?: string
          owner_id?: string
          processing_status?: string
          school_id?: string
          storage_key?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "question_media_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_media_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      question_stimuli: {
        Row: {
          author_id: string
          content_blocks: Json
          created_at: string
          id: string
          plain_text: string
          school_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          content_blocks?: Json
          created_at?: string
          id?: string
          plain_text?: string
          school_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          content_blocks?: Json
          created_at?: string
          id?: string
          plain_text?: string
          school_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_stimuli_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stimuli_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      question_stimulus_media: {
        Row: {
          created_at: string
          id: string
          media_id: string
          school_id: string
          stimulus_id: string
          usage_key: string
        }
        Insert: {
          created_at?: string
          id?: string
          media_id: string
          school_id: string
          stimulus_id: string
          usage_key: string
        }
        Update: {
          created_at?: string
          id?: string
          media_id?: string
          school_id?: string
          stimulus_id?: string
          usage_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_stimulus_media_media_school_fkey"
            columns: ["media_id", "school_id"]
            isOneToOne: false
            referencedRelation: "question_media"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "question_stimulus_media_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stimulus_media_stimulus_id_fkey"
            columns: ["stimulus_id"]
            isOneToOne: false
            referencedRelation: "question_stimuli"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          course_id: string | null
          created_at: string
          id: string
          is_published: boolean
          programme_id: string | null
          rating: number
          review_text: string | null
          school_id: string
          student_id: string
          sub_programme_id: string | null
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          programme_id?: string | null
          rating: number
          review_text?: string | null
          school_id: string
          student_id: string
          sub_programme_id?: string | null
        }
        Update: {
          course_id?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          programme_id?: string | null
          rating?: number
          review_text?: string | null
          school_id?: string
          student_id?: string
          sub_programme_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_sub_programme_id_fkey"
            columns: ["sub_programme_id"]
            isOneToOne: false
            referencedRelation: "sub_programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      school_promos: {
        Row: {
          created_at: string
          id: string
          image_key: string
          is_active: boolean
          link_id: string
          link_type: string
          order_index: number
          school_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_key: string
          is_active?: boolean
          link_id: string
          link_type: string
          order_index?: number
          school_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_key?: string
          is_active?: boolean
          link_id?: string
          link_type?: string
          order_index?: number
          school_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_promos_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          banner_url: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          facebook_url: string | null
          id: string
          instagram_url: string | null
          is_active: boolean
          logo_url: string | null
          name: string
          paystack_subaccount_code: string | null
          slug: string
          twitter_url: string | null
          updated_at: string
          video_intro_url: string | null
          website_url: string | null
          whatsapp_number: string | null
        }
        Insert: {
          banner_url?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          is_active?: boolean
          logo_url?: string | null
          name: string
          paystack_subaccount_code?: string | null
          slug: string
          twitter_url?: string | null
          updated_at?: string
          video_intro_url?: string | null
          website_url?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          banner_url?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          is_active?: boolean
          logo_url?: string | null
          name?: string
          paystack_subaccount_code?: string | null
          slug?: string
          twitter_url?: string | null
          updated_at?: string
          video_intro_url?: string | null
          website_url?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      sub_programmes: {
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
          price: number
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
        ]
      }
      submissions: {
        Row: {
          assignment_id: string
          created_at: string
          feedback: string | null
          file_key: string
          file_name: string
          id: string
          is_late: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          school_id: string
          score: number | null
          student_id: string
          submitted_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          feedback?: string | null
          file_key: string
          file_name: string
          id?: string
          is_late?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id: string
          score?: number | null
          student_id: string
          submitted_at?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          feedback?: string | null
          file_key?: string
          file_name?: string
          id?: string
          is_late?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string
          score?: number | null
          student_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_course_assignments: {
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
      }
      tutor_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          school_id: string
          status: string
          supabase_auth_id: string | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by: string
          school_id: string
          status?: string
          supabase_auth_id?: string | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          school_id?: string
          status?: string
          supabase_auth_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_invites_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          activated_at: string | null
          added_by: string | null
          bio: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          is_active: boolean
          kanvise_user_id: string
          last_name: string
          onboarding_source: string
          onboarding_status: string
          phone: string | null
          profile_photo_key: string | null
          role: string
          school_id: string | null
          supabase_auth_id: string | null
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          added_by?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          is_active?: boolean
          kanvise_user_id: string
          last_name: string
          onboarding_source?: string
          onboarding_status?: string
          phone?: string | null
          profile_photo_key?: string | null
          role: string
          school_id?: string | null
          supabase_auth_id?: string | null
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          added_by?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          is_active?: boolean
          kanvise_user_id?: string
          last_name?: string
          onboarding_source?: string
          onboarding_status?: string
          phone?: string | null
          profile_photo_key?: string | null
          role?: string
          school_id?: string | null
          supabase_auth_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_signups: {
        Row: {
          centre_name: string
          contact_email: string
          contact_name: string
          contact_phone: string | null
          contacted_at: string | null
          converted_school_id: string | null
          created_at: string
          estimated_student_count: number | null
          id: string
          invited_at: string | null
          notes: string | null
          source: string | null
          state: string | null
          status: string
          updated_at: string
          wants_beta_testing: boolean | null
        }
        Insert: {
          centre_name: string
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          contacted_at?: string | null
          converted_school_id?: string | null
          created_at?: string
          estimated_student_count?: number | null
          id?: string
          invited_at?: string | null
          notes?: string | null
          source?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          wants_beta_testing?: boolean | null
        }
        Update: {
          centre_name?: string
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          contacted_at?: string | null
          converted_school_id?: string | null
          created_at?: string
          estimated_student_count?: number | null
          id?: string
          invited_at?: string | null
          notes?: string | null
          source?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          wants_beta_testing?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_signups_converted_school_id_fkey"
            columns: ["converted_school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bind_question_block_media: {
        Args: {
          p_blocks: Json
          p_question_version_id: string
          p_school_id: string
          p_usage_prefix: string
        }
        Returns: undefined
      }
      claim_free_marketplace_mock: {
        Args: { p_listing_id: string; p_now: string; p_student_id: string }
        Returns: {
          entitlement_id: string
          newly_claimed: boolean
        }[]
      }
      confirm_marketplace_payment: {
        Args: {
          p_amount_kobo: number
          p_now: string
          p_paystack_reference: string
          p_paystack_transaction_id: string
        }
        Returns: {
          already_processed: boolean
          entitlement_id: string
          listing_title: string
          order_id: string
          student_email: string
          student_first_name: string
          student_id: string
        }[]
      }
      confirm_student_payment: {
        Args: {
          p_amount_kobo: number
          p_paystack_reference: string
          p_paystack_transaction_id: string
        }
        Returns: Json
      }
      consume_tutor_invite: {
        Args: {
          p_email: string
          p_invite_id: string
          p_supabase_auth_id: string
        }
        Returns: string
      }
      create_bank_question_versioned: {
        Args: {
          p_author_id: string
          p_bank_id: string
          p_content_blocks: Json
          p_course_id: string
          p_explanation_blocks: Json
          p_grading_rubric_blocks: Json
          p_marks: number
          p_options: Json
          p_plain_text: string
          p_question_type: string
          p_school_id: string
          p_stimulus_id: string
          p_subject_name: string
          p_subtopic: string
          p_topic: string
        }
        Returns: {
          question_id: string
          version_id: string
        }[]
      }
      increment_user_sequence: { Args: { p_role: string }; Returns: number }
      publish_versioned_mock: {
        Args: {
          p_mock_exam_id: string
          p_published_at: string
          p_published_by: string
          p_school_id: string
        }
        Returns: {
          mock_exam_version_id: string
          total_marks: number
          total_questions: number
          version_number: number
        }[]
      }
      replace_authored_mock_questions: {
        Args: {
          p_author_id: string
          p_mock_exam_id: string
          p_questions: Json
          p_school_id: string
        }
        Returns: {
          bank_id: string
          question_count: number
          section_id: string
        }[]
      }
      replace_versioned_mock_assembly: {
        Args: { p_mock_exam_id: string; p_school_id: string; p_sections: Json }
        Returns: {
          fixed_question_count: number
          rule_count: number
          section_count: number
        }[]
      }
      revise_bank_question_versioned: {
        Args: {
          p_content_blocks: Json
          p_course_id: string
          p_editor_id: string
          p_explanation_blocks: Json
          p_grading_rubric_blocks: Json
          p_marks: number
          p_options: Json
          p_plain_text: string
          p_question_id: string
          p_school_id: string
          p_stimulus_id: string
          p_subject_name: string
          p_subtopic: string
          p_topic: string
        }
        Returns: {
          question_id: string
          version_id: string
          version_number: number
        }[]
      }
      save_versioned_mock_answer: {
        Args: {
          p_attempt_id: string
          p_is_flagged: boolean
          p_mock_version_question_id: string
          p_now: string
          p_school_id: string
          p_selected_option_version_id: string
          p_student_id: string
          p_theory_answer_text: string
        }
        Returns: {
          answer_id: string
          saved_at: string
        }[]
      }
      start_or_resume_marketplace_mock_attempt: {
        Args: { p_listing_id: string; p_now: string; p_student_id: string }
        Returns: {
          attempt_id: string
          attempt_number: number
          deadline_at: string
          mock_exam_version_id: string
          resumed: boolean
          started_at: string
        }[]
      }
      start_or_resume_versioned_mock_attempt: {
        Args: {
          p_mock_exam_id: string
          p_now: string
          p_school_id: string
          p_student_id: string
        }
        Returns: {
          attempt_id: string
          attempt_number: number
          deadline_at: string
          mock_exam_version_id: string
          resumed: boolean
          started_at: string
        }[]
      }
      submit_versioned_mock_attempt: {
        Args: {
          p_attempt_id: string
          p_now: string
          p_reason: string
          p_school_id: string
          p_student_id: string
        }
        Returns: {
          mcq_score: number
          status: string
          submitted_at: string
          total_marks: number
          total_score: number
        }[]
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
