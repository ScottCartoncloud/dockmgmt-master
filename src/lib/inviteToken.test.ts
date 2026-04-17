import { describe, it, expect } from 'vitest';
import {
  parseInviteFromHash,
  parseInviteFromQuery,
  resolveInviteToken,
  PENDING_INVITE_KEY,
} from './inviteToken';

describe('parseInviteFromHash', () => {
  it('parses token from a leading-# hash', () => {
    expect(parseInviteFromHash('#invite=abc-123')).toBe('abc-123');
  });

  it('parses token from a hash without leading #', () => {
    expect(parseInviteFromHash('invite=abc-123')).toBe('abc-123');
  });

  it('returns null for empty/missing hash', () => {
    expect(parseInviteFromHash('')).toBeNull();
    expect(parseInviteFromHash(null)).toBeNull();
    expect(parseInviteFromHash(undefined)).toBeNull();
    expect(parseInviteFromHash('#')).toBeNull();
  });

  it('returns null when invite key is absent', () => {
    expect(parseInviteFromHash('#foo=bar')).toBeNull();
  });

  it('handles multiple hash params', () => {
    expect(parseInviteFromHash('#foo=bar&invite=xyz')).toBe('xyz');
  });
});

describe('parseInviteFromQuery', () => {
  it('parses token from a leading-? query', () => {
    expect(parseInviteFromQuery('?invite=abc-123')).toBe('abc-123');
  });

  it('parses token from a query without leading ?', () => {
    expect(parseInviteFromQuery('invite=abc-123')).toBe('abc-123');
  });

  it('returns null for empty/missing query', () => {
    expect(parseInviteFromQuery('')).toBeNull();
    expect(parseInviteFromQuery(null)).toBeNull();
  });
});

describe('resolveInviteToken', () => {
  const mkStorage = (val: string | null): Pick<Storage, 'getItem'> => ({
    getItem: () => val,
  });

  it('prefers hash over query and storage', () => {
    const token = resolveInviteToken({
      hash: '#invite=from-hash',
      search: '?invite=from-query',
      storage: mkStorage('from-storage'),
    });
    expect(token).toBe('from-hash');
  });

  it('falls back to query string when hash is empty', () => {
    expect(
      resolveInviteToken({
        hash: '',
        search: '?invite=from-query',
        storage: mkStorage('from-storage'),
      })
    ).toBe('from-query');
  });

  it('falls back to storage when hash and query are empty', () => {
    expect(
      resolveInviteToken({
        hash: '',
        search: '',
        storage: mkStorage('from-storage'),
      })
    ).toBe('from-storage');
  });

  it('returns null when nothing is available', () => {
    expect(
      resolveInviteToken({ hash: '', search: '', storage: mkStorage(null) })
    ).toBeNull();
  });

  it('handles missing storage gracefully', () => {
    expect(resolveInviteToken({ hash: '', search: '', storage: null })).toBeNull();
  });

  it('handles storage that throws', () => {
    const throwingStorage: Pick<Storage, 'getItem'> = {
      getItem: () => {
        throw new Error('storage disabled');
      },
    };
    expect(
      resolveInviteToken({ hash: '', search: '', storage: throwingStorage })
    ).toBeNull();
  });

  it('exposes the canonical storage key', () => {
    expect(PENDING_INVITE_KEY).toBe('dockmgmt_pending_invite');
  });
});
