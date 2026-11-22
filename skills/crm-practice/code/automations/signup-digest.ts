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

// Sign-up digest: once or twice a day, one post listing everyone who signed up since the last digest, each with a
// two-sentence background, where they came from and how far they got; the same profiles are written to the CRM.
// Schedule: cron "0 9 * * *" in the team's zone. For a second daily post, add a tiny Automation on the other time that
// only triggers this one (`workflow trigger <id>`): both runs then share this state and never double-post.
// Guide: references/signup-digest.md. Flow: diagrams/signup-digest.md.

const DIGEST_ROOM = '__DIGEST_ROOM_ID__';
const PREFIX = 'Sign-ups';
const SIGNUP_EVENT = '__SIGNUP_EVENT__'; // their event name for "account created"
const MILESTONES: Record<string, string> = __MILESTONES__; // event name -> tag, e.g. {"invite_sent": "invited a teammate"}
const EMAIL_PROPERTY = '__EMAIL_PERSON_PROPERTY__';
const LATE_MS = 3 * 3_600_000; // re-read a few hours before the cursor for late records
const MAX_POST = 3500; // split long posts on line breaks

// Optional: the product's own sign-up list (more complete than analytics: ad blockers, native apps).
async function productSignups(_from: Date, _to: Date): Promise<{ id: string; email: string; name?: string; account?: string; at: string }[]> {
  return []; // fill in with the product's admin API through an API-key Connection, or leave empty
}

const RESEARCH_PROMPT = `You write a two-sentence background on a company for a sales team, from supplied page text only.
Sentence 1: what they do. Sentence 2: where they are (only if a source says so) and the industry. No usage numbers, no guesses.
Return JSON only: {"found": true|false, "background": "two sentences or null", "industry": "short or null", "country": "or null"}`;

const saved: any = (await state.get({ view: 'latest' }))?.state ?? {};
const handled = new Set<string>(saved.handled ?? []);
const now = new Date();
const from = new Date(Date.parse(saved.cursor ?? new Date(Date.now() - 86_400_000).toISOString()) - LATE_MS);
const windowKey = `${PREFIX} ${now.toISOString().slice(0, 13)}`; // the post's first line; also the "already posted" marker

// 1. A window that stopped after posting but before writing back is finished first, never posted again.
let inflight = saved.inflight ?? null;

if (!inflight) {
  // 2. Collect from every source; drop handled ids, the team, and re-fired events for old accounts.
  const fromPosthog = await hogql(`SELECT distinct_id AS id, ${'person.properties.' + EMAIL_PROPERTY} AS email, person.properties.name AS name,
      min(timestamp) AS at, any(person.created_at) AS person_created
    FROM events WHERE event = ${sqlString(SIGNUP_EVENT)} AND timestamp >= toDateTime(${sqlString(from.toISOString().slice(0, 19).replace('T', ' '))})
    GROUP BY id, email, name`);
  const all = [...(await productSignups(from, now)), ...fromPosthog.filter((r) => Date.parse(r.person_created) >= from.getTime() - 86_400_000)];
  const seen = new Set<string>();
  const signups = all
    .map((r: any) => ({ id: String(r.id), email: String(r.email ?? '').toLowerCase(), name: r.name ? String(r.name) : '', at: String(r.at) }))
    .filter((r) => r.email.includes('@') && !isTeam(r.email) && !handled.has(r.id) && !seen.has(r.email) && seen.add(r.email));
  if (!signups.length) { await state.set({ ...saved, cursor: now.toISOString() }); console.log('no new sign-ups'); process.exit(0); }

  // 3. Milestones per person in one query.
  const list = signups.map((s) => sqlString(s.email)).join(', ');
  const ms = Object.keys(MILESTONES).length ? await hogql(`SELECT person.properties.${EMAIL_PROPERTY} AS email, groupUniqArray(event) AS events FROM events
      WHERE event IN (${Object.keys(MILESTONES).map(sqlString).join(', ')}) AND person.properties.${EMAIL_PROPERTY} IN (${list}) GROUP BY email`) : [];
  const tags = new Map(ms.map((r) => [String(r.email).toLowerCase(), (r.events as string[]).map((e) => MILESTONES[e]).filter(Boolean)]));
  const first = await hogql(`SELECT properties.${EMAIL_PROPERTY} AS email, properties.$initial_utm_source AS utm, properties.$initial_referring_domain AS ref FROM persons WHERE properties.${EMAIL_PROPERTY} IN (${list})`);
  const sourceOf = new Map(first.map((r) => [String(r.email).toLowerCase(), r.utm || r.ref || 'direct']));

  // 4. Research: reuse the CRM's company profile; research only the rest (fetched pages + one tool-free model call).
  const entries: any[] = [];
  for (const s of signups) {
    const domain = workDomain(s.email);
    let background: string | null = null;
    let company: any = null;
    if (domain) {
      const b = await crm('GET', '/api/companies', undefined, { filters: JSON.stringify([{ field_id: 'domain', operator: 'eq', value: domain }]), limit: '1' });
      const c = b?.records?.[0];
      if (c?.data?.description) background = String(c.data.description);
      else {
        let text = '';
        try { text = (await (await fetch(`https://${domain}`, { signal: AbortSignal.timeout(15_000) })).text()).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 8000); } catch { /* unreachable site */ }
        const r = text ? await modelJson(RESEARCH_PROMPT, { domain, page_text: text }, 400) : null;
        if (r?.found && r.background) { background = r.background; company = { domain, description: r.background, ...(r.industry ? { industry: r.industry } : {}), ...(r.country ? { country: r.country } : {}) }; }
      }
    }
    entries.push({ ...s, domain, background, company, source: sourceOf.get(s.email) ?? 'unknown', tags: tags.get(s.email) ?? [] });
  }
  inflight = { key: windowKey, entries, message_id: null };
  await state.set({ ...saved, inflight });
}

