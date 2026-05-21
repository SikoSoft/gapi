import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply } from "..";
import { Medal } from "../lib/Medal";

export async function medal(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) {
    return forbiddenReply();
  }

  const userId = introspection.user.id;

  switch (request.method) {
    case "GET": {
      const res = await Medal.getMedals(userId);
      if (res.isErr()) {
        context.error(res.error);
        return { status: 500 };
      }
      return jsonReply({ medals: res.value });
    }
  }
}

app.http("medal", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: medal,
  route: "medal",
});
