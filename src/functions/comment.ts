import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { introspect, jsonReply } from "..";
import { Comment } from "../lib/Comment";
import {
  CommentCreateBodySchema,
  CommentUpdateBodySchema,
} from "../models/Comment";
import { AccessError } from "../errors/AccessError";
import { ValidationError } from "../errors/ValidationError";

export async function comment(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  const userId = introspection.isLoggedIn ? introspection.user.id : null;

  switch (request.method) {
    case "GET": {
      const entityId = parseInt(request.query.get("entityId") || "");
      if (!entityId) {
        return { status: 400 };
      }

      const result = await Comment.getForEntity(entityId, userId);
      if (result.isErr()) {
        context.error(result.error);
        return { status: 500 };
      }

      return jsonReply({ comments: result.value });
    }

    case "POST": {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return { status: 400 };
      }

      const parsed = CommentCreateBodySchema.safeParse(body);
      if (!parsed.success) {
        return { status: 400, body: JSON.stringify(parsed.error.issues) };
      }

      const result = await Comment.create(userId, parsed.data);
      if (result.isErr()) {
        context.error(result.error);
        if (result.error instanceof ValidationError) {
          return { status: 400 };
        }
        return { status: 500 };
      }

      return jsonReply(result.value);
    }

    case "PATCH": {
      if (!introspection.isLoggedIn) {
        return { status: 403 };
      }
      const id = parseInt(request.params.id || "");
      if (!id) {
        return { status: 400 };
      }

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return { status: 400 };
      }

      const parsed = CommentUpdateBodySchema.safeParse(body);
      if (!parsed.success) {
        return { status: 400, body: JSON.stringify(parsed.error.issues) };
      }

      const result = await Comment.setPublished(
        userId,
        id,
        parsed.data.published
      );
      if (result.isErr()) {
        context.error(result.error);
        if (result.error instanceof AccessError) {
          return { status: 403 };
        }
        if (result.error instanceof ValidationError) {
          return { status: 400 };
        }
        return { status: 500 };
      }

      return jsonReply(result.value);
    }

    case "DELETE": {
      if (!introspection.isLoggedIn) {
        return { status: 403 };
      }
      const id = parseInt(request.params.id || "");
      if (!id) {
        return { status: 400 };
      }

      const result = await Comment.delete(userId, id);
      if (result.isErr()) {
        context.error(result.error);
        if (result.error instanceof AccessError) {
          return { status: 403 };
        }
        if (result.error instanceof ValidationError) {
          return { status: 400 };
        }
        return { status: 500 };
      }

      return { status: 204 };
    }
  }

  return { status: 405 };
}

app.http("comment", {
  methods: ["GET", "POST", "PATCH", "DELETE"],
  authLevel: "anonymous",
  handler: comment,
  route: "comment/{id?}",
});
