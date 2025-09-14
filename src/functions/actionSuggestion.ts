import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply, prisma } from "..";
import { Action } from "../lib/Action";

export async function actionSuggestion(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) {
    return forbiddenReply();
  }

  const suggestionsRes = await Action.getSuggestions(
    introspection.user.id,
    request.params.query
  );

  if (suggestionsRes.isErr()) {
    context.error(suggestionsRes.error);

    return {
      status: 500,
    };
  }

  return jsonReply({
    suggestions: suggestionsRes.value,
  });
}

app.http("actionSuggestion", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: actionSuggestion,
  route: "actionSuggestion/{query?}",
});
