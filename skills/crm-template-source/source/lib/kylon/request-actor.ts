/**
 * Who a request is for, and who actually made it.
 *
 * Kylon's middleware sets `x-p2-user-id` to the caller on every request: a
 * person's App login, an Agent's service call, an API key's owner, or
 * `anonymous`. During a person's live turn an Agent's call may also carry
 * `x-p2-on-behalf-of` — the person the Agent is acting for — when this App
 * declared `delegation: "live_human_turn"` in its definition. Kylon only sets
 * that header from its own signed token and strips any inbound copy, so App
 * code can trust it as much as the caller header.
 *
 * Authorize and attribute ownership to `actorId`; record `callerId` in logs
 * and audit fields so a delegated write still names the Agent that made it.
 */
export const KYLON_CALLER_HEADER = "x-p2-user-id";
export const KYLON_ON_BEHALF_OF_HEADER = "x-p2-on-behalf-of";

export interface KylonRequestActor {
  /** The id to authorize and to own what the request creates, or null when anonymous. */
  actorId: string | null;
  /** The credential that made the request, or null when anonymous. */
  callerId: string | null;
  /** True when `actorId` is a person an Agent acts for; `callerId` is then the Agent. */
  delegated: boolean;
}

function readHeader(request: Request, name: string): string | null {
  const value = request.headers.get(name)?.trim();
  return value ? value : null;
}

export function requestActor(request: Request): KylonRequestActor {
  const caller = readHeader(request, KYLON_CALLER_HEADER);
  const callerId = caller && caller !== "anonymous" ? caller : null;
  const onBehalfOf = readHeader(request, KYLON_ON_BEHALF_OF_HEADER);
  // A delegated person always rides on a named caller; without one the header
  // cannot have come from Kylon and is ignored.
  if (callerId && onBehalfOf && onBehalfOf !== callerId) {
    return { actorId: onBehalfOf, callerId, delegated: true };
  }
  return { actorId: callerId, callerId, delegated: false };
}

/** The id to authorize as: the delegated person when present, else the caller. */
export function delegatedActor(request: Request): string | null {
  return requestActor(request).actorId;
}

/** A log-safe rendering: `user_1 via agent_2` when delegated, else the caller. */
export function describeRequestActor(actor: KylonRequestActor): string {
  if (!actor.actorId) return "anonymous";
  return actor.delegated ? `${actor.actorId} via ${actor.callerId}` : actor.actorId;
}
