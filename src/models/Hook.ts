import { EntityBodyPayload } from "./Entity";

export enum HookType {
  PRE_CREATE = "preCreate",
  POST_CREATE = "postCreate",
  PRE_UPDATE = "preUpdate",
  POST_UPDATE = "postUpdate",
  PRE_DELETE = "preDelete",
  POST_DELETE = "postDelete",
}

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

export type HookContext =
  | PreCreateContext
  | PostCreateContext
  | PreUpdateContext
  | PostUpdateContext
  | PreDeleteContext
  | PostDeleteContext;

export type HookHandler = (context: HookContext) => Promise<void>;

export interface Hook {
  type: HookType;
  handler: HookHandler;
}
