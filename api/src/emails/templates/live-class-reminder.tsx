import { Text } from '@react-email/components'
import type { LiveClassReminderEmailInput } from '../types'
import { BrandedLayout } from './branded-layout'
import { EmailButton, EmailHeading, formatEmailDate, templateStyles } from './shared'

export function LiveClassReminderEmail({ logoUrl, ...input }: LiveClassReminderEmailInput & { logoUrl: string }) {
  return <BrandedLayout preview={`${input.classTitle} starts soon.`} logoUrl={logoUrl}>
    <EmailHeading eyebrow="CLASS REMINDER">Your class starts soon.</EmailHeading>
    <Text style={templateStyles.copy}>Hi {input.firstName}, <strong>{input.classTitle}</strong> for {input.courseName} is coming up.</Text>
    <Text style={templateStyles.detail}><strong>Starts:</strong> {formatEmailDate(input.startsAt)}</Text>
    <EmailButton href={input.joinUrl}>Join class</EmailButton>
    <Text style={templateStyles.note}>You can join from a supported browser. Please arrive a few minutes early.</Text>
  </BrandedLayout>
}

