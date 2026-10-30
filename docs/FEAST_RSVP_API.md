# Feast RSVP API

A Hall member can tell the mess whether they will come to a feast. The admin sees how many are going
and can download the list. All routes are under `/api/hall` and need the normal login token.

RSVP is only a headcount for now. It does not change the meal ON/OFF state or the bill.

## Routes

| Method | Path | Who | What it does |
| --- | --- | --- | --- |
| GET | `/feasts` | any Hall member | Feast list. Each feast now also has `capacity`, `goingCount`, `myRsvp`, `rsvpOpen`. |
| POST | `/feasts/:id/rsvp` | any Hall member | Body `{ "status": "going" }` or `{ "status": "not_going" }`. Answering again changes the old answer. |
| DELETE | `/feasts/:id/rsvp` | any Hall member | Takes my answer back. |
| GET | `/feasts/:id/rsvps` | admin | `{ feast, going, notGoing, people: [{ name, externalId, status, at }] }` |
| POST | `/feasts` | admin | Same as before, plus optional `capacity` (1 to 5000, empty = no limit). |

## Rules

- RSVP is open until the meal's own cut-off (the same moment the meal's price is fixed). After that, POST and DELETE answer `409`.
- When `capacity` is set and all seats are taken, a new `going` answer gets `409 This feast is full`. Someone who is already going can still re-send `going`.
- The admin can not lower `capacity` below the number of people already going (`409`).
- Saving a feast again for the same date and meal keeps its answers. Deleting a feast deletes its answers.

## Errors

| Code | When |
| --- | --- |
| 400 | `status` is not `going` / `not_going`, or `capacity` is not a whole number from 1 to 5000 |
| 404 | The feast does not exist |
| 409 | RSVP is closed, the feast is full, or seats would drop below the number going |

## Known limit

The seat check and the save are two separate queries. If two students press Going at the same
millisecond for the very last seat, both can get in. For a hall mess this is rare, but a transaction
with `SELECT ... FOR UPDATE` on the feast row would remove it.

## Tests

`cd backend && npm test` runs `tests/feastRsvp.test.js` (status parsing and the seat rule).
