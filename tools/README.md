# tools

Helper and patch scripts that used to sit in the project root. Run them from the **project root** (the folder that holds `backend` and `frontend`), because they read paths such as `frontend/campusdine.html`:

```
node tools/check-setup.js
```

## What is here
- `check-setup.js`: a read-only health check. It changes nothing.
- `test-rating.js`: tries the "rate your rider" feature from the terminal. The backend and MySQL must be running.
- `apply-all.js`: runs every patch script in the right order. A patch that is already installed just says "Already applied", so running it again is safe.
- `apply-features.js`, `apply-theme.js`, `db-fix.js`, `chat-upgrade11.js`, `chat-upgrade12.js` and the other files: one-off patches for the frontend or backend. Their changes are already in the repository.
