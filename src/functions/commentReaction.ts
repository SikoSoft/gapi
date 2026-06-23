import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { getIp, introspect, jsonReply } from "..";
import { Comment } from "../lib/Comment";
import { CommentReactionBodySchema } from "../models/Comment";
import { ValidationError } from "../errors/ValidationError";

export async function commentReaction(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  const userId = introspection.isLoggedIn ? introspection.user.id : null;
  const ip = userId ? null : getIp(request);

  const id = parseInt(request.params.id || "");
  if (!id) {
    return { status: 400 };
  }

  switch (request.method) {
    case "POST": {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return { status: 400 };
      }

      const parsed = CommentReactionBodySchema.safeParse(body);
      if (!parsed.success) {
        return { status: 400, body: JSON.stringify(parsed.error.issues) };
      }

      const result = await Comment.react(userId, ip, id, parsed.data.type);
      if (result.isErr()) {
        context.error(result.error);
        if (result.error instanceof ValidationError) {
          return { status: 400 };
        }
        return { status: 500 };
      }

      return jsonReply({ counts: result.value });
    }

    case "DELETE": {
      const result = await Comment.removeReaction(userId, ip, id);
      if (result.isErr()) {
        context.error(result.error);
        if (result.error instanceof ValidationError) {
          return { status: 400 };
        }
        return { status: 500 };
      }

      return jsonReply({ counts: result.value });
    }
  }

  return { status: 405 };
}

app.http("commentReaction", {
  methods: ["POST", "DELETE"],
  authLevel: "anonymous",
  handler: commentReaction,
  route: "commentReaction/{id}",
});
