import { prisma } from "..";

export class Tagging {
  static async syncActionTags(actionId: number, tags: string[]) {
    await Tagging.saveTags(tags);
    await Tagging.saveActionTags(actionId, tags);
  }

  static async saveTags(tags: string[]) {
    await prisma.tag.createMany({ data: tags.map((tag) => ({ label: tag })) });
  }

  static async saveActionTags(actionId: number, tags: string[]) {
    await prisma.actionTag.createMany({
      data: tags.map((tag) => ({ label: tag, actionId })),
    });
  }
}

export const tagging = new Tagging();
