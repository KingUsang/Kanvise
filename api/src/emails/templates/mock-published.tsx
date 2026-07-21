import { Text } from '@react-email/components'
import type { MockPublishedEmailInput } from '../types'
import { BrandedLayout } from './branded-layout'
import { EmailButton, EmailHeading, formatEmailDate, templateStyles } from './shared'

export function MockPublishedEmail({ logoUrl, ...input }: MockPublishedEmailInput & { logoUrl: string }) {
  return <BrandedLayout preview={`${input.mockTitle} is now available.`} logoUrl={logoUrl}>
    <EmailHeading eyebrow="NEW MOCK">A new mock is available.</EmailHeading>
    <Text style={templateStyles.copy}>Hi {input.firstName}, <strong>{input.mockTitle}</strong> for {input.courseName} has been published.</Text>
    {input.closesAt && <Text style={templateStyles.detail}><strong>Available until:</strong> {formatEmailDate(input.closesAt)}</Text>}
    <EmailButton href={input.mockUrl}>Start mock</EmailButton>
  </BrandedLayout>
}

