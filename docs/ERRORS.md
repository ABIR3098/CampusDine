# Error answers

Every error is JSON with one field: `{ "error": "message" }`. The message is written to be shown to the person.

| Status | Meaning | Example |
|---|---|---|
| 400 | The request is wrong | `Invalid month`, `Message cannot be empty` |
| 401 | No token, or an invalid or expired token | `Missing auth token`, `Invalid or expired token` |
| 402 | Not enough wallet balance | calendar `pay` |
| 403 | The role or the owner is not allowed | `Forbidden — insufficient role` |
| 404 | The thing does not exist | `Item not found` |
| 409 | The request clashes with the current state | `This group order is closed` |
| 413 | A photo is too large | chat photo over 900 KB |
| 429 | Too many failed login tries | `Too many failed attempts. Try again in 9 minute(s).` |
| 500 | Something went wrong on the server | the error handler in `server.js` |

An async route that throws is caught by `catchAsync`, so one bad request never stops the server.
