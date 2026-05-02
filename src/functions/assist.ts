import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect } from "..";
import { AssistSuggestion } from "../lib/AssistSuggestion";

export async function assist(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) {
    return forbiddenReply();
  }

  const authorizationHeader =
    request.headers.get("authorization") ?? undefined;

  const result =
    await AssistSuggestion.runForAllListConfigs(authorizationHeader);

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
