import { z } from "zod";
import { Prisma } from "@prisma/client";
import { Entity } from "api-spec/models";
import { DataType } from "api-spec/models/Entity";

export const propertyConfigInclude = {
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
    optionsShortText: true,
    optionsInt: true,
    formatters: true,
  } satisfies Prisma.PropertyConfigFindUniqueArgs["include"];

const prismaPropertyConfig =
  Prisma.validator<Prisma.PropertyConfigFindUniqueArgs>()({
    where: { id: 1, userId: "" },
    include: propertyConfigInclude,
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
      optionsShortText: true,
      optionsInt: true,
    },
  });

export type PrismaFullPropertyConfig = Prisma.PropertyConfigGetPayload<
  typeof prismaFullPropertyConfig
>;

const ImageDataValueSchema = z.object({
  src: z.string(),
  alt: z.string(),
});

const CommonPropertyConfigSchema = z.object({
  performDriftCheck: z.boolean(),
  timeZone: z.number(),
  name: z.string(),
  required: z.number(),
  repeat: z.number(),
  allowed: z.number(),
  prefix: z.string(),
  suffix: z.string(),
  hidden: z.boolean(),
  optionsOnly: z.boolean(),
  formatters: z.array(z.string()).optional(),
});

export const propertyConfigCreateSchema = z.discriminatedUnion("dataType", [
  CommonPropertyConfigSchema.extend({
    dataType: z.literal(DataType.BOOLEAN),
    defaultValue: z.boolean(),
    options: z.array(z.boolean()),
  }),
  CommonPropertyConfigSchema.extend({
    dataType: z.literal(DataType.DATE),
    defaultValue: z.string().nullable(),
    options: z.array(z.string().nullable()),
  }),
  CommonPropertyConfigSchema.extend({
    dataType: z.literal(DataType.INT),
    defaultValue: z.number(),
    options: z.array(z.number()),
  }),
  CommonPropertyConfigSchema.extend({
    dataType: z.literal(DataType.IMAGE),
    defaultValue: ImageDataValueSchema,
    options: z.array(ImageDataValueSchema),
  }),
  CommonPropertyConfigSchema.extend({
    dataType: z.literal(DataType.LONG_TEXT),
    defaultValue: z.string(),
    options: z.array(z.string()),
  }),
  CommonPropertyConfigSchema.extend({
    dataType: z.literal(DataType.SHORT_TEXT),
    defaultValue: z.string(),
    options: z.array(z.string()),
  }),
]);

export type PropertyConfigCreateBody = z.infer<typeof propertyConfigCreateSchema>;
export type PropertyConfigCreateBodyType = PropertyConfigCreateBody;

export const propertyConfigUpdateSchema = propertyConfigCreateSchema;
export type PropertyConfigUpdateBody = PropertyConfigCreateBody;
export type PropertyConfigUpdateBodyType = PropertyConfigCreateBody;

export const propertyConfigUpdateOrderSchema = z.array(
  z.object({ id: z.number(), order: z.number() })
);
export type PropertyConfigUpdateOrderBody = z.infer<typeof propertyConfigUpdateOrderSchema>;

const CalculationOperandReference = z.object({ propertyConfigId: z.number() });
const CalculationOperand = z.union([CalculationOperandReference, z.number()]);
const CalculationOperation = z.enum(["*", "/", "+", "-"]);

export const calculatedPropertyConfigCreateSchema = z.object({
  name: z.string(),
  prefix: z.string(),
  suffix: z.string(),
  hidden: z.boolean(),
  calculation: z.object({
    value1: CalculationOperand,
    value2: CalculationOperand,
    operation: CalculationOperation,
  }),
});

// Explicit interface avoids a Zod v4 inference quirk that marks value1/value2 as optional
export interface CalculatedPropertyConfigCreateBody {
  name: string;
  prefix: string;
  suffix: string;
  hidden: boolean;
  calculation: {
    value1: { propertyConfigId: number } | number;
    value2: { propertyConfigId: number } | number;
    operation: "*" | "/" | "+" | "-";
  };
}

export const calculatedPropertyConfigUpdateSchema = calculatedPropertyConfigCreateSchema;
export type CalculatedPropertyConfigUpdateBody = CalculatedPropertyConfigCreateBody;

export interface ResolvedCalculatedConfig {
  id: number;
  calculation: Entity.EntityPropertyCalculation;
  value1DataType: DataType | null;
  value2DataType: DataType | null;
}
