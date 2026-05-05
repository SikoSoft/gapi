import { Result, err, ok } from "neverthrow";
import { prisma } from "..";

export class Tagging {
  static async syncEntityTags(
    entityId: number,
    tags: string[]
  ): Promise<Result<null, Error>> {
    const deleteResult = await Tagging.deleteAllEntityTags(entityId);
    if (deleteResult.isErr()) {
      return err(deleteResult.error);
    }

    const saveResult = await Tagging.saveTags(tags);
    if (saveResult.isErr()) {
      return err(saveResult.error);
    }

    const addResult = await Tagging.addEntityTags(entityId, tags);
    if (addResult.isErr()) {
      return err(addResult.error);
    }

    return ok(null);
  }

  static async saveTags(tags: string[]): Promise<Result<null, Error>> {
    try {
      await prisma.tag.createMany({
        data: tags.map((tag) => ({ label: tag })),
        skipDuplicates: true,
      });
      return ok(null);
    } catch (error) {
      return err(error);
    }
  }

  static async deleteTags(tags: string[]): Promise<Result<null, Error>> {
    try {
      await prisma.tag.deleteMany({
        where: { label: { in: tags } },
      });
      return ok(null);
    } catch (error) {
      return err(error);
    }
  }

  static async deleteEntityTags(
    entityId: number,
    tags: string[]
  ): Promise<Result<null, Error>> {
    try {
      await prisma.entityTag.deleteMany({
        where: { entityId: entityId, label: { in: tags } },
      });
      return ok(null);
    } catch (error) {
      return err(error);
    }
  }

  static async addEntityTags(
    entityId: number,
    tags: string[]
  ): Promise<Result<null, Error>> {
    try {
      await prisma.entityTag.createMany({
        data: tags.map((tag) => ({ label: tag, entityId })),
        skipDuplicates: true,
      });
      return ok(null);
    } catch (error) {
      return err(error);
    }
  }

  static async deleteAllEntityTags(
    entityId: number
  ): Promise<Result<null, Error>> {
    try {
      await prisma.entityTag.deleteMany({ where: { entityId } });
      return ok(null);
    } catch (error) {
      return err(error);
    }
  }

  static async getTagsFromEntityDesc(
    userId: string,
    desc: string
  ): Promise<Result<string[], Error>> {
    try {
      const entityIds = (
        await prisma.entity.findMany({ where: { userId, desc } })
      ).map((entity) => entity.id);
      return ok([
        ...new Set(
          (
            await prisma.entityTag.findMany({
              where: { entityId: { in: entityIds } },
            })
          ).map((entityTag) => entityTag.label)
        ),
      ]);
    } catch (error) {
      return err(error);
    }
  }
}

export const tagging = new Tagging();
