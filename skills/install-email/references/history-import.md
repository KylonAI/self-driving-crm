# Importing past email

- Scope from the approved design: which mailboxes, how far back, only client conversations (outside the team's domains, minus the skip list).
- Gmail/Outlook: run the capture Automation's backfill with the agreed period instead of the default 30 days, in batches, keyed on the provider message id.
- IMAP hosts without a connector: ask the owner to export the agreed folders (most webmail clients export .eml or .mbox); attach the export here, read headers and snippets from it, and import through the intake with `source_ref` = the Message-ID header. Never ask for the mailbox password.
- Always a trial first: 20 representative messages, show where they landed, wait for the person's go.
- Report counts per mailbox: imported, matched to clients, sent to Review, skipped and why.
