# Meeting notes (Read AI, Fireflies, Otter, Fathom, Granola, tl;dv, Zoom, Google Meet)

Note takers differ in how they hand over a recap. Pick in this order:

1. **Webhook** (Read AI, Fireflies, Fathom, tl;dv and Zoom offer one): create a webhook Automation (`workflow create --trigger webhook`, see `workflow webhook profiles` for signing), give the person the URL to paste into the provider's webhook settings, and parse each delivery.
2. **Connection with list tools**: poll every 30 minutes with the owner's connection, cursor on the newest recap time. Find the tools with `connection tool search --toolkit <toolkit> --query "list transcripts meetings"`.
3. **Email recap**: many note takers email a recap. The Gmail sync can recognise those senders and pass the recap through step 3 below instead of writing a plain email activity.

For every recap:

1. Parse deterministically what the provider gives as fields: meeting id, title, start time, participants with emails, summary, action items with assignees.
2. If the summary or action items only exist as prose, make one tool-free model call to extract `{ summary, action_items: [{ text, owner_email, due_date? }] }` from the supplied text, and validate the result in code; never invent owners or dates.
3. For each outside participant, `POST /api/intake` with `source` = "<Provider> · <owner mailbox>", `source_ref` = "<provider>:<meeting id>:<participant email>", the person, and an activity of kind `meeting` with the summary (up to 2,000 characters) and `recorded_by` = the owner.
4. For each action item the team owns, add a `task` in the same call (title = the item, `owner` = the team member whose email matches, `due_date` if stated).
5. Update the `sync_sources` record as in the Gmail template.

Keep the full transcript out of the CRM; link to it in the summary when the provider gives a URL.
