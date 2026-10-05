## **KANVISE -Product Email Library & Design Specification** 

Version 1.0 — October 2026 

For: Product & Engineering Support: hello@kanvise.com 

### **WHAT WE ARE BUILDING** 

Kanvise product emails should feel like an extension of the product, not automated system messages. 

When something happens inside Kanvise, the user should receive a communication that tells them: 

What happened → Why it matters → What to do next 

The emails should be useful, warm and recognisably Kanvise. 

Kavi is the personality behind these communications. 

The goal is for users to eventually recognise a Kanvise email before they even read the sender. 

### **THE EMAIL FORMULA** 

Every product email should generally follow: 

HOOK → CONTEXT → MEANING → CTA → KAVI 

Hook 

The first line should immediately make the email interesting. 

Context 

Tell the user exactly what happened. 

Meaning 

Where relevant, explain why they should care. 

CTA 

Give them one clear next action. 

Kavi 

Add a small human touch where appropriate. 

Not every email needs a joke. 

Not every email needs an emoji. 

But every email should feel alive. 

### **SUBJECT LINES AND TITLES MATTER** 

Do not use generic system language such as: 

“Assignment Submission Notification”“New Student Activity” “Mock Results Available” “Class Reminder” 

Instead, make the subject feel human and specific. 

Examples: The results are in 👀 Someone just handed something in There’s something worth looking at You haven’t tried this yet Oops, that payment didn’t go through Your class starts soon 👀 

The subject must always remain truthful. 

### STANDARD EMAIL DESIGN 

All product emails should use a reusable Kanvise master template. 

The developer should create one responsive master email template that can be reused for different triggers. 

The template should contain: 

1. Kanvise branding 

Logo/brand mark at the top. 

### 2. Visual header / hero area 

A small visual related to the event. 

This could be: 

- Kavi 

- A relevant illustration 

- An animated GIF 

- A simple product visual 

- A status graphic 

- A dynamic banner 

### 3. Subject/headline 

A strong headline inside the email. 

This does not necessarily need to duplicate the email subject line. 

4. Body 

Short paragraphs with generous spacing. 

5. Primary CTA 

A clear button. 

6. Kavi sign-off 

Where appropriate. 

7. Footer 

Kanvise information and support: 

Need help? hello@kanvise.com 

### **IMPORTANT: EMAILS SHOULD NOT LOOK BLANK OR DRY** 

Plain text dumped into an email template is not the desired Kanvise experience. 

The developer should build the master template with enough visual flexibility that product emails can contain: 

- Banners 

- Kavi illustrations 

- Product screenshots 

- Animated GIFs 

- Small status animations 

- Progress indicators 

- Score cards 

- Performance cards 

- Assignment cards 

- Class cards 

- Mock result cards 

- Dynamic student information 

- Icons or illustrations 

Animations should be used intentionally, not simply because animation is available. 

For example: 

Mock results 

A result card can visually display: 

74% 

with a subtle animated reveal. 

Assignment submission 

A small Kavi/assignment animation can reinforce: 

“Someone just handed something in 👀 ” 

Class reminder 

A subtle countdown or animated “Starting soon” element could be used where supported. 

Performance alert 

A visual performance card can highlight: 

Organic Chemistry 

3 assessments 

Below previous average 

This makes the email feel like part of the Kanvise product rather than a generic notification. 

Animated GIFs and other email-safe visual elements can be used, but the email must remain functional when images or animation are not loaded. Responsive HTML email templates and reusable components are established approaches for maintaining consistent rendering across inboxes. 

### **MASTER TEMPLATE FOR NEW PRODUCT TRIGGERS** 

If a new product trigger is added and it is not already included in this document, use this structure: 

### EVENT: 

What happened in Kanvise? 

RECIPIENT: 

Who needs to know? 

TRIGGER: 

Exactly when should the email send? 

PRIORITY: 

High / Medium / Low 

GROUPING: 

Should repeated events be combined? 

SUBJECT: 

