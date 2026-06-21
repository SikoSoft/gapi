import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply } from "..";
import { Comment } from "../lib/Comment";
import { commentCreateSchema, commentUpdateSchema } from "../models/Comment";
import { ErrorCode } from "../models/Error";

export async function comment(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  const userId = introspection.isLoggedIn ? introspection.user.id : undefined;

  switch (request.method) {
    case "POST": {
      const body = await request.json();
      const parseResult = commentCreateSchema.safeParse(body);
      if (!parseResult.success) {
        return { status: 400, body: JSON.stringify(parseResult.error.issues) };
      }

      const createRes = await Comment.create(
        parseResult.data.entityId,
        parseResult.data.body,
        { userId, guestName: parseResult.data.guestName }
      );

      if (createRes.isErr()) {
        context.error(createRes.error);
        if (createRes.error.name === ErrorCode.AccessError) {
          return forbiddenReply();
        }
        if (createRes.error.name === ErrorCode.ValidationError) {
          return {
            status: 400,
            body: JSON.stringify({ message: createRes.error.message }),
          };
        }
        return { status: 500 };
      }

      return jsonReply({ ...createRes.value }, 201);
    }
    case "GET": {
      const idParam = request.params.id;
      if (idParam) {
        const getRes = await Comment.getById(parseInt(idParam, 10));
        if (getRes.isErr()) {
          return { status: 404 };
        }
        return jsonReply({ ...getRes.value });
      }

      if (!request.query.has("entityId")) {
        return { status: 400 };
      }

      const entityId = parseInt(request.query.get("entityId")!, 10);
      const listRes = await Comment.getListForEntity(entityId, userId);

      if (listRes.isErr()) {
        context.error(listRes.error);
        if (listRes.error.name === ErrorCode.ValidationError) {
          return { status: 404 };
        }
        return { status: 500 };
      }

      return jsonReply({ comments: listRes.value });
    }
    case "PATCH": {
      if (!userId || !request.params.id) {
        return forbiddenReply();
      }

      const body = await request.json();
      const parseResult = commentUpdateSchema.safeParse(body);
      if (!parseResult.success) {
        return { status: 400, body: JSON.stringify(parseResult.error.issues) };
      }

      const updateRes = await Comment.setPublished(
        userId,
        parseInt(request.params.id, 10),
        parseResult.data.published
      );

      if (updateRes.isErr()) {
        context.error(updateRes.error);
        if (updateRes.error.name === ErrorCode.AccessError) {
          return forbiddenReply();
        }
        return { status: 500 };
      }

      return jsonReply({ ...updateRes.value });
    }
    case "DELETE": {
      if (!request.params.id) {
        return { status: 400 };
      }

      const deleteRes = await Comment.delete(
        userId,
        parseInt(request.params.id, 10)
      );

      if (deleteRes.isErr()) {
        context.error(deleteRes.error);
        if (deleteRes.error.name === ErrorCode.AccessError) {
          return forbiddenReply();
        }
        return { status: 500 };
      }

      return { status: 204 };
    }
  }
}

app.http("comment", {
  methods: ["GET", "POST", "PATCH", "DELETE"],
  authLevel: "anonymous",
  handler: comment,
  route: "comment/{id?}",
});
