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

  static async getTagsFromDesc(
    userId: string,
    desc: string
  ): Promise<string[]> {
    const actionIds = (
      await prisma.action.findMany({ where: { userId, desc } })
    ).map((action) => action.id);
    return [
      ...new Set(
        (
          await prisma.actionTag.findMany({
            where: { actionId: { in: actionIds } },
          })
        ).map((actionTag) => actionTag.label)
      ),
    ];
  }
}

export const tagging = new Tagging();
