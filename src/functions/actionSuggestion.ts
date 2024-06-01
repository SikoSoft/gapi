import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { prisma } from "..";

export async function actionSuggestion(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  const actions = await prisma.action.findMany({
    take: 10,
    where: { desc: { startsWith: request.params.query } },
    orderBy: { desc: "asc" },
  });
  const suggestions = [
    ...new Set(actions.map((row) => row.desc.toLowerCase().trim())),
  ];

  const reply = {
    suggestions,
  };

  return { body: JSON.stringify(reply) };
}

app.http("actionSuggestion", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: actionSuggestion,
  route: "actionSuggestion/{query?}",
});
