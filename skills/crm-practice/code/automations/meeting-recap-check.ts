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

// Meeting recap check: every 15 minutes. Matches ended customer meetings to note-taker recaps, writes notes and
// to-dos to the CRM, posts them in the guest's record thread, and hands the follow-up email to a one-shot turn
// that creates a Draft Card from the host's own mailbox. Nothing is ever sent from here.
// Schedule: {"kind":"every","everyMs":900000}. Guide: references/meeting-follow-up.md. Prompt: prompts/meeting-recap.md.
// Flow: diagrams/meeting-follow-up.md.

// Every connected note-taker account. Keep expired ones listed: a re-authorised one is read again automatically.
const NOTE_TAKERS: { provider: string; connection: string; listTool: string }[] = __NOTE_TAKERS__;
const HOSTS: Record<string, { userId: string; firstName: string; mailboxConnection: string }> = __HOSTS__; // by host workspace user id
const RECAP_PROMPT = `__PASTE_prompts/meeting-recap.md__`; // the prompt text from the line after "---"
const STYLE_RULES = '__STYLE_RULES__'; // e.g. "No dashes as punctuation. Sign with first name only."
const APPROVED_LINKS = '__APPROVED_LINKS__'; // material hosts may send: deck, pricing page, case studies
const HOUR = 3_600_000;

type Recap = { id: string; title: string; start: number; participants: string[]; summary: string; actionItems: string; keyQuestions: string; url?: string };

// Adapter per note taker: map the provider's list output to Recap. Log one item on the rehearsal and adjust.
function toRecap(provider: string, m: any): Recap {
  return {
    id: `${provider}:${m.id ?? m.meeting_id ?? m.uuid}`,
    title: String(m.title ?? m.name ?? ''),
    start: Date.parse(m.start_time ?? m.startTime ?? m.date ?? ''),
    participants: addrs(JSON.stringify(m.participants ?? m.attendees ?? m.invitees ?? [])),
    summary: String(m.summary ?? m.overview ?? '').slice(0, 6000),
    actionItems: JSON.stringify(m.action_items ?? m.actionItems ?? []).slice(0, 3000),
    keyQuestions: JSON.stringify(m.key_questions ?? m.questions ?? []).slice(0, 2000),
    url: m.report_url ?? m.url ?? m.share_url,
  };
}

const saved: any = (await state.get({ view: 'latest' }))?.state ?? {};
const done: Record<string, string> = saved.done ?? {}; // meeting activity id -> recap id (or "pinged")
const now = Date.now();
const failed: string[] = [];
let posted = 0;

// 1. Meetings that ended in the last 48 hours and are not handled yet.
const meetings = (await listAll('/api/activities', [
  { field_id: 'kind', operator: 'eq', value: 'meeting' },
  { field_id: 'occurred_at', operator: 'gte', value: new Date(now - 48 * HOUR).toISOString() },
  { field_id: 'occurred_at', operator: 'lte', value: new Date(now - HOUR).toISOString() },
])).filter((a) => !done[a.record_id] && a.data?.source !== 'Meeting recap' && !/^\[(Cancelled|Rescheduled)\]/.test(String(a.data?.summary ?? '')));

// 2. Recent recaps from every note taker. If every connection fails, skip this run: never write "not found" because a source was down.
const recaps: Recap[] = [];
let sourcesUp = 0;
for (const nt of NOTE_TAKERS) {
  try {
    const b: any = await tool(nt.connection, nt.listTool, { limit: 50 });
    const items: any[] = b?.data?.meetings ?? b?.data?.items ?? b?.data?.transcripts ?? b?.data ?? [];
    recaps.push(...(Array.isArray(items) ? items : []).map((m) => toRecap(nt.provider, m)));
    sourcesUp += 1;
  } catch (e) {
    console.error('note taker', nt.provider, String(e).slice(0, 200));
  }
}
if (NOTE_TAKERS.length && !sourcesUp) { console.log('all note takers unreachable; skipped'); process.exit(0); }

