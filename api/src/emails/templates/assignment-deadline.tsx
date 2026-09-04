import { Text } from '@react-email/components'
import type { AssignmentDeadlineEmailInput } from '../types'
import { BrandedLayout } from './branded-layout'
import { EmailButton, EmailHeading, formatEmailDate, templateStyles } from './shared'

export function AssignmentDeadlineEmail({ logoUrl, ...input }: AssignmentDeadlineEmailInput & { logoUrl: string }) {
  return <BrandedLayout preview={`${input.assignmentTitle} is due soon.`} logoUrl={logoUrl}>
    <EmailHeading eyebrow="DEADLINE REMINDER">Your assignment is due soon.</EmailHeading>
    <Text style={templateStyles.copy}>Hi {input.firstName}, <strong>{input.assignmentTitle}</strong> for {input.courseName} is approaching its deadline.</Text>
    <Text style={templateStyles.detail}><strong>Due:</strong> {formatEmailDate(input.deadlineAt)}</Text>
    <EmailButton href={input.assignmentUrl}>View assignment</EmailButton>
  </BrandedLayout>
}

