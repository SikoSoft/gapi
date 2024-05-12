import { prisma } from "..";

export class Tagging {
  static async syncActionTags(actionId: number, tags: string[]): Promise<void> {
    await Tagging.deleteActionTags(actionId);
    await Tagging.saveTags(tags);
    await Tagging.saveActionTags(actionId, tags);
  }

  static async saveTags(tags: string[]): Promise<void> {
    await prisma.tag.createMany({
      data: tags.map((tag) => ({ label: tag })),
      skipDuplicates: true,
    });
  }

  static async saveActionTags(actionId: number, tags: string[]): Promise<void> {
    console.log(
      "saveActionTags",
      tags.map((tag) => ({ label: tag, actionId }))
    );
    await prisma.actionTag.createMany({
      data: tags.map((tag) => ({ label: tag, actionId })),
      skipDuplicates: true,
    });
  }

  static async deleteActionTags(actionId: number): Promise<void> {
    await prisma.actionTag.deleteMany({ where: { actionId } });
  }
}

export const tagging = new Tagging();
