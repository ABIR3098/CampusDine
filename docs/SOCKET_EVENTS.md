# Live (Socket.IO) events

The browser connects with its login token. After that the server puts the connection into rooms:

| Room | Who is in it |
|---|---|
| `user:<id>` | every logged-in user (their own room) |
| `admins` | admin accounts |
| `teachers` | teacher accounts |
| `rider:<id>` | the rider with that id |
| `hall_admins` | hall admin accounts |

## Events the server sends
| Event | Sent to | When |
|---|---|---|
| `order:new` | `admins` | a new order is placed |
| `order:update` | `admins` and `user:<customer>` | an order changes status, or is picked up |
| `queue:changed` | everyone | the kitchen queue changed |
| `loyalty:update` | `user:<customer>` | points were awarded for an order |
| `referral:bonus` | the new user and the referrer | a referral bonus was paid (`kind` is `friend` or `referrer`) |
| `wallet:received` | `user:<receiver>` | someone sent money to the wallet |
| `issue:new` | `admins` | a customer reported a problem with an order |
| `issue:update` | `user:<customer>` | an admin answered or changed the report |
| `feedback:new` | `admins` | feedback or an order rating arrived |
| `menu:changed` | everyone | an admin changed a menu item |
| `menu:restocked` | `user:<id>` of people who asked to be told | a sold-out item is back |
| `announcement` | everyone | an admin sent an announcement |
| `rider:order-assigned` | `rider:<id>` | an order was given to the rider |
| `rider:order-accepted` | `admins` | a rider accepted a delivery |
| `rider:location` | `teachers` | a rider shares GPS, or stops sharing (`active: false`) |
| `chat:message` | sender and receiver | a support chat message |
| `order-chat:message` | customer and rider | an order chat message |
| `chat:deleted` | sender and receiver | a message was removed |
| `chat:reaction` | the chat owner and `admins` | someone reacted to a message |
| `hall:notification` | `user:<id>` | a Hall last-call or notice message |

## Event the browser sends
`chat:typing` with `{ to, typing }`. The server passes it on as `chat:typing` to `user:<to>`
(or to `admins` when the sender is not an admin).
