import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { getIp, introspect, jsonReply } from "..";
import { Comment } from "../lib/Comment";
import { commentReactionSchema, ReactionIdentity } from "../models/Comment";

export async function commentReaction(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (!request.params.id) {
    return { status: 400 };
  }

  const commentId = parseInt(request.params.id, 10);
  const introspection = await introspect(request);
  const identity: ReactionIdentity = introspection.isLoggedIn
    ? { userId: introspection.user.id }
    : { ip: getIp(request) };

  switch (request.method) {
    case "POST": {
      const body = await request.json();
      const parseResult = commentReactionSchema.safeParse(body);
      if (!parseResult.success) {
        return { status: 400, body: JSON.stringify(parseResult.error.issues) };
      }

      const reactRes = await Comment.react(
        commentId,
        identity,
        parseResult.data.type
      );

      if (reactRes.isErr()) {
        context.error(reactRes.error);
        return { status: 500 };
      }

      return jsonReply({
        likeCount: reactRes.value.like,
        dislikeCount: reactRes.value.dislike,
      });
    }
    case "DELETE": {
      const removeRes = await Comment.removeReaction(commentId, identity);

      if (removeRes.isErr()) {
        context.error(removeRes.error);
        return { status: 500 };
      }

      return jsonReply({
        likeCount: removeRes.value.like,
        dislikeCount: removeRes.value.dislike,
      });
    }
  }
}

app.http("commentReaction", {
  methods: ["POST", "DELETE"],
  authLevel: "anonymous",
  handler: commentReaction,
  route: "commentReaction/{id}",
});
