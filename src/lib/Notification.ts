import webpush from "web-push";
import { Result, err, ok } from "neverthrow";
import { prisma } from "..";
import { NotificationMessage } from "../models/Notification";
import { Logger } from "./Logger";

export class Notification {
  static async send(
    message: NotificationMessage
  ): Promise<Result<void, Error>> {
    const subject = process.env.VAPID_SUBJECT;
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;

    if (!subject || !publicKey || !privateKey) {
      return err(new Error("Missing VAPID environment variables"));
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

    let subscriptions;
    try {
      subscriptions = await prisma.pushSubscription.findMany({
        where: { userId: message.userId },
      });
    } catch (error) {
      return err(
        new Error("Failed to fetch push subscriptions", { cause: error })
      );
    }

    Logger.log(`[Notification] found ${subscriptions.length} subscription(s) for userId=${message.userId}`);

    if (subscriptions.length === 0) {
      return ok(undefined);
    }

    const actionUrls = Object.fromEntries(
      message.actions.map(a => [a.action, a.url])
    );

    const payload = JSON.stringify({
      title: message.title,
      body: message.body,
      actions: message.actions.map(a => ({ action: a.action, title: a.title })),
      data: { actionUrls },
    });

    let sent = 0;
    let failed = 0;
    let expired = 0;

    for (const sub of subscriptions) {
      try {
        Logger.log(`[Notification] sending to endpoint: ${sub.endpoint}`);
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        Logger.log(`[Notification] sent successfully to ${sub.endpoint}`);
        sent++;
      } catch (error: any) {
        if (error?.statusCode === 410) {
          Logger.log(`[Notification] subscription expired (410), deleting: ${sub.endpoint}`);
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
          expired++;
        } else {
          Logger.error(`[Notification] failed to send to ${sub.endpoint}`, {
            statusCode: error?.statusCode,
            body: error?.body,
            message: error instanceof Error ? error.message : String(error),
          });
          failed++;
        }
      }
    }

    Logger.log(`[Notification] send summary: sent=${sent} failed=${failed} expired=${expired} total=${subscriptions.length}`);

    return ok(undefined);
  }
}
