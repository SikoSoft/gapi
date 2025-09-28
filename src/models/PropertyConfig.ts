import * as t from "io-ts";
import { Prisma } from "@prisma/client";
import { Entity } from "api-spec/models";

const prismaPropertyConfig =
  Prisma.validator<Prisma.PropertyConfigFindUniqueArgs>()({
    where: { id: 1, userId: "" },
    include: {
      defaultBooleanValue: {
        include: {
          booleanValue: true,
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
  });

export type PrismaPropertyConfig = Prisma.PropertyConfigGetPayload<
  typeof prismaPropertyConfig
>;

const prismaFullPropertyConfig =
  Prisma.validator<Prisma.PropertyConfigFindUniqueArgs>()({
    where: { id: 1 },
    include: {
      defaultBooleanValue: true,
      defaultIntValue: true,
      defaultImageValue: true,
      defaultLongTextValue: true,
      defaultShortTextValue: true,
    },
  });

export type PrismaFullPropertyConfig = Prisma.PropertyConfigGetPayload<
  typeof prismaFullPropertyConfig
>;

export type PropertyConfigCreateBody = Omit<
  Entity.EntityPropertyConfig,
  "id" | "userId" | "entityConfigId"
> & { timeZone: number };

export type PropertyConfigUpdateBody = PropertyConfigCreateBody; //Entity.EntityPropertyConfig;

const ImageDataValue = t.type({
  src: t.string,
  alt: t.string,
});

const CommonPropertyConfig = t.type({
  timeZone: t.number,
  name: t.string,
  required: t.number,
  repeat: t.number,
  allowed: t.number,
  prefix: t.string,
  suffix: t.string,
  hidden: t.boolean,
});

export const propertyConfigCreateSchema = t.union([
  t.exact(
    t.intersection([
      CommonPropertyConfig,
      t.type({
        dataType: t.literal(Entity.DataType.BOOLEAN),
        defaultValue: t.boolean,
      }),
    ])
  ),
  t.exact(
    t.intersection([
      CommonPropertyConfig,
      t.type({
        dataType: t.literal(Entity.DataType.DATE),
        defaultValue: t.string,
      }),
    ])
  ),
  t.exact(
    t.intersection([
      CommonPropertyConfig,
      t.type({
        dataType: t.literal(Entity.DataType.INT),
        defaultValue: t.number,
      }),
    ])
  ),
  t.exact(
    t.intersection([
      CommonPropertyConfig,
      t.type({
        dataType: t.literal(Entity.DataType.IMAGE),
        defaultValue: ImageDataValue,
      }),
    ])
  ),
  t.exact(
    t.intersection([
      CommonPropertyConfig,
      t.type({
        dataType: t.literal(Entity.DataType.LONG_TEXT),
        defaultValue: t.string,
      }),
    ])
  ),
  t.exact(
    t.intersection([
      CommonPropertyConfig,
      t.type({
        dataType: t.literal(Entity.DataType.SHORT_TEXT),
        defaultValue: t.string,
      }),
    ])
  ),
]);

export type PropertyConfigCreateBodyType = t.TypeOf<
  typeof propertyConfigCreateSchema
>;

export const propertyConfigUpdateSchema = propertyConfigCreateSchema;

export type PropertyConfigUpdateBodyType = t.TypeOf<
  typeof propertyConfigUpdateSchema
>;

export const propertyConfigUpdateOrderSchema = t.array(
  t.type({ id: t.number, order: t.number })
);

export type PropertyConfigUpdateOrderBody = t.TypeOf<
  typeof propertyConfigUpdateOrderSchema
>;
