import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { SettingName } from "api-spec/models/Setting";
import { forbiddenReply, introspect, jsonReply } from "..";
import { Setting } from "../lib/Setting";
import { Streak } from "../lib/Streak";

export async function streakRequestCache(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) {
    return forbiddenReply();
  }

  const userId = introspection.user.id;

  switch (request.method) {
    case "DELETE": {
      const idParam = request.params.id;
      const id = parseInt(idParam, 10);
      if (isNaN(id)) {
        return { status: 400 };
      }

      const settingsRes = await Setting.getForUser(userId);
      const utcOffsetMinutes = settingsRes.isOk()
        ? (settingsRes.value[SettingName.TIMEZONE] as number) ?? 0
        : 0;

      const res = await Streak.invalidateForConfig(id, userId, utcOffsetMinutes);
      if (res.isErr()) {
        if (res.error.message !== "Streak not found") {
          context.error(res.error);
        }
        return { status: res.error.message === "Streak not found" ? 404 : 500 };
      }

      return jsonReply({ invalidated: id });
    }

    default:
      return { status: 405 };
  }
}

app.http("streakRequestCache", {
  methods: ["DELETE"],
  authLevel: "anonymous",
  handler: streakRequestCache,
  route: "streakRequestCache/{id}",
});
