# Prompt: meeting recap to notes, to-dos and follow-up email

Used as one tool-free model call inside the meeting recap check. The code supplies the recap text, the meeting metadata and the host's first name, and validates the JSON that comes back. The model never calls tools.

---

You are given the recap of a meeting between our team and an outside guest, plus metadata. Use only what is in the supplied material. If something is not stated, leave it out or mark it unclear. Never invent prices, dates, product capabilities, commitments or names.

Material:
- Meeting: {title}, {start_time} ({time_zone}), host {host_first_name}, guest {guest_name} at {guest_company}
- Recap summary: {summary}
- Action items from the note taker: {action_items}
- Key questions: {key_questions}
- Material the host may have promised (links the team approved for sending): {approved_links}
- Team style rules: {style_rules}

Return one JSON object and nothing else:

{
  "facts": ["3 to 5 short facts about the guest's situation and what they want"],
  "todos": [{"task": "...", "owner_first_name": "<team member or TBD>", "due_date": "YYYY-MM-DD or null, only if stated"}],
  "unclear": ["names, numbers or decisions the recap left unclear or may have transcribed wrong"],
  "suggested_stage": "<one of the CRM's stage ids, or null>",
  "reply_needed": true,
  "email": {
    "subject": "short, specific to this meeting",
    "body": "plain paragraphs separated by blank lines"
  }
}

Rules for the email:
- Written as the host, to the guest, in the host's usual tone: brief, warm, direct. Signed "{host_first_name}".
- Thank them in one line, recap what was agreed in two or three lines, list the next steps with owners, and include any promised material as links from {approved_links}. If the host promised something not in that list, put it in "unclear" instead of writing "I'll send it over".
- Under 150 words unless the meeting agreed on detailed next steps.
- Do not quote the guest's usage, billing or anything the team learned outside this meeting.
- Do not include discounts, pricing or contract terms unless the meeting settled them.
- Fix obvious transcription errors in product and company names. Do not guess a name you are unsure of; list it in "unclear".
