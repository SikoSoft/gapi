import { vi, describe, it, expect, beforeEach } from 'vitest';
import { FactOperation } from 'api-spec/models/Fact';

vi.mock('../index', () => ({
  prisma: {
    factCache: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    medal: {
      count: vi.fn(),
    },
  },
}));

vi.mock('../lib/Logger', () => ({
  Logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../lib/EntityListQueryBuilder', () => ({
  EntityListQueryBuilder: vi.fn().mockImplementation(() => ({
    setUserId: vi.fn(),
    setFilter: vi.fn(),
    runCountQuery: vi.fn(),
    runIdsQuery: vi.fn(),
  })),
}));

import { prisma } from '../index';
import { Fact } from '../lib/Fact';

describe('Fact', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('contextKey', () => {
    it('returns a 64-character hex string', () => {
      const context = { operation: FactOperation.MEDAL_COUNT, medalConfigId: 1, series: 'gold' };
      expect(Fact.contextKey(context)).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is deterministic for the same context', () => {
      const context = { operation: FactOperation.MEDAL_COUNT, medalConfigId: 1, series: 'gold' };
      expect(Fact.contextKey(context)).toBe(Fact.contextKey(context));
    });

    it('produces different keys for different contexts', () => {
      const a = { operation: FactOperation.MEDAL_COUNT, medalConfigId: 1, series: 'gold' };
      const b = { operation: FactOperation.MEDAL_COUNT, medalConfigId: 2, series: 'gold' };
      expect(Fact.contextKey(a)).not.toBe(Fact.contextKey(b));
    });

    it('produces the same key regardless of object key insertion order', () => {
      const a = { operation: FactOperation.MEDAL_COUNT, medalConfigId: 1, series: 'gold' };
      const b = { series: 'gold', operation: FactOperation.MEDAL_COUNT, medalConfigId: 1 } as typeof a;
      expect(Fact.contextKey(a)).toBe(Fact.contextKey(b));
    });

    it('preserves array element order — swapped arrays produce different keys', () => {
      const a = { operation: FactOperation.ENTITY_COUNT, filter: { types: ['foo', 'bar'] } } as any;
      const b = { operation: FactOperation.ENTITY_COUNT, filter: { types: ['bar', 'foo'] } } as any;
      expect(Fact.contextKey(a)).not.toBe(Fact.contextKey(b));
    });
  });

  describe('resolve', () => {
    it('returns the cached value without computing when a valid cache entry exists', async () => {
      vi.mocked(prisma.factCache.findUnique).mockResolvedValue({
        value: JSON.stringify(42),
        expiresAt: new Date(Date.now() + 60_000),
      } as any);

      const context = { operation: FactOperation.MEDAL_COUNT, medalConfigId: 1, series: 'gold' };
      const result = await Fact.resolve(context, 'user1');

      expect(result).toBe(42);
      expect(prisma.medal.count).not.toHaveBeenCalled();
      expect(prisma.factCache.upsert).not.toHaveBeenCalled();
    });

    it('treats an expired cache entry as a miss and recomputes', async () => {
      vi.mocked(prisma.factCache.findUnique).mockResolvedValue({
        value: JSON.stringify(99),
        expiresAt: new Date(Date.now() - 1_000),
      } as any);
      vi.mocked(prisma.medal.count).mockResolvedValue(5);
      vi.mocked(prisma.factCache.upsert).mockResolvedValue({} as any);

      const context = { operation: FactOperation.MEDAL_COUNT, medalConfigId: 1, series: 'gold' };
      const result = await Fact.resolve(context, 'user1');

      expect(result).toBe(5);
      expect(prisma.medal.count).toHaveBeenCalled();
      expect(prisma.factCache.upsert).toHaveBeenCalled();
    });

    it('skips cache read and write when bypassCache is true', async () => {
      vi.mocked(prisma.medal.count).mockResolvedValue(7);

      const context = { operation: FactOperation.MEDAL_COUNT, medalConfigId: 1, series: 'gold' };
      const result = await Fact.resolve(context, 'user1', { bypassCache: true });

      expect(result).toBe(7);
      expect(prisma.factCache.findUnique).not.toHaveBeenCalled();
      expect(prisma.factCache.upsert).not.toHaveBeenCalled();
    });

    it('returns undefined and skips cache write for ANALYSIS_CLASSIFICATION', async () => {
      vi.mocked(prisma.factCache.findUnique).mockResolvedValue(null as any);

      const context = {
        operation: FactOperation.ANALYSIS_CLASSIFICATION,
        filter: {} as any,
        analysisType: 'morningFasting' as any,
      };
      const result = await Fact.resolve(context, 'user1');

      expect(result).toBeUndefined();
      expect(prisma.factCache.upsert).not.toHaveBeenCalled();
    });

    it('writes computed value to cache on cache miss', async () => {
      vi.mocked(prisma.factCache.findUnique).mockResolvedValue(null as any);
      vi.mocked(prisma.medal.count).mockResolvedValue(3);
      vi.mocked(prisma.factCache.upsert).mockResolvedValue({} as any);

      const context = { operation: FactOperation.MEDAL_COUNT, medalConfigId: 2, series: 'silver' };
      await Fact.resolve(context, 'user1');

      expect(prisma.factCache.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ value: JSON.stringify(3), userId: 'user1' }),
          update: expect.objectContaining({ value: JSON.stringify(3) }),
        })
      );
    });
  });
});
