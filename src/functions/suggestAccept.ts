import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { jsonReply } from "..";
import { Entity } from "../lib/Entity";
import { IdentityManager } from "../lib/IdentityManager";
import { OneTimeTokenScope, SuggestAcceptQuery } from "../models/Identity";

export async function suggestAccept(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  const { token } = Object.fromEntries(
    request.query.entries()
  ) as unknown as SuggestAcceptQuery;

  const ottRes = await IdentityManager.verifyOtt(
    token,
    OneTimeTokenScope.suggestionAccept
  );
  if (ottRes.isErr()) {
    context.error(ottRes.error);
    return { status: 500 };
  }
  if (!ottRes.value || ottRes.value.entityId === null) {
    return jsonReply({ success: false }, 403);
  }

  const acceptRes = await Entity.acceptSuggestion(ottRes.value.entityId);
  if (acceptRes.isErr()) {
    context.error(acceptRes.error);
    return { status: 500 };
  }

  return jsonReply({ success: true });
}

app.http("suggestAccept", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: suggestAccept,
  route: "suggestAccept",
});
