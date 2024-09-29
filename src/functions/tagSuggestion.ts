import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { prisma } from "..";
import { Tagging } from "../lib/Tagging";

export async function tagSuggestion(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  console.log("query", request.params.query);
  const suggestions = await Tagging.getTagsFromDesc(request.params.query);

  const reply = {
    suggestions,
  };

  return { body: JSON.stringify(reply) };
}

app.http("tagSuggestion", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: tagSuggestion,
  route: "tagSuggestion/{query?}",
});
