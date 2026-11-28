import { Text } from '@react-email/components'
import type { AssignmentDeadlineEmailInput } from '../types'
import { BrandedLayout } from './branded-layout'
import { EmailButton, EmailHeading, formatEmailDateTime, templateStyles, type EmailChrome } from './shared'

export function AssignmentDeadlineEmail({ logoUrl, footer, timeZone, ...input }: AssignmentDeadlineEmailInput & EmailChrome) {
  return <BrandedLayout preview={`${input.assignmentTitle} is due soon.`} logoUrl={logoUrl} footer={footer}>
    <EmailHeading eyebrow="DEADLINE REMINDER">Your assignment is due soon.</EmailHeading>
    <Text style={templateStyles.copy}>Hi {input.firstName}, <strong>{input.assignmentTitle}</strong> for {input.courseName} is approaching its deadline.</Text>
    <Text style={templateStyles.detail}><strong>Due:</strong> {formatEmailDateTime(input.deadlineAt, timeZone)}</Text>
    <EmailButton href={input.assignmentUrl}>View assignment</EmailButton>
  </BrandedLayout>
}

