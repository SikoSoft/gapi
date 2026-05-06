import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply } from "..";
import { EntityBodyPayload } from "../models/Entity";
import { Entity } from "../lib/Entity";
import { Assist } from "../lib/Assist";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export async function suggestEntity(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isSystem) {
    return forbiddenReply();
  }

  const dateParam = request.params.date;
  const match = DATE_PATTERN.exec(dateParam);
  if (!match) {
    return {
      status: 400,
      body: JSON.stringify({ message: "date must be formatted as YYYY-MM-DD" }),
    };
  }

  const yyyy = parseInt(match[1]);
  const mm = parseInt(match[2]);
  const dd = parseInt(match[3]);

  const lockRes = await Assist.getSuggestionLock(yyyy, mm, dd);
  if (lockRes.isErr()) {
    context.error(lockRes.error);
    return { status: 500 };
  }

  if (lockRes.value) {
    return { status: 409 };
  }

  const body = (await request.json()) as EntityBodyPayload[];
  const entities = [];

  for (const payload of body) {
    const entityRes = await Entity.create("", { ...payload, suggestion: true });

    if (entityRes.isErr()) {
      context.error(entityRes.error);
      return { status: 500 };
    }

    entities.push(entityRes.value);
  }

  const setLockRes = await Assist.setSuggestionLock(yyyy, mm, dd);
  if (setLockRes.isErr()) {
    context.error(setLockRes.error);
    return { status: 500 };
  }

  return jsonReply({ entities });
}

app.http("suggestEntity", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: suggestEntity,
  route: "suggestEntity/{date}",
});
