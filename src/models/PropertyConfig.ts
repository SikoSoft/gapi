import * as t from "io-ts";
import { Prisma } from "@prisma/client";
import { Entity } from "api-spec/models";
import { RenderType } from "api-spec/models/Entity";

const prismaPropertyConfig =
  Prisma.validator<Prisma.PropertyConfigFindUniqueArgs>()({
    where: { id: 1, userId: "" },
    include: {},
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
>;

export type PropertyConfigUpdateBody = PropertyConfigCreateBody; //Entity.EntityPropertyConfig;

const RenderTypeCodec = t.keyof(
  Object.values(Entity.RenderType).reduce((acc, value) => {
    acc[value] = null;
    return acc;
  }, {} as Record<RenderType, null>)
);

const ImageDataValue = t.type({
  src: t.string,
  alt: t.string,
});

const CommonPropertyConfig = t.type({
  name: t.string,
  renderType: RenderTypeCodec,
  required: t.number,
  repeat: t.number,
  allowed: t.number,
  prefix: t.string,
  suffix: t.string,
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
