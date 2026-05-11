import { Result, err, ok } from "neverthrow";
import { prisma } from "..";
import { PushSubscriptionPayload } from "../models/PushSubscription";

export class PushSubscription {
  static async save(
    userId: string,
    payload: PushSubscriptionPayload
  ): Promise<Result<void, Error>> {
    try {
      await prisma.pushSubscription.upsert({
        where: { endpoint: payload.endpoint },
        create: {
          userId,
          endpoint: payload.endpoint,
          p256dh: payload.keys.p256dh,
          auth: payload.keys.auth,
        },
        update: {
          userId,
          p256dh: payload.keys.p256dh,
          auth: payload.keys.auth,
        },
      });
      return ok(undefined);
    } catch (error) {
      return err(
        new Error("Failed to save push subscription", { cause: error })
      );
    }
  }

  static async remove(
    userId: string,
    endpoint: string
  ): Promise<Result<void, Error>> {
    try {
      await prisma.pushSubscription.deleteMany({
        where: { userId, endpoint },
      });
      return ok(undefined);
    } catch (error) {
      return err(
        new Error("Failed to remove push subscription", { cause: error })
      );
    }
  }
}
