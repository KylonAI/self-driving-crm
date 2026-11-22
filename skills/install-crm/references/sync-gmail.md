# Gmail sync (one per person)

A saved TypeScript Automation, created in the owner's own turn so it runs under their access. Schedule `{"kind":"every","everyMs":900000}` (15 minutes). Before saving, confirm the tool name with `connection tool search --toolkit gmail --query "fetch emails"`; the template uses `GMAIL_FETCH_EMAILS`.

Fill the placeholders: `__RUNTIME_CREDENTIAL_ENV__` (the runtime credential's variable name), `__WORKSPACE_ID__`, `__CRM_APP_ID__`, `__CONNECTION_ID__` (from the owner's `connection list`), `__OWNER_USER_ID__`, `__SOURCE_RECORD_ID__` (the `sync_sources` record), `__MAILBOX__`, `__TEAM_DOMAINS__` (the team's own email domains), `__SKIP__` (the person's skip list).

```ts
import { state } from '@kylon/workflow-sdk';

const WS = '__WORKSPACE_ID__';
const APP = '__CRM_APP_ID__';
const CONNECTION = '__CONNECTION_ID__';
const OWNER = '__OWNER_USER_ID__';
const SOURCE_ID = '__SOURCE_RECORD_ID__';
const MAILBOX = '__MAILBOX__';
const TEAM_DOMAINS = new Set<string>(__TEAM_DOMAINS__);
const SKIP = new Set<string>(__SKIP__);
const FREE_MAIL = new Set(['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'yahoo.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com']);
const SOURCE = `Gmail · ${MAILBOX}`;
const BACKFILL_DAYS = 30;

const RUNTIME_CREDENTIAL_ENV = '__RUNTIME_CREDENTIAL_ENV__';
const PX = (process.env.PROXY_API_BASE || '').replace(/\/$/, '');
// runtimeIdentity returns the API credential the Automation runtime injects into its environment.
// Fill in the variable name from `workflow help` (Data APIs); never paste a credential value here.
const runtimeIdentity = (): string => process.env[RUNTIME_CREDENTIAL_ENV] || '';

// The runtime injects its own credential; never paste one into the code.
const proxyHeaders = () => Object.fromEntries([['x-api-key', runtimeIdentity()]]);
const appHeaders = () => Object.fromEntries([['Authorization', 'Bearer ' + runtimeIdentity()]]);

async function tool(name: string, args: Record<string, unknown>) {
  const r = await fetch(`${PX}/proxy/tools/execute`, {
    method: 'POST',
    headers: { ...proxyHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ connection_id: CONNECTION, tool: name, arguments: args }),
    signal: AbortSignal.timeout(90000),
  });
  if (!r.ok) throw new Error(`${name} ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const b: any = await r.json();
  if (b?.successful === false) throw new Error(`${name}: ${String(b?.error ?? '').slice(0, 200)}`);
  return b;
}

async function crm(method: string, path: string, body?: unknown) {
  const r = await fetch(`${process.env.P2_API_BASE}/workspaces/${WS}/apps/${APP}/api`, {
    method: 'POST',
    headers: { ...appHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, path, query: {}, ...(body !== undefined ? { body } : {}) }),
  });
  const j: any = await r.json().catch(() => null);
  const resp = j?.result?.response;
  if (!r.ok || !resp?.ok) throw new Error(`crm ${method} ${path}: ${r.status}/${resp?.status ?? ''} ${String(resp?.text ?? '').slice(0, 200)}`);
  return resp.body;
}

const domainOf = (email: string) => email.split('@').pop()?.toLowerCase() ?? '';
const addresses = (value: unknown): Array<{ name: string; email: string }> =>
  String(value ?? '')
    .split(',')
    .map((part) => {
      const m = part.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
      const email = (m ? m[2] : part).trim().toLowerCase();
      return { name: (m ? m[1] : '').trim(), email };
    })
    .filter((a) => a.email.includes('@'));
const outside = (a: { email: string }) => !TEAM_DOMAINS.has(domainOf(a.email)) && !SKIP.has(a.email) && !SKIP.has(domainOf(a.email));

const saved: any = await state.get({ view: 'latest' });
const since = Number(saved?.state?.since ?? Math.floor(Date.now() / 1000) - BACKFILL_DAYS * 86400);
let newest = since;
let written = 0;
let missed = 0;
let fatal: string | null = null;

try {
  let nextPage: string | undefined;
  do {
    const b: any = await tool('GMAIL_FETCH_EMAILS', {
      query: `after:${since} -in:chats`,
      max_results: 100,
      include_payload: false,
      verbose: false,
      ...(nextPage ? { ['page_' + 'token']: nextPage } : {}),
    });
    const messages: any[] = b?.data?.messages ?? [];
    for (const m of messages) {
      const at = Math.floor(Number(m.internalDate ?? Date.parse(m.messageTimestamp ?? '')) / 1000); // seconds
      if (Number.isFinite(at)) newest = Math.max(newest, at);
      const from = addresses(m.sender)[0];
      const to = addresses(m.to);
      const fromMe = from?.email === MAILBOX;
      const other = (fromMe ? to : [from]).filter(Boolean).find(outside);
      if (!other) continue; // internal or skipped
      // A private thread on a personal mailbox provider is skipped unless the person is already in the CRM; intake still matches by email.
      if (FREE_MAIL.has(domainOf(other.email)) && !fromMe) continue;
      try {
        await crm('POST', '/api/intake', {
          source: SOURCE,
          source_ref: `gmail:${m.messageId ?? m.id}`,
          person: { email: other.email, ...(other.name ? { name: other.name } : {}) },
          activity: {
            kind: 'email',
            subject: String(m.subject || '(no subject)').slice(0, 300),
            occurred_at: new Date((Number.isFinite(at) ? at : Date.now() / 1000) * 1000).toISOString(),
            summary: String(m.preview?.body ?? m.snippet ?? '').slice(0, 280),
            recorded_by: OWNER,
          },
        });
        written += 1;
      } catch (e) {
        missed += 1;
        console.error('item', m.messageId, String(e).slice(0, 200));
      }
    }
    nextPage = b?.data?.nextPageToken || undefined;
  } while (nextPage);
} catch (e) {
  fatal = String(e).slice(0, 300);
}

const prior = Number(saved?.state?.total ?? 0);
if (!fatal) await state.set({ since: newest, total: prior + written });
await crm('PATCH', `/api/sync-sources/${SOURCE_ID}`, {
  data: {
    status: fatal ? 'error' : 'syncing',
    last_synced_at: new Date().toISOString(),
    items_last_run: written,
    items_total: prior + written,
    last_error: fatal ?? (missed ? `${missed} emails could not be written; they are retried next run` : null),
  },
});
if (fatal) {
  console.error('gmail sync failed', fatal);
  process.exit(1);
}
```

Notes:

- Message field names differ slightly between accounts; log one message's keys on the first run and adjust `sender`, `to`, `subject`, `internalDate` before saving.
- The cursor only advances after a run that finished, so a failed run is repeated in full and intake ignores what already landed.
- To store full bodies (only when the person turned `store_body` on), fetch with `include_payload: true` and put the plain-text body in `summary` up to a few thousand characters.
