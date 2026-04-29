import { vi, describe, it, expect } from 'vitest';

vi.mock('../index', () => ({ prisma: {} }));

import { PropertyConfig } from '../lib/PropertyConfig';
import { DataType } from 'api-spec/models/Entity';
import type { PrismaPropertyConfig } from '../models/PropertyConfig';

const baseConfig: PrismaPropertyConfig = {
  id: 1,
  entityConfigId: 10,
  userId: 'user-uuid',
  name: 'Test Property',
  dataType: DataType.SHORT_TEXT,
  required: 0,
  repeat: 0,
  allowed: 0,
  prefix: '',
  suffix: '',
  hidden: false,
  optionsOnly: false,
  optionsShortText: [],
  optionsInt: [],
  defaultBooleanValue: null,
  defaultDateValue: null,
  defaultIntValue: null,
  defaultImageValue: null,
  defaultLongTextValue: null,
  defaultShortTextValue: null,
} as unknown as PrismaPropertyConfig;

describe('PropertyConfig.mapDataToSpec', () => {
  it('maps common fields regardless of dataType', () => {
    const result = PropertyConfig.mapDataToSpec(baseConfig);
    expect(result.id).toBe(1);
    expect(result.entityConfigId).toBe(10);
    expect(result.userId).toBe('user-uuid');
    expect(result.name).toBe('Test Property');
    expect(result.required).toBe(0);
    expect(result.options).toEqual([]);
  });

  describe('BOOLEAN', () => {
    it('uses defaultBooleanValue when present', () => {
      const config = {
        ...baseConfig,
        dataType: DataType.BOOLEAN,
        defaultBooleanValue: { booleanValue: { value: true } },
      } as unknown as PrismaPropertyConfig;
      const result = PropertyConfig.mapDataToSpec(config);
      expect(result.dataType).toBe(DataType.BOOLEAN);
      expect((result as any).defaultValue).toBe(true);
    });

    it('falls back to false when defaultBooleanValue is null', () => {
      const config = { ...baseConfig, dataType: DataType.BOOLEAN } as unknown as PrismaPropertyConfig;
      const result = PropertyConfig.mapDataToSpec(config);
      expect((result as any).defaultValue).toBe(false);
    });
  });

  describe('DATE', () => {
    it('uses defaultDateValue when present', () => {
      const dateVal = new Date('2024-06-15');
      const config = {
        ...baseConfig,
        dataType: DataType.DATE,
        defaultDateValue: { dateValue: { value: dateVal } },
      } as unknown as PrismaPropertyConfig;
      const result = PropertyConfig.mapDataToSpec(config);
      expect(result.dataType).toBe(DataType.DATE);
      expect((result as any).defaultValue).toBe(dateVal);
    });

    it('falls back to null when defaultDateValue is null', () => {
      const config = { ...baseConfig, dataType: DataType.DATE } as unknown as PrismaPropertyConfig;
      expect((PropertyConfig.mapDataToSpec(config) as any).defaultValue).toBeNull();
    });
  });

  describe('INT', () => {
    it('uses defaultIntValue when present', () => {
      const config = {
        ...baseConfig,
        dataType: DataType.INT,
        defaultIntValue: { intValue: { value: 42 } },
      } as unknown as PrismaPropertyConfig;
      expect((PropertyConfig.mapDataToSpec(config) as any).defaultValue).toBe(42);
    });

    it('falls back to 0 when defaultIntValue is null', () => {
      const config = { ...baseConfig, dataType: DataType.INT } as unknown as PrismaPropertyConfig;
      expect((PropertyConfig.mapDataToSpec(config) as any).defaultValue).toBe(0);
    });
  });

  describe('IMAGE', () => {
    it('uses defaultImageValue when present', () => {
      const config = {
        ...baseConfig,
        dataType: DataType.IMAGE,
        defaultImageValue: { imageValue: { url: 'https://example.com/img.png', altText: 'A photo' } },
      } as unknown as PrismaPropertyConfig;
      const result = PropertyConfig.mapDataToSpec(config) as any;
      expect(result.defaultValue.src).toBe('https://example.com/img.png');
      expect(result.defaultValue.alt).toBe('A photo');
    });

    it('falls back to empty strings when defaultImageValue is null', () => {
      const config = { ...baseConfig, dataType: DataType.IMAGE } as unknown as PrismaPropertyConfig;
      const result = PropertyConfig.mapDataToSpec(config) as any;
      expect(result.defaultValue.src).toBe('');
      expect(result.defaultValue.alt).toBe('');
    });
  });

  describe('LONG_TEXT', () => {
    it('uses defaultLongTextValue when present', () => {
      const config = {
        ...baseConfig,
        dataType: DataType.LONG_TEXT,
        defaultLongTextValue: { longTextValue: { value: 'some long text' } },
      } as unknown as PrismaPropertyConfig;
      expect((PropertyConfig.mapDataToSpec(config) as any).defaultValue).toBe('some long text');
    });

    it('falls back to empty string when null', () => {
      const config = { ...baseConfig, dataType: DataType.LONG_TEXT } as unknown as PrismaPropertyConfig;
      expect((PropertyConfig.mapDataToSpec(config) as any).defaultValue).toBe('');
    });
  });

  describe('SHORT_TEXT', () => {
    it('uses defaultShortTextValue when present', () => {
      const config = {
        ...baseConfig,
        dataType: DataType.SHORT_TEXT,
        defaultShortTextValue: { shortTextValue: { value: 'hello' } },
      } as unknown as PrismaPropertyConfig;
      expect((PropertyConfig.mapDataToSpec(config) as any).defaultValue).toBe('hello');
    });

    it('falls back to empty string when null', () => {
      expect((PropertyConfig.mapDataToSpec(baseConfig) as any).defaultValue).toBe('');
    });
  });

  describe('mapDataToOptions', () => {
    it('returns short text option values', () => {
      const config = {
        ...baseConfig,
        dataType: DataType.SHORT_TEXT,
        optionsShortText: [{ id: 1, propertyConfigId: 1, value: 'apple' }, { id: 2, propertyConfigId: 1, value: 'banana' }],
      } as unknown as PrismaPropertyConfig;
      expect((PropertyConfig.mapDataToSpec(config) as any).options).toEqual(['apple', 'banana']);
    });

    it('returns int option values', () => {
      const config = {
        ...baseConfig,
        dataType: DataType.INT,
        optionsInt: [{ id: 1, propertyConfigId: 1, value: 10 }, { id: 2, propertyConfigId: 1, value: 20 }],
      } as unknown as PrismaPropertyConfig;
      expect((PropertyConfig.mapDataToSpec(config) as any).options).toEqual([10, 20]);
    });
  });
});
