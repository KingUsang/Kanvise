import { Text } from '@react-email/components'
import type { PaymentConfirmedEmailInput } from '../types'
import { BrandedLayout } from './branded-layout'
import { EmailButton, EmailHeading, formatLongEmailDate, templateStyles, type EmailChrome } from './shared'

export function PaymentConfirmedEmail({ logoUrl, footer, timeZone, ...input }: PaymentConfirmedEmailInput & EmailChrome) {
  return <BrandedLayout preview={`Payment received for ${input.programmeName}.`} logoUrl={logoUrl} footer={footer}>
    <EmailHeading eyebrow="PAYMENT CONFIRMED">You’re enrolled, {input.firstName}.</EmailHeading>
    <Text style={templateStyles.copy}>Your payment to <strong>{input.schoolName}</strong> was successful and access to <strong>{input.programmeName}</strong> is ready.</Text>
    <Text style={templateStyles.detail}><strong>Amount:</strong> {input.amount}</Text>
    <Text style={templateStyles.detail}><strong>Reference:</strong> {input.paymentReference}</Text>
    <Text style={templateStyles.detail}><strong>Paid:</strong> {formatLongEmailDate(input.paidAt, timeZone)}</Text>
    <EmailButton href={input.dashboardUrl}>Access your class</EmailButton>
    <Text style={templateStyles.note}>Keep this email as your payment receipt.</Text>
  </BrandedLayout>
}
