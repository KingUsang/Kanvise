import { Text } from '@react-email/components'
import type { ClassCancellationEmailInput } from '../types'
import { BrandedLayout } from './branded-layout'
import { EmailButton, EmailHeading, formatEmailDateTime, templateStyles, type EmailChrome } from './shared'

export function ClassCancellationEmail({ logoUrl, footer, timeZone, ...input }: ClassCancellationEmailInput & EmailChrome) {
  return <BrandedLayout preview={`${input.classTitle} has been cancelled.`} logoUrl={logoUrl} footer={footer}>
    <EmailHeading eyebrow="CLASS UPDATE">This class has been cancelled.</EmailHeading>
    <Text style={templateStyles.copy}>Hi {input.firstName}, <strong>{input.classTitle}</strong>, scheduled for {formatEmailDateTime(input.scheduledAt, timeZone)}, has been cancelled by {input.schoolName}.</Text>
    {input.reason && <Text style={templateStyles.detail}><strong>Reason:</strong> {input.reason}</Text>}
    <EmailButton href={input.dashboardUrl}>View your schedule</EmailButton>
  </BrandedLayout>
}

