import { ok, Result } from "neverthrow";
import { prisma } from "..";

export class Data {
  static async reset(): Promise<Result<null, Error>> {
    try {
      await prisma.$executeRaw`TRUNCATE TABLE "ListConfig" CASCADE`;
      return ok(null);
    } catch (err) {
      return err(new Error("Failed to reset data"));
    }
  }
}
