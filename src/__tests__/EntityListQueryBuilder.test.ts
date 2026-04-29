import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  ListFilterTimeType,
  ListFilterType,
  ListSortDirection,
  ListSortNativeProperty,
} from 'api-spec/models/List';

vi.mock('../index', () => ({
  prisma: {},
  getDefaultFilter: () => ({
    tagging: {
      [ListFilterType.CONTAINS_ONE_OF]: [],
      [ListFilterType.CONTAINS_ALL_OF]: [],
    },
    time: { type: ListFilterTimeType.ALL_TIME },
    properties: [],
    includeUntagged: true,
    includeAll: true,
    includeAllTagging: true,
    includeTypes: [],
  }),
}));

import { EntityListQueryBuilder } from '../lib/EntityListQueryBuilder';

function normalize(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

describe('EntityListQueryBuilder', () => {
  let builder: EntityListQueryBuilder;

  beforeEach(() => {
    builder = new EntityListQueryBuilder();
    builder.setUserId('user-uuid');
  });

  describe('buildQuery', () => {
    it('includes COUNT(*) when countOnly is true', () => {
      const query = normalize(builder.buildQuery(true));
      expect(query).toContain('COUNT(*)');
      expect(query).not.toContain('LIMIT');
    });

    it('includes column list and LIMIT when countOnly is false', () => {
      const query = normalize(builder.buildQuery(false));
      expect(query).not.toContain('COUNT(*)');
      expect(query).toContain('LIMIT');
      expect(query).toContain('OFFSET');
    });

    it('registers limit and offset params only for non-count queries', () => {
      const countBuilder = new EntityListQueryBuilder();
      countBuilder.setUserId('user-uuid');
      countBuilder.buildQuery(true);
      expect((countBuilder as any).params).not.toHaveProperty('limit');

      const fullBuilder = new EntityListQueryBuilder();
      fullBuilder.setUserId('user-uuid');
      fullBuilder.buildQuery(false);
      expect((fullBuilder as any).params).toHaveProperty('limit');
      expect((fullBuilder as any).params).toHaveProperty('offset');
    });
  });

  describe('getFilterPropertyFragment', () => {
    it('produces a boolean filter fragment for boolean values', () => {
      const fragment = normalize(builder.getFilterPropertyFragment({ propertyId: 1, value: true }, 0));
      expect(fragment).toContain('EntityBooleanProperty');
      expect(fragment).toContain('BooleanPropertyValue');
      expect(fragment).toContain('{filterPropId0}::int');
      expect(fragment).toContain('{filterPropVal0}::boolean');
    });

    it('produces an int filter fragment for number values', () => {
      const fragment = normalize(builder.getFilterPropertyFragment({ propertyId: 2, value: 42 }, 1));
      expect(fragment).toContain('EntityIntProperty');
      expect(fragment).toContain('IntPropertyValue');
      expect(fragment).toContain('{filterPropId1}::int');
      expect(fragment).toContain('{filterPropVal1}::int');
    });

    it('produces a text filter fragment for string values (covers short and long text)', () => {
      const fragment = normalize(builder.getFilterPropertyFragment({ propertyId: 3, value: 'hello' }, 2));
      expect(fragment).toContain('EntityShortTextProperty');
      expect(fragment).toContain('EntityLongTextProperty');
      expect(fragment).toContain('{filterPropId2}::int');
      expect(fragment).toContain('{filterPropVal2}::text');
    });

    it('returns empty string for non-primitive value types', () => {
      const fragment = builder.getFilterPropertyFragment({ propertyId: 4, value: null as any }, 3);
      expect(fragment).toBe('');
    });

    it('registers the param values when building filter fragments', () => {
      builder.getFilterPropertyFragment({ propertyId: 7, value: false }, 0);
      expect((builder as any).params.filterPropId0).toBe(7);
      expect((builder as any).params.filterPropVal0).toBe(false);
    });
  });

  describe('getFilterTagsContainsOneOfFragment', () => {
    it('returns empty string when tag list is empty', () => {
      builder.setFilter({
        tagging: { containsOneOf: [], containsAllOf: [] },
        time: { type: ListFilterTimeType.ALL_TIME },
        properties: [],
        includeUntagged: false,
        includeAll: true,
        includeAllTagging: true,
        includeTypes: [],
      });
      expect(builder.getFilterTagsContainsOneOfFragment()).toBe('');
    });

    it('produces an EXISTS subquery for tag matching', () => {
      builder.setFilter({
        tagging: { containsOneOf: ['urgent', 'bug'], containsAllOf: [] },
        time: { type: ListFilterTimeType.ALL_TIME },
        properties: [],
        includeUntagged: false,
        includeAll: true,
        includeAllTagging: true,
        includeTypes: [],
      });
      const fragment = normalize(builder.getFilterTagsContainsOneOfFragment());
      expect(fragment).toContain('AND');
      expect(fragment).toContain('EXISTS');
      expect(fragment).toContain('EntityTag');
      expect(fragment).toContain('{tagLabels}::text[]');
    });

    it('wraps with OR NOT EXISTS when includeUntagged is true', () => {
      builder.setFilter({
        tagging: { containsOneOf: ['urgent'], containsAllOf: [] },
        time: { type: ListFilterTimeType.ALL_TIME },
        properties: [],
        includeUntagged: true,
        includeAll: true,
        includeAllTagging: true,
        includeTypes: [],
      });
      const fragment = normalize(builder.getFilterTagsContainsOneOfFragment());
      expect(fragment).toContain('NOT EXISTS');
    });
  });

  describe('getFilterTagsContainsAllOfFragment', () => {
    it('returns empty string when tag list is empty', () => {
      builder.setFilter({
        tagging: { containsOneOf: [], containsAllOf: [] },
        time: { type: ListFilterTimeType.ALL_TIME },
        properties: [],
        includeUntagged: false,
        includeAll: true,
        includeAllTagging: true,
        includeTypes: [],
      });
      expect(builder.getFilterTagsContainsAllOfFragment()).toBe('');
    });

    it('uses COUNT(DISTINCT) subquery requiring all tags match', () => {
      builder.setFilter({
        tagging: { containsOneOf: [], containsAllOf: ['alpha', 'beta'] },
        time: { type: ListFilterTimeType.ALL_TIME },
        properties: [],
        includeUntagged: false,
        includeAll: true,
        includeAllTagging: true,
        includeTypes: [],
      });
      const fragment = normalize(builder.getFilterTagsContainsAllOfFragment());
      expect(fragment).toContain('COUNT(DISTINCT');
      expect(fragment).toContain('array_length({tagLabels}::text[], 1)');
    });

    it('wraps with OR NOT EXISTS when includeUntagged is true', () => {
      builder.setFilter({
        tagging: { containsOneOf: [], containsAllOf: ['alpha'] },
        time: { type: ListFilterTimeType.ALL_TIME },
        properties: [],
        includeUntagged: true,
        includeAll: true,
        includeAllTagging: true,
        includeTypes: [],
      });
      const fragment = normalize(builder.getFilterTagsContainsAllOfFragment());
      expect(fragment).toContain('NOT EXISTS');
    });
  });

  describe('getFilterFragment', () => {
    it('adds type filter when includeTypes is non-empty', () => {
      builder.setFilter({
        tagging: { containsOneOf: [], containsAllOf: [] },
        time: { type: ListFilterTimeType.ALL_TIME },
        properties: [],
        includeUntagged: true,
        includeAll: true,
        includeAllTagging: true,
        includeTypes: [1, 2, 3],
      });
      const fragment = normalize(builder.getFilterFragment());
      expect(fragment).toContain('{types}::int[]');
    });

    it('returns empty string when filter is all-inclusive', () => {
      builder.setFilter({
        tagging: { containsOneOf: [], containsAllOf: [] },
        time: { type: ListFilterTimeType.ALL_TIME },
        properties: [],
        includeUntagged: true,
        includeAll: true,
        includeAllTagging: true,
        includeTypes: [],
      });
      expect(builder.getFilterFragment().trim()).toBe('');
    });
  });
});
