import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ok } from 'neverthrow';
import type { Criteria, Criterion } from 'api-spec/models/Medal';
import type { FactValue } from '../lib/Fact';

vi.mock('../index', () => ({
  prisma: {
    medalConfig: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    medal: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../lib/Fact', () => ({
  Fact: { resolve: vi.fn() },
}));

vi.mock('../lib/Notification', () => ({
  Notification: { send: vi.fn() },
}));

vi.mock('../lib/Logger', () => ({
  Logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { prisma } from '../index';
import { Fact } from '../lib/Fact';
import { Notification } from '../lib/Notification';
import { Medal } from '../lib/Medal';

// Helpers for accessing private static methods in tests
const evaluateCriterion = (criterion: Criterion, facts: Record<string, FactValue>) =>
  (Medal as any).evaluateCriterion(criterion, facts);

const evaluateCriteria = (criteria: Criterion | Criteria, facts: Record<string, FactValue>) =>
  (Medal as any).evaluateCriteria(criteria, facts);

// Minimal Prisma config shape that satisfies mapConfigToSpec
function makePrismaConfig(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: 'Test Medal',
    description: 'A test medal',
    series: 'test',
    recurrence: 0,
    prestige: 1,
    icon: 'star',
    factRequests: [{ alias: 'count', context: { operation: 'entityCount', filter: {} } }],
    streakRequests: [],
    criteria: { fact: 'count', operator: '>=', value: 1 },
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-06-01T00:00:00Z'),
    ...overrides,
  };
}

describe('Medal', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Mapping
  // ---------------------------------------------------------------------------

  describe('mapConfigToSpec', () => {
    it('maps all fields correctly and converts dates to ISO strings', () => {
      const createdAt = new Date('2024-01-01T00:00:00Z');
      const updatedAt = new Date('2024-06-01T00:00:00Z');
      const config = makePrismaConfig({ id: 5, name: 'Gold Star', prestige: 10, createdAt, updatedAt });

      const result = Medal.mapConfigToSpec(config as any);

      expect(result).toEqual({
        id: 5,
        name: 'Gold Star',
        description: 'A test medal',
        series: 'test',
        recurrence: 0,
        prestige: 10,
        icon: 'star',
        factRequests: config.factRequests,
        streakRequests: [],
        criteria: config.criteria,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      });
    });
  });

  describe('mapMedalToSpec', () => {
    it('maps all fields correctly and converts awardedAt to ISO string', () => {
      const awardedAt = new Date('2024-03-15T12:00:00Z');
      const medal = { id: 42, userId: 'user-uuid', medalConfigId: 7, awardedAt };

      const result = Medal.mapMedalToSpec(medal as any);

      expect(result).toEqual({
        id: 42,
        userId: 'user-uuid',
        medalConfigId: 7,
        awardedAt: awardedAt.toISOString(),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // evaluateCriterion
  // ---------------------------------------------------------------------------

  describe('evaluateCriterion (private)', () => {
    it('== returns true when values match', () => {
      expect(evaluateCriterion({ fact: 'x', operator: '==', value: 5 }, { x: 5 })).toBe(true);
    });

    it('== returns false when values differ', () => {
      expect(evaluateCriterion({ fact: 'x', operator: '==', value: 5 }, { x: 6 })).toBe(false);
    });

    it('!= returns true when values differ', () => {
      expect(evaluateCriterion({ fact: 'x', operator: '!=', value: 5 }, { x: 6 })).toBe(true);
    });

    it('!= returns false when values match', () => {
      expect(evaluateCriterion({ fact: 'x', operator: '!=', value: 5 }, { x: 5 })).toBe(false);
    });

    it('> returns true when fact is greater', () => {
      expect(evaluateCriterion({ fact: 'n', operator: '>', value: 10 }, { n: 11 })).toBe(true);
    });

    it('> returns false when fact is equal', () => {
      expect(evaluateCriterion({ fact: 'n', operator: '>', value: 10 }, { n: 10 })).toBe(false);
    });

    it('>= returns true when fact is equal', () => {
      expect(evaluateCriterion({ fact: 'n', operator: '>=', value: 10 }, { n: 10 })).toBe(true);
    });

    it('>= returns false when fact is less', () => {
      expect(evaluateCriterion({ fact: 'n', operator: '>=', value: 10 }, { n: 9 })).toBe(false);
    });

    it('< returns true when fact is less', () => {
      expect(evaluateCriterion({ fact: 'n', operator: '<', value: 10 }, { n: 9 })).toBe(true);
    });

    it('< returns false when fact is equal', () => {
      expect(evaluateCriterion({ fact: 'n', operator: '<', value: 10 }, { n: 10 })).toBe(false);
    });

    it('<= returns true when fact is equal', () => {
      expect(evaluateCriterion({ fact: 'n', operator: '<=', value: 10 }, { n: 10 })).toBe(true);
    });

    it('<= returns false when fact is greater', () => {
      expect(evaluateCriterion({ fact: 'n', operator: '<=', value: 10 }, { n: 11 })).toBe(false);
    });

    it('contains with array: returns true when factValue is in the array', () => {
      expect(
        evaluateCriterion(
          { fact: 'tag', operator: 'contains', value: ['alpha', 'beta', 'gamma'] },
          { tag: 'beta' }
        )
      ).toBe(true);
    });

    it('contains with array: returns false when factValue is not in the array', () => {
      expect(
        evaluateCriterion(
          { fact: 'tag', operator: 'contains', value: ['alpha', 'beta'] },
          { tag: 'delta' }
        )
      ).toBe(false);
    });

    it('contains with string: returns true when factValue includes the substring', () => {
      expect(
        evaluateCriterion({ fact: 'label', operator: 'contains', value: 'hello' }, { label: 'say hello world' })
      ).toBe(true);
    });

    it('contains with string: returns false when factValue does not include the substring', () => {
      expect(
        evaluateCriterion({ fact: 'label', operator: 'contains', value: 'hello' }, { label: 'goodbye' })
      ).toBe(false);
    });

    it('returns false when the fact alias is not in the facts map', () => {
      expect(evaluateCriterion({ fact: 'missing', operator: '==', value: 1 }, {})).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // evaluateCriteria
  // ---------------------------------------------------------------------------

  describe('evaluateCriteria (private)', () => {
    it('evaluates a leaf Criterion directly', () => {
      expect(evaluateCriteria({ fact: 'n', operator: '>=', value: 5 }, { n: 10 })).toBe(true);
      expect(evaluateCriteria({ fact: 'n', operator: '>=', value: 5 }, { n: 3 })).toBe(false);
    });

    it('all: returns true only when every child passes', () => {
      const criteria: Criteria = {
        all: [
          { fact: 'a', operator: '>=', value: 1 },
          { fact: 'b', operator: '>=', value: 1 },
        ],
      };
      expect(evaluateCriteria(criteria, { a: 5, b: 5 })).toBe(true);
      expect(evaluateCriteria(criteria, { a: 5, b: 0 })).toBe(false);
    });

    it('any: returns true when at least one child passes', () => {
      const criteria: Criteria = {
        any: [
          { fact: 'a', operator: '>=', value: 10 },
          { fact: 'b', operator: '>=', value: 1 },
        ],
      };
      expect(evaluateCriteria(criteria, { a: 0, b: 5 })).toBe(true);
      expect(evaluateCriteria(criteria, { a: 0, b: 0 })).toBe(false);
    });

    it('supports nested criteria trees', () => {
      const criteria: Criteria = {
        all: [
          { fact: 'a', operator: '>=', value: 5 },
          {
            any: [
              { fact: 'b', operator: '==', value: true },
              { fact: 'c', operator: '>', value: 100 },
            ],
          },
        ],
      };
      expect(evaluateCriteria(criteria, { a: 10, b: true, c: 0 })).toBe(true);
      expect(evaluateCriteria(criteria, { a: 10, b: false, c: 50 })).toBe(false);
      expect(evaluateCriteria(criteria, { a: 1, b: true, c: 200 })).toBe(false);
    });

    it('returns false when neither all nor any is present', () => {
      expect(evaluateCriteria({} as any, {})).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // createConfig — alias validation
  // ---------------------------------------------------------------------------

  describe('createConfig', () => {
    it('returns err when criteria reference an undefined fact alias', async () => {
      const body = {
        name: 'Test',
        description: 'Test',
        series: 'test',
        recurrence: 1,
        prestige: 1,
        icon: 'star',
        factRequests: [{ alias: 'entityCount', context: {} }],
        criteria: { fact: 'undefinedAlias', operator: '>=', value: 5 },
      };

      const result = await Medal.createConfig(body as any);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toContain('undefinedAlias');
    });

    it('returns err for nested criteria that reference an undefined alias', async () => {
      const body = {
        name: 'Test',
        description: 'Test',
        series: 'test',
        recurrence: 1,
        prestige: 1,
        icon: 'star',
        factRequests: [{ alias: 'count', context: {} }],
        criteria: {
          all: [
            { fact: 'count', operator: '>=', value: 5 },
            { fact: 'ghost', operator: '==', value: true },
          ],
        },
      };

      const result = await Medal.createConfig(body as any);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toContain('ghost');
    });

    it('calls prisma.medalConfig.create and returns the mapped config when aliases are valid', async () => {
      const now = new Date();
      vi.mocked(prisma.medalConfig.create).mockResolvedValue(makePrismaConfig({ createdAt: now, updatedAt: now }) as any);

      const body = {
        name: 'Test Medal',
        description: 'A test medal',
        series: 'test',
        recurrence: 0,
        prestige: 1,
        icon: 'star',
        factRequests: [{ alias: 'count', context: {} }],
        criteria: { fact: 'count', operator: '>=', value: 1 },
      };

      const result = await Medal.createConfig(body as any);

      expect(result.isOk()).toBe(true);
      expect(prisma.medalConfig.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'Test Medal' }) })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getConfigWithProgress
  // ---------------------------------------------------------------------------

  describe('getConfigWithProgress', () => {
    it('returns err when the config is not found', async () => {
      vi.mocked(prisma.medalConfig.findUnique).mockResolvedValue(null as any);

      const result = await Medal.getConfigWithProgress(99, 'user1');

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toContain('not found');
    });

    it('includes resolved fact values in criteriaProgress', async () => {
      const now = new Date();
      vi.mocked(prisma.medalConfig.findUnique).mockResolvedValue(
        makePrismaConfig({ createdAt: now, updatedAt: now }) as any
      );
      vi.mocked(Fact.resolve).mockResolvedValue(42);

      const result = await Medal.getConfigWithProgress(1, 'user1');

      expect(result.isOk()).toBe(true);
      const config = result._unsafeUnwrap();
      expect(config.criteriaProgress).toEqual([{ alias: 'count', value: 42 }]);
    });

    it('omits entries for facts that could not be resolved', async () => {
      const now = new Date();
      vi.mocked(prisma.medalConfig.findUnique).mockResolvedValue(
        makePrismaConfig({ createdAt: now, updatedAt: now }) as any
      );
      vi.mocked(Fact.resolve).mockResolvedValue(undefined);

      const result = await Medal.getConfigWithProgress(1, 'user1');

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().criteriaProgress).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // getConfigsWithProgress
  // ---------------------------------------------------------------------------

  describe('getConfigsWithProgress', () => {
    it('returns an empty array when there are no configs', async () => {
      vi.mocked(prisma.medalConfig.findMany).mockResolvedValue([]);

      const result = await Medal.getConfigsWithProgress('user1');

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual([]);
    });

    it('resolves criteriaProgress for each config', async () => {
      const now = new Date();
      vi.mocked(prisma.medalConfig.findMany).mockResolvedValue([
        makePrismaConfig({ id: 1, createdAt: now, updatedAt: now }),
        makePrismaConfig({ id: 2, createdAt: now, updatedAt: now }),
      ] as any);
      vi.mocked(Fact.resolve).mockResolvedValue(7);

      const result = await Medal.getConfigsWithProgress('user1');

      expect(result.isOk()).toBe(true);
      const configs = result._unsafeUnwrap();
      expect(configs).toHaveLength(2);
      expect(configs[0].criteriaProgress).toEqual([{ alias: 'count', value: 7 }]);
      expect(configs[1].criteriaProgress).toEqual([{ alias: 'count', value: 7 }]);
    });
  });

  // ---------------------------------------------------------------------------
  // checkForDisbursement
  // ---------------------------------------------------------------------------

  describe('checkForDisbursement', () => {
    const hookContext = { userId: 'user1', type: 'postCreate', entityId: 1 } as any;

    it('skips a config when a fact cannot be resolved', async () => {
      vi.mocked(prisma.medalConfig.findMany).mockResolvedValue([makePrismaConfig()] as any);
      vi.mocked(Fact.resolve).mockResolvedValue(undefined);

      await Medal.checkForDisbursement(hookContext);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('skips medal creation when the criteria are not met', async () => {
      vi.mocked(prisma.medalConfig.findMany).mockResolvedValue([
        makePrismaConfig({ criteria: { fact: 'count', operator: '>=', value: 100 } }),
      ] as any);
      vi.mocked(Fact.resolve).mockResolvedValue(5);

      await Medal.checkForDisbursement(hookContext);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('does not create a medal when the recurrence cap has been reached', async () => {
      vi.mocked(prisma.medalConfig.findMany).mockResolvedValue([
        makePrismaConfig({ recurrence: 1, criteria: { fact: 'count', operator: '>=', value: 1 } }),
      ] as any);
      vi.mocked(Fact.resolve).mockResolvedValue(10);

      const txMock = {
        medal: {
          count: vi.fn().mockResolvedValue(1), // already at the cap
          create: vi.fn(),
        },
      };
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(txMock));

      await Medal.checkForDisbursement(hookContext);

      expect(txMock.medal.create).not.toHaveBeenCalled();
      expect(Notification.send).not.toHaveBeenCalled();
    });

    it('creates a medal and sends a notification when criteria are met and recurrence allows', async () => {
      const config = makePrismaConfig({
        id: 7,
        name: 'Milestone',
        description: 'You did it!',
        recurrence: 0,
        criteria: { fact: 'count', operator: '>=', value: 1 },
      });
      vi.mocked(prisma.medalConfig.findMany).mockResolvedValue([config] as any);
      vi.mocked(Fact.resolve).mockResolvedValue(10);
      vi.mocked(Notification.send).mockResolvedValue(ok(undefined));

      const txMock = {
        medal: {
          count: vi.fn().mockResolvedValue(0),
          create: vi.fn().mockResolvedValue({ id: 99, userId: 'user1', medalConfigId: 7, awardedAt: new Date() }),
        },
      };
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(txMock));

      await Medal.checkForDisbursement(hookContext);

      expect(txMock.medal.create).toHaveBeenCalledWith({
        data: { userId: 'user1', medalConfigId: 7 },
      });
      expect(Notification.send).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user1',
          title: 'Medal Earned: Milestone',
          body: 'You did it!',
        })
      );
    });
  });
});
