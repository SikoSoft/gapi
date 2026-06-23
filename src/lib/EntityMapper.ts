import { prisma } from "..";
import {
  EntityPropertyCalculation,
  EntityPropertyCalculationReference,
} from "api-spec/models/Entity";
import { Entity as EntitySpec } from "api-spec/models";
import { PrismaEntity } from "../models/Entity";

export class EntityMapper {
  static booleanPropertiesToSpec(
    entity: PrismaEntity
  ): EntitySpec.EntityProperty[] {
    const properties: EntitySpec.EntityProperty[] = [];

    if (entity.booleanProperties) {
      entity.booleanProperties.forEach((prop) => {
        properties.push({
          id: prop.propertyValueId,
          propertyConfigId: prop.propertyConfigId,
          value: prop.propertyValue ? prop.propertyValue.value : false,
          order: prop.order,
        });
      });
    }

    return properties;
  }

  static datePropertiesToSpec(
    entity: PrismaEntity
  ): EntitySpec.EntityProperty[] {
    const properties: EntitySpec.EntityProperty[] = [];

    if (entity.dateProperties) {
      entity.dateProperties.forEach((prop) => {
        properties.push({
          id: prop.propertyValueId,
          propertyConfigId: prop.propertyConfigId,
          value: prop.propertyValue ? prop.propertyValue.value : new Date(),
          order: prop.order,
        });
      });
    }

    return properties;
  }

  static intPropertiesToSpec(
    entity: PrismaEntity
  ): EntitySpec.EntityProperty[] {
    const properties: EntitySpec.EntityProperty[] = [];

    if (entity.intProperties) {
      entity.intProperties.forEach((prop) => {
        properties.push({
          id: prop.propertyValueId,
          propertyConfigId: prop.propertyConfigId,
          value: prop.propertyValue ? prop.propertyValue.value : 0,
          order: prop.order,
        });
      });
    }

    return properties;
  }

  static imagePropertiesToSpec(
    entity: PrismaEntity
  ): EntitySpec.EntityProperty[] {
    const properties: EntitySpec.EntityProperty[] = [];

    if (entity.imageProperties) {
      entity.imageProperties.forEach((prop) => {
        properties.push({
          id: prop.propertyValueId,
          propertyConfigId: prop.propertyConfigId,
          value: prop.propertyValue
            ? { src: prop.propertyValue.url, alt: prop.propertyValue.altText }
            : { src: "", alt: "" },
          order: prop.order,
        });
      });
    }

    return properties;
  }

  static shortTextPropertiesToSpec(
    entity: PrismaEntity
  ): EntitySpec.EntityProperty[] {
    const properties: EntitySpec.EntityProperty[] = [];

    if (entity.shortTextProperties) {
      entity.shortTextProperties.forEach((prop) => {
        properties.push({
          id: prop.propertyValueId,
          propertyConfigId: prop.propertyConfigId,
          value: prop.propertyValue ? prop.propertyValue.value : "",
          order: prop.order,
        });
      });
    }

    return properties;
  }

  static longTextPropertiesToSpec(
    entity: PrismaEntity
  ): EntitySpec.EntityProperty[] {
    const properties: EntitySpec.EntityProperty[] = [];

    if (entity.longTextProperties) {
      entity.longTextProperties.forEach((prop) => {
        properties.push({
          id: prop.propertyValueId,
          propertyConfigId: prop.propertyConfigId,
          value: prop.propertyValue ? prop.propertyValue.value : null,
          order: prop.order,
        });
      });
    }

    return properties;
  }

  static calculatedPropertiesToSpec(
    entity: PrismaEntity
  ): EntitySpec.EntityProperty[] {
    const raw = (entity as any).calculatedProperties;
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw.map((prop: any) => ({
      id: 0,
      propertyConfigId: prop.propertyConfigId,
      value: prop.propertyValue?.value ?? null,
      order: prop.order,
    }));
  }

  static computeCalculatedValue(
    calc: EntityPropertyCalculation,
    properties: EntitySpec.EntityProperty[]
  ): number | null {
    const resolveOperand = (
      operand: EntityPropertyCalculationReference | number
    ): number | null => {
      if (typeof operand === "number") {
        return operand;
      }
      const sourceProp = properties.find(
        (p) => p.propertyConfigId === operand.propertyConfigId
      );
      if (!sourceProp || sourceProp.value === null) {
        return null;
      }
      return sourceProp.value as number;
    };

    const v1 = resolveOperand(calc.value1);
    const v2 = resolveOperand(calc.value2);

    if (v1 === null || v2 === null) {
      return null;
    }

    switch (calc.operation) {
      case "*":
        return v1 * v2;
      case "/":
        return v2 !== 0 ? v1 / v2 : null;
      case "+":
        return v1 + v2;
      case "-":
        return v1 - v2;
      default:
        return null;
    }
  }

  static async computeAndAugmentSpec(
    entity: PrismaEntity
  ): Promise<EntitySpec.Entity> {
    const spec = EntityMapper.toSpec(entity);
    const calcRecords = entity.calculatedProperties;
    if (!calcRecords || calcRecords.length === 0) {
      return spec;
    }

    const configs = await prisma.propertyConfig.findMany({
      where: { id: { in: calcRecords.map((r) => r.propertyConfigId) } },
      select: { id: true, calculation: true },
    });

    for (const record of calcRecords) {
      const config = configs.find((c) => c.id === record.propertyConfigId);
      if (!config?.calculation) {
        continue;
      }
      const value = EntityMapper.computeCalculatedValue(
        config.calculation as EntityPropertyCalculation,
        spec.properties
      );
      const prop = spec.properties.find(
        (p) => p.propertyConfigId === record.propertyConfigId && p.id === 0
      );
      if (prop) {
        prop.value = value;
      }
    }

    return spec;
  }

  static toSpec(entity: PrismaEntity): EntitySpec.Entity {
    const properties: EntitySpec.EntityProperty[] = [
      ...EntityMapper.booleanPropertiesToSpec(entity),
      ...EntityMapper.datePropertiesToSpec(entity),
      ...EntityMapper.imagePropertiesToSpec(entity),
      ...EntityMapper.intPropertiesToSpec(entity),
      ...EntityMapper.longTextPropertiesToSpec(entity),
      ...EntityMapper.shortTextPropertiesToSpec(entity),
      ...EntityMapper.calculatedPropertiesToSpec(entity),
    ].sort((a, b) => a.order - b.order);

    return {
      id: entity.id,
      userId: entity.userId,
      type: entity.entityConfigId,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      properties,
      tags: entity.tags.map((tag) => tag.label),
      viewAccessPolicyId: entity.accessPolicy
        ? entity.accessPolicy.viewAccessPolicyId
        : 0,
      editAccessPolicyId: entity.accessPolicy
        ? entity.accessPolicy.editAccessPolicyId
        : 0,
      suggested: entity.suggested,
      published: entity.published,
      identified: entity.identified,
      allowComments: entity.allowComments,
    };
  }
}
