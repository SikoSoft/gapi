import { Result, err, ok } from "neverthrow";
import { NotificationMessage } from "../models/Notification";

export class Notification {
  static async send(message: NotificationMessage): Promise<Result<void, Error>> {
    try {
      const baseUrl = process.env.NTFY_BASE_URL;
      if (!baseUrl) {
        return err(new Error("Missing NTFY_BASE_URL environment variable"));
      }

      const url = new URL(message.topic, baseUrl);

      const headers: Record<string, string> = {
        "Content-Type": "text/plain",
      };

      if (message.actions.length > 0) {
        headers["X-Actions"] = message.actions
          .map((a) => `${a.action}, ${a.label}, ${a.url}`)
          .join("; ");
      }

      const response = await fetch(url.toString(), {
        method: "POST",
        headers,
        body: message.message,
      });

      if (!response.ok) {
        return err(new Error(`Ntfy request failed with status ${response.status}`));
      }

      return ok(undefined);
    } catch (error) {
      return err(new Error("Failed to send notification", { cause: error }));
    }
  }
}
