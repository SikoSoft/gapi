import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, prisma } from "..";
import { Tagging } from "../lib/Tagging";

export async function tagSuggestion(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) {
    return forbiddenReply();
  }
  const userId = introspection.user.id;
  context.log(`Http function processed request for url "${request.url}"`);

  const suggestionsRes = await Tagging.getTagsFromActionDesc(
    userId,
    request.params.query
  );

  if (suggestionsRes.isErr()) {
    context.error(suggestionsRes.error);

    return {
      status: 500,
    };
  }

  const reply = {
    suggestions: suggestionsRes.value,
  };

  return { body: JSON.stringify(reply) };
}

app.http("tagSuggestion", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: tagSuggestion,
  route: "tagSuggestion/{query?}",
});
