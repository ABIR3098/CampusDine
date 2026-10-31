# Environment variables

Copy `backend/.env.example` to `backend/.env` and fill in your own values. Never commit `.env`.

| Variable | Purpose | Default in example |
| --- | --- | --- |
| `PORT` | Port the server listens on | `5000` |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection | `localhost`, `3306`, `root`, empty, `campusdine` |
| `JWT_SECRET` | Secret used to sign login tokens (use a long random string) | placeholder |
| `JWT_EXPIRES_IN` | Token lifetime | `7d` |
| `CORS_ORIGIN` | Allowed frontend origin(s), comma separated; `*` for local use | `*` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Email for OTP codes; leave `SMTP_HOST` empty to print codes in the console | empty |
| `EMAIL_OTP_REQUIRED` | Require an email code on sign-up and password reset | `true` |
| `LOGIN_OTP` | Login 2FA: `all`, `admin` or `off` | `all` |
| `CANTEEN_TZ` | Timezone for pickup times, the meal calendar and reports | `Asia/Dhaka` |
| `SMTP_SECURE` | Use TLS from the start of the SMTP connection (Hall emails) | `false` |
| `SMTP_FROM` | Sender name and address for Hall emails | unset |
| `WALLET_TOPUP_DAILY_LIMIT` | Most a single account can top up in one day, in taka | `20000` |
| `NODE_ENV` | `production` skips the demo accounts (admin, student1, teacher1, rider1) | unset |
