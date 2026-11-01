# Teacher-rider chat API

Base path: `/api/teacher-rider-chat`. A direct chat between **one teacher and one rider**. It is not tied to an order
(for that, use the order chat in [CHAT_API.md](CHAT_API.md)) and it is separate from the support chat with the admin.
Only the roles `teacher` and `rider` can call it; everyone else gets 403.

## Who can talk to whom

| I am | I can write to | Starting a new chat |
|---|---|---|
| teacher | any rider | always allowed |
| rider | any teacher | only a teacher whose order I carry (or carried). Once the teacher has written first, I can answer even without a shared order |

Teacher and teacher, rider and rider, students, staff and admins are never in this chat. Two riders never see each other's
chat with the same teacher: a thread belongs to exactly one teacher + rider pair.

## Routes
| Method and path | What it does |
|---|---|
| `GET /threads` | My chats, newest first: `thread_id`, `peer_id`, `name`, `role`, `external_id`, `updated_at`, `last_message`, `unread_count` |
| `GET /contacts` | People I already share an order with (a teacher sees riders, a rider sees teachers), most recent order first, up to 10 |
| `GET /directory?q=` | Find someone to start a chat with (2+ letters of the name or ID, up to 10). A teacher finds any rider, a rider only finds order-linked teachers |
| `GET /unread` | `{ unread }`: how many messages are waiting for me, used for the badge on the chat tab |
| `GET /:peerId/messages` | One conversation (the last 300 messages). Marks the messages sent to me as read. Before the first message you get `threadId: null` and an empty list |
| `POST /:peerId/messages` | Send `{ message }` (1 to 2000 characters). The first message opens the thread. Answer `201 { message }` |
| `DELETE /messages/:id` | Remove one of my own messages for both sides (the text is blanked, the row stays) |

`:peerId` is the user ID of the other person. A deleted message comes back with `message: ""` and a `deleted_at` time.

## Live events
`teacher-rider-chat:message`, `teacher-rider-chat:read` and `teacher-rider-chat:deleted`, sent to the rooms `user:<id>` of both
people. See [SOCKET_EVENTS.md](SOCKET_EVENTS.md).

## Tables
Created on first use (no migration to run): `teacher_rider_threads` (unique per `teacher_id` + `rider_id`) and
`teacher_rider_messages` (`thread_id`, `sender_id`, `recipient_id`, `message`, `read_at`, `deleted_at`).

## Errors
400 bad user ID, empty or too long message; 401 no token; 403 wrong role, or a rider starting a chat with a teacher they do not
deliver to; 404 the other person does not exist or has the wrong role (teacher to teacher, rider to rider), or the message is not yours.
