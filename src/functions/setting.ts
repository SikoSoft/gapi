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

  const settingBody = (await request.json()) as SettingSpec;
  console.log("settingBody", settingBody);

  const result = await Setting.update(request.params.listConfigId, settingBody);

  if (result.isErr()) {
    return {
      status: 400,
    };
  }

  return {
    status: 204,
  };
}

app.http("setting", {
  methods: ["PUT"],
  authLevel: "anonymous",
  handler: setting,
  route: "setting/{listConfigId}",
});
