# Formatter System

Formatters are client-side display transforms applied to chart dataset values before rendering. The backend accepts, validates, and echoes formatter references — all actual transformation logic lives in the frontend (`orbit`).

## Where formatters live

- **`api-spec/models/Formatter.ts`** — `FormatterId` enum of known formatter IDs; `FormatterConfig`, `FormatterEntry`, `FormatterMeta`, `FormatterFn` types; `supportedDataTypes` list.
- **`api-spec/lib/FormatterRegistry.ts`** — A runtime `registry: Record<string, FormatterMeta>` populated by the frontend via `registerFormatter(id, meta)`. The backend never calls this registry.
- **`api-spec/lib/Formatter.ts`** — `dataTypeSupportsFormatter(dataType)` helper (frontend use only).

## How formatters flow through gapi

### Request (`ChartConfigV3`)

`ChartVersion.V3` promotes every `DataPointRequest` to a `FormattedDataPointRequest`, adding `formatters: string[]`:

```typescript
// api-spec/models/Statistic.ts
export type FormattedDataPointRequest = DataPointRequest & {
  formatters: string[];
};

export interface ChartConfigV3 extends Omit<ChartConfigV2, "version"> {
  version: ChartVersion.V3;
  dataPoints: FormattedDataPointRequest[];
}
```

### Validation (`src/models/Chart.ts`)

The Zod schema for V3 validates that every formatter ID in each `dataPoint.formatters` array is a known `FormatterId` value:

```typescript
const v3DataPointSchema = z.array(
  z.object({ formatters: z.array(z.nativeEnum(FormatterId)) }).passthrough()
);
```

`FormatterId` currently contains: `MS_TO_DURATION = "ms_to_duration"`.

### Response (`ChartDataset`)

`Chart.getChartData` echoes each dataPoint's `formatters` back in the corresponding `ChartDataset`:

```typescript
// api-spec/models/Statistic.ts
export interface ChartDataset {
  data: SegmentedDataPoint[];
  label: string;
  formatters: string[];
}
```

For V1/V2 dataPoints (which have no `formatters` field), `formatters` is returned as `[]`.

## Adding a new formatter

1. Add a new entry to the `FormatterId` enum in `api-spec/src/models/Formatter.ts`.
2. Bump the `api-spec` version and update the `package.json` reference in both `gapi` and `orbit`.
3. Run `npm install` in `gapi` — the new ID becomes valid in the Zod `v3DataPointSchema`.
4. Implement the formatter function in `orbit` and call `registerFormatter(FormatterId.YOUR_NEW_ID, meta)`.
