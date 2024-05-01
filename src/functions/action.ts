import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { jsonReply, prisma } from "..";
import { Action } from "@prisma/client";

const perPage = 25;

declare interface RequestBody {
  desc: string;
  type: string;
  occurredAt?: string;
}

export async function action(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  let action: Action;
  switch (request.method) {
    case "POST":
      const body = (await request.json()) as RequestBody;
      if (request.params.id) {
        action = await prisma.action.update({
          data: {
            type: body.type,
            desc: body.desc,
            occurredAt: new Date(body.occurredAt),
          },
          where: { id: parseInt(request.params.id) },
        });
        return jsonReply({ action });
      }
      action = await prisma.action.create({
        data: {
          type: body.type,
          desc: body.desc,
        },
      });
      return jsonReply({ action });
    case "DELETE":
      action = await prisma.action.delete({
        where: { id: parseInt(request.params.id) },
      });
      return jsonReply({ action });
    case "GET":
      let start = 0;
      if (request.query.has("start")) {
        start = parseInt(request.query.get("start") || "");
      }
      const actions = await prisma.action.findMany({
        skip: start,
        take: perPage,
        orderBy: {
          occurredAt: "desc",
        },
      });
      const total = await prisma.action.count();
      return jsonReply({ actions, total });
  }
}

app.http("action", {
  methods: ["GET", "POST", "DELETE"],
  authLevel: "anonymous",
  handler: action,
  route: "action/{id?}",
});
