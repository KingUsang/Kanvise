import { Text } from '@react-email/components'
import type { PaymentConfirmedEmailInput } from '../types'
import { BrandedLayout } from './branded-layout'
import { EmailButton, EmailHeading, formatEmailDate, templateStyles } from './shared'

export function PaymentConfirmedEmail({ logoUrl, ...input }: PaymentConfirmedEmailInput & { logoUrl: string }) {
  return <BrandedLayout preview={`Payment received for ${input.programmeName}.`} logoUrl={logoUrl}>
    <EmailHeading eyebrow="PAYMENT CONFIRMED">You’re enrolled, {input.firstName}.</EmailHeading>
    <Text style={templateStyles.copy}>Your payment to <strong>{input.schoolName}</strong> was successful and access to <strong>{input.programmeName}</strong> is ready.</Text>
    <Text style={templateStyles.detail}><strong>Amount:</strong> {input.amount}</Text>
    <Text style={templateStyles.detail}><strong>Reference:</strong> {input.paymentReference}</Text>
    <Text style={templateStyles.detail}><strong>Paid:</strong> {formatEmailDate(input.paidAt)}</Text>
    <EmailButton href={input.dashboardUrl}>Access your programme</EmailButton>
    <Text style={templateStyles.note}>Keep this email as your payment receipt.</Text>
  </BrandedLayout>
}

