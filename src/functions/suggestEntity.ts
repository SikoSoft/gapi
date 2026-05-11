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
import { NotificationQueue } from "../lib/NotificationQueue";

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

  const ignoreLock = request.query.get("ignoreLock") === "1";

  const yyyy = parseInt(match[1]);
  const mm = parseInt(match[2]);
  const dd = parseInt(match[3]);

  if (!ignoreLock) {
    const lockRes = await Assist.getSuggestionLock(yyyy, mm, dd);
    if (lockRes.isErr()) {
      context.error(lockRes.error);
      return { status: 500 };
    }

    if (lockRes.value) {
      return { status: 409 };
    }
  }

  const deleteRes = await Entity.deleteStaleSuggestions();
  if (deleteRes.isErr()) {
    context.error(deleteRes.error);
    return { status: 500 };
  }

  const body = (await request.json()) as EntityBodyPayload[];
  const entities = [];

  context.log(
    `[suggestEntity] received ${body.length} payload(s); userIds present: [${body.map(p => p.userId ?? "(none)").join(", ")}]`
  );

  for (const payload of body) {
    const entityRes = await Entity.create("", { ...payload, suggestion: true });

    if (entityRes.isErr()) {
      context.error(entityRes.error);
      return { status: 500 };
    }

    const entity = entityRes.value;
    entities.push(entity);

    if (payload.userId) {
      context.log(
        `[suggestEntity] entity ${entity.id} has userId=${payload.userId} — enqueuing push notification`
      );

      const textValuesRes = await Entity.getTextValues(entity.id);

      if (textValuesRes.isErr()) {
        context.error(textValuesRes.error);
        return { status: 500 };
      }

      const enqueueRes = await NotificationQueue.enqueue({
        userId: payload.userId,
        entityConfigId: entity.type,
        suggestionEntityId: entity.id,
        textValues: textValuesRes.value,
      });

      if (enqueueRes.isErr()) {
        context.error(enqueueRes.error);
        return { status: 500 };
      }
    } else {
      context.log(
        `[suggestEntity] entity ${entity.id} has no userId — skipping push notification`
      );
    }
  }

  console.log("SUGGESTED ENTITIES", JSON.stringify(body, null, 2));

  if (!ignoreLock) {
    const setLockRes = await Assist.setSuggestionLock(yyyy, mm, dd);
    if (setLockRes.isErr()) {
      context.error(setLockRes.error);
      return { status: 500 };
    }
  }

  return jsonReply({ entities });
}

app.http("suggestEntity", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: suggestEntity,
  route: "suggestEntity/{date}",
});
