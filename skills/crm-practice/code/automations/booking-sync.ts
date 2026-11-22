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

// Booking sync: scheduler bookings -> CRM, with a card for the host in the guest's record thread.
// Two Automations share this code (same state is not needed; both paths are idempotent):
//   1. webhook trigger: paste its URL into the scheduler's team webhook (booked, rescheduled, cancelled, no-show)
//   2. schedule {"kind":"every","everyMs":900000}: the safety net. Webhooks get missed; ours once pointed elsewhere for weeks.
// Guide: references/forms-and-booking.md. Flow: diagrams/forms-and-booking.md.
// Shapes below are Cal.com and Calendly; for another scheduler write one more `normalise` branch.

const CONNECTION = '__SCHEDULER_CONNECTION_ID__'; // only for the safety net
const LIST_TOOL = '__SCHEDULER_LIST_TOOL__'; // confirm with `connection tool search --toolkit <scheduler> --query "list bookings"`
const HOSTS: Record<string, string> = __HOSTS__; // host email -> workspace user id, e.g. {"lee@team.example": "user_..."}
const SOURCE = 'Scheduler';

type Booking = { id: string; status: 'booked' | 'rescheduled' | 'cancelled' | 'no_show'; previousId?: string; title: string; start: string; hostEmail: string; guests: { email: string; name: string }[]; answers: string };

function normalise(raw: any): Booking | null {
  // Cal.com: { triggerEvent, payload: { uid, title, startTime, organizer, attendees, responses, rescheduleUid } }
  if (raw?.triggerEvent && raw?.payload) {
    const p = raw.payload;
    const status = /CANCEL/.test(raw.triggerEvent) ? 'cancelled' : /NO_SHOW/.test(raw.triggerEvent) ? 'no_show' : /RESCHEDULE/.test(raw.triggerEvent) ? 'rescheduled' : 'booked';
    const answers = Object.entries(p.responses ?? {})
      .filter(([k]) => !['name', 'email', 'guests', 'location'].includes(k))
      .map(([k, v]: [string, any]) => `${k}: ${typeof v === 'object' ? v?.value ?? '' : v}`).join('\n');
    return { id: String(p.uid), status, previousId: p.rescheduleUid ?? p.fromReschedule ?? undefined, title: String(p.title ?? 'Meeting'), start: String(p.startTime), hostEmail: String(p.organizer?.email ?? '').toLowerCase(), guests: (p.attendees ?? []).map((a: any) => ({ email: String(a.email).toLowerCase(), name: String(a.name ?? '') })), answers };
  }
  // Calendly: { event: 'invitee.created' | 'invitee.canceled', payload: { uri, email, name, scheduled_event, questions_and_answers, old_invitee } }
  if (raw?.event && raw?.payload?.scheduled_event) {
    const p = raw.payload;
    return { id: String(p.scheduled_event.uri), status: raw.event === 'invitee.canceled' ? 'cancelled' : p.old_invitee ? 'rescheduled' : 'booked', previousId: p.old_invitee ?? undefined, title: String(p.scheduled_event.name ?? 'Meeting'), start: String(p.scheduled_event.start_time), hostEmail: String(p.scheduled_event.event_memberships?.[0]?.user_email ?? '').toLowerCase(), guests: [{ email: String(p.email).toLowerCase(), name: String(p.name ?? '') }], answers: (p.questions_and_answers ?? []).map((q: any) => `${q.question}: ${q.answer}`).join('\n') };
  }
  return null;
}

async function activityFor(bookingId: string, email: string) {
  const b = await crm('GET', '/api/activities', undefined, { filters: JSON.stringify([{ field_id: 'source_ref', operator: 'eq', value: `booking:${bookingId}:${email}` }]), limit: '1' });
  return b?.records?.[0] ?? null;
}

async function handle(bk: Booking): Promise<string> {
  if (!HOSTS[bk.hostEmail]) return 'not team-hosted';
  const guests = bk.guests.filter((g) => g.email.includes('@') && !isTeam(g.email));
  if (!guests.length) return 'internal';
  const host = HOSTS[bk.hostEmail];
  let result = 'unchanged';
  for (const g of guests) {
    if (bk.status === 'cancelled' || bk.status === 'no_show') {
      const act = await activityFor(bk.id, g.email);
      const tag = bk.status === 'cancelled' ? '[Cancelled]' : '[No-show]';
      // Never delete: mark the activity. No-show only when the scheduler reports this guest missing.
      if (act && !String(act.data?.summary ?? '').startsWith(tag)) {
        await crm('PATCH', `/api/activities/${act.record_id}`, { data: { summary: `${tag} ${act.data?.summary ?? ''}`.slice(0, 2000) } });
        result = bk.status;
      }
      continue;
    }
    if (bk.status === 'rescheduled' && bk.previousId) {
      const old = await activityFor(bk.previousId, g.email);
      if (old && !String(old.data?.summary ?? '').startsWith('[Rescheduled]')) await crm('PATCH', `/api/activities/${old.record_id}`, { data: { summary: `[Rescheduled] ${old.data?.summary ?? ''}`.slice(0, 2000) } });
    }
    const intake = await crm('POST', '/api/intake', {
      source: SOURCE,
      source_ref: `booking:${bk.id}:${g.email}`,
      person: { email: g.email, ...(g.name ? { name: g.name } : {}) },
      ...(workDomain(g.email) ? { company: { domain: workDomain(g.email) } } : {}),
      activity: { kind: 'meeting', subject: bk.title.slice(0, 300), occurred_at: new Date(bk.start).toISOString(), summary: bk.answers.slice(0, 2000), recorded_by: host },
    });
    if (intake?.activity?.duplicate || !intake?.person?.id) continue;
    // A card for the host in the guest's own thread. Times in the host's zone are better: pass it in HOSTS if you want them.
    await postInRecordThread('people', intake.person.id, [`@${host} ${g.name || g.email} booked "${bk.title}" for ${new Date(bk.start).toUTCString()}.`, bk.answers ? `They wrote:\n${bk.answers.slice(0, 800)}` : ''].filter(Boolean).join('\n\n'), [host]);
    result = bk.status;
  }
  return result;
}

const out: Record<string, number> = {};
const count = (k: string) => { out[k] = (out[k] ?? 0) + 1; };

if (ctx.trigger?.kind === 'webhook') {
  const t: any = ctx.trigger;
  const raw = t.bodyTruncated ? await t.body.json() : t.bodyJson;
  const bk = normalise(raw);
  if (!bk) { console.log('ignored payload'); process.exit(0); }
  count(await handle(bk));
} else {
  // Safety net: bookings in the last day and the next 14 days, through the same path.
  const b: any = await tool(CONNECTION, LIST_TOOL, { afterStart: new Date(Date.now() - 86_400_000).toISOString(), beforeEnd: new Date(Date.now() + 14 * 86_400_000).toISOString() });
  const rows: any[] = b?.data?.bookings ?? b?.data?.data ?? b?.data?.collection ?? [];
  for (const row of rows) {
    // List tools return the booking itself, not a webhook envelope; wrap it so `normalise` reads one shape.
    const status = String(row.status ?? '').toLowerCase();
    const bk = normalise({ triggerEvent: status.includes('cancel') ? 'BOOKING_CANCELLED' : 'BOOKING_CREATED', payload: { ...row, startTime: row.startTime ?? row.start } });
    try { if (bk) count(await handle(bk)); } catch (e) { count('failed'); console.error(row.uid ?? row.id, String(e).slice(0, 200)); }
  }
}
console.log(JSON.stringify(out));
if (out.failed) process.exit(1);
