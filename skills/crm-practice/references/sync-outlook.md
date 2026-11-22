# Outlook sync (one per person)

The same shape as `sync-gmail.md`, for people on Microsoft 365. A saved TypeScript Automation, created in the owner's own turn so it runs under their access, every 15 minutes. Code template: `code/automations/outlook-sync.ts`.

Before saving:

1. `connection list --toolkit outlook` in the owner's turn; if they have none, `connection create --toolkit outlook` sends the sign-in card.
2. Confirm tool names and fields with `connection tool search --toolkit outlook --query "list messages"`. Do not write code against names you have not seen returned. Typical needs: list messages received or sent after a time (both Inbox and Sent Items), with sender, recipients, subject, received time, a preview, and the message and conversation ids.
3. Log one message's keys on the rehearsal run and adjust the field mapping before saving.

What it does each run:

1. Read the cursor (newest message time from the last finished run; on the first run, now minus the backfill window).
2. List messages in Inbox and Sent Items since the cursor, paging until done.
3. For each message, find the outside party: the sender for received mail, the recipients for sent mail, minus the team's own domains, the person's skip list, and no-reply senders. Mail where no outside party remains is skipped.
4. One intake call per outside party: `source` = "Outlook · <mailbox address>", `source_ref` = `outlook:<message id>`, the person (and company from a work domain), and an activity of kind `email` with the subject and a short preview, `recorded_by` = the owner. Full bodies only if the person turned that on.
5. Advance the cursor only after a run that finished; update the data source record exactly as in the Gmail template.

Differences from Gmail worth knowing:

- Outlook separates folders; read Sent Items as well as Inbox, or outbound touches are missed.
- Conversation ids group a thread; use them to keep an existing email thread when drafting replies later.
- Shared mailboxes are a team source, connected once by whoever owns the shared mailbox, not per person.
- Recognisable senders (the scheduler's booking confirmations, the note taker's recap email, form tool notifications) can be routed to the booking, recap or form handling instead of a plain email activity, for teams that do not connect those tools directly.
