import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { jsonReply, prisma, userIdFromRequest } from "..";
import { Action, Prisma } from "@prisma/client";
import { Tagging } from "../lib/Tagging";
import {
  ListFilter,
  ListFilterTimeType,
  ListFilterType,
} from "../models/ListFilter";

const perPage = 25;

declare interface RequestBody {
  desc: string;
  type: string;
  occurredAt?: string;
  timeZone: string;
  tags: string[];
}

function getFilter(request: HttpRequest): ListFilter {
  if (request.query.has("filter")) {
    return JSON.parse(request.query.get("filter")) as ListFilter;
  }

  return {
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
}

function getFilteredConditions(userId: string, filter: ListFilter) {
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

  return Prisma.validator(
    prisma,
    "action",
    "findMany",
    "where"
  )({
    userId,
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
                              ...filter.tagging.containsOneOf.map((tag) => ({
                                tags: { some: { label: tag } },
                              })),
                            ],
                          }
                        : {}),
                    },
                    {
                      ...(filter.tagging.containsAllOf
                        ? {
                            AND: [
                              ...filter.tagging.containsAllOf.map((tag) => ({
                                tags: { some: { label: tag } },
                              })),
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
      const start = request.query.has("start")
        ? parseInt(request.query.get("start") || "")
        : 0;
      const userId = userIdFromRequest(request);
      const filter = getFilter(request);
      const where = getFilteredConditions(userId, filter);

      const actions = (
        await prisma.action.findMany({
          skip: start,
          take: perPage,
          where,
          orderBy: {
            occurredAt: "desc",
          },
          include: {
            tags: true,
          },
        })
      ).map((action) => ({
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
