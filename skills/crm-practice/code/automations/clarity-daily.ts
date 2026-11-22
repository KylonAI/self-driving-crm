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

// Microsoft Clarity daily snapshot: page and channel behaviour for the website. Clarity does not identify people,
// so this never writes person records. Its export covers only the last 1 to 3 days and allows few calls per
// project per day, so this runs once a day, makes two calls, and keeps its own 60-day history in state.
// Schedule: cron "30 6 * * *". Guide: references/clarity.md.
// Tool: MICROSOFT_CLARITY_DATA_EXPORT (numOfDays 1-3, up to three dimensions, max 1,000 rows, no paging).

const CONNECTION = '__CLARITY_CONNECTION_ID__';
const REPORT_ROOM = '__REPORT_ROOM_ID__'; // where the daily website card goes
const SITE = '__SITE_URL__'; // e.g. https://www.example.com, to link pages

type PageDay = { sessions: number; rage: number; dead: number; quickBack: number; scroll: number | null };
const day = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10); // "last 24 hours" is filed as yesterday

// Clarity returns [{ metricName, information: [{ <dimension>: value, sessionsCount, subTotal, ... }] }]. Log one on the rehearsal.
function byDimension(data: any, dim: string): Map<string, PageDay> {
  const out = new Map<string, PageDay>();
  const get = (k: string) => { if (!out.has(k)) out.set(k, { sessions: 0, rage: 0, dead: 0, quickBack: 0, scroll: null }); return out.get(k)!; };
  for (const metric of Array.isArray(data) ? data : data?.data ?? []) {
    for (const row of metric.information ?? []) {
      const key = String(row[dim] ?? row[dim.toLowerCase()] ?? 'unknown');
      const n = Number(row.subTotal ?? row.sessionsCount ?? 0);
      const d = get(key);
      switch (metric.metricName) {
        case 'Traffic': d.sessions = Number(row.totalSessionCount ?? row.sessionsCount ?? n); break;
        case 'RageClickCount': d.rage = n; break;
        case 'DeadClickCount': d.dead = n; break;
        case 'QuickbackClick': d.quickBack = n; break;
        case 'ScrollDepth': d.scroll = Number(row.averageScrollDepth ?? row.scrollDepth ?? n); break;
      }
    }
  }
  return out;
}

const saved: any = (await state.get({ view: 'latest' }))?.state ?? {};
const history: Record<string, any> = saved.history ?? {};
if (history[day]) { console.log('already stored', day); process.exit(0); } // a second run the same day spends no calls

const pagesRaw: any = await tool(CONNECTION, 'MICROSOFT_CLARITY_DATA_EXPORT', { numOfDays: 1, dimension1: 'URL' });
const channelsRaw: any = await tool(CONNECTION, 'MICROSOFT_CLARITY_DATA_EXPORT', { numOfDays: 1, dimension1: 'Channel' });
const pages = byDimension(pagesRaw?.data, 'URL');
const channels = byDimension(channelsRaw?.data, 'Channel');
history[day] = { pages: Object.fromEntries([...pages].sort((a, b) => b[1].sessions - a[1].sessions).slice(0, 200)), channels: Object.fromEntries(channels) };
const keep = Object.keys(history).sort().slice(-60);
await state.set({ history: Object.fromEntries(keep.map((k) => [k, history[k]])) });

// Page health: totals, the worst pages by rage + dead clicks, and pages that moved sharply against their own 7-day average.
const sessions = [...channels.values()].reduce((s, c) => s + c.sessions, 0);
const worst = [...pages].filter(([, p]) => p.sessions >= 20).sort((a, b) => (b[1].rage + b[1].dead) / b[1].sessions - (a[1].rage + a[1].dead) / a[1].sessions).slice(0, 3);
const prior = keep.filter((k) => k < day).slice(-7).map((k) => history[k]);
const moved: string[] = [];
for (const [url, p] of [...pages].slice(0, 50)) {
  const past = prior.map((h) => h.pages?.[url]?.sessions).filter((n): n is number => typeof n === 'number');
  if (past.length < 4) continue;
  const avg = past.reduce((s, n) => s + n, 0) / past.length;
  if (avg >= 20 && (p.sessions < avg * 0.5 || p.sessions > avg * 2)) moved.push(`${url}: ${p.sessions} sessions vs about ${Math.round(avg)} a day`);
}
const link = (u: string) => (u.startsWith('http') ? u : `${SITE}${u}`);
const text = [
  `**Website, ${day}** (Clarity, sampled; trends, not counts of people): ${sessions} sessions.`,
  `By channel: ${[...channels].sort((a, b) => b[1].sessions - a[1].sessions).slice(0, 5).map(([k, v]) => `${k} ${v.sessions}`).join(', ')}`,
  worst.length ? `Most rage or dead clicks:\n${worst.map(([u, p]) => `- [${u}](${link(u)}): ${p.rage} rage, ${p.dead} dead of ${p.sessions}`).join('\n')}` : '',
  moved.length ? `Moved sharply:\n${moved.map((m) => `- ${m}`).join('\n')}` : '',
  'Visitors who declined the cookie banner are not recorded.',
].filter(Boolean).join('\n\n');
await workspace('POST', `/rooms/${REPORT_ROOM}/messages/ui`, { fallback_text: text.replace(/\*\*/g, ''), blocks: [{ type: 'markdown', content: text }] });
console.log(JSON.stringify({ day, pages: pages.size, sessions }));
