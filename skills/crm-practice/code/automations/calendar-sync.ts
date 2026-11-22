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

// Google Calendar sync: one Automation per person, saved in that person's own turn.
// Schedule: {"kind":"every","everyMs":1800000} (30 minutes). Guide: references/sync-calendar.md.
// Confirm the tool: `connection tool search --toolkit googlecalendar --query "list events"` -> GOOGLECALENDAR_EVENTS_LIST.
// For Outlook Calendar, swap the tool for the Outlook calendar-view tool and map start/attendees the same way.

const CONNECTION = '__CONNECTION_ID__';
const OWNER = '__OWNER_USER_ID__';
const SOURCE_ID = '__SOURCE_RECORD_ID__';
const CALENDAR = '__MAILBOX__'; // the owner's calendar address
const SKIP = new Set<string>(__SKIP__);
const SOURCE = `Google Calendar · ${CALENDAR}`;

const saved: any = await state.get({ view: 'latest' });
const updatedSince = String(saved?.state?.updated_since ?? new Date(Date.now() - 30 * 86_400_000).toISOString());
let newest = updatedSince;
let written = 0;
let missed = 0;
let fatal: string | null = null;

try {
  let pageToken: string | undefined;
  for (let page = 0; page < 50; page++) {
    const b: any = await tool(CONNECTION, 'GOOGLECALENDAR_EVENTS_LIST', {
      calendarId: 'primary',
      updatedMin: updatedSince,
      timeMax: new Date(Date.now() + 14 * 86_400_000).toISOString(),
      singleEvents: true,
      showDeleted: true,
      maxResults: 250,
      ...(pageToken ? { pageToken } : {}),
    });
    const events: any[] = b?.data?.items ?? [];
    for (const ev of events) {
      if (String(ev.updated ?? '') > newest) newest = String(ev.updated);
      if (ev.status === 'cancelled') continue; // an earlier write stays: it shows the meeting was planned
      if (!ev.start?.dateTime) continue; // all-day events are not meetings
      const me = (ev.attendees ?? []).find((a: any) => a.self);
      if (me?.responseStatus === 'declined') continue;
      const guests = (ev.attendees ?? []).filter((a: any) => a.email && !isTeam(a.email) && !SKIP.has(a.email.toLowerCase()) && !SKIP.has(domainOf(a.email)) && !a.resource);
      for (const g of guests) {
        const email = String(g.email).toLowerCase();
        try {
          await crm('POST', '/api/intake', {
            source: SOURCE,
            source_ref: `gcal:${ev.id}:${email}`,
            person: { email, ...(g.displayName ? { name: g.displayName } : {}) },
            ...(workDomain(email) ? { company: { domain: workDomain(email) } } : {}),
            activity: {
              kind: 'meeting',
              subject: String(ev.summary || 'Meeting').slice(0, 300),
              occurred_at: new Date(ev.start.dateTime).toISOString(),
              // Conference links and dial-in text are left out of the CRM.
              summary: String(ev.description ?? '').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim().slice(0, 280),
              recorded_by: OWNER,
            },
          });
          written += 1;
        } catch (e) {
          missed += 1;
          console.error('event', ev.id, String(e).slice(0, 200));
        }
      }
    }
    pageToken = b?.data?.nextPageToken || undefined;
    if (!pageToken) break;
  }
} catch (e) {
  fatal = String(e).slice(0, 300);
}

const prior = Number(saved?.state?.total ?? 0);
if (!fatal) await state.set({ updated_since: newest, total: prior + written });
await reportSource(SOURCE_ID, written, prior + written, fatal ?? (missed ? `${missed} meetings could not be written; they are retried next run` : null));
if (fatal) process.exit(1);
console.log(JSON.stringify({ written, missed }));
