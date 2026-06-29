import type { JellyfinUserResponse } from '@server/api/jellyfin';
import {
  matchJellyfinUser,
  normalizeJellyfinGuid,
} from '@server/utils/jellyfin';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

function jellyfinUser(
  partial: Partial<JellyfinUserResponse> & { Name: string; Id: string }
): JellyfinUserResponse {
  return {
    ServerId: 'server-id',
    ServerName: 'server-name',
    Configuration: { GroupedFolders: [] },
    Policy: { IsAdministrator: false },
    ...partial,
  };
}

describe('normalizeJellyfinGuid', () => {
  it('strips dashes and lowercases a valid GUID', () => {
    assert.strictEqual(
      normalizeJellyfinGuid('A1B2C3D4-E5F6-A7B8-C9D0-E1F2A3B4C5D6'),
      'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'
    );
  });

  it('returns null for empty or malformed input', () => {
    assert.strictEqual(normalizeJellyfinGuid(undefined), null);
    assert.strictEqual(normalizeJellyfinGuid(''), null);
    assert.strictEqual(normalizeJellyfinGuid('not-a-guid'), null);
  });
});

describe('matchJellyfinUser', () => {
  const users = [
    jellyfinUser({ Name: 'alice', Id: 'id-alice' }),
    jellyfinUser({ Name: 'Bob', Id: 'id-bob' }),
  ];

  it('matches a single user by preferred_username', () => {
    const result = matchJellyfinUser(users, { preferredUsername: 'alice' });
    assert.strictEqual(result.status, 'matched');
    assert.strictEqual(
      result.status === 'matched' ? result.user.Id : null,
      'id-alice'
    );
  });

  it('matches case-insensitively and ignores surrounding whitespace', () => {
    const result = matchJellyfinUser(users, { preferredUsername: '  BOB  ' });
    assert.strictEqual(result.status, 'matched');
    assert.strictEqual(
      result.status === 'matched' ? result.user.Id : null,
      'id-bob'
    );
  });

  it('returns no-candidate when preferred_username is absent or blank', () => {
    assert.strictEqual(
      matchJellyfinUser(users, { preferredUsername: undefined }).status,
      'no-candidate'
    );
    assert.strictEqual(
      matchJellyfinUser(users, { preferredUsername: '   ' }).status,
      'no-candidate'
    );
  });

  it('returns no-match when no Jellyfin user has that name', () => {
    const result = matchJellyfinUser(users, { preferredUsername: 'carol' });
    assert.strictEqual(result.status, 'no-match');
  });

  it('does not match on email (Jellyfin exposes no email)', () => {
    // A Jellyfin account named like the email must not be matched via the email
    // claim in username mode; only preferred_username is compared.
    const result = matchJellyfinUser(
      [jellyfinUser({ Name: 'alice@example.com', Id: 'id-email' })],
      { preferredUsername: 'alice', email: 'alice@example.com' }
    );
    assert.strictEqual(result.status, 'no-match');
  });

  it('refuses to link when multiple Jellyfin users share the same name', () => {
    const dupes = [
      jellyfinUser({ Name: 'dup', Id: 'id-1' }),
      jellyfinUser({ Name: 'DUP', Id: 'id-2' }),
    ];
    const result = matchJellyfinUser(dupes, { preferredUsername: 'dup' });
    assert.strictEqual(result.status, 'ambiguous');
    assert.strictEqual(result.status === 'ambiguous' ? result.count : 0, 2);
  });
});
