import { Button, Heading, Text, Img } from '@react-email/components'
import { BrandedLayout } from './branded-layout'
import * as React from 'react'

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
  signature: { color: '#3C3027', fontSize: '16px', lineHeight: '26px', margin: '20px 0 0', fontWeight: 'bold' }
}

export type LifecycleEmailProps = {
  firstName: string
  actionUrl: string
  logoUrl: string
}

export function WelcomePilotEmail({ firstName, actionUrl, logoUrl }: LifecycleEmailProps) {
  return (
    <BrandedLayout preview="You're in. Here's what happens next." logoUrl={logoUrl}>
      <Text style={styles.copy}>Hey {firstName},</Text>
      <Text style={styles.copy}>It's official. You're in.</Text>
      <Text style={styles.copy}>We are opening Kanvise to a very small group of educators for this pilot, and we are genuinely glad you're one of them.</Text>
      <Text style={styles.copy}>This isn't just about early access.</Text>
      <Text style={styles.copy}>We spent the last few months talking to tutors, building, breaking things, and building them again.</Text>
      <Text style={styles.copy}>But there is a difference between building in a room and seeing what happens when real educators actually use it to teach.</Text>
      <Text style={styles.copy}>For the next few weeks, you get to see whether we actually got it right.</Text>
      <Text style={styles.copy}>And that's why you're here.</Text>
      <Text style={styles.copy}><strong>See the gaps. Close them early.</strong></Text>
      <Text style={styles.copy}>Welcome to Kanvise.</Text>
      <Text style={styles.copy}>Let's do this. 👀</Text>
      <Text style={styles.signature}>The Kanvise Team</Text>
    </BrandedLayout>
  )
}

export function FounderLetterEmail({ firstName, actionUrl, logoUrl }: LifecycleEmailProps) {
  return (
    <BrandedLayout preview="This started with a problem we couldn't ignore." logoUrl={logoUrl}>
      <Text style={styles.copy}>Hey {firstName},</Text>
      <Text style={styles.copy}>My name is Mayokun. Emmanuel and I founded Kanvise from our small rooms in University of Ibadan.</Text>
      <Text style={styles.copy}>Before Kanvise was a product, I was a tutor.</Text>
      <Text style={styles.copy}>And one of the frustrating things about teaching was that sometimes, you could finish a class feeling like everything went well and still have no real idea what was happening with your students afterwards.</Text>
      <Text style={styles.copy}>Were they actually following?</Text>
      <Text style={styles.copy}>Who was falling behind?</Text>
      <Text style={styles.copy}>Who understood the first topic but was already struggling by the third?</Text>
      <Text style={styles.copy}>A tutor we spoke to, Martins, put it even more clearly. He told us that sometimes they only discovered that about 30% of their students were lagging <strong>after the exam results came out.</strong></Text>
      <Text style={styles.copy}>That stayed with us.</Text>
      <Text style={styles.copy}>Because at that point, what can you really do?</Text>
      <Text style={styles.copy}>So we started talking to more tutors.</Text>
      <Text style={styles.copy}>Over 100 educators later, we kept hearing versions of the same thing. Tutors were already doing the work. They just didn't always have the visibility they needed to know what was happening underneath it. That became the reason we built Kanvise.</Text>
      <Text style={styles.copy}>But here's the thing; we don't want to build something that we think tutors need. We want to build something that actually makes your work easier. That is what this pilot is about.</Text>
      <Text style={styles.copy}>So please, don't use Kanvise to impress us.</Text>
      <Text style={styles.copy}>Use it the way you actually teach.</Text>
      <Text style={styles.copy}>If something makes your life easier, tell us.</Text>
      <Text style={styles.copy}>If something makes you want to close your laptop, tell us that too.</Text>
      <Text style={styles.copy}>If something doesn't make sense, tell us.</Text>
      <Text style={styles.copy}>Because once we fail at making Kanvise genuinely useful and easy to use, there really isn't much of a reason for Project Kanvise to exist.</Text>
      <Text style={styles.copy}>You have direct access to us throughout this pilot.</Text>
      <Text style={styles.copy}>And we're listening.</Text>
      <Text style={styles.copy}>Thank you for trusting us enough to be one of the first people through the door.</Text>
      <Text style={styles.copy}>Mayokun<br/>Co-founder, Kanvise</Text>
      <Button href={actionUrl} style={styles.button}>Talk to the Kanvise Team →</Button>
    </BrandedLayout>
  )
}

