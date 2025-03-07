import { Action as PrismaAction } from "@prisma/client";
import { ListContext, ListFilter, ListSort } from "api-spec/models/List";

export interface ActionBodyPayload {
  desc: string;
  occurredAt?: string;
  timeZone: string;
  tags: string[];
}

export type ContextActions = Record<number, PrismaAction[]>;

export interface ActionListParams {
  userId: string;
  filter: ListFilter;
  context: ListContext;
  sort: ListSort;
  start: number;
  perPage: number;
}

export interface ActionList {
  actions: PrismaAction[];
  context: ContextActions;
  total: number;
}
