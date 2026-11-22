# Prompt: company research

Use for a new sign-up, a form submission, a booking, an inbound email from an unknown company, or "who is this company?" before a meeting. The intake Automations call it once per new company; people can also ask for it in a record thread.

---

Research <company or email domain or website> and return a sourced brief for the CRM record.

Work in this order and stop only when a field is confirmed or you can say why it cannot be:
1. Our own records first: the CRM record and its thread, other Apps in this workspace, earlier threads that mention the company or the person's email. Note any earlier contact and who had it.
2. The company website: home, About, Team, Pricing, Careers, Contact, footer. Follow every linked profile (LinkedIn company page, X, GitHub, YouTube) and read recent posts.
3. Whatever enrichment and search tools this workspace has connected (web search, an enrichment service such as Apollo, a people-data service). Check the exact email and the domain before giving up.
4. For a personal email address (gmail.com, outlook.com and so on), do not force a company. Find the person first (see people-search.md), then their employer from a confirmed profile.

Write:
- One sentence: who they are and why they matter to us.
- Confirmed facts, each with its source link: what they do and for whom, size, headquarters, founded, founders and decision makers, funding, tools they use.
- Our relationship: earlier contact, who owns the account, open threads.
- Where our product fits (labelled as our inference): two or three scenarios, each tied to a fact above, easiest first.
- Three questions worth asking in the first call, aimed at the unknown fields.
- Unknowns and conflicts: field plus reason (not found, not queried, blocked, conflicting sources).

Rules:
- Every external fact carries its own source link and a confidence (high, medium, low). Inferences are labelled as inferences.
- A website or handle you found is the start of the research, not the result. Read it and follow its links.
- Same name is not the same company. Brand, operating company and legal entity can differ; state the link and its source.
- An IP address or sign-up region is not the company's location. Leave location empty rather than guess.
- No record of something is not proof it did not happen ("no site visit recorded", not "never visited").
- Never put what you found into an email to the customer ("I saw you are based in...").
- Write the result into the CRM through the intake (empty fields only; conflicts go to Review) and add source links as linked resources. Post a short summary in the record thread.
