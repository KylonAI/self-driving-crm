# Installing this CRM

This App is a blank CRM. To set it up, an Agent in the Room follows the bundled skill in `skills/install-crm/SKILL.md`: it asks what kind of CRM this is, brings in the customer data the Room already holds, and helps each person connect their own email, calendar and meeting notes. Every sync writes through `POST /api/intake`; **Settings › Data sources** shows what is connected and how fresh it is.
