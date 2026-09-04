# Telegram MVP implementation

Telegram is a teaching companion, not a replacement Kanvise interface. Tutors continue to teach with Telegram text, screenshots, voice notes and files. Kanvise sends the timely messages around that teaching and remains the source of truth for enrolment, payments, assignments, mocks, and attendance records.

## Included

- Admin-controlled group connection using an expiring code from `POST /telegram/connection-codes/group` and `/connect <code>` in the group.
- Student opt-in private reminders using the Telegram control in Student Settings. The student starts the bot with a one-time link; the bot can then DM them.
- Existing class, assignment, mock, grade and cancellation notifications now attempt an idempotent Telegram DM for opted-in students.
- Class reminders are additionally posted to each active connected school group.
- Payment confirmation sends an idempotent Telegram receipt DM in addition to the existing email receipt.
- Tutors/admins can open a timed Telegram attendance window with `POST /telegram/attendance/windows`. Students tap **Check in** in the group. Only linked and enrolled students are recorded; the scheduled job closes the window and posts a count.
- A centre can connect one **Paid class chat**. Paid students link their Telegram account from Settings with a bot-delivered verification code, then the bot sends a join-request link and approves only accounts linked to a Kanvise enrolment. This has no effect unless a centre explicitly configures a paid Telegram chat.

## Deliberately excluded

- No automatic removals, bans, restrictions, or payment enforcement in Telegram.
- No Telegram Mini App and no attempt to copy normal teaching content into Kanvise.
- No native Telegram mock exams or tutor/admin dashboard inside Telegram.

## Deployment configuration

Set these API environment variables before enabling the integration:

```text
TELEGRAM_BOT_TOKEN=<BotFather token>
TELEGRAM_BOT_USERNAME=<bot username without @>
TELEGRAM_WEBHOOK_SECRET=<at least 32 random bytes>
```

Apply `20260806000000_add_telegram_teaching_layer.sql`, regenerate Supabase database types, deploy the API, then register:

```text
POST https://api.telegram.org/bot<BOT_TOKEN>/setWebhook
url=https://<api-host>/telegram/webhook
secret_token=<TELEGRAM_WEBHOOK_SECRET>
allowed_updates=["message","channel_post","callback_query","chat_join_request"]
```

The bot must be added to each connected teaching chat. The person sending `/connect` or `/connect-paid` must be both a Kanvise admin (by virtue of possessing the dashboard-generated one-time code) and a Telegram group administrator. A paid chat also requires the bot to have permission to create invite links and approve join requests.
