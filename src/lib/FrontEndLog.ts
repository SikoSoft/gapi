import { err, ok, Result } from "neverthrow";
import { prisma } from "..";
import { FrontEndLogPayload } from "../models/FrontEndLog";

export class FrontEndLog {
  static async create(
    payload: FrontEndLogPayload,
  ): Promise<Result<{ id: string }, Error>> {
    try {
      const record = await prisma.frontEndLog.create({
        data: {
          type: payload.type,
          message: payload.message,
          stack: payload.stack,
          source: payload.source,
          lineno: payload.lineno,
          colno: payload.colno,
          url: payload.url,
          userAgent: payload.userAgent,
          timestamp: new Date(payload.timestamp),
        },
      });
      return ok({ id: record.id });
    } catch (error) {
      return err(error as Error);
    }
  }
}
