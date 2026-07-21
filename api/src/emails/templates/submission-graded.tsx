import { Text } from '@react-email/components'
import type { SubmissionGradedEmailInput } from '../types'
import { BrandedLayout } from './branded-layout'
import { EmailButton, EmailHeading, templateStyles } from './shared'

export function SubmissionGradedEmail({ logoUrl, ...input }: SubmissionGradedEmailInput & { logoUrl: string }) {
  return <BrandedLayout preview={`Your ${input.assignmentTitle} submission has been graded.`} logoUrl={logoUrl}>
    <EmailHeading eyebrow="SUBMISSION GRADED">Your result is ready.</EmailHeading>
    <Text style={templateStyles.copy}>Hi {input.firstName}, your submission for <strong>{input.assignmentTitle}</strong> has been graded.</Text>
    <Text style={templateStyles.detail}><strong>Score:</strong> {input.score}</Text>
    {input.feedback && <Text style={templateStyles.detail}><strong>Tutor feedback:</strong> {input.feedback}</Text>}
    <EmailButton href={input.submissionUrl}>View feedback</EmailButton>
  </BrandedLayout>
}

