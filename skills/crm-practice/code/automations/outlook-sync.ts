// ===== Shared helpers: identical in every template in this folder (see README.md). =====
// Fill every __PLACEHOLDER__ before saving. Never paste a credential value into the code:
// the Automation runtime injects its own credential into the environment.
import { ctx, proxy, state } from '@kylon/workflow-sdk';

const WS = '__WORKSPACE_ID__';
const APP = '__CRM_APP_ID__'; // the CRM App
const CRM_ROOM = '__CRM_ROOM_ID__'; // the Room the CRM App lives in (record threads are created there)
const MODEL = '__MODEL__'; // a fast Claude model for sorting and short summaries; a stronger one for recaps
const RUNTIME_CREDENTIAL_ENV = '__RUNTIME_CREDENTIAL_ENV__'; // variable name from `workflow help` (Data APIs)

const PX = (process.env.PROXY_API_BASE || '').replace(/\/$/, '');
const P2 = (process.env.P2_API_BASE || '').replace(/\/$/, '');
const runtimeIdentity = (): string => process.env[RUNTIME_CREDENTIAL_ENV] || '';
const proxyHeaders = () => Object.fromEntries([['x-api-key', runtimeIdentity()]]);
const authHeaders = () => Object.fromEntries([['Authorization', 'Bearer ' + runtimeIdentity()]]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Run one tool of a Connection. Rate limits and server errors are retried; any other error fails at once. */
async function tool(connection: string, name: string, args: Record<string, unknown>): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(`${PX}/proxy/tools/execute`, {
      method: 'POST',
      headers: { ...proxyHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ connection_id: connection, tool: name, arguments: args }),
      signal: AbortSignal.timeout(90_000),
    });
    if ((r.status === 429 || r.status >= 500) && attempt < 2) { await sleep(3000 * (attempt + 1)); continue; }
    if (!r.ok) throw new Error(`${name} ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const b: any = await r.json();
    if (b?.successful === false) throw new Error(`${name}: ${String(b?.error ?? '').slice(0, 200)}`);
    return b;
  }
}

/** Call the CRM App's API. A 404 returns null: "not found" is an answer, not a failure. */
async function crm(method: string, path: string, body?: unknown, query: Record<string, string> = {}): Promise<any> {
  const r = await fetch(`${P2}/workspaces/${WS}/apps/${APP}/api`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, path, query, ...(body !== undefined ? { body } : {}) }),
  });
  const j: any = await r.json().catch(() => null);
  const resp = j?.result?.response;
  if (resp?.status === 404) return null;
  if (!r.ok || !resp?.ok) throw new Error(`crm ${method} ${path}: ${r.status}/${resp?.status ?? ''} ${String(resp?.text ?? '').slice(0, 200)}`);
  return resp.body;
}

/** Workspace REST (messages, threads, follow-ups). POSTs are never retried, so nothing is posted twice. */
async function workspace(method: string, path: string, body?: unknown): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(`${P2}/workspaces/${WS}${path}`, {
      method,
      headers: { ...authHeaders(), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (r.ok) return r.status === 204 ? {} : r.json().catch(() => ({}));
    if (method === 'GET' && (r.status === 429 || r.status >= 500) && attempt < 2) { await sleep(2000 * (attempt + 1)); continue; }
    throw new Error(`workspace ${method} ${path.split('?')[0]} -> ${r.status}: ${(await r.text()).slice(0, 200)}`);
  }
}

/** One tool-free model call over supplied material. Returns the parsed JSON object, or null. */
async function modelJson(system: string, input: unknown, maxTokens = 1500, model = MODEL): Promise<any | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await proxy.fetch('/proxy/anthropic-vertex/v1/messages', {
        method: 'POST',
        headers: { 'anthropic-version': '2023-06-01' },
        body: {
          model,
          max_tokens: maxTokens,
          system: system + (attempt ? '\nReturn exactly one JSON object and nothing else.' : ''),
          messages: [{ role: 'user', content: JSON.stringify(input) }],
        },
        timeoutMs: 60_000,
      });
      const out: any = await res.json();
      const text = (out?.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
      const a = text.indexOf('{');
      const z = text.lastIndexOf('}');
      if (a >= 0 && z > a) return JSON.parse(text.slice(a, z + 1));
    } catch (e) {
      if (attempt === 1) console.error('model', String(e).slice(0, 200));
      await sleep(3000);
    }
  }
  return null;
}

// ---- small helpers ----
const TEAM_DOMAINS = new Set<string>(__TEAM_DOMAINS__); // the team's own email domains, lowercase
const FREE_MAIL = new Set(['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'yahoo.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'yandex.com', 'qq.com', '163.com', '126.com']);
const MACHINE_LOCAL = /(no-?reply|do-?not-?reply|donotreply|mailer-daemon|postmaster|notifications?|bounces?|alerts?|billing|receipts?)/i;
const ADDR = /[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const addrs = (v: unknown): string[] => ((Array.isArray(v) ? v.join(', ') : String(v ?? '')).match(ADDR) ?? []).map((a) => a.toLowerCase());
const domainOf = (email: string) => (email.split('@').pop() || '').toLowerCase();
const isTeam = (email: string) => [...TEAM_DOMAINS].some((d) => domainOf(email) === d || domainOf(email).endsWith('.' + d));
const workDomain = (email: string) => (FREE_MAIL.has(domainOf(email)) ? null : domainOf(email));

/** Relation and owner fields come back as [{ id, label }] (or a plain id); these read either shape. */
const relId = (v: any): string | null => (Array.isArray(v) ? (v[0]?.id ?? v[0] ?? null) : (v?.id ?? v ?? null));
const relLabel = (v: any): string => (Array.isArray(v) ? String(v[0]?.label ?? '') : String(v?.label ?? ''));

/** Find a CRM person by exact email. */
async function findPerson(email: string): Promise<any | null> {
  const b = await crm('GET', '/api/people', undefined, { filters: JSON.stringify([{ field_id: 'email', operator: 'eq', value: email.toLowerCase() }]), limit: '1' });
  return b?.records?.[0] ?? null;
}

/** Read every record of a CRM entity, page by page. */
async function listAll(path: string, filters: unknown[] = []): Promise<any[]> {
  const out: any[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 200; page++) {
    const b = await crm('GET', path, undefined, { limit: '500', ...(filters.length ? { filters: JSON.stringify(filters) } : {}), ...(cursor ? { cursor } : {}) });
    out.push(...(b?.records ?? []));
    cursor = b?.pagination?.next_cursor;
    if (!cursor) break;
  }
  return out;
}

/** Root message id from a thread-create response (field names differ between versions; log one response on the rehearsal). */
function rootIdOf(b: any): string | null {
  const c = [b?.rootMessageId, b?.root_message_id, b?.thread?.rootMessageId, b?.thread?.root_message_id, b?.thread?.id, b?.message?.parentId, b?.message?.parent_id];
  return (c.find((x) => typeof x === 'string' && x) as string) || null;
}

/** Post text in a CRM record's own thread (creates the thread on first use). Returns the thread root id. */
async function postInRecordThread(entity: string, recordId: string, text: string, mentions: string[] = []): Promise<string | null> {
  const target = [APP, entity, recordId].map(encodeURIComponent).join('/');
  const b = await workspace('POST', `/rooms/${CRM_ROOM}/agent/threads`, { target_type: 'app_record', target_id: target, text, mentions });
  return rootIdOf(b);
}

/** Update this sync's row on the CRM's Settings > Data sources page. */
async function reportSource(sourceId: string, written: number, total: number, error: string | null) {
  await crm('PATCH', `/api/sync-sources/${sourceId}`, {
    data: { status: error ? 'error' : 'syncing', last_synced_at: new Date().toISOString(), items_last_run: written, items_total: total, last_error: error },
  });
}
// ===== End of shared helpers. =====

// Outlook sync: one Automation per person, saved in that person's own turn so it runs under their access.
// Schedule: {"kind":"every","everyMs":900000} (15 minutes). Guide: references/sync-outlook.md.
// Confirm the tool first: `connection tool search --toolkit outlook --query "list messages"` -> OUTLOOK_LIST_MESSAGES.
// On the rehearsal, log one message's keys and adjust the field mapping below before saving.

const CONNECTION = '__CONNECTION_ID__'; // the owner's Outlook connection, from their `connection list`
const OWNER = '__OWNER_USER_ID__';
const SOURCE_ID = '__SOURCE_RECORD_ID__'; // this sync's sync_sources record
const MAILBOX = '__MAILBOX__'; // the owner's address, lowercase
const SKIP = new Set<string>(__SKIP__); // addresses or domains the person never wants recorded
const SOURCE = `Outlook · ${MAILBOX}`;
const BACKFILL_DAYS = 30;
const FOLDERS = [
  { folder: 'inbox', field: 'receivedDateTime' },
  { folder: 'sentitems', field: 'sentDateTime' }, // without Sent Items every outbound touch is missed
];

const skipped = (email: string) => SKIP.has(email) || SKIP.has(domainOf(email)) || MACHINE_LOCAL.test(email.split('@')[0] ?? '');
const one = (r: any) => ({ email: String(r?.emailAddress?.address ?? '').toLowerCase(), name: String(r?.emailAddress?.name ?? '').trim() });

const saved: any = await state.get({ view: 'latest' });
const since = String(saved?.state?.since ?? new Date(Date.now() - BACKFILL_DAYS * 86_400_000).toISOString());
let newest = since;
let written = 0;
let missed = 0;
let fatal: string | null = null;

try {
  for (const { folder, field } of FOLDERS) {
    let pageToken: string | undefined;
    for (let page = 0; page < 100; page++) {
      const b: any = await tool(CONNECTION, 'OUTLOOK_LIST_MESSAGES', pageToken
        ? { page_token: pageToken }
        : {
            folder,
            top: 100,
            filter: `${field} ge ${since}`,
            orderby: [`${field} desc`],
            select: ['id', 'internetMessageId', 'conversationId', 'subject', 'from', 'toRecipients', 'ccRecipients', 'receivedDateTime', 'sentDateTime', 'bodyPreview'],
          });
      const messages: any[] = b?.data?.value ?? b?.data?.messages ?? [];
      for (const m of messages) {
        const at = String(m[field] ?? m.receivedDateTime ?? '');
        if (at > newest) newest = at;
        const from = one(m.from);
        const fromMe = from.email === MAILBOX;
        const candidates = fromMe ? [...(m.toRecipients ?? []), ...(m.ccRecipients ?? [])].map(one) : [from];
        const outside = candidates.filter((a) => a.email.includes('@') && !isTeam(a.email) && !skipped(a.email));
        // Received mail from a personal mailbox is skipped unless it is a reply in a thread we started; the intake still matches by email.
        for (const other of outside) {
          if (!fromMe && FREE_MAIL.has(domainOf(other.email))) continue;
          try {
            await crm('POST', '/api/intake', {
              source: SOURCE,
              // Same email in Inbox of one person and Sent Items of another stays one activity per mailbox and party.
              source_ref: `outlook:${m.internetMessageId ?? m.id}:${other.email}`,
              person: { email: other.email, ...(other.name ? { name: other.name } : {}) },
              ...(workDomain(other.email) ? { company: { domain: workDomain(other.email) } } : {}),
              activity: {
                kind: 'email',
                subject: String(m.subject || '(no subject)').slice(0, 300),
                occurred_at: at || new Date().toISOString(),
                summary: String(m.bodyPreview ?? '').slice(0, 280),
                recorded_by: OWNER,
              },
            });
            written += 1;
          } catch (e) {
            missed += 1;
            console.error('item', m.id, String(e).slice(0, 200));
          }
        }
      }
      pageToken = b?.data?.next_page_token || undefined;
      if (!pageToken) break;
    }
  }
} catch (e) {
  fatal = String(e).slice(0, 300);
}

const prior = Number(saved?.state?.total ?? 0);
// The cursor only moves after a run that finished, so a failed run is repeated and the intake ignores what already landed.
if (!fatal) await state.set({ since: newest, total: prior + written });
await reportSource(SOURCE_ID, written, prior + written, fatal ?? (missed ? `${missed} emails could not be written; they are retried next run` : null));
if (fatal) {
  console.error('outlook sync failed', fatal);
  process.exit(1);
}
console.log(JSON.stringify({ written, missed }));
