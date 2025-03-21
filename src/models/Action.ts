import { Prisma } from "@prisma/client";
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
  actions: ActionItem[];
  context: ContextActions;
  total: number;
}

const prismaAction = Prisma.validator<Prisma.ActionFindUniqueArgs>()({
  where: { id: 1, userId: "" },
  include: {
    tags: true,
  },
});

export type PrismaAction = Prisma.ActionGetPayload<typeof prismaAction>;

export type ActionItem = Omit<PrismaAction, "tags"> & {
  tags: string[];
};
