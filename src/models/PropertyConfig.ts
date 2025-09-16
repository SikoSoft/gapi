import * as z from "zod";
import { Prisma } from "@prisma/client";
import { Entity } from "api-spec/models";

const prismaPropertyConfig =
  Prisma.validator<Prisma.PropertyConfigFindUniqueArgs>()({
    where: { id: 1, userId: "" },
    include: {},
  });

export type PrismaPropertyConfig = Prisma.PropertyConfigGetPayload<
  typeof prismaPropertyConfig
>;

export type PropertyConfigCreateBody = Omit<
  Entity.EntityPropertyConfig,
  "id" | "userId" | "entityConfigId"
>;

export const propertyConfigCreateSchema = z.object({
  name: z.string().min(2).max(100),
  renderType: z.enum(Object.values(Entity.RenderType)),
  required: z.int().default(0),
  repeat: z.int().default(0),
  allowed: z.int().default(0),
  prefix: z.string().max(100).default(""),
  suffix: z.string().max(100).default(""),
  dataType: z.enum(Object.values(Entity.DataType)),
  defaultValue: z.union([
    z.string().max(255),
    z.number(),
    z.boolean(),
    z.object({
      src: z.string().max(2048),
      alt: z.string().max(255),
    }),
  ]),
});

export type PropertyConfigUpdateBody = PropertyConfigCreateBody; //Entity.EntityPropertyConfig;