// 5. Post once. Adopt a post that already starts with this window's key (a crash after posting).
if (!inflight.message_id) {
  const recent: any = await workspace('GET', `/rooms/${DIGEST_ROOM}/messages?limit=30`);
  const existing = (recent?.messages ?? []).find((m: any) => String(m.content ?? m.metadata?.fallbackText ?? '').startsWith(inflight.key));
  if (existing) inflight.message_id = existing.id;
  else {
    const line = (e: any) => `- **${e.name || e.email}**${e.domain ? ` (${e.domain})` : ''}: ${e.background ?? 'No public match yet.'} Source: ${e.source}.${e.tags.length ? ` ${e.tags.join(', ')}.` : ''}`;
    const matched = inflight.entries.filter((e: any) => e.background);
    const unmatched = inflight.entries.filter((e: any) => !e.background);
    const lines = [`${inflight.key}: ${inflight.entries.length} new`, ...matched.map(line), ...(unmatched.length ? ['', '**No public match yet**', ...unmatched.map(line)] : [])];
    const chunks: string[] = [];
    let cur = '';
    for (const l of lines) { if ((cur + '\n' + l).length > MAX_POST && cur) { chunks.push(cur); cur = l; } else cur = cur ? `${cur}\n${l}` : l; }
    if (cur) chunks.push(cur);
    const top: any = await workspace('POST', `/rooms/${DIGEST_ROOM}/messages/ui`, { fallback_text: chunks[0], blocks: [{ type: 'markdown', content: chunks[0] }] });
    inflight.message_id = top?.message?.id ?? 'posted';
    await state.set({ ...saved, inflight }); // saved right away: a crash from here on never re-posts
    for (const c of chunks.slice(1)) await workspace('POST', `/rooms/${DIGEST_ROOM}/messages/ui`, { fallback_text: c, blocks: [{ type: 'markdown', content: c }], parent_id: inflight.message_id });
  }
}

// 6. Write back: one intake call per sign-up, idempotent on id + date. Values a person set are never overwritten.
for (const e of inflight.entries) {
  await crm('POST', '/api/intake', {
    source: 'Sign-up digest',
    source_ref: `signup:${e.id}:${String(e.at).slice(0, 10)}`,
    person: { email: e.email, ...(e.name ? { name: e.name } : {}) },
    ...(e.company ? { company: e.company } : e.domain ? { company: { domain: e.domain } } : {}),
    activity: { kind: 'other', subject: 'Signed up', occurred_at: new Date(e.at).toISOString(), summary: `Source: ${e.source}.${e.tags.length ? ` ${e.tags.join(', ')}.` : ''}` },
  });
  handled.add(e.id);
}

// 7. Close the window.
await state.set({ cursor: now.toISOString(), handled: [...handled].slice(-20_000), inflight: null });
console.log(JSON.stringify({ posted: inflight.entries.length }));