for (const act of meetings) {
  try {
    const personId = relId(act.data?.person_id);
    const person = personId ? await crm('GET', `/api/people/${personId}`) : null;
    const guest = String(person?.data?.email ?? '').toLowerCase();
    const host = HOSTS[String(relId(act.data?.recorded_by) ?? '')];
    if (!guest || !host) continue;
    const start = Date.parse(act.data.occurred_at);
    // 3. Match: guest email among participants and start within 2 hours; nearest start wins.
    const match = recaps
      .filter((r) => r.participants.includes(guest) && Math.abs(r.start - start) < 2 * HOUR)
      .sort((a, b) => Math.abs(a.start - start) - Math.abs(b.start - start))[0];
    if (!match) {
      // Two hours after the end with no recap: ping the host once. (Check the mailbox sync for a moved meeting first if you have it.)
      if (now - start > 3 * HOUR && done[act.record_id] !== 'pinged') {
        await postInRecordThread('people', person.record_id, `@${host.userId} No recap found yet for "${act.data.subject}". If it happened, paste a few lines here and I'll do the notes and the email.`, [host.userId]);
        done[act.record_id] = 'pinged';
      }
      continue;
    }
    if (!match.summary.trim()) continue; // cannot read it: skip, never invent notes

    // 4. One tool-free model call; strict JSON validated in code.
    const filled = RECAP_PROMPT
      .replace('{title}', String(act.data.subject)).replace('{start_time}', new Date(start).toISOString()).replace('{time_zone}', 'UTC')
      .replace(/\{host_first_name\}/g, host.firstName).replace('{guest_name}', String(person.data.name ?? guest)).replace('{guest_company}', relLabel(person.data.company_id))
      .replace('{summary}', match.summary).replace('{action_items}', match.actionItems).replace('{key_questions}', match.keyQuestions)
      .replace('{approved_links}', APPROVED_LINKS).replace('{style_rules}', STYLE_RULES);
    const out = await modelJson(filled, { note: 'Material is in the system prompt. Return the JSON object.' }, 2000);
    if (!out || !Array.isArray(out.facts) || !out.email?.subject || !out.email?.body) { failed.push(`${act.record_id}: invalid model output`); continue; }
    const todos = (Array.isArray(out.todos) ? out.todos : []).filter((t: any) => typeof t?.task === 'string').slice(0, 10);
    const tag = `[post-meeting ${new Date(start).toISOString().slice(0, 10)}]`;

    // 5. Write through the intake: one recap activity (idempotent on the recap id) and a task per owned to-do.
    await crm('POST', '/api/intake', {
      source: 'Meeting recap',
      source_ref: `${match.id}:${guest}`,
      person: { email: guest },
      activity: { kind: 'meeting', subject: `${tag} ${act.data.subject}`.slice(0, 300), occurred_at: new Date(start).toISOString(), summary: [...out.facts, match.url ? `Recap: ${match.url}` : ''].filter(Boolean).join('\n').slice(0, 2000), recorded_by: host.userId },
    });
    for (const t of todos) {
      const owner = Object.values(HOSTS).find((h) => h.firstName.toLowerCase() === String(t.owner_first_name ?? '').toLowerCase());
      if (owner) await crm('POST', '/api/intake', { source: 'Meeting recap', person: { email: guest }, task: { title: String(t.task).slice(0, 200), owner: owner.userId, ...(t.due_date ? { due_date: t.due_date } : {}) } });
    }

    // 6. Notes in the guest's thread, mentioning the host. The stage is a suggestion; a person changes it.
    const notes = [
      `@${host.userId} Notes from "${act.data.subject}":`,
      out.facts.map((f: string) => `- ${f}`).join('\n'),
      todos.length ? `To-dos:\n${todos.map((t: any) => `- ${t.task} (${t.owner_first_name ?? 'TBD'}${t.due_date ? `, ${t.due_date}` : ''})`).join('\n')}` : '',
      Array.isArray(out.unclear) && out.unclear.length ? `Please check: ${out.unclear.join('; ')}` : '',
      out.suggested_stage ? `Suggested stage: ${out.suggested_stage}` : '',
      'Drafting the follow-up email from your mailbox next.',
    ].filter(Boolean).join('\n\n');
    const root = await postInRecordThread('people', person.record_id, notes, [host.userId]);

    // 7. Draft handoff: saved code cannot present a Draft Card, so a one-shot turn in the same thread does it.
    if (root && out.reply_needed !== false) {
      await workspace('POST', `/rooms/${CRM_ROOM}/followups`, {
        title: `Follow up: draft the email to ${person.data.name ?? guest}`,
        due_at: new Date(Date.now() + 60_000).toISOString(),
        thread_root_message_id: root,
        notify_user_ids: [host.userId],
        message: [
          `Create an email Draft Card from ${host.firstName}'s mailbox (connection ${host.mailboxConnection}) to ${guest}.`,
          'Find the latest email thread with this guest and reply in it; if there is none, start a new draft.',
          'Write HTML paragraphs, put links as hyperlinks and check each one loads, use the host\'s usual signature. Never send.',
          `If you cannot use ${host.firstName}'s mailbox in this turn, say so here and ask ${host.firstName} to reply in this thread; never say it is disconnected.`,
          `Subject: ${out.email.subject}`,
          `Body:\n${out.email.body}`,
        ].join('\n'),
      });
    }
    done[act.record_id] = match.id;
    posted += 1;
  } catch (e) {
    failed.push(`${act.record_id}: ${String(e).slice(0, 200)}`);
  }
}

// 8. Keep state small: drop markers older than the 48-hour window plus a margin.
const live = new Set((await listAll('/api/activities', [{ field_id: 'kind', operator: 'eq', value: 'meeting' }, { field_id: 'occurred_at', operator: 'gte', value: new Date(now - 72 * HOUR).toISOString() }])).map((a) => a.record_id));
await state.set({ done: Object.fromEntries(Object.entries(done).filter(([k]) => live.has(k))) });
console.log(JSON.stringify({ meetings: meetings.length, recaps: recaps.length, posted, failed: failed.length }));
if (failed.length) { console.error(failed.join('\n')); process.exit(1); }