Create a strong, truthful hook. 

EMAIL HEADLINE: Create a short headline inside the email. 

HOOK: 

One or two lines that immediately create interest. 

CONTEXT: What happened? 

MEANING: 

Why does it matter? 

CTA: 

What should the user do next? 

VISUAL: 

What banner, Kavi illustration, card, animation or product visual should accompany the email? 

DYNAMIC DATA: 

What information needs to be pulled from Kanvise? 

SUPPORT: 

hello@kanvise.com 

### **PRODUCT EMAIL LIBRARY** 

01. VERIFICATION CODE 

Recipient: User Trigger: User requests account verification. 

Subject: Wait, don’t leave yet 👀 

Headline: I’ve got your code. 

Email: 

Hey {{First Name}}! 

Kavi here. I’ve got something you need before we let you in. 

{{CODE}} 

Pop that in and you're good to go. 

This code expires in {{Expiry}}. 

See you inside. 👀 

Kavi 

CTA: No button required. 

Visual: Kavi holding/presenting the verification code. Keep the code visually prominent. 

### 2. PASSWORD RESET 

Recipient: User Trigger: Password reset requested. 

Subject: Need to get back in? 

Headline: I’ve got you. 

Email: 

Hey {{First Name}}! 

Looks like you need a little help getting back into Kanvise. 

No worries. I’ve got you. 

[Reset your password → ] 

If you didn't request this, you can safely ignore this email. 

Kavi 💛 

Visual: Kavi with a simple “unlock” or “back in” visual. 

### 3.  STUDENT JOINS POD 

Recipient: Tutor Trigger: Student successfully joins a Pod. 

Subject: Someone just joined your Pod 👀 Headline: One more student in. 

Email: 

Hey {{Tutor Name}}! {{Student Name}} just joined {{Pod Name}}. One more student in. 👀 

You can now see them alongside the rest of your students and start teaching. [View Pod → ] Kavi 💛 

Visual: Pod/student count card. 

4. NEW ASSIGNMENT 

Recipient: Student Trigger: Tutor publishes an assignment. Subject: Something new just landed 👀 

Headline: Your next assignment is ready. 

Email: 

Hey {{Student Name}}! 

{{Tutor Name}} just dropped a new assignment for {{Pod Name}}. {{Assignment Name}} 

Due: {{Deadline}} 

Don’t leave it till the last minute. 👀 [View assignment → ] Kavi 

Visual: Assignment card showing name and deadline. 

5. ASSIGNMENT SUBMITTED Recipient: Tutor Trigger: Student submits an assignment. 

Subject: {{Student Name}} just handed something in 👀 Headline: A new submission is waiting. 

Email: 

Hey {{Tutor Name}}! {{Student Name}} just submitted {{Assignment Name}}. Their submission is ready for you to review. 

[Review submission → ] 

One less thing to chase. 😉 

Kavi 💛 

Visual: Kavi + submission card. 

### 6.  MULTIPLE ASSIGNMENTS SUBMITTED 

Recipient: Tutor Trigger: Multiple students submit within the configured grouping period. Subject: Your students have been busy 👀 

Headline: {{Number}} new submissions. 

Email: 

Hey {{Tutor Name}}! 

{{Number}} students have submitted their latest assignments. 

I've put them all together for you, so you don't have to go looking for them one by one. 

[Review submissions → ] 

You're welcome. 😂 

Kavi 

Visual: Stacked submission cards or a simple animated submission count. 

7. NEW MOCK AVAILABLE 

Recipient: Student Trigger: Tutor publishes a mock. 

Subject: Okay… time to see what you know 👀 

Headline: Your mock is ready. 

Email: Hey {{Student Name}}! Your {{Mock Name}} is ready. No more excuses. 😂 You've got until {{Deadline}} to complete it. [Take the mock → ] Good luck. I’ll be watching. 👀 Kavi Visual: Mock card with deadline. 

8. MOCK RESULTS READY 

