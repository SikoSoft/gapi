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

  Setting.update(request.params.listConfigId, settingBody);

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
