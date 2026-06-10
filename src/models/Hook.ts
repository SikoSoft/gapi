import { HookType } from "api-spec/models/Hook";
import { AnalysisClassificationType } from "api-spec/models/Fact";
import { SegmentationTimeUnit } from "api-spec/models/Statistic";
import { EntityBodyPayload } from "./Entity";
import { FactValue } from "../lib/Fact";

export { HookType };

export type PreCreateContext = {
  type: HookType.PRE_CREATE;
  userId: string;
  data: EntityBodyPayload;
};

export type PostCreateContext = {
  type: HookType.POST_CREATE;
  userId: string;
  data: EntityBodyPayload;
  entityId: number;
};

export type PreUpdateContext = {
  type: HookType.PRE_UPDATE;
  userId: string;
  entityId: number;
  data: EntityBodyPayload;
};

export type PostUpdateContext = {
  type: HookType.POST_UPDATE;
  userId: string;
  entityId: number;
  data: EntityBodyPayload;
};

export type PreDeleteContext = {
  type: HookType.PRE_DELETE;
  userId: string;
  entityId: number;
};

export type PostDeleteContext = {
  type: HookType.POST_DELETE;
  userId: string;
  entityId: number;
};

export type PostAnalysisClassificationContext = {
  type: HookType.POST_ANALYSIS_CLASSIFICATION;
  userId: string;
  analysisType: AnalysisClassificationType;
  segmentUnit: SegmentationTimeUnit;
  segmentKey: string;
  value: FactValue;
};

export type HookContext =
  | PreCreateContext
  | PostCreateContext
  | PreUpdateContext
  | PostUpdateContext
  | PreDeleteContext
  | PostDeleteContext
  | PostAnalysisClassificationContext;

export type HookHandler = (context: HookContext) => Promise<void>;

export interface Hook {
  type: HookType;
  handler: HookHandler;
}
