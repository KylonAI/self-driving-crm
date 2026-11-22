# Google Calendar sync (one per person)

The ready-to-fill template is `code/automations/calendar-sync.ts`; the snippet below shows the shape.

Same structure as `sync-gmail.md` (reuse its `tool`, `crm`, `state` and sync-source update code). Schedule every 30 minutes. Confirm the tool with `connection tool search --toolkit googlecalendar --query "list events"`; the template uses `GOOGLECALENDAR_EVENTS_LIST` on the primary calendar.

What each run does:

1. Read the cursor `updated_since` from state (first run: 30 days ago).
2. List events with `{ calendarId: 'primary', updatedMin: updated_since, timeMax: <now + 14 days>, singleEvents: true, showDeleted: true, maxResults: 250 }`, following `nextPageToken`.
3. Keep events that have at least one attendee outside the team's domains and not on the skip list. Skip all-day events and events the owner declined.
4. For each outside attendee, `POST /api/intake`:

```json
{
  "source": "Google Calendar · <calendar address>",
  "source_ref": "gcal:<event id>:<attendee email>",
  "person": { "email": "<attendee email>", "name": "<display name>" },
  "activity": {
    "kind": "meeting",
    "subject": "<event summary>",
    "occurred_at": "<event start, ISO>",
    "summary": "<first 280 characters of the description, without conference links>",
    "recorded_by": "<owner user id>"
  }
}
```

5. A cancelled event (`status: "cancelled"`) is not written; if it was written before, leave it: the activity shows it was planned.
6. Save the newest `updated` timestamp as the next cursor, then update the `sync_sources` record exactly as in the Gmail template.

Future meetings land with their start time, so Home's activity list and the record timelines show them as upcoming.
