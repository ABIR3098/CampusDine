# FAQ

Short answers to common setup questions.

## Which port does the server use?
The `PORT` value in `backend/.env` (`5000` in `.env.example`). The server also serves the frontend, so open that address in the browser.

## I have no email provider. How do I get the OTP code?
Leave `SMTP_HOST` empty. The code is printed in the server console while developing.
