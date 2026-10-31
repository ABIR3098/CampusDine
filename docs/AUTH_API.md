# Auth API

Base path: `/api/auth`. Routes marked **token** need `Authorization: Bearer <token>`.

| Method | Path | Token | What it does |
|---|---|---|---|
| GET | `/availability?externalId=&email=` | no | Says whether an ID or email is already taken |
| GET | `/config` | no | `{ otpRequired }` so the frontend knows whether to show the code step |
| POST | `/otp/send-signup` | no | Emails a sign-up code to a new address |
| POST | `/register` | no | Create an account |
| POST | `/login` | no | Sign in with ID or email and password |
| POST | `/login/verify` | no | Finish a two-step login with the emailed code |
| POST | `/login/resend` | no | Send a new login code |
| POST | `/forgot-password` | no | Email a reset code |
| POST | `/reset-password` | no | Set a new password with the code |
| GET | `/me` | yes | My profile |
| PUT | `/me` | yes | Update my profile, password, picture or hall details |

## Sign-up
- Roles allowed: `student`, `teacher`, `rider`. Admin accounts cannot be made here.
- ID: 3-50 characters (letters, numbers, `.`, `-`, `_`). Password: at least 6 characters.
- A **hall** account also needs `hallName` and `roomNumber`, and gets a fixed Hall ID such as `H-0007`.
- `409` means the ID or email already has an account.

## Login
1. `POST /login` with `externalId` (or an email) and `password`. The optional `role` must match the account's role.
2. If two-step login applies, the answer is `{ otpRequired: true, challenge, email, resendIn }` and a code is emailed.
3. `POST /login/verify` with `{ challenge, otp }` returns `{ token, user }`. The challenge lasts 10 minutes and proves the password step was passed.
4. Without two-step login, step 1 returns `{ token, user }` directly. The token lasts `JWT_EXPIRES_IN` (default 7 days).

Two-step login follows `LOGIN_OTP`: `all` (default), `admin` or `off`. Accounts with no email skip it.

## Limits
| Limit | Value |
|---|---|
| Wrong password attempts | 5 per ID and address, then locked 10 minutes (`429`) |
| Code lifetime | 10 minutes |
| Wrong tries per code | 5 |
| Wait before a new code | 60 seconds |
| Codes per email and purpose | 5 per hour |

## Password reset
`POST /forgot-password` always gives the same answer, so nobody can learn which IDs exist. `POST /reset-password` needs `externalId`, `email`, `otp` and `newPassword`. Admin accounts cannot be reset this way.

## Profile update
`PUT /me` accepts any of `name`, `email`, `phone`, `address`, `department`, `fatherPhone`, `hallName`, `roomNumber`, `avatar` (PNG, JPG or WebP) and `newPassword`. Changing the password needs `currentPassword`.
