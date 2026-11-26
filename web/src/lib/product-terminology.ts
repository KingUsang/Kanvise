import type { StudentDashboardData } from '@/lib/student-dashboard'

/** Product language used by new shared surfaces. Legacy wire names stay at the adapter edge. */
export const productTerms = {
  tutoringAccount: 'tutoring account',
  learner: 'Learner',
  learners: 'Learners',
  class: 'Class',
  classes: 'Classes',
  subject: 'Subject',
  subjects: 'Subjects',
  session: 'Session',
  sessions: 'Sessions',
} as const

export type LegacyClassRecord = {
  id: string
  name: string
  description?: string | null
  is_published: boolean
  teaching_mode: string
  courses?: ProductSubject[] | null
  enrolled_count?: number
}

export type ProductSubject = { id: string; name: string; tutor_ids?: string[] }

export type ProductClassRecord<T extends LegacyClassRecord = LegacyClassRecord> = Omit<T, 'courses'> & {
  subjects: ProductSubject[]
}

export function adaptClassRecord<T extends LegacyClassRecord>(record: T): ProductClassRecord<T> {
  const { courses, ...productClass } = record
  return { ...productClass, subjects: courses || [] } as ProductClassRecord<T>
}

export type LegacySubjectLink = { course?: ProductSubject | null }

export type ProductSubjectLink<T extends LegacySubjectLink> = Omit<T, 'course'> & {
  subject?: ProductSubject | null
}

export function adaptSubjectLink<T extends LegacySubjectLink>(record: T): ProductSubjectLink<T> {
  const { course, ...productRecord } = record
  return { ...productRecord, subject: course || null } as ProductSubjectLink<T>
}

export type ProductLearnerDashboard = Omit<StudentDashboardData, 'student' | 'school' | 'capabilities'> & {
  learner: StudentDashboardData['student']
  tutoringAccount: StudentDashboardData['school']
  capabilities?: {
    hasClassLearning: boolean
    hasMarketplaceAccess: boolean
  }
}

export function adaptLearnerDashboard(data: StudentDashboardData): ProductLearnerDashboard {
  const { student, school, capabilities, ...productData } = data
  return {
    ...productData,
    learner: student,
    tutoringAccount: school,
    capabilities: capabilities
      ? {
          hasClassLearning: capabilities.hasCentreLearning,
          hasMarketplaceAccess: capabilities.hasMarketplaceAccess,
        }
      : undefined,
  }
}
