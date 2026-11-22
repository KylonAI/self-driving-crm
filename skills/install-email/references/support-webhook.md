# Support tool without a connector (Chatwoot and similar)

1. Create an inbound webhook for the CRM Room: `connection webhook create --name "<tool> conversations"`. Each event opens its own thread and wakes the Room's main Agent.
2. The person who administers the support tool copies the webhook URL from Room settings and pastes it into the tool's webhook or automation settings (for Chatwoot: Settings, Integrations, Webhooks), choosing conversation created and message created events.
3. The Agent matches each event to a client by the contact's exact email or domain, writes it to the CRM through the intake with `source` = the tool name and `source_ref` = the conversation id, and posts a one-line note in that client's thread. Unknown contacts go to Review, not to a guessed client.
4. Send one test conversation and confirm it lands in the right client thread before turning it on for everyone. State it as "not yet tested" in the design until then.