Recipient: Student Trigger: Mock has been graded and results are available. Subject: The results are in 👀 Headline: Okay… let’s see how you did. 

Email: Hey {{Student Name}}! Your results for {{Mock Name}} are ready. You scored: 

{{Score}}% But your score isn't the only thing worth looking at. 

I've also pulled out the areas where you lost marks so you know what to work on next. 

[See your results → ] 

Go take a look. 👀 

Kavi 💛 

Visual: Animated score/result card. 

9.  TUTOR ASSESSMENT RESULTS 

Recipient: Tutor Trigger: Assessment results are ready for review. Subject: The results are in. Here’s what happened. 

Headline: Your students’ results are ready. 

Email: 

Hey {{Tutor Name}}! 

Your latest assessment has been graded. 

Here’s the quick picture: 

{{Number}} students assessed Average score: {{Average Score}}% 

{{Number}} students may need a closer look 

We’ve also highlighted the areas where your students struggled most. 

[View results → ] 

Kavi 💛 

Visual: Results summary card. 

10. PERFORMANCE ALERT 

Recipient: Tutor Trigger: Configured performance rule identifies a meaningful pattern. Subject: There’s something worth looking at 👀 

Headline: {{Student Name}} may need your attention. Email: 

Hey {{Tutor Name}}, We noticed something about {{Student Name}}. 

They've struggled with {{Topic}} across their last {{Number}} assessments. I've put the details together so you can see exactly where they're struggling. [View {{Student Name}}’s performance → ] 

Might be worth checking in with them. 

Kavi 💛 

Visual: Performance card showing evidence behind the alert. Important: Never make unsupported claims such as “This student is failing.” 

The email must show the underlying measurable information. 

11.  STUDENT IMPROVEMENT 

Recipient: Tutor 

Subject: Look who’s improving 👀 

Headline: {{Student Name}} is making progress. 

Email: 

Hey {{Tutor Name}}! 

{{Student Name}}'s performance has improved by {{Percentage}}% across their recent assessments. 

Their biggest improvement has been in {{Topic}}. 

[See their progress → ] 

Someone's putting in the work. 󰗰 

Kavi 

Visual: Progress card showing previous vs current performance. 

12. CLASS REMINDER 

Recipient: Tutor / Student 

Subject: Your {{Class Name}} class starts soon 👀 Headline: See you in class. 

Email: 

Hey {{First Name}}! 

Just a little heads up: 

{{Class Name}} starts in {{Time Until Class}}. 

{{Tutor Name}} and the rest of the class will be there. 

[Join class → ] 

See you in there! 

Kavi 💛 Visual: Class card + optional countdown. 13. STUDENT MISSED CLASS Recipient: Tutor Subject: {{Student Name}} wasn’t in class today Headline: Just a heads up. Email: Hey {{Tutor Name}}, {{Student Name}} wasn't marked present for today's {{Class Name}} class. You can check their attendance history below. [View attendance → ] Kavi 

Visual: Attendance status card. 

14. PAYMENT RECEIVED Recipient: Tutor Subject: Payment received. 💰 Headline: You’ve got a payment. 

Email: 

Hey {{Tutor Name}}! Good news. 

{{Amount}} has been received from {{Student Name}}. 

[View payment → ] 

One less thing to keep track of. 

Kavi 💛 Visual: Payment confirmation card. 15. PAYMENT FAILED Recipient: Tutor / Student depending on payment flow. Subject: Oops, that payment didn’t go through Headline: Something went wrong with the payment. Email: Hey {{First Name}}, The payment of {{Amount}} didn't go through. Nothing to panic about. You can try again below. [Try again → ] Kavi 👀 

Visual: Payment status card 

16. CLASS SCHEDULED Recipient: Tutor / Student 

Subject: It’s on the calendar 👀 Headline: Your class is scheduled. 

Email: Hey {{First Name}}! {{Class Name}} has been scheduled for: {{Date}} at {{Time}} [View class → ] See you there! Kavi 

