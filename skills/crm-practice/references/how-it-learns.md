# How it learns

The CRM runs itself because the agent keeps turning the team's own decisions into rules it follows next time. Nobody writes a rulebook up front. The agent learns the way a new teammate does: from being corrected, and from watching how the team decides.

The loop has four parts:

- **Observe.** Mail, meetings, bookings, forms and sign-ups land on the right record through the intake.
- **Act.** The agent fills blanks, moves meetings, drafts follow-ups and sends real disagreements to Review.
- **Learn.** A person corrects the agent in a thread, or decides the same kind of Review item the same way again and again.
- **Improve.** The agent writes that down as a rule, with who and when, and follows it from the next run on.

## What it learns from

1. **A correction in a thread.** Someone tells the agent it got something wrong ("that call never happened, the guest moved it by email"). Fix the work in that same turn, then write the rule down (below).
2. **Repeated Review decisions.** When people have settled the same kind of Review item the same way three times in a row (same field, same competing source, same choice, none reversed), that is a team habit. Write it down as a rule with links to those decisions (`operating-rules.md`, "Learn from how the team decides").

Never learn from a single decision, from one person's mood in one thread, or from anything about money, ownership or who decides. Those keep going to a person.

## Where a rule goes

Write each rule where it belongs, with the person's name and the date:

| Kind of rule | Where it goes | Example |
| --- | --- | --- |
| How this team works | The CRM Room's guideline, under a heading like `## <Topic> (<Name>, <date>)` | "Before asking for a recap, check the guest's email for a reschedule." |
| One person's preference | The agent's memory, scoped to that person | "Dana wants follow-ups short, no bullet points." |
| A repeatable method | A skill (this one, or the team's own) | "How we qualify an inbound agency lead." |
| How records match or what goes to Review | A draft of the CRM App for a person to approve | "Treat `@acme.co` and `@acme.com` as the same company." |
| What a scheduled sync or check does | A draft change to that Automation for a person to approve | "Skip the recap reminder when the meeting was moved." |

Changes to the App or an Automation are always drafts a person approves. Guideline and memory rules take effect at once and are announced in the thread where they came from.

Read the guideline, your memory and the relevant skills before every run. A rule that is written down but not read is not learned.

## Show what it learned

People trust a rule they can see. After the first week runs cleanly, offer an Automation (saved paused until someone turns it on) that posts one card in the CRM Room every Monday:

- **Title:** "What I learned this week".
- **One row per rule** added or changed in the last 7 days: the rule in one line, where it lives (guideline, memory, skill, App draft, Automation draft), the thread or Review items it came from, and who said so or approved it.
- **Rules dropped** because someone decided differently, with a link to that decision.
- Nothing learned that week: post nothing.

The card is built by the agent reading the Room guideline history, its memory changes and the Review log for the week. Keep it to the rules; no process logs.

## Undo

Anyone can undo a learned rule by deciding differently once (in Review or in the thread). Drop the rule, say so in the thread it came from, and send that kind of item back to people until a new pattern forms.

## A worked example (made-up names)

1. Sam at Harbor & Pine emails to move Tuesday's call to Friday. The agent moves the meeting on the record.
2. Two hours after the old time, the agent asks Dana for the recap. Dana replies: "That call never happened. Sam moved it by email."
3. The agent fixes the record and writes to the Room guideline: `## Recaps (Dana, Nov 24)`: "Before asking for a recap, check the guest's email for a reschedule."
4. Next week Northwind moves a call by email. The agent updates the meeting and does not ask for a recap, and notes "followed the Recaps rule from Dana, Nov 24".

Same idea from Review: Dana keeps HubSpot's phone number over a new email signature on Oct 30, Nov 6 and Nov 13. On Nov 27 the agent writes "When a signature phone differs from HubSpot, keep HubSpot's (from Dana's choices on Oct 30, Nov 6 and Nov 13)" and applies it to the next signature, saying which rule it followed.
