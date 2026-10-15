import { render } from '@react-email/render'
import { Text, Button } from '@react-email/components'
import { BrandedLayout } from '../emails/templates/branded-layout'
import * as fs from 'fs'
import React from 'react'

const styles = {
  copy: { color: '#3C3027', fontSize: '16px', lineHeight: '26px', margin: '0 0 20px' },
  button: {
    backgroundColor: '#C26627',
    borderRadius: '10px',
    color: '#FFFFFF',
    display: 'inline-block',
    fontSize: '15px',
    fontWeight: 700,
    margin: '10px 0 22px',
    padding: '14px 24px',
    textDecoration: 'none',
  },
  signature: { color: '#3C3027', fontSize: '16px', lineHeight: '26px', margin: '20px 0 0', fontWeight: 'bold' },
}

function BroadcastEmail() {
  return (
    <BrandedLayout preview="You're officially in." logoUrl="https://staging.kanvise.com/kanvise_logo_small_blue.png">
      <Text style={styles.copy}>Hello {"{{{contact.first_name}}}"},</Text>

      <Text style={styles.copy}>You’re officially in.</Text>
      
      <Text style={styles.copy}>You’re one of the 30 educators joining the Kanvise pilot, and we’re excited to have you here.</Text>

      <Text style={styles.copy}>For the next few weeks, we’d love for you to use Kanvise with your real students and real teaching.</Text>

      <Text style={styles.copy}><strong>Here’s how to get started:</strong></Text>

      <Text style={styles.copy}>
        <strong>1. Create your class</strong><br />
        Set up the class you currently teach.
      </Text>

      <Text style={styles.copy}>
        <strong>2. Add your students</strong><br />
        Invite the students you’ll be teaching with Kanvise.
      </Text>

      <Text style={styles.copy}>
        <strong>3. Run your next class</strong><br />
        Set it up and give Kanvise a proper try.
      </Text>

      <Text style={styles.copy}>You don’t need to set everything up at once. Start with one real class and take it from there.</Text>

      <Text style={styles.copy}>And please remember: this is a pilot.</Text>

      <Text style={styles.copy}>
        If something works, tell us.<br />
        If something is confusing, tell us.<br />
        If something is completely broken, definitely tell us.
      </Text>

      <Text style={styles.copy}>We’re building Kanvise with you, not just for you.</Text>

      <Button href="https://app.kanvise.com/dashboard" style={styles.button}>Open Kanvise →</Button>

      <Text style={styles.copy}>See you inside,</Text>
      <Text style={styles.signature}>Mayokun & Emmanuel<br />Co-founders, Kanvise</Text>
    </BrandedLayout>
  )
}

async function run() {
  const html = await render(<BroadcastEmail />)
  fs.writeFileSync('broadcast_email.html', html)
  console.log('HTML written to broadcast_email.html')
}

run()
