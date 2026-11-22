# Email design: what the person signs off

One page for the business owner. Use their names for brands, addresses and stages. Worked example: `docs/kylon-email-architecture.html`.

1. **Summary:** where client mail will be visible, who drafts, who sends.
2. **Mailboxes:** a table of every address (personal, shared, Agent), owner, provider, route from `provider-routes.md`, and status (supported / to be tested).
3. **Capture into the CRM:** which mail is captured (default: conversations with people outside the team's own domains), what is stored (default: subject, snippet, link back), matching rule (exact email or domain, never by name; unsure goes to Review), and how often each capture runs.
4. **One client, one thread:** captured mail, Agent drafts and support conversations for a client all land in that client's record thread in the CRM Room.
5. **Sending:** Draft Cards from the right mailbox; who approves; signature; large files as links; if the team uses several sending domains, which domain is for what (for example one for one-to-one client mail, one for automated notices).
6. **Support tool** (if any): how conversations reach the client thread (webhook), and what an Agent may do with them.
7. **History import:** period, which mailboxes, trial size, what is skipped.
8. **Privacy:** what admins see, what teammates see of each other's mail, what is never stored, how a person removes a thread captured by mistake.
9. **Open questions and anything untested.**

End with the approval card.