export function MeetKaviEmail({ firstName, actionUrl, logoUrl }: LifecycleEmailProps) {
  return (
    <BrandedLayout preview="Okay, I have something to tell you 👀" logoUrl={logoUrl}>
      <Text style={styles.copy}>Hey {firstName}!</Text>
      <Text style={styles.copy}>Okay, I've been waiting for this one.</Text>
      <Text style={styles.copy}>You've probably seen my name around already, but we haven't actually met.</Text>
      <Text style={styles.copy}>So, hi. I'm Kavi. 🪄</Text>
      <Text style={styles.copy}>I'm the one who'll be keeping you company around Kanvise.</Text>
      <Text style={styles.copy}>Remember when Mayokun said we're listening?</Text>
      <Text style={styles.copy}>Well, I'm part of that.</Text>
      <Text style={styles.copy}>When something important happens, I'll let you know.</Text>
      <Text style={styles.copy}>When there's something new to explore, I'll point you there.</Text>
      <Text style={styles.copy}>When you're wondering, "Wait… how do I do this?"</Text>
      <Text style={styles.copy}>You can ask me.</Text>
      <Text style={styles.copy}>You'll also see me around the app, helping you get familiar with things as you use Kanvise.</Text>
      <Text style={styles.copy}>And don't worry, I'm not going to bombard you with emails every five minutes.</Text>
      <Text style={styles.copy}>I have manners.</Text>
      <Text style={styles.copy}>For now, just think of me as your little Kanvise guide.</Text>
      <Text style={styles.copy}>You're going to be figuring things out, trying things, discovering what works for you and occasionally wondering what on earth we were thinking.</Text>
      <Text style={styles.copy}>I'll be around for all of it.</Text>
      <Text style={styles.copy}>So I guess this is the beginning of our little friendship.</Text>
      <Button href={actionUrl} style={styles.button}>Meet Kavi →</Button>
      <Text style={styles.copy}>I'll see you around. 👀</Text>
      <Text style={styles.signature}>Kavi 💛</Text>
    </BrandedLayout>
  )
}

export function LetUsUseThisEmail({ firstName, actionUrl, logoUrl }: LifecycleEmailProps) {
  return (
    <BrandedLayout preview="You're in. Now let's actually use Kanvise 👀" logoUrl={logoUrl}>
      <Text style={styles.copy}>Hey {firstName}!</Text>
      <Text style={styles.copy}>Enough introductions. 😂</Text>
      <Text style={styles.copy}>You've met the team. You've met me.</Text>
      <Text style={styles.copy}>Now I want you to actually get into Kanvise.</Text>
      <Text style={styles.copy}>And please, don't worry about doing everything perfectly. This is a pilot, remember?</Text>
      <Text style={styles.copy}>Start with the class you're already teaching.</Text>
      <Text style={styles.copy}>Create your <strong>class</strong>, bring your students in, set up your next session and try teaching with Kanvise.</Text>
      <Text style={styles.copy}>Then, when you're ready, explore the rest.</Text>
      <Text style={styles.copy}>Run an assignment.</Text>
      <Text style={styles.copy}>Try a mock.</Text>
      <Text style={styles.copy}>Check attendance.</Text>
      <Text style={styles.copy}>Look through your students' performance.</Text>
      <Text style={styles.copy}>The point isn't to tick every box.</Text>
      <Text style={styles.copy}><strong>The point is to see what Kanvise feels like when you use it for real work.</strong></Text>
      <Text style={styles.copy}>So go on.</Text>
      <Text style={styles.copy}>Click things.</Text>
      <Text style={styles.copy}>Try things.</Text>
      <Text style={styles.copy}>Break something if you have to. 😂</Text>
      <Text style={styles.copy}>And if you get stuck, you know where to find me.</Text>
      <Button href={actionUrl} style={styles.button}>Open Kanvise →</Button>
      <Text style={styles.copy}>Let's see what happens.</Text>
      <Text style={styles.signature}>Kavi 💛</Text>
    </BrandedLayout>
  )
}

export function FirstWeekEmail({ firstName, actionUrl, logoUrl }: LifecycleEmailProps) {
  return (
    <BrandedLayout preview="So… what happened when you actually used it? 👀" logoUrl={logoUrl}>
      <Text style={styles.copy}>Hey {firstName}!</Text>
      <Text style={styles.copy}>One week already.</Text>
      <Text style={styles.copy}>Which means you've probably gone from:</Text>
      <Text style={styles.copy}>"Okay, what is this thing?"</Text>
      <Text style={styles.copy}>to</Text>
      <Text style={styles.copy}>"Ohhh, I see what they're trying to do."</Text>
      <Text style={styles.copy}>Or maybe you're still somewhere between the two. 😂</Text>
      <Text style={styles.copy}>Either way, I want to hear about it.</Text>
      <Text style={styles.copy}>Because this is the part we care about.</Text>
      <Text style={styles.copy}>Not whether you opened Kanvise.</Text>
      <Text style={styles.copy}>Not whether you clicked every button.</Text>
      <Heading as="h3" style={{ color: '#322B7A', fontSize: '20px', margin: '24px 0 16px' }}>What happened when you actually used it in your teaching?</Heading>
      <Text style={styles.copy}>Did something save you time?</Text>
      <Text style={styles.copy}>Did you notice something about a student that you wouldn't have noticed before?</Text>
      <Text style={styles.copy}>Did something feel confusing?</Text>
      <Text style={styles.copy}>Was there a moment where you thought, "Oh, this is actually useful."</Text>
      <Text style={styles.copy}>Or did you find yourself thinking, "Guys… why did you build it like this?" 😂</Text>
      <Text style={styles.copy}>Tell us.</Text>
      <Text style={styles.copy}>This pilot only works if you tell us the truth.</Text>
      <Button href={actionUrl} style={styles.button}>Tell us what you think →</Button>
      <Text style={styles.copy}>I'll be reading. 👀</Text>
      <Text style={styles.signature}>Kavi 💛</Text>
    </BrandedLayout>
  )
}

