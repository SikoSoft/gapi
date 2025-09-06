import { Prisma } from "@prisma/client";
import { ListContext, ListFilter, ListSort } from "api-spec/models/List";
import { Entity } from "api-spec/models";

export interface EntityBodyPayload {
  desc: string;
  timeZone: string;
  tags: string[];
}

export type ContextEntities = Record<number, PrismaEntity[]>;

export interface EntityListParams {
  userId: string;
  filter: ListFilter;
  context: ListContext;
  sort: ListSort;
  start: number;
  perPage: number;
}

export interface EntityList {
  entities: EntityItem[];
  context: ContextEntities;
  total: number;
}

const prismaEntityConfig =
  Prisma.validator<Prisma.EntityConfigFindUniqueArgs>()({
    where: { id: 1, userId: "" },
    include: {
      properties: true,
    },
  });

export type PrismaEntityConfig = Prisma.EntityConfigGetPayload<
  typeof prismaEntityConfig
>;

const prismaEntity = Prisma.validator<Prisma.EntityFindUniqueArgs>()({
  where: { id: 1, userId: "" },
  include: {
    tags: true,
  },
});

export type PrismaEntity = Prisma.EntityGetPayload<typeof prismaEntity>;

export type EntityItem = Omit<PrismaEntity, "tags"> & {
  tags: string[];
};

export type EntityConfigCreateBody = Omit<Entity.EntityConfig, "id">;

export type EntityConfigUpdateBody = Entity.EntityConfig;
