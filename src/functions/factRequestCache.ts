import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply } from "..";
import { Fact } from "../lib/Fact";

export async function factRequestCache(
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
      const idParam = request.params.id;
      const id = parseInt(idParam, 10);
      if (isNaN(id)) {
        return { status: 400 };
      }

      const res = await Fact.invalidateForConfig(id, userId);
      if (res.isErr()) {
        if (res.error.message !== "Fact not found") {
          context.error(res.error);
        }
        return { status: res.error.message === "Fact not found" ? 404 : 500 };
      }

      return jsonReply({ invalidated: id });
    }

    default:
      return { status: 405 };
  }
}

app.http("factRequestCache", {
  methods: ["DELETE"],
  authLevel: "anonymous",
  handler: factRequestCache,
  route: "factRequestCache/{id}",
});
