# Prompt: people search

Use to identify a person behind a sign-up, a form, a booking or an email, or to find the decision maker at a company.

---

Find out who <name and/or email> is and return a sourced profile for the CRM person record.

Steps:
1. Our own records: CRM, its threads, other Apps, earlier messages with this email.
2. The exact email in every search tool the workspace has connected. For a personal email, the local part is often the LinkedIn or X handle; try it.
3. Find the LinkedIn profile and read it directly. A current role on the person's own profile beats an enrichment database, whose history may be years old. Then enrich by the LinkedIn URL.
4. Read their own site, X and GitHub if linked. Recent posts often name the employer, team size and city.

Return: name, current title and employer (checked current, with the date seen), decision power, LinkedIn and X links, the person's own location if they state it, a two-line background, and how they relate to us. Only when someone asks for it: a work email, and only if a verification step confirms it.

Rules:
- A name plus a region is a candidate, not a match. Confirm with the email domain, their own site, or a profile that links to them. Unconfirmed goes in as "to verify", never as fact.
- Never write a job or location you inferred from a sign-up IP.
- Two people in one thread are not necessarily one customer.
- Every fact keeps its source link and confidence.
- Write through the CRM intake (fill blanks only; conflicts to Review).
