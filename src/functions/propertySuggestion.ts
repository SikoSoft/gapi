import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply, prisma } from "..";
import { Entity } from "../lib/Entity";

export async function propertySuggestion(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) {
    return forbiddenReply();
  }

  const suggestionsRes = await Entity.getPropertySuggestions(
    introspection.user.id,
    request.params.propertyConfigId,
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

app.http("propertySuggestion", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: propertySuggestion,
  route: "propertySuggestion/{propertyConfigId}/{query?}",
});
