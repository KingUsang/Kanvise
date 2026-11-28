import { Text } from '@react-email/components'
import type { MockPublishedEmailInput } from '../types'
import { BrandedLayout } from './branded-layout'
import { EmailButton, EmailHeading, formatEmailDateTime, templateStyles, type EmailChrome } from './shared'

export function MockPublishedEmail({ logoUrl, footer, timeZone, ...input }: MockPublishedEmailInput & EmailChrome) {
  return <BrandedLayout preview={`${input.mockTitle} is now available.`} logoUrl={logoUrl} footer={footer}>
    <EmailHeading eyebrow="NEW MOCK">A new mock is available.</EmailHeading>
    <Text style={templateStyles.copy}>Hi {input.firstName}, <strong>{input.mockTitle}</strong> for {input.courseName} has been published.</Text>
    {input.closesAt && <Text style={templateStyles.detail}><strong>Available until:</strong> {formatEmailDateTime(input.closesAt, timeZone)}</Text>}
    <EmailButton href={input.mockUrl}>Start mock</EmailButton>
  </BrandedLayout>
}

