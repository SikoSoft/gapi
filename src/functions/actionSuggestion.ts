import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, prisma } from "..";

export async function actionSuggestion(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) {
    return forbiddenReply();
  }

  const userId = introspection.user.id;

  console.log("query", request.params.query);
  const actions = await prisma.action.findMany({
    distinct: ["desc"],
    take: 10,
    where: {
      desc: { startsWith: request.params.query, mode: "insensitive" },
      userId,
    },
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
