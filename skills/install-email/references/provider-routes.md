# How each mailbox reaches Kylon

| Mailbox | Route | Sending | Status to state in the design |
|---|---|---|---|
| Gmail / Google Workspace, personal | Owner connects Gmail; a capture Automation under their access writes client mail into the CRM | Draft Cards from that mailbox, person sends | Supported |
| Microsoft 365 / Outlook, personal | Owner connects Outlook; same capture pattern with the Outlook fetch tool | Draft Cards from that mailbox, person sends | Supported; confirm the Outlook tool names with `connection tool search` before saving |
| Hosted IMAP (IONOS, GoDaddy, Zoho Mail, similar), personal or shared | Owner adds a forwarding or auto-BCC rule in the provider's mail settings to an Agent mailbox; the Agent files each message to the client's thread through the CRM intake | Replies go out from the person's own mail client, or the Agent drafts in Kylon and the person copies and sends until a direct connector exists | Not yet tested: prove with one inbound and one outbound test before relying on it |
| Shared role address (sales@, info@) on any provider | Forward to an Agent mailbox, or connect it as its own Gmail/Outlook account if it is a real mailbox | Draft Cards from the connected account; the address's owner sends | Supported for Gmail/Outlook; forwarding as above for IMAP |
| Agent mailbox | Built into Kylon: the Agent requests an address, a person who manages it approves; set delivery so new mail reaches the right Room | The Agent drafts; a person approves and sends | Supported |

Choosing between them:

- If a team is starting from zero and can choose, Google Workspace or Microsoft 365 gives the most direct setup (connect, capture, draft, send all in Kylon).
- If they must keep an IMAP host, forwarding to an Agent mailbox captures inbound mail reliably once the rule is set; outbound capture needs auto-BCC on the person's sent mail, which many IMAP hosts support in their webmail settings. Check the provider's own help pages and test.
- Never ask for mailbox passwords in chat. If a provider needs an app password for anything, the owner enters it through a secure connection setup, not a message.
