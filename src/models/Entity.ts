import { Prisma } from "@prisma/client";
import { ListContext, ListFilter, ListSort } from "api-spec/models/List";
import { Entity } from "api-spec/models";
import { DataType } from "api-spec/models/Entity";

export type PropertyReference = {
  dataType: DataType;
  propertyValueId: number;
};

export interface EntityBodyPayload {
  entityConfigId: number;
  desc: string;
  timeZone: number;
  tags: string[];
  properties: Entity.EntityProperty[];
  propertyReferences: PropertyReference[];
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
  entities: Entity.Entity[];
  context: ContextEntities;
  total: number;
}

const prismaEntityConfig =
  Prisma.validator<Prisma.EntityConfigFindUniqueArgs>()({
    where: { id: 1, userId: "" },
    include: {
      properties: {
        include: {
          defaultBooleanValue: {
            include: {
              booleanValue: true,
            },
          },
          defaultDateValue: {
            include: {
              dateValue: true,
            },
          },
          defaultIntValue: {
            include: {
              intValue: true,
            },
          },
          defaultImageValue: {
            include: {
              imageValue: true,
            },
          },
          defaultLongTextValue: {
            include: {
              longTextValue: true,
            },
          },
          defaultShortTextValue: {
            include: {
              shortTextValue: true,
            },
          },
        },
      },
    },
  });

export type PrismaEntityConfig = Prisma.EntityConfigGetPayload<
  typeof prismaEntityConfig
>;

const prismaEntity = Prisma.validator<Prisma.EntityFindUniqueArgs>()({
  where: { id: 1, userId: "" },
  include: {
    tags: true,
    booleanProperties: {
      include: {
        propertyValue: true,
      },
    },
    dateProperties: {
      include: {
        propertyValue: true,
      },
    },
    intProperties: {
      include: {
        propertyValue: true,
      },
    },
    imageProperties: {
      include: {
        propertyValue: true,
      },
    },
    longTextProperties: {
      include: {
        propertyValue: true,
      },
    },
    shortTextProperties: {
      include: {
        propertyValue: true,
      },
    },
  },
});

export type PrismaEntity = Prisma.EntityGetPayload<typeof prismaEntity>;

export type EntityConfigCreateBody = Omit<Entity.EntityConfig, "id">;

export type EntityConfigUpdateBody = Entity.EntityConfig;

export type EntityListQueryBuilderParams = {};
