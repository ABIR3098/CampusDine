# Profile API: `PUT /api/auth/me`

Updates the signed-in person's own profile. It needs the login token (`Authorization: Bearer <token>`)
and works for every role. Send only the fields you want to change. The answer is the updated user.

## Fields

| Field | Rule |
|---|---|
| `name` | Ignored when blank. |
| `email` | Must be a valid address, at most 120 characters, and not used by another account. Changing it needs `currentPassword` (see below). |
| `phone`, `address`, `department`, `fatherPhone` | Free text. An empty value clears the field. |
| `hallName`, `roomNumber` | Room at most 20 characters, hall name at most 60. Saving a room needs a hall name. The first time a room is saved the account becomes a hall account and gets its Hall ID (made once, never changed). |
| `avatar` | A PNG, JPEG or WebP image as a data URL, at most 400,000 characters. `null` or `""` removes the picture. |
| `currentPassword`, `newPassword` | `newPassword` needs `currentPassword` and must be at least 6 characters. |

## Changing the e-mail needs the current password

The e-mail is where "forgot password" codes are sent, so whoever controls it can take the account.
Because of that, an e-mail change must come with the correct `currentPassword`. The same applies
when an account with no e-mail adds its first one.

Sending the address the account already has (any capital letters or spaces are ignored) needs no
password. The profile form sends the e-mail on every save, so ordinary saves are not affected.

## Answers

| Status | When |
|---|---|
| `200` | Saved. Body is the updated user. |
| `400` | Invalid e-mail; e-mail change without `currentPassword`; room or hall name too long; room without hall name; bad or too large `avatar`; `newPassword` too short or without `currentPassword`; nothing to update. |
| `401` | `currentPassword` is wrong. |
| `404` | The account no longer exists (only when an e-mail change is sent). |
| `409` | The e-mail is already used by another account. |

Related: `POST /api/auth/forgot-password` and `POST /api/auth/reset-password` (reset by e-mail code).
