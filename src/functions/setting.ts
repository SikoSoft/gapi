import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply } from "..";
import { Setting } from "../lib/Setting";
import { Setting as SettingSpec } from "api-spec/models/Setting";

export async function setting(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) {
    return forbiddenReply();
  }

  switch (request.method) {
    case "GET": {
      const [userResult, systemResult] = await Promise.all([
        Setting.getForUser(introspection.user.id),
        Setting.getForSystem(),
      ]);

      if (userResult.isErr()) {
        context.error(userResult.error);
        return { status: 500 };
      }

      if (systemResult.isErr()) {
        context.error(systemResult.error);
        return { status: 500 };
      }

      return jsonReply({ user: userResult.value, system: systemResult.value });
    }

    case "PUT": {
      const isSystem = request.query.get("isSystem") === "true";

      if (isSystem && !introspection.user.roles.includes("admin")) {
        return forbiddenReply();
      }

      const settingBody = (await request.json()) as SettingSpec;
      context.log("settingBody", settingBody);

      const result = await Setting.update(
        introspection.user.id,
        request.params.listConfigId,
        settingBody,
        isSystem
      );

      if (result.isErr()) {
        context.error(result.error);
        return { status: 400 };
      }

      return { status: 204 };
    }
  }
}

app.http("setting", {
  methods: ["GET", "PUT"],
  authLevel: "anonymous",
  handler: setting,
  route: "setting/{listConfigId?}",
});
