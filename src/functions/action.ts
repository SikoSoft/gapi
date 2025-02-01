import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import {
  forbiddenReply,
  getDefaultFilter,
  getDefaultSort,
  introspect,
  jsonReply,
  prisma,
  userIdFromRequest,
} from "..";
import { Action, Prisma } from "@prisma/client";
import { Tagging } from "../lib/Tagging";
import {
  ListFilter,
  ListFilterTimeType,
  ListFilterType,
  ListSortProperty,
  ListSortDirection,
  ListSort,
  ListContext,
  ListContextType,
  ListContextUnit,
} from "api-spec/models/List";

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

  return getDefaultFilter();
}

function getSort(request: HttpRequest): ListSort {
  if (request.query.has("sort")) {
    return JSON.parse(request.query.get("sort")) as ListSort;
  }

  return getDefaultSort();
}

function getContext(request: HttpRequest): ListContext | null {
  if (request.query.has("context")) {
    return JSON.parse(request.query.get("context")) as ListContext;
  }

  return null;
}

function secondsFromQuantityUnits(
  quantity: number,
  unit: ListContextUnit
): number {
  switch (unit) {
    case ListContextUnit.MINUTE:
      return quantity * 60000;
    case ListContextUnit.HOUR:
      return quantity * 3600000;
    case ListContextUnit.DAY:
      return quantity * 86400000;
  }
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
              ...(filter.text.length === 0
                ? { desc: { not: "" } }
                : {
                    AND: filter.text.map((textFilter) => ({
                      desc: {
                        [textFilter.type]: textFilter.subStr,
                        mode: "insensitive",
                      },
                    })),
                  }),
            },
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
              ...(filter.includeAllTagging
                ? {}
                : {
                    OR: [
                      {
                        ...(filter.includeUntagged
                          ? { tags: { none: {} } }
                          : {}),
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
                  }),
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
  const introspection = await introspect(request);
  console.log({ introspection });
  if (!introspection.isLoggedIn) {
    return forbiddenReply();
  }

  const userId = introspection.user.id;

  let action: Action;
  switch (request.method) {
    case "POST":
      const body = (await request.json()) as RequestBody;
      const tags = [...body.tags];
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
            userId,
          },
        });
        Tagging.syncActionTags(action.id, tags);
        return jsonReply({ action });
      }
      action = await prisma.action.create({
        data: {
          type: body.type,
          desc: body.desc,
          userId,
        },
      });
      Tagging.syncActionTags(action.id, tags);
      return jsonReply({ action });
    case "DELETE":
      action = await prisma.action.delete({
        where: {
          id: parseInt(request.params.id),
          userId,
        },
      });
      return jsonReply({ action });
    case "GET":
      const start = request.query.has("start")
        ? parseInt(request.query.get("start") || "")
        : 0;
      const filter = getFilter(request);
      const sort = getSort(request);
      const where = getFilteredConditions(userId, filter);

      const actions = (
        await prisma.action.findMany({
          skip: start,
          take: perPage,
          where,
          orderBy: {
            [sort.property]: sort.direction,
          },
          include: {
            tags: true,
          },
        })
      ).map((action) => ({
        ...action,
        tags: action.tags.map((tag) => tag.label),
      }));

      const listContext = getContext(request);
      context.log(`The context is ${JSON.stringify(listContext)}`);

      let contextActions: Record<number, Action[]> = {};

      if (listContext) {
        for (let i = 0; i < actions.length; i++) {
          let startTime: Date, endTime: Date;
          if (listContext.type === ListContextType.BEFORE) {
            endTime = new Date(actions[i].occurredAt.getTime() - 1);
            startTime = new Date(
              endTime.getTime() -
                secondsFromQuantityUnits(listContext.quantity, listContext.unit)
            );
          } else if (listContext.type === ListContextType.AFTER) {
            startTime = new Date(actions[i].occurredAt.getTime() + 1);
            endTime = new Date(
              startTime.getTime() +
                secondsFromQuantityUnits(listContext.quantity, listContext.unit)
            );
          }
          const actionContext = await prisma.action.findMany({
            where: {
              AND: [
                { occurredAt: { gte: startTime } },
                { occurredAt: { lte: endTime } },
              ],
            },
            orderBy: {
              [sort.property]: sort.direction,
            },
            include: {
              tags: true,
            },
          });

          contextActions[actions[i].id] = actionContext;
        }
      }

      const total = await prisma.action.count({ where });
      return jsonReply({
        time: new Date().toISOString(),
        actions,
        context: contextActions,
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
