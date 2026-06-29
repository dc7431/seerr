import type { JellyfinUserResponse } from '@server/api/jellyfin';

export function normalizeJellyfinGuid(
  value: string | null | undefined
): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/-/g, '').toLowerCase();

  if (!/^[0-9a-f]{32}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

/**
 * Strategy used to match an incoming OIDC identity to an existing Jellyfin/Emby
 * user. Only `username` matching is implemented today (comparing the OIDC
 * `preferred_username` claim against the Jellyfin account name).
 *
 * A future `mapping-claim` mode — matching on an explicit, admin-configured OIDC
 * claim that carries the Jellyfin user id/name — can be added by extending this
 * union and `resolveJellyfinMatchKey` only; call sites do not need to change.
 */
export type JellyfinAutoLinkMode = 'username';

export interface JellyfinAutoLinkProfile {
  preferredUsername?: string | null;
  email?: string | null;
}

export type JellyfinUserMatch =
  | { status: 'matched'; user: JellyfinUserResponse }
  | { status: 'no-candidate' }
  | { status: 'no-match' }
  | { status: 'ambiguous'; count: number };

/**
 * Resolves the value to compare against each Jellyfin account's `Name`, based on
 * the selected matching mode. Returns `null` when the profile carries no usable
 * candidate for the given mode.
 */
function resolveJellyfinMatchKey(
  profile: JellyfinAutoLinkProfile,
  mode: JellyfinAutoLinkMode
): string | null {
  switch (mode) {
    case 'username':
    default: {
      const username = profile.preferredUsername?.trim();
      return username ? username : null;
    }
  }
}

/**
 * Attempts to match an OIDC identity to exactly one Jellyfin/Emby user.
 *
 * Jellyfin's API does not expose user email addresses, so the only reliable
 * identifier is the account name. Matching therefore compares the OIDC
 * `preferred_username` against the Jellyfin `Name` (case-insensitive, trimmed).
 *
 * SECURITY: username matching is only safe when a single identity provider
 * authoritatively provisions BOTH the Jellyfin and OIDC usernames (e.g. the same
 * SSO provider creates both accounts). Otherwise a user who controls their OIDC
 * `preferred_username` could be auto-linked to an unrelated Jellyfin account.
 * Callers MUST keep this behind an opt-in setting, require an unambiguous single
 * match, and verify the resulting `jellyfinUserId` is not already linked to
 * another Seerr user.
 */
export function matchJellyfinUser(
  jellyfinUsers: JellyfinUserResponse[],
  profile: JellyfinAutoLinkProfile,
  mode: JellyfinAutoLinkMode = 'username'
): JellyfinUserMatch {
  const matchKey = resolveJellyfinMatchKey(profile, mode);
  if (!matchKey) {
    return { status: 'no-candidate' };
  }

  const normalizedKey = matchKey.toLowerCase();
  const matches = jellyfinUsers.filter(
    (user) => user.Name?.trim().toLowerCase() === normalizedKey
  );

  if (matches.length === 0) {
    return { status: 'no-match' };
  }
  if (matches.length > 1) {
    return { status: 'ambiguous', count: matches.length };
  }
  return { status: 'matched', user: matches[0] };
}
