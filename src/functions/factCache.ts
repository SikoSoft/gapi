import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply } from "..";
import { Fact } from "../lib/Fact";

export async function factCache(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) {
    return forbiddenReply();
  }

  const userId = introspection.user.id;

  switch (request.method) {
    case "DELETE": {
      const contextKey = request.params.contextKey;

      if (contextKey) {
        const res = await Fact.invalidate(contextKey, userId);
        if (res.isErr()) {
          context.error(res.error);
          return { status: 500 };
        }
        return jsonReply({ invalidated: contextKey });
      }

      const res = await Fact.invalidateUser(userId);
      if (res.isErr()) {
        context.error(res.error);
        return { status: 500 };
      }
      return jsonReply({ invalidated: "all" });
    }

    default:
      return { status: 405 };
  }
}

app.http("factCache", {
  methods: ["DELETE"],
  authLevel: "anonymous",
  handler: factCache,
  route: "factCache/{contextKey?}",
});