export function KaviChallengeEmail({ firstName, actionUrl, logoUrl }: LifecycleEmailProps) {
  return (
    <BrandedLayout preview="You've seen the basics. Now try this 👀" logoUrl={logoUrl}>
      <Text style={styles.copy}>Hey {firstName}!</Text>
      <Text style={styles.copy}>Okay, I have a little challenge for you.</Text>
      <Text style={styles.copy}>By now, you've probably found the parts of Kanvise you naturally gravitate towards.</Text>
      <Text style={styles.copy}>But there's a good chance there's still a feature sitting there that you haven't touched.</Text>
      <Text style={styles.copy}>So this week, I want you to pick <strong>one thing you haven't tried yet</strong> and use it with your students.</Text>
      <Text style={styles.copy}>Maybe you've been teaching but haven't run a mock.</Text>
      <Text style={styles.copy}>Maybe you've collected assignments but haven't looked closely at performance.</Text>
      <Text style={styles.copy}>Maybe you've been using the classes but haven't explored what Kanvise can actually tell you about how your students are doing.</Text>
      <Text style={styles.copy}>Go find one.</Text>
      <Text style={styles.copy}>Try it properly.</Text>
      <Text style={styles.copy}>Because sometimes the thing you didn't think you needed turns out to be the thing you end up using the most. 😉</Text>
      <Button href={actionUrl} style={styles.button}>Try something new →</Button>
      <Text style={styles.copy}>And when you do, come back and tell me how it went.</Text>
      <Text style={styles.copy}>Deal?</Text>
      <Text style={styles.signature}>Kavi 💛</Text>
    </BrandedLayout>
  )
}

export function PilotEndingEmail({ firstName, actionUrl, logoUrl }: LifecycleEmailProps) {
  return (
    <BrandedLayout preview="You were here before everyone else 💛" logoUrl={logoUrl}>
      <Text style={styles.copy}>Hey {firstName},</Text>
      <Text style={styles.copy}>And just like that…</Text>
      <Text style={styles.copy}><strong>our pilot is coming to an end.</strong></Text>
      <Text style={styles.copy}>A few weeks ago, you were one of the first people to walk into Kanvise while we were still figuring things out.</Text>
      <Text style={styles.copy}>You created classes.</Text>
      <Text style={styles.copy}>You taught sessions.</Text>
      <Text style={styles.copy}>You brought in students.</Text>
      <Text style={styles.copy}>You tried features.</Text>
      <Text style={styles.copy}>You found things we got right.</Text>
      <Text style={styles.copy}>And you found things we definitely need to fix. 😂</Text>
      <Text style={styles.copy}>But more than anything, you gave us something we couldn't get by building in isolation:</Text>
      <Heading as="h3" style={{ color: '#322B7A', fontSize: '20px', margin: '24px 0 16px' }}>your experience.</Heading>
      <Text style={styles.copy}>You helped us see Kanvise through the eyes of the people we built it for.</Text>
      <Text style={styles.copy}>And that matters.</Text>
      <Text style={styles.copy}>Because tomorrow, November 1, Kanvise opens its doors to everyone.</Text>
      <Text style={styles.copy}>But you'll always be able to say:</Text>
      <Heading as="h3" style={{ color: '#322B7A', fontSize: '20px', margin: '24px 0 16px' }}>"I was here before that."</Heading>
      <Text style={styles.copy}>Before we move into this next chapter, we want to hear one last thing from you.</Text>
      <Text style={styles.copy}>How was it? What should we keep? What should we change?</Text>
      <Text style={styles.copy}>And, most importantly, did Kanvise actually make teaching better for you?</Text>
      <Button href={actionUrl} style={styles.button}>Share your final thoughts →</Button>
      <Text style={styles.copy}>Thank you for being here at the beginning.</Text>
      <Text style={styles.copy}>We built Kanvise for educators like you.</Text>
      <Text style={styles.copy}>And now, we get to keep building it with you.</Text>
      <Text style={styles.copy}>See you on the other side. 💛</Text>
      <Text style={styles.signature}>The Kanvise Team</Text>
    </BrandedLayout>
  )
}
