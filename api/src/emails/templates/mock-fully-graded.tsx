import { Text } from '@react-email/components'
import type { MockFullyGradedEmailInput } from '../types'
import { BrandedLayout } from './branded-layout'
import { EmailButton, EmailHeading, templateStyles, type EmailChrome } from './shared'

export function MockFullyGradedEmail({ logoUrl, footer, ...input }: MockFullyGradedEmailInput & EmailChrome) {
  return <BrandedLayout preview={`Your ${input.mockTitle} result is ready.`} logoUrl={logoUrl} footer={footer}>
    <EmailHeading eyebrow="MOCK GRADED">Your complete result is ready.</EmailHeading>
    <Text style={templateStyles.copy}>Hi {input.firstName}, all sections of <strong>{input.mockTitle}</strong> have now been graded.</Text>
    <Text style={templateStyles.detail}><strong>Final score:</strong> {input.score}</Text>
    <EmailButton href={input.resultsUrl}>View full result</EmailButton>
  </BrandedLayout>
}

