import { Result, err, ok } from "neverthrow";
import { Prisma } from "@prisma/client";
import {
  ListContext,
  ListContextType,
  ListContextUnit,
  ListFilter,
  ListFilterTimeType,
  ListSort,
  ListSortNativeProperty,
} from "api-spec/models/List";
import { prisma } from "..";
import { Tagging } from "./Tagging";
import {
  PrismaAction,
  ActionBodyPayload,
  ActionList,
  ActionListParams,
  ContextActions,
  ActionItem,
} from "../models/Action";
import { Util } from "./Util";

export class Action {
  static getFilteredConditions(userId: string, filter: ListFilter) {
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

  static async create(
    userId: string,
    data: ActionBodyPayload
  ): Promise<Result<ActionItem, Error>> {
    try {
      const action = await prisma.action.create({
        data: {
          desc: data.desc,
          userId,
        },
        include: {
          tags: true,
        },
      });
      Tagging.syncActionTags(action.id, data.tags);
      return ok(Action.toSpec(action));
    } catch (error) {
      return err(error);
    }
  }

  static async update(
    userId: string,
    id: number,
    data: ActionBodyPayload
  ): Promise<Result<ActionItem, Error>> {
    const occurredAt = Util.getDateInTimeZone(
      data.occurredAt,
      parseInt(data.timeZone)
    );
    try {
      const action = await prisma.action.update({
        data: {
          desc: data.desc,
          occurredAt,
        },
        where: {
          id,
          userId,
        },
        include: {
          tags: true,
        },
      });
      Tagging.syncActionTags(action.id, data.tags);
      return ok(Action.toSpec(action));
    } catch (error) {
      return err(error);
    }
  }

  static toSpec(action: PrismaAction): ActionItem {
    return {
      ...action,
      tags: action.tags.map((tag) => tag.label),
    };
  }

  static async getList({
    userId,
    filter,
    context,
    sort,
    start,
    perPage,
  }: ActionListParams): Promise<Result<ActionList, Error>> {
    const sortProperty = sort.property as ListSortNativeProperty;

    const where = Action.getFilteredConditions(userId, filter);

    let actions: ActionItem[];

    try {
      actions = (
        await prisma.action.findMany({
          skip: start,
          take: perPage,
          where,
          orderBy: {
            [sortProperty]: sort.direction,
          },
          include: {
            tags: true,
          },
        })
      ).map((action) => Action.toSpec(action));

      const contextActionsRes = await Action.getContextActions(
        context,
        actions,
        sort
      );

      if (contextActionsRes.isErr()) {
        return err(contextActionsRes.error);
      }

      const total = await prisma.action.count({ where });

      return ok({
        actions,
        context: contextActionsRes.value,
        total,
      });
    } catch (error) {
      return err(error);
    }
  }

  static async delete(
    userId: string,
    id: number
  ): Promise<Result<ActionItem, Error>> {
    try {
      const action = await prisma.action.delete({
        where: {
          userId,
          id,
        },
        include: {
          tags: true,
        },
      });
      return ok(Action.toSpec(action));
    } catch (error) {
      return err(error);
    }
  }

  static async getContextActions(
    listContext: ListContext,
    actions: ActionItem[],
    sort: ListSort
  ): Promise<Result<ContextActions, Error>> {
    const sortProperty = sort.property as ListSortNativeProperty;

    let contextActions: ContextActions = {};

    if (listContext) {
      for (let i = 0; i < actions.length; i++) {
        let startTime: Date, endTime: Date;
        if (listContext.type === ListContextType.BEFORE) {
          endTime = new Date(actions[i].occurredAt.getTime() - 1);
          startTime = new Date(
            endTime.getTime() -
              Action.secondsFromQuantityUnits(
                listContext.quantity,
                listContext.unit
              )
          );
        } else if (listContext.type === ListContextType.AFTER) {
          startTime = new Date(actions[i].occurredAt.getTime() + 1);
          endTime = new Date(
            startTime.getTime() +
              Action.secondsFromQuantityUnits(
                listContext.quantity,
                listContext.unit
              )
          );
        }

        try {
          const actionContext = await prisma.action.findMany({
            where: {
              AND: [
                { occurredAt: { gte: startTime } },
                { occurredAt: { lte: endTime } },
              ],
            },
            orderBy: {
              [sortProperty]: sort.direction,
            },
            include: {
              tags: true,
            },
          });

          contextActions[actions[i].id] = actionContext;
        } catch (error) {
          return err(error);
        }
      }
    }

    return ok(contextActions);
  }

  static secondsFromQuantityUnits(
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

  static async getSuggestions(
    userId: string,
    desc: string
  ): Promise<Result<string[], Error>> {
    try {
      const actions = await prisma.action.findMany({
        distinct: ["desc"],
        take: 10,
        where: {
          desc: { startsWith: desc, mode: "insensitive" },
          userId,
        },
        orderBy: { desc: "asc" },
      });
      const suggestions = [
        ...new Set(actions.map((row) => row.desc.toLowerCase().trim())),
      ];
      return ok(suggestions);
    } catch (error) {
      return err(error);
    }
  }
}
