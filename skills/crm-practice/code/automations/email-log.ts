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

// Email log: paste these functions into ANY Automation that sends, or drafts, email to a customer.
// Every automated email then appears in that customer's own record thread with what was actually sent, and on
// the CRM timeline, and nothing goes out when the customer can't be matched safely. Guide: references/email-log.md.
// The bottom of this file is a runnable example (a reminder flow) showing the order of calls.

/** 1. Resolve exactly one customer: exact email first, then a single company on the work domain. */
async function resolveCustomer(email: string): Promise<{ entity: 'people' | 'companies'; id: string; name: string } | { pause: string }> {
  const person = await findPerson(email);
  if (person) return { entity: 'people', id: person.record_id, name: String(person.data?.name ?? email) };
  const domain = workDomain(email);
  if (!domain) return { pause: `${email}: personal address and not in the CRM` };
  const b = await crm('GET', '/api/companies', undefined, { filters: JSON.stringify([{ field_id: 'domain', operator: 'eq', value: domain }]), limit: '2' });
  const list = b?.records ?? [];
  if (list.length !== 1) return { pause: `${email}: ${list.length ? 'more than one company' : 'no company'} on ${domain}` };
  return { entity: 'companies', id: list[0].record_id, name: String(list[0].data?.name ?? domain) };
}

/** 2. Hold when a person is already talking to this customer: a manual email in the last N days. */
async function recentManualEmail(email: string, mySource: string, days = 5): Promise<boolean> {
  const person = await findPerson(email);
  if (!person) return false;
  const acts = await listAll('/api/activities', [
    { field_id: 'person_id', operator: 'eq', value: person.record_id },
    { field_id: 'kind', operator: 'eq', value: 'email' },
    { field_id: 'occurred_at', operator: 'gte', value: new Date(Date.now() - days * 86_400_000).toISOString() },
  ]);
  return acts.some((a) => a.data?.source !== mySource);
}

/** 3. Log what was actually sent, with the provider's real status. Never "sent" from a planned list. */
async function logSent(input: { source: string; email: string; fromMailbox: string; subject: string; text: string; providerMessageId: string; status: string; sentAt: string }) {
  const who = await resolveCustomer(input.email);
  if ('pause' in who) throw new Error(`refusing to log against an unmatched customer: ${who.pause}`);
  await crm('POST', '/api/intake', {
    source: input.source,
    source_ref: `sent:${input.providerMessageId}`, // re-runs log nothing twice
    person: { email: input.email },
    activity: { kind: 'email', subject: input.subject.slice(0, 300), occurred_at: input.sentAt, summary: `${input.status} · from ${input.fromMailbox}\n${input.text}`.slice(0, 2000) },
  });
  await postInRecordThread(who.entity, who.id, [
    `Automated email · ${input.status}`,
    `From ${input.fromMailbox} to ${input.email} · ${input.sentAt}`,
    `Subject: ${input.subject}`,
    '',
    input.text.slice(0, 3000),
  ].join('\n'));
}

// ---- Example: a reminder flow that may send by itself (the team decided so for this flow only) ----
const MY_SOURCE = 'Reminder emails';
const SEND_CONNECTION = '__SENDING_MAILBOX_CONNECTION_ID__';
const FROM_MAILBOX = '__MAILBOX__';
const toSend: { email: string; subject: string; text: string }[] = __PLANNED__; // whatever this flow plans
const paused: string[] = [];
for (const mail of toSend) {
  const who = await resolveCustomer(mail.email);
  if ('pause' in who) { paused.push(who.pause); continue; }
  if (await recentManualEmail(mail.email, MY_SOURCE)) { paused.push(`${mail.email}: a person emailed them recently; held for the owner`); continue; }
  // Use the provider's own send tool and read its result; the template uses Gmail's.
  const r: any = await tool(SEND_CONNECTION, 'GMAIL_SEND_EMAIL', { recipient_email: mail.email, subject: mail.subject, body: mail.text });
  await logSent({ source: MY_SOURCE, email: mail.email, fromMailbox: FROM_MAILBOX, subject: mail.subject, text: mail.text, providerMessageId: String(r?.data?.id ?? r?.data?.messageId ?? `${mail.email}:${Date.now()}`), status: r?.successful === false ? 'failed' : 'sent', sentAt: new Date().toISOString() });
}
if (paused.length) await workspace('POST', `/rooms/${CRM_ROOM}/messages/ui`, { fallback_text: `Held, not sent:\n${paused.join('\n')}`, blocks: [{ type: 'markdown', content: `**Held, not sent** (${MY_SOURCE})\n${paused.map((p) => `- ${p}`).join('\n')}` }] });
console.log(JSON.stringify({ planned: toSend.length, paused: paused.length }));
