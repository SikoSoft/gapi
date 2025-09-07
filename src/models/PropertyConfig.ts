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

export type PropertyConfigUpdateBody = PropertyConfigCreateBody; //Entity.EntityPropertyConfig;
