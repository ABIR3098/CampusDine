# Chat API

Base path: `/api/chat`. Two kinds of chat live here: **support chat** between a student or teacher and
the canteen admin, and **order chat** between a customer and the rider of one order.

## Support chat
| Method and path | Who | What it does |
|---|---|---|
| `GET /conversations` | admin | Every conversation, newest first, with the last message and the unread count |
| `GET /messages` | student, teacher | My conversation with the admin |
| `GET /:userId/messages` | admin | One person's conversation |
| `POST /messages` | student, teacher, admin | Send a message (admin must say who to send it to) |
| `DELETE /messages/:id` | student, teacher, admin | Remove one of my messages for everyone (the text is blanked) |
| `GET /presence` | student, teacher, admin | Who is online and when they were last seen |
| `POST /images` | student, teacher, admin | Upload a photo (raw bytes, up to 900 KB) |
| `GET /images/:id` | student, teacher, admin | View a photo (admin or the person the chat belongs to) |
| `POST /messages/:id/reaction` | student, teacher, admin | One emoji per person per message |

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
