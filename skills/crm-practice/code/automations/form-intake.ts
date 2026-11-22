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

// Form intake: a webhook Automation the website form (or form tool) POSTs to. Saved code, no agent steps.
// Create with a webhook trigger (`workflow create ... --trigger webhook`); paste the webhook URL into the form tool.
// Guide: references/forms-and-booking.md. Flow: diagrams/forms-and-booking.md.
// Map FIELDS to the form's own field names on the rehearsal (send one real test submission first).

const LEADS_OWNER = '__OWNER_USER_ID__'; // who handles new form leads
const TEST_ROOM_THREAD = '__TEST_THREAD_ROOT_ID__'; // team members' own test submissions go here, nothing is written
const FIELDS = { email: 'email', name: 'name', company: 'company', website: 'website', country: 'country', message: 'message', submittedAt: 'submitted_at' };
// Qualification is decided on the website or form side when possible; the payload carries the verdict.
const OFFER_CALL = (p: Record<string, any>) => String(p.verdict ?? p.qualified ?? '').toLowerCase() === 'call';
const RESEARCH_PROMPT = '__RESEARCH_FOLLOWUP_TEXT__'; // the instruction text for the research turn (prompts/company-research.md)

if (ctx.trigger?.kind !== 'webhook') throw new Error('This Automation only runs from its webhook');
const t: any = ctx.trigger;
const payload: Record<string, any> = t.bodyTruncated ? await t.body.json() : (t.bodyJson ?? {});
const p: Record<string, any> = payload.data ?? payload.fields ?? payload; // most form tools wrap the answers once

// 1. Normalise. A submission without an email fails visibly instead of creating an empty person.
const email = String(p[FIELDS.email] ?? '').trim().toLowerCase();
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Submission has no valid email; nothing was written');
const name = String(p[FIELDS.name] ?? '').trim();
const companyName = String(p[FIELDS.company] ?? '').trim();
const website = String(p[FIELDS.website] ?? '').trim();
const submittedAt = String(p[FIELDS.submittedAt] ?? t.receivedAt ?? new Date().toISOString());
const key = `form ${email} ${submittedAt}`; // idempotency key; also printed on the card so a retry never posts twice
const answers = Object.entries(p)
  .filter(([k, v]) => v !== '' && v != null && !/^(utm_|gclid|fbclid|msclkid|_)/i.test(k)) // tracking tags are lead source, not answers
  .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
  .join('\n')
  .slice(0, 2000);

// 2. The team's own test submissions never touch the CRM.
if (isTeam(email)) {
  await workspace('POST', `/rooms/${CRM_ROOM}/agent/threads`, { target_type: 'message', target_id: TEST_ROOM_THREAD, text: `Test submission from ${email}, nothing written.\n${key}` });
  process.exit(0);
}

// 3. Write the CRM through the intake (activity is idempotent on source + source_ref).
const intake = await crm('POST', '/api/intake', {
  source: 'Website form',
  source_ref: `form:${email}:${submittedAt}`,
  person: { email, ...(name ? { name } : {}) },
  ...(companyName || website || workDomain(email) ? { company: { ...(companyName ? { name: companyName } : {}), ...(website ? { website } : {}), ...(workDomain(email) ? { domain: workDomain(email) } : {}) } } : {}),
  activity: { kind: 'form', subject: `Form: ${companyName || name || email}`.slice(0, 300), occurred_at: new Date(submittedAt).toISOString(), summary: answers, recorded_by: LEADS_OWNER },
  ...(OFFER_CALL(p) ? { task: { title: `Offer a call to ${name || email}`, owner: LEADS_OWNER, due_date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10) } } : {}),
});
if (intake?.activity?.duplicate) { console.log('already handled', key); process.exit(0); }

// 4. Home thread: the person's own record thread (one customer, one thread).
const personId = intake?.person?.id;
if (!personId) throw new Error('Intake returned no person; nothing posted');

// 5. One card in that thread. Who, company, country, what they want, one next step; the rest collapsed.
const card = {
  fallback_text: [`Form submitted: ${name || email}${companyName ? ` (${companyName})` : ''}`, `Email: ${email}`, `Next: ${OFFER_CALL(p) ? 'offer a call' : 'reply by email'}`, key].join('\n'),
  blocks: [
    { type: 'markdown', content: `**${name || email}**${companyName ? ` · ${companyName}` : ''}${p[FIELDS.country] ? ` · ${p[FIELDS.country]}` : ''}\n\n${String(p[FIELDS.message] ?? '').slice(0, 600)}\n\n**Next:** ${OFFER_CALL(p) ? 'offer a call' : 'reply by email'} · @${LEADS_OWNER}` },
    { type: 'collapsible', title: 'All answers', blocks: [{ type: 'markdown', content: answers }] },
  ],
};
const target = [APP, 'people', personId].map(encodeURIComponent).join('/');
const thread = await workspace('POST', `/rooms/${CRM_ROOM}/agent/threads`, { target_type: 'app_record', target_id: target });
const root = rootIdOf(thread);
if (!root) throw new Error('Could not open the record thread; the CRM write is done, the card was not posted');
// De-duplicate on the key: a retried webhook finds the card already there.
const replies: any = await workspace('GET', `/rooms/${CRM_ROOM}/messages/${root}/thread?limit=50&include_parent=true`);
const already = [...(replies?.replies ?? []), replies?.parent].some((m: any) => String(m?.content ?? m?.metadata?.fallbackText ?? '').includes(key));
if (!already) await workspace('POST', `/rooms/${CRM_ROOM}/messages/ui`, { ...card, parent_id: root });

// 6. Research new companies in a follow-up turn in the same thread (never as an agent step inside this code).
if (intake?.company?.created) {
  await workspace('POST', `/rooms/${CRM_ROOM}/followups`, {
    title: `Research ${companyName || workDomain(email)}`,
    message: RESEARCH_PROMPT.replace('{company}', companyName || String(workDomain(email))).replace('{email}', email),
    due_at: new Date(Date.now() + 60_000).toISOString(),
    thread_root_message_id: root,
  });
}
console.log(JSON.stringify({ key, person: personId, posted: !already }));
