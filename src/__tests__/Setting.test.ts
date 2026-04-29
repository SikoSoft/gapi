import { vi, describe, it, expect } from 'vitest';

vi.mock('../index', () => ({ prisma: {} }));

import { Setting } from '../lib/Setting';
import { defaultSettings } from 'api-spec/models/Setting';
import type { PrismaSetting } from '../models/Setting';

const baseSetting: PrismaSetting = {
  id: 'setting-uuid',
  userId: 'user-uuid',
  listConfigId: 'list-config-uuid',
  booleanSettings: [],
  intSettings: [],
  shortTextSettings: [],
} as unknown as PrismaSetting;

describe('Setting.mapDataToSpec', () => {
  it('returns defaultSettings when all arrays are empty', () => {
    expect(Setting.mapDataToSpec(baseSetting)).toEqual(defaultSettings);
  });

  it('overrides a boolean setting', () => {
    const setting: PrismaSetting = {
      ...baseSetting,
      booleanSettings: [{ settingId: 'setting-uuid', name: 'public', value: true }],
    } as unknown as PrismaSetting;
    const result = Setting.mapDataToSpec(setting);
    expect(result.public).toBe(true);
    expect(result.paginationPageSize).toBe(defaultSettings.paginationPageSize);
  });

  it('overrides an int setting', () => {
    const setting: PrismaSetting = {
      ...baseSetting,
      intSettings: [{ settingId: 'setting-uuid', name: 'paginationPageSize', value: 50 }],
    } as unknown as PrismaSetting;
    const result = Setting.mapDataToSpec(setting);
    expect(result.paginationPageSize).toBe(50);
    expect(result.public).toBe(defaultSettings.public);
  });

  it('overrides a short text setting', () => {
    const setting: PrismaSetting = {
      ...baseSetting,
      shortTextSettings: [{ settingId: 'setting-uuid', name: 'entityNameSingular', value: 'item' }],
    } as unknown as PrismaSetting;
    const result = Setting.mapDataToSpec(setting);
    expect(result.entityNameSingular).toBe('item');
  });

  it('merges all three setting types together', () => {
    const setting: PrismaSetting = {
      ...baseSetting,
      booleanSettings: [{ settingId: 'setting-uuid', name: 'public', value: true }],
      intSettings: [{ settingId: 'setting-uuid', name: 'paginationPageSize', value: 25 }],
      shortTextSettings: [{ settingId: 'setting-uuid', name: 'entityNameSingular', value: 'task' }],
    } as unknown as PrismaSetting;
    const result = Setting.mapDataToSpec(setting);
    expect(result.public).toBe(true);
    expect(result.paginationPageSize).toBe(25);
    expect(result.entityNameSingular).toBe('task');
  });
});
