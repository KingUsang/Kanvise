import { Text } from '@react-email/components'
import type { ClassCancellationEmailInput } from '../types'
import { BrandedLayout } from './branded-layout'
import { EmailButton, EmailHeading, formatEmailDate, templateStyles } from './shared'

export function ClassCancellationEmail({ logoUrl, ...input }: ClassCancellationEmailInput & { logoUrl: string }) {
  return <BrandedLayout preview={`${input.classTitle} has been cancelled.`} logoUrl={logoUrl}>
    <EmailHeading eyebrow="CLASS UPDATE">This class has been cancelled.</EmailHeading>
    <Text style={templateStyles.copy}>Hi {input.firstName}, <strong>{input.classTitle}</strong>, scheduled for {formatEmailDate(input.scheduledAt)}, has been cancelled by {input.schoolName}.</Text>
    {input.reason && <Text style={templateStyles.detail}><strong>Reason:</strong> {input.reason}</Text>}
    <EmailButton href={input.dashboardUrl}>View your schedule</EmailButton>
  </BrandedLayout>
}

