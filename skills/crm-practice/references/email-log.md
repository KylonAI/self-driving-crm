# Every automated email in the customer's thread

Any email an Automation sends, or prepares as a draft, for a customer shows up in that customer's record thread. A batch summary in some other Room is not enough. The account owner can then see every touch in one place and reconcile manual and automated outreach.

Code template: `code/automations/email-log.ts`.

## Rules

1. **Route to the owner thread.** Before an Automation sends or drafts, it resolves the customer's record in the CRM (by exact email, then by company domain) and that record's thread. If it cannot match exactly one customer safely, the send pauses and the case is listed for a person. Nothing goes out unlogged.
2. **Log what was actually sent.** Post in the record thread: subject, the sent text (or a link to the sent message), from which mailbox, to whom, the time, and the real status returned by the mail provider (sent, delivered, bounced, failed). Never "sent" from a planned list.
3. **Write the CRM too:** an activity of kind `email` through the intake, with `source_ref` = the provider's message id, so the timeline and the thread agree and a re-run logs nothing twice.
4. **Check for conflicts first.** Before an automated email goes out, check the customer's thread and the CRM for a recent manual email or an open conversation with the owner. If there is one, hold the automated email and tell the owner.
5. **Replies come back** through the mailbox sync (step 4 of the setup) and land in the same thread.

## Drafts versus sends

Most customer email in this practice is a Draft Card a person sends (`operating-rules.md`). Draft Cards already appear in the customer's thread when the drafting turn runs there. This file matters most for any flow the team explicitly decided may send by itself (a confirmation, a reminder, a sequence step): those must log here.

## Backstop: a daily archive of what people said

People also discuss customers in chat without any agent involved. A daily Automation can scan yesterday's messages and thread replies in the CRM Room and copy substantive customer facts (needs, decisions, quotes, risks, owner changes) into each customer's record thread, with links back to the source messages.

- Fixed window: yesterday, passed as literal dates so windows never overlap or leave gaps.
- Only customers with an owner, and only explicit mentions of the customer's name, workspace or email domain. Unsure means skip and list it as "possible mention".
- Dedupe with a dated footer on the archived reply.
- Post a short report only when something was archived or looked wrong; otherwise stay silent.
