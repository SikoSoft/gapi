import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { jsonReply, prisma, userIdFromRequest } from "..";
import { Action, Prisma } from "@prisma/client";
import { Tagging } from "../lib/Tagging";
import { v4 as uuidv4 } from "uuid";
import {
  ListFilter,
  ListFilterTimeType,
  ListFilterType,
} from "../models/ListFilter";

const perPage = 25;

const oneOfIsTags = ["food"];

declare interface RequestBody {
  desc: string;
  type: string;
  occurredAt?: string;
  timeZone: string;
  tags: string[];
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
        const timeZone = parseInt(body.timeZone);
        const serverTimeZone = new Date().getTimezoneOffset();
        const timeZoneDiff = serverTimeZone - timeZone;
        const occurredAt = new Date(
          new Date(body.occurredAt).getTime() - timeZoneDiff * 60000
        );
        context.log(
          `ID: ${request.params.id} ::: BODY occurredAt: (${body.occurredAt}) | occurredAt: (${occurredAt}) | timeZone: (${timeZone}) | serverTimeZone: (${serverTimeZone}) | timeZoneDiff: (${timeZoneDiff})`
        );
        action = await prisma.action.update({
          data: {
            type: body.type,
            desc: body.desc,
            occurredAt,
          },
          where: {
            id: parseInt(request.params.id),
            userId: userIdFromRequest(request),
          },
        });
        Tagging.syncActionTags(action.id, body.tags);
        return jsonReply({ action });
      }
      action = await prisma.action.create({
        data: {
          type: body.type,
          desc: body.desc,
          userId: userIdFromRequest(request),
        },
      });
      Tagging.syncActionTags(action.id, body.tags);
      return jsonReply({ action });
    case "DELETE":
      action = await prisma.action.delete({
        where: {
          id: parseInt(request.params.id),
          userId: userIdFromRequest(request),
        },
      });
      return jsonReply({ action });
    case "GET":
      let start = 0;
      if (request.query.has("start")) {
        start = parseInt(request.query.get("start") || "");
      }
      let filter: ListFilter = {
        tagging: {
          [ListFilterType.CONTAINS_ONE_OF]: [],
          [ListFilterType.CONTAINS_ALL_OF]: [],
        },
        time: {
          type: ListFilterTimeType.ALL_TIME,
        },
        includeUntagged: true,
        includeAll: true,
      };
      if (request.query.has("filter")) {
        filter = JSON.parse(request.query.get("filter")) as ListFilter;
      }
      console.log("###########", filter);
      let startTime: Date;
      let endTime: Date;
      if (filter.time.type === ListFilterTimeType.EXACT_DATE) {
        startTime = new Date(filter.time.date);
        endTime = new Date(startTime.getTime() + 86400000);
      }
      if (filter.time.type === ListFilterTimeType.RANGE) {
        startTime = new Date(filter.time.start);
        endTime = new Date(new Date(filter.time.end).getTime() + 86400000);
      }

      const where = Prisma.validator(
        prisma,
        "action",
        "findMany",
        "where"
      )({
        userId: userIdFromRequest(request),
        ...(!filter.includeAll
          ? {
              AND: [
                {
                  ...(filter.time.type === ListFilterTimeType.ALL_TIME
                    ? { occurredAt: { lte: new Date() } }
                    : {
                        AND: [
                          { occurredAt: { gte: startTime } },
                          { occurredAt: { lte: endTime } },
                        ],
                      }),
                },
                {
                  OR: [
                    {
                      ...(filter.includeUntagged ? { tags: { none: {} } } : {}),
                    },
                    {
                      AND: [
                        {
                          ...(filter.tagging.containsOneOf.length
                            ? {
                                OR: [
                                  ...filter.tagging.containsOneOf.map(
                                    (tag) => ({
                                      tags: { some: { label: tag } },
                                    })
                                  ),
                                ],
                              }
                            : {}),
                        },
                        {
                          ...(filter.tagging.containsAllOf
                            ? {
                                AND: [
                                  ...filter.tagging.containsAllOf.map(
                                    (tag) => ({
                                      tags: { some: { label: tag } },
                                    })
                                  ),
                                ],
                              }
                            : {}),
                        },
                      ],
                    },
                  ],
                },
              ],
            }
          : {}),
      });
      const rawActions = await prisma.action.findMany({
        skip: start,
        take: perPage,
        where,
        orderBy: {
          occurredAt: "desc",
        },
        include: {
          tags: true,
        },
      });
      const actions = rawActions.map((action) => ({
        ...action,
        tags: action.tags.map((tag) => tag.label),
      }));
      const total = await prisma.action.count({ where });
      return jsonReply({
        time: new Date().toISOString(),
        actions,
        total,
      });
  }
}

app.http("action", {
  methods: ["GET", "POST", "DELETE"],
  authLevel: "anonymous",
  handler: action,
  route: "action/{id?}",
});