Visual: Calendar/class card. 16. CLASS RESCHEDULED Recipient: Tutor / Student Subject: Tiny change: your class has moved Headline: Your class has a new time. 

Email: 

Hey {{First Name}}! Your {{Class Name}} class has a new time. Was: {{Old Date/Time}} Now: {{New Date/Time}} [View updated schedule → ] Just wanted to make sure you didn't miss it. 👀 Kavi 

Visual: Before → After schedule animation or card. 

17. CLASS CANCELLED 

Recipient: Tutor / Student 

Subject: 

Your {{Class Name}} class has been cancelled 

Headline: 

Just a heads up. 

Email: 

Hey {{First Name}}, 

The {{Class Name}} class scheduled for {{Date/Time}} has been cancelled. 

We'll let you know if a new class is scheduled. 

[View your schedule → ] 

Kavi 

Visual: Simple class status card. Avoid playful animation for cancellation. 

18.  NEW PRODUCT TRIGGERS 

When a new Kanvise feature creates a new event that is not listed above, the developer should not create a generic notification. 

Use the Kanvise Product Email Template: 

EVENT 

What happened? 

RECIPIENT 

Who needs to know? 

TRIGGER 

When should the email send? 

SUBJECT 

Write a strong, truthful hook. 

HEADLINE 

Short internal headline. 

HOOK 

Create an opening that makes the user want to continue. 

CONTEXT 

Explain what happened using real product data. 

MEANING 

Explain why it matters. 

CTA 

Give the user one obvious next step. 

VISUAL 

Choose an appropriate banner, Kavi illustration, product card, animation, GIF or other visual treatment. 

DYNAMIC DATA 

List every variable the email needs. 

SUPPORT 

hello@kanvise.com 

26. VISUAL DESIGN PRINCIPLES 

Kanvise emails should feel designed, not like text pasted into an email. 

The developer should create reusable visual components so the design can change depending on the event. 

### Recommended components include: 

- Kavi hero 

- Kavi reaction 

- Product screenshot 

- Result card 

- Student performance card 

- Assignment card 

- Class card 

- Payment card 

- Calendar card 

- Progress card 

- Status banner 

- Animated GIF area 

- Countdown area 

- CTA button 

- Support footer 

Animations should be subtle and purposeful. 

Do not make every email move. 

Do not use animation where it could distract from important academic or payment information. 

The email must still make sense if images are blocked or an animation does not load. 

### 27. EMAIL FREQUENCY 

Kanvise should not overwhelm users. 

The developer should support three notification behaviours: 

### Immediate 

For time-sensitive events such as verification, class reminders and important alerts. 

### Grouped 

For repeated events such as multiple assignment submissions. 

Digest 

For lower-priority activity that can be summarised. 

The system should be designed so these rules can be changed later without rebuilding the email system. 

SUPPORT-For questions, implementation clarification or issues with any product email:hello@kanvise.com 

FINAL STANDARD-Before adding any product email, ask: 

Would I actually want to open this? 

Does the subject make me curious without misleading me? 

Does the first line pull me in? 

Does the email tell me exactly what happened? 

Do I understand why it matters? 

Do I know what to do next? 

Does it feel like Kanvise? 

Does it feel alive rather than automated? 

If the answer is no, the email is not ready. 

# **KANVISE PILOT ONBOARDING EMAIL SEQUENCE** 

**Pilot period:** October 2026 **Audience:** 30 pilot users **Tone:** Warm, personal, playful, founder led **Character:** Kavi, the Kanvise companion 

# **1. VERIFICATION EMAIL** 

**When:** Immediately after sign up 

**Subject:** Your Kanvise code is here 👀 

Hey {{First Name}}! 

Kavi here 👋 

I’ve got your Kanvise verification code ready: 

**{{CODE}}** 

Pop that in and you’re officially in. 

I’ll see you on the other side. We’ve got some pretty cool things to show you. 😉 

Kavi 

Your little Kanvise companion 

**P.S.** Keep this code to yourself. I’m trusting you. 👀 

