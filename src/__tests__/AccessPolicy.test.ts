import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../index', () => ({ prisma: {} }));

import { AccessPolicy } from '../lib/AccessPolicy';
import { Access } from 'api-spec/models';
import type { PrismaAccessPolicy } from '../models/Access';

const basePolicy: PrismaAccessPolicy = {
  id: 1,
  name: 'Test Policy',
  description: 'A policy for testing',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  parties: [],
};

describe('AccessPolicy.mapPolicy', () => {
  it('returns null for null input', () => {
    expect(AccessPolicy.mapPolicy(null)).toBeNull();
  });

  it('maps a policy with no parties', () => {
    const result = AccessPolicy.mapPolicy(basePolicy);
    expect(result).toMatchObject({
      id: 1,
      name: 'Test Policy',
      description: 'A policy for testing',
    });
    expect(result!.parties).toEqual([]);
  });

  it('maps a user party correctly', () => {
    const policy: PrismaAccessPolicy = {
      ...basePolicy,
      parties: [
        {
          id: 10,
          accessPolicyId: 1,
          type: Access.AccessPartyType.USER,
          userId: 'user-uuid-1',
          groupId: null,
          user: { id: 'user-uuid-1', username: 'alice', firstName: 'Alice', lastName: 'Smith', createdAt: new Date(), updatedAt: new Date(), email: null, googleAccountId: null } as any,
          group: null,
        },
      ],
    };

    const result = AccessPolicy.mapPolicy(policy);
    expect(result!.parties).toHaveLength(1);
    const party = result!.parties[0] as Access.AccessPolicyUserParty;
    expect(party.type).toBe(Access.AccessPartyType.USER);
    expect(party.userId).toBe('user-uuid-1');
    expect(party.name).toBe('alice');
    expect(party.id).toBe('10');
  });

  it('falls back to empty string when user has no username', () => {
    const policy: PrismaAccessPolicy = {
      ...basePolicy,
      parties: [
        {
          id: 11,
          accessPolicyId: 1,
          type: Access.AccessPartyType.USER,
          userId: 'user-uuid-2',
          groupId: null,
          user: null,
          group: null,
        },
      ],
    };

    const result = AccessPolicy.mapPolicy(policy);
    const party = result!.parties[0] as Access.AccessPolicyUserParty;
    expect(party.name).toBe('');
  });

  it('maps a group party correctly', () => {
    const policy: PrismaAccessPolicy = {
      ...basePolicy,
      parties: [
        {
          id: 20,
          accessPolicyId: 1,
          type: Access.AccessPartyType.GROUP,
          userId: null,
          groupId: 5,
          user: null,
          group: {
            id: 5,
            name: 'Admins',
            userId: 'owner-uuid',
            createdAt: new Date(),
            updatedAt: new Date(),
            users: [
              {
                groupId: 5,
                userId: 'user-uuid-3',
                user: { id: 'user-uuid-3', username: 'bob', firstName: 'Bob', lastName: 'Jones', createdAt: new Date(), updatedAt: new Date(), email: null, googleAccountId: null } as any,
              },
            ],
          },
        },
      ],
    };

    const result = AccessPolicy.mapPolicy(policy);
    const party = result!.parties[0] as Access.AccessPolicyGroupParty;
    expect(party.type).toBe(Access.AccessPartyType.GROUP);
    expect(party.name).toBe('Admins');
    expect(party.groupId).toBe('5');
    expect(party.users).toHaveLength(1);
    expect(party.users[0].name).toBe('bob');
  });
});
