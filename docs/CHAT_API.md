# Chat API

Base path: `/api/chat`. Two kinds of chat live here: **support chat** and **order chat** between a customer and the rider of one order.

Support chat has two separate inboxes, picked with `scope`:

| Scope | Student/teacher talks to | Who answers | Where it shows |
|---|---|---|---|
| `canteen` (default) | the canteen admin | `admin` | the Chat tab inside a restaurant |
| `hall` | the Hall Admin | `hall_admin` | Hall → "Hall Admin chat" tab; Hall Admin portal → "Student messages" |

A student passes `?scope=hall` (or `scope` in the body of `POST /messages`). Admin and Hall Admin never pass it: the server uses their role.
Inside the Hall the canteen admin is a member of the hall inbox too (the app sends `scope=hall`), so the canteen admin and the Hall Admin can talk to each other there. The inbox routes (`/conversations`, `/:userId/messages`, `/directory`) ignore `scope`: the canteen admin always gets the canteen inbox, the Hall Admin the hall inbox.
Canteen Admin cannot read Hall chats of students and Hall Admin cannot read canteen chats (messages, photos, reactions and typing are all separated). Staff accounts only have the canteen chat.

## Support chat
| Method and path | Who | What it does |
|---|---|---|
| `GET /conversations` | admin, hall_admin | Every conversation, newest first, with the last message and the unread count |
| `GET /messages` | student, teacher, staff, admin (only with `scope=hall`) | My conversation with the admin of the inbox (the canteen admin uses it inside the Hall to read the chat with the Hall Admin) |
| `GET /:userId/messages` | admin, hall_admin | One person's conversation |
| `POST /messages` | student, teacher, staff, admin, hall_admin | Send a message (admin and Hall Admin must say who to send it to with `userId`) |
| `GET /directory?q=` | admin, hall_admin | Find a student/teacher by name or ID (2+ letters) to start a new conversation |
| `DELETE /messages/:id` | student, teacher, staff, admin, hall_admin | Remove one of my messages for everyone (the text is blanked) |
| `GET /presence` | student, teacher, staff, admin, hall_admin | Who is online and when they were last seen |
| `POST /images` | student, teacher, staff, admin, hall_admin | Upload a photo (raw bytes, up to 900 KB) |
| `GET /images/:id` | student, teacher, staff, admin, hall_admin | View a photo (the admin of that inbox or the person the chat belongs to) |
| `POST /messages/:id/reaction` | student, teacher, staff, admin, hall_admin | One emoji per person per message |

A message is 1 to 4000 characters. Allowed reactions: 👍 ❤️ 😂 😮 😢 🙏. Sending no emoji removes your reaction. Only an admin or the person the conversation belongs to can react.

## Order chat
| Method and path | Who | What it does |
|---|---|---|
| `GET /order/:orderId/messages` | student, teacher, rider | Messages of one order |
| `POST /order/:orderId/messages` | student, teacher, rider | Send a message (1 to 1000 characters) |

Only the customer of the order and its assigned rider can use it. Sending before a rider is assigned gives 409.

## Live events
`chat:message`, `order-chat:message`, `chat:deleted`, `chat:reaction` and `chat:typing`. See [SOCKET_EVENTS.md](SOCKET_EVENTS.md).

## Errors
400 empty or too long message, bad id, unsupported reaction or photo; 403 not your chat or photo; 404 not found;
409 no rider yet; 413 photo too large.
