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

// ---- PostHog: one exact SQL (HogQL) query per call, through a PostHog personal API key Connection ----
// The key needs read access to query and persons. Create the API-key Connection once (team source) and grant it
// to this Automation; the runtime injects it under the variable name the Connection declares.
const POSTHOG_HOST = '__POSTHOG_HOST__'; // https://us.posthog.com or https://eu.posthog.com (or self-hosted)
const POSTHOG_PROJECT = '__POSTHOG_PROJECT_ID__'; // confirm from the project settings, never from memory
const POSTHOG_KEY_ENV = '__POSTHOG_KEY_ENV__'; // the variable name the Connection declares

async function hogql(query: string): Promise<Record<string, any>[]> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(`${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT}/query/`, {
      method: 'POST',
      headers: { ...Object.fromEntries([['Authorization', 'Bearer ' + (process.env[POSTHOG_KEY_ENV] || '')]]), 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
      signal: AbortSignal.timeout(120_000),
    });
    if (r.ok) {
      const b: any = await r.json();
      const cols: string[] = b.columns ?? [];
      return (b.results ?? []).map((row: any[]) => Object.fromEntries(cols.map((c, i) => [c, row[i]])));
    }
    // Timeouts and rate limits are retried with backoff; a lost run is caught up by the cursor, not by a missed-day list.
    if (r.status !== 429 && r.status < 500) throw new Error(`posthog ${r.status}: ${(await r.text()).slice(0, 300)}`);
    await sleep(10_000 * (attempt + 1));
  }
  throw new Error('posthog: no answer after 3 tries');
}
const sqlString = (s: string) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

// PostHog account usage: daily, for a product people sign up for. One SQL query for all accounts, one weekly usage
// activity per account, and signals (not conclusions) for the account owner. It never changes status or health.
// Schedule: cron "0 7 * * *" in the team's time zone. Guide: references/posthog.md ("account usage").

const SOURCE = 'PostHog usage';
const KEY_EVENTS = __KEY_EVENTS__; // the actions that mean real use, e.g. ["report_created", "invite_sent"]
const EMAIL_PROPERTY = '__EMAIL_PERSON_PROPERTY__';

const isoWeek = (d: Date) => { const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return `${t.getUTCFullYear()}-W${String(Math.ceil(((+t - +y) / 86_400_000 + 1) / 7)).padStart(2, '0')}`; };
const week = isoWeek(new Date());

// Accounts and the people of their companies (usage is counted per person email, then summed per account).
const accounts = await listAll('/api/accounts');
const people = await listAll('/api/people');
const byCompany = new Map<string, string[]>();
for (const p of people) {
  const c = relId(p.data?.company_id);
  const e = String(p.data?.email ?? '').toLowerCase();
  if (c && e) byCompany.set(c, [...(byCompany.get(c) ?? []), e]);
}
const emails = [...new Set(people.map((p) => String(p.data?.email ?? '').toLowerCase()).filter((e) => e.includes('@') && !isTeam(e)))];
const usage = new Map<string, any>();
for (let i = 0; i < emails.length; i += 500) {
  const list = emails.slice(i, i + 500).map(sqlString).join(', ');
  for (const r of await hogql(`
    SELECT person.properties.${EMAIL_PROPERTY} AS email,
      countIf(event IN (${KEY_EVENTS.map(sqlString).join(', ')}) AND timestamp > now() - INTERVAL 7 DAY) AS actions_7d,
      countIf(event IN (${KEY_EVENTS.map(sqlString).join(', ')}) AND timestamp > now() - INTERVAL 28 DAY) AS actions_28d,
      max(timestamp) AS last_active
    FROM events WHERE person.properties.${EMAIL_PROPERTY} IN (${list}) AND timestamp > now() - INTERVAL 28 DAY GROUP BY email`)) usage.set(String(r.email).toLowerCase(), r);
}

const saved: any = (await state.get({ view: 'latest' }))?.state ?? {};
const lastWeeks: Record<string, number[]> = saved.weeks ?? {}; // account id -> recent weekly action counts
let written = 0;
const signals: string[] = [];
for (const a of accounts) {
  const members = byCompany.get(String(relId(a.data?.company_id))) ?? [];
  const rows = members.map((e) => usage.get(e)).filter(Boolean);
  const active = rows.filter((r) => r.actions_7d > 0).length;
  const actions = rows.reduce((s, r) => s + Number(r.actions_7d), 0);
  const last = rows.map((r) => r.last_active).sort().pop() ?? null;
  const res = await crm('POST', '/api/intake', {
    source: SOURCE,
    source_ref: `usage:${a.record_id}:${week}`, // one per account per week; re-runs in the same week change nothing
    account: { name: a.data?.name },
    activity: { kind: 'other', subject: `Usage this week: ${active} active users, ${actions} key actions`, occurred_at: new Date().toISOString(), summary: last ? `Last activity ${new Date(last).toISOString()} UTC.` : 'No activity in 28 days.' },
  });
  if (!res?.activity?.duplicate) written += 1;
  const history = (lastWeeks[a.record_id] ?? []).slice(-3);
  const avg = history.length ? history.reduce((s, n) => s + n, 0) / history.length : null;
  const status = String(a.data?.status ?? '');
  // Signals to check, never conclusions. Paid status comes from billing, not analytics.
  if (/active|paying|customer/i.test(status) && avg !== null && avg >= 10 && actions < avg * 0.4) signals.push(`${a.data?.name}: usage fell to ${actions} from about ${Math.round(avg)} a week`);
  if (/cancel|churn/i.test(status) && actions >= 20) signals.push(`${a.data?.name}: cancelled but ${actions} actions this week`);
  if (!res?.activity?.duplicate) lastWeeks[a.record_id] = [...history, actions];
}
if (signals.length) await workspace('POST', `/rooms/${CRM_ROOM}/messages/ui`, { fallback_text: `Usage signals to check:\n${signals.join('\n')}`, blocks: [{ type: 'markdown', content: `**Usage signals to check** (PostHog, last 7 days)\n${signals.map((s) => `- ${s}`).join('\n')}` }] });
await state.set({ weeks: lastWeeks });
console.log(JSON.stringify({ accounts: accounts.length, written, signals: signals.length }));
