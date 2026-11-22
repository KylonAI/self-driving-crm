# Meeting recaps and follow-up drafts

After every customer meeting, three things happen without anyone asking: the recap is written to the CRM, the notes and to-dos appear in that customer's thread, and an email **Draft Card** from the host's own mailbox is waiting for the host to review and send.

Recap sync itself is in `sync-meeting-notes.md`. This file covers what happens after a recap is matched. Code template: `code/automations/meeting-recap-check.ts`. Prompt: `prompts/meeting-recap.md`. Flow: `diagrams/meeting-follow-up.md`.

## The 15-minute check (saved code, scheduled every 15 minutes)

One scheduled Automation does the whole pipeline. Webhooks alone are not enough; ours were missed more than once, and this polling check is what kept the data right.

1. **Catch up bookings** from the scheduler since a saved cursor, with a 15-minute overlap. Move the cursor only after a clean pass.
2. **Match recaps.** For meetings that have ended and have no recap yet, list recent meetings from every connected note-taker account. Match by meeting link or code plus start time within 3 hours; else by guest email among participants plus start time within 2 hours; the nearest start wins. Recap status: found, pending (under 48 hours), not found.
   If every note-taker connection fails (expired sign-in, rate limit), skip recap updates for this run. Never write "not found" because the source was down.
3. **Attendance.** Attended if any outside participant joined. No-show only when participants are listed, a team member joined and no outsider did.
4. **After an attended meeting with a matched recap** (fires when the recap arrives, not when the meeting ends):
   1. Read the full recap. If it cannot be read, skip; never invent notes.
   2. One tool-free model call with `prompts/meeting-recap.md` returns strict JSON: 3 to 5 facts, to-dos (task, owner, due date only if stated), unclear points, a suggested stage (or none), whether a reply is needed, and the follow-up email (subject and body). Validate the JSON in code; on invalid JSON retry once with a strict reminder.
   3. Write through the intake: an activity of kind `meeting` with the summary, and a task for each to-do with an owner who is on the team. Use a dated marker in the summary (for example `[post-meeting 11/14]`) so a re-run replaces rather than duplicates.
   4. Post the notes in the customer's record thread, mentioning the host: facts, a to-do table (task, owner, due), points to check, the suggested stage (a suggestion only; a person changes the stage), and links to what was written.
   5. **Hand off the draft.** Saved code cannot present a Draft Card, so schedule a one-shot follow-up turn in the same thread, due in a minute, whose instructions are: use the host's mailbox connection; find the latest email thread with the guest and reply in it, otherwise start a new draft; HTML paragraphs, links as hyperlinks (check each link loads), the host's usual signature; never send; then mention the host in one line.
   6. A scheduled turn may not carry the host's access to their mailbox. If it cannot use it, it says so in the thread and asks the host to reply there; the host's reply starts a turn under their own access, which then creates the card. It never says "disconnected" when the cause is access.
5. **No-shows.** For a fresh no-show (meeting ended within 14 days), post one message to the host with a copyable "sorry we missed you" note and the booking link. One reminder after 3 days, close after 10. If the guest books again, close it. Old meetings found in a backfill never trigger this.
6. **Missing recap two hours after the end:** first check the mailbox sync for an email that moved or cancelled this meeting. If none, ping the host once in the thread.
7. Save state (cursor, attempts per meeting, done markers), prune it to live rows, and fail the run visibly if any item failed.

## What a good follow-up email looks like

- Only what was said in the meeting. No invented prices, dates or features.
- Short, in the host's voice, signed with their first name. No dashes as punctuation if the team's style forbids them.
- If the host promised material ("I'll send the deck"), the email includes it as a link or an attachment. It never says "I'll send it over" when the material exists.
- No unsettled terms (discounts, commissions, contract changes) unless the meeting settled them.
- Transcription errors fixed (product and company names). Names the recap got wrong are not guessed; they are flagged in "points to check".

## Without a note taker

If the team uses none, step 4 runs from the calendar event and the host's own notes: the 15-minute check posts a short "how did it go?" prompt to the host in the thread one hour after the meeting, and the host's reply (a few lines) is the recap.

## Pitfalls we hit

- Every note-taker connection expired on the same day once. Keep every connection listed so a re-authorised one is read again, and skip updates rather than write false "not found".
- A meeting a guest moved by email still triggered "where is the recap?" pings. Check the mailbox first.
- Follow-ups were posted as plain text instead of a Draft Card, so people had to copy them into their mail client and lost the email thread. Always the Draft Card, in the customer's thread, from the host's mailbox.
- A partner who came in through a customer demo was never recorded as a partner. If partners live in this CRM, add a check that suggests "this looks like a partner" to the host, with a button only the host can press.
