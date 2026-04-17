/**
 * Invite token parsing utilities.
 *
 * Invite links can arrive in two formats:
 *   - Hash fragment (preferred):  /auth#invite=<uuid>
 *   - Query string (legacy):      /auth?invite=<uuid>
 *
 * Hash fragments are not transmitted to the server, which prevents the token
 * from leaking via referrer headers, server access logs, or analytics.
 */

export const PENDING_INVITE_KEY = 'dockmgmt_pending_invite';

/** Parse an invite token from a URL hash fragment (e.g. "#invite=abc"). */
export function parseInviteFromHash(hash: string | null | undefined): string | null {
  if (!hash) return null;
  const cleaned = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!cleaned) return null;
  const params = new URLSearchParams(cleaned);
  return params.get('invite');
}

/** Parse an invite token from a URL query string (e.g. "?invite=abc" or "invite=abc"). */
export function parseInviteFromQuery(query: string | null | undefined): string | null {
  if (!query) return null;
  const cleaned = query.startsWith('?') ? query.slice(1) : query;
  if (!cleaned) return null;
  const params = new URLSearchParams(cleaned);
  return params.get('invite');
}

/**
 * Resolve the active invite token from (in priority order):
 *   1. URL hash fragment
 *   2. URL query string
 *   3. localStorage fallback (used to survive OAuth round-trips)
 */
export function resolveInviteToken(opts: {
  hash?: string | null;
  search?: string | null;
  storage?: Pick<Storage, 'getItem'> | null;
}): string | null {
  const fromHash = parseInviteFromHash(opts.hash);
  if (fromHash) return fromHash;

  const fromQuery = parseInviteFromQuery(opts.search);
  if (fromQuery) return fromQuery;

  if (opts.storage) {
    try {
      return opts.storage.getItem(PENDING_INVITE_KEY);
    } catch {
      return null;
    }
  }
  return null;
}
