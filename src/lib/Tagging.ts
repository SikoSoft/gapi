import { prisma } from "..";

export class Tagging {
  static async syncActionTags(actionId: number, tags: string[]): Promise<void> {
    await Tagging.deleteAllActionTags(actionId);
    await Tagging.saveTags(tags);
    await Tagging.addActionTags(actionId, tags);
  }

  static async saveTags(tags: string[]): Promise<void> {
    await prisma.tag.createMany({
      data: tags.map((tag) => ({ label: tag })),
      skipDuplicates: true,
    });
  }

  static async deleteTags(tags: string[]): Promise<void> {
    await prisma.tag.deleteMany({
      where: { label: { in: tags } },
    });
  }

  static async deleteActionTags(
    actionId: number,
    tags: string[]
  ): Promise<void> {
    await prisma.actionTag.deleteMany({
      where: { actionId: actionId, label: { in: tags } },
    });
  }

  static async addActionTags(actionId: number, tags: string[]): Promise<void> {
    console.log(
      "saveActionTags",
      tags.map((tag) => ({ label: tag, actionId }))
    );
    await prisma.actionTag.createMany({
      data: tags.map((tag) => ({ label: tag, actionId })),
      skipDuplicates: true,
    });
  }

  static async deleteAllActionTags(actionId: number): Promise<void> {
    await prisma.actionTag.deleteMany({ where: { actionId } });
  }

  static async replaceActionTags(actionId: number, tags: string[]) {
    Tagging.deleteAllActionTags(actionId);
  }
}

export const tagging = new Tagging();
