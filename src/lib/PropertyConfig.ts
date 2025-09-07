import { prisma } from "..";
import { Entity } from "api-spec/models";
import { PrismaEntityConfig } from "../models/Entity";

export class PropertyConfig {
  static async delete(
    userId: string,
    propertyConfigId: number
  ): Promise<boolean> {
    const result = await prisma.propertyConfig.delete({
      where: { userId, id: propertyConfigId },
    });
    if (result) {
      return true;
    }
    return false;
  }
}