# **2. WELCOME EMAIL** 

**When:** Immediately after verification 

**Subject:** Welcome to Kanvise 👋 

Hi {{First Name}}, 

You’re in. 💛 

And honestly, we’re really glad you are. 

You’re now one of the first 30 educators getting to use Kanvise before we open it up to everyone else. 

Kanvise started with a simple question: 

### **What if tutors could know a student was struggling before the exam result told them?** 

Because teaching online can get messy very quickly. You’re teaching on Zoom, sending things through WhatsApp, collecting assignments somewhere else, creating assesment somewhere else again, then trying to piece together how your students are actually doing. 

We thought there had to be a better way. 

So we built Kanvise. 

A place where you can teach, manage your classes, run assessments and, most importantly, have a clearer picture of what is happening with your students. 

For the next few weeks, you get to see whether we actually got it right. 

And that’s why you’re here. 

**See the gaps. Close them early.** 

Welcome to Kanvise. 

Let’s do this. 👀 

The Kanvise Team 

# **3. FOUNDER LETTER** 

**When:** 1 hour after welcome 

**Subject:** There’s a reason we asked you to be here 💛 

**Headline:** This started with a problem we couldn’t ignore. 

Hey {{First Name}}, 

My name is Mayokun. Emmanuel and I founded Kanvise from our small rooms in University of  Ibadan. 

Before Kanvise was a product, I was a tutor. 

And one of the frustrating things about teaching was that sometimes, you could finish a class feeling like everything went well and still have no real idea what was happening with your students afterwards. 

Were they actually following? 

Who was falling behind? 

Who understood the first topic but was already struggling by the third? 

A tutor we spoke to, Martins, put it even more clearly. He told us that sometimes they only discovered that about 30% of their students were lagging **after the exam results came out.** 

That stayed with us. 

Because at that point, what can you really do? 

So we started talking to more tutors. 

Over 100 educators later, we kept hearing versions of the same thing. Tutors were already doing the work. They just didn't always have the visibility they needed to know what was happening underneath it. That became the reason we built Kanvise. 

But here's the thing; we don't want to build something that we think tutors need. We want to build something that actually makes your work easier. That is what this pilot is about. 

So please, don't use Kanvise to impress us. 

Use it the way you actually teach. 

If something makes your life easier, tell us. 

If something makes you want to close your laptop, tell us that too. 

If something doesn't make sense, tell us. 

Because once we fail at making Kanvise genuinely useful and easy to use, there really isn't much of a reason for Project Kanvise to exist. 

You have direct access to us throughout this pilot. 

And we're listening. 

Thank you for trusting us enough to be one of the first people through the door. 

Mayokun 

Co-founder, Kanvise                          NB - Add pictures of us building and animations 

**[Talk to the Kanvise Team → ]** 

# **4. MEET KAVI** 

**When:** Day 2 

**Subject:** Okay, I have something to tell you 👀 

Hey {{First Name}}! 

Okay, I’ve been waiting for this one. 

You’ve probably seen my name around already, but we haven’t actually met. 

So, hi. I’m Kavi. 󰗜 

I’m the one who’ll be keeping you company around Kanvise. 

Remember when Mayokun said we’re listening? 

Well, I’m part of that. 

When something important happens, I’ll let you know. 

When there’s something new to explore, I’ll point you there. 

When you’re wondering, “Wait… how do I do this?” 

You can ask me. 

You’ll also see me around the app, helping you get familiar with things as you use Kanvise. 

And don't worry, I’m not going to bombard you with emails every five minutes. 

I have manners. 

For now, just think of me as your little Kanvise guide. 

You’re going to be figuring things out, trying things, discovering what works for you and occasionally wondering what on earth we were thinking. 

I’ll be around for all of it. 

So I guess this is the beginning of our little friendship. 

**[Meet Kavi → ]** 

I’ll see you around. 👀 

Kavi 💛 

# **5. OKAY, LET’S ACTUALLY USE THIS THING** 

**When:** Day 3 

