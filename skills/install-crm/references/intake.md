# Writing through the CRM's intake

`POST /api/intake` is the only way syncs and imports write customer data. Read the App's contract with `app docs <app_id>` for the full schema.

What it does with each call:

- **Company** matched by domain (given, from `website`, or from the person's work email), else by exact name. Created only when it has a name.
- **Person** matched by email. A person without email is always new, so send email whenever there is one.
- Existing records only get their **empty** fields filled. A different non-empty value becomes an open Review item instead of overwriting.
- **Activity** recorded once per `source` + `source_ref`: a repeat returns `duplicate: true` and changes nothing. This is what makes re-runs and backfills safe.
- **Deal** matched by name within its company; stage, amount and next step move with the source.
- **Follow-up** (task) not repeated while an open one with the same title exists for the same person and company.

Shape:

```json
{
  "source": "Gmail · <mailbox address>",
  "source_ref": "gmail:18c2f0a9b1",
  "company": { "name": "Northwind", "domain": "northwind.io" },
  "person": { "name": "Lee Park", "email": "<their email address>", "title": "COO" },
  "activity": {
    "kind": "email",
    "subject": "Re: pilot scope",
    "occurred_at": "2026-11-10T16:04:00Z",
    "summary": "Asked for pricing for 20 seats.",
    "recorded_by": "<owner user id>"
  },
  "task": { "title": "Send pricing for 20 seats", "due_date": "2026-11-13", "owner": "<owner user id>" }
}
```

Rules for sync code:

- `source` names the sync and the account, `source_ref` is the provider's own id with a prefix. Never reuse a `source_ref` for a different item.
- Send one call per item; on a transient failure retry that item once, then record it as missed and continue.
- After the run, `PATCH /api/sync-sources/<source_record_id>` with `{ "status": "syncing", "last_synced_at": "<now>", "items_last_run": n, "items_total": total, "last_error": null }`, or `status: "error"` and `last_error` when the run could not finish (an expired sign-in, a quota).
