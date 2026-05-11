import webpush from "web-push";
import { Result, err, ok } from "neverthrow";
import { prisma } from "..";
import { NotificationMessage } from "../models/Notification";

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

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
      } catch (error: any) {
        if (error?.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
        } else {
          console.error(`Failed to send push notification to ${sub.endpoint}`, error);
        }
      }
    }

    return ok(undefined);
  }
}