**Subject:** You’re in. Now let’s actually use Kanvise 👀 

Hey {{First Name}}! 

Enough introductions. 😂 

You’ve met the team. You’ve met me. 

Now I want you to actually get into Kanvise. 

And please, don't worry about doing everything perfectly. This is a pilot, remember? 

Start with the class you’re already teaching. 

Create your **Pod** , bring your students in, set up your next class and try teaching with Kanvise. 

Then, when you’re ready, explore the rest. 

Run an assignment. 

Try a mock. 

Check attendance. 

Look through your students’ performance. 

The point isn't to tick every box. 

**The point is to see what Kanvise feels like when you use it for real work.** 

So go on. 

Click things. 

Try things. 

Break something if you have to. 😂 

And if you get stuck, you know where to find me. 

**[Open Kanvise → ]** 

Let's see what happens. 

Kavi 💛 

# **6. YOUR FIRST WEEK** 

**When:** End of Week 1 

**Subject:** So… what happened when you actually used it? 👀 

Hey {{First Name}}! 

One week already. 

Which means you've probably gone from: 

"Okay, what is this thing?" 

to 

"Ohhh, I see what they’re trying to do." 

Or maybe you're still somewhere between the two. 😂 

Either way, I want to hear about it. 

Because this is the part we care about. 

Not whether you opened Kanvise. 

Not whether you clicked every button. 

### **What happened when you actually used it in your teaching?** 

Did something save you time? 

Did you notice something about a student that you wouldn't have noticed before? 

Did something feel confusing? 

Was there a moment where you thought, “Oh, this is actually useful.” 

Or did you find yourself thinking, “Guys… why did you build it like this?” 😂 

Tell us. 

This pilot only works if you tell us the truth. 

**[Tell us what you think → ]** 

I'll be reading. 👀 

Kavi 💛 

# **7. KAVI HAS A LITTLE CHALLENGE FOR YOU** 

**When:** Week 2 

**Subject:** You’ve seen the basics. Now try this 👀 

Hey {{First Name}}! 

Okay, I have a little challenge for you. 

By now, you've probably found the parts of Kanvise you naturally gravitate towards. 

But there’s a good chance there’s still a feature sitting there that you haven't touched. 

So this week, I want you to pick **one thing you haven't tried yet** and use it with your students. 

Maybe you've been teaching but haven't run a mock. 

Maybe you've collected assignments but haven't looked closely at performance. 

Maybe you've been using the classes but haven't explored what Kanvise can actually tell you about how your students are doing. 

Go find one. 

Try it properly. 

Because sometimes the thing you didn't think you needed turns out to be the thing you end up using the most. 😉 

**[Try something new → ]** 

And when you do, come back and tell me how it went. 

Deal? 

Kavi 💛 

# **8. THE PILOT IS ENDING** 

**When:** October 31 / November 1 

**Subject:** You were here before everyone else 💛 

Hey {{First Name}}, 

And just like that… 

**our pilot is coming to an end.** 

A few weeks ago, you were one of the first people to walk into Kanvise while we were still figuring things out. 

You created Pods. 

You taught classes. 

You brought in students. 

You tried features. 

You found things we got right. 

And you found things we definitely need to fix. 😂 

But more than anything, you gave us something we couldn't get by building in isolation: 

### **your experience.** 

You helped us see Kanvise through the eyes of the people we built it for. 

And that matters. 

Because tomorrow, November 1, Kanvise opens its doors to everyone. 

But you'll always be able to say: 

### **“I was here before that.”** 

Before we move into this next chapter, we want to hear one last thing from you. 

How was it? What should we keep? What should we change? 

And, most importantly, did Kanvise actually make teaching better for you? 

**[Share your final thoughts → ]** 

Thank you for being here at the beginning. 

We built Kanvise for educators like you. 

And now, we get to keep building it with you. 

See you on the other side. 💛 

The Kanvise Team 

USE SURVERY LINKS- NOT GOOGLE FORM FOR FEEDBACK 

