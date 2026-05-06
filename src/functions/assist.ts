import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect } from "..";
import { Assist } from "../lib/Assist";

export async function assist(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isSystem) {
    return forbiddenReply();
  }

  const result = await Assist.getListConfigSuggestions();

  if (result.isErr()) {
    context.error(result.error);
    return { status: 500 };
  }

  return { status: 204 };
}

app.http("assist", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: assist,
  route: "assist",
});
