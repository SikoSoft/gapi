import { v4 as uuidv4 } from "uuid";
import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply, prisma } from "..";
import {
  ListSortDirection,
  ListSortProperty,
  ListFilter,
  ListSort,
  ListFilterTimeType,
} from "api-spec/models/List";
import { ListConfig } from "../lib/ListConfig";

export interface CreateBody {
  id: string;
  name: string;
  userId: string;
}

export interface UpdateBody extends CreateBody {
  filter: ListFilter;
  sort: ListSort;
}

export async function listConfig(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) {
    return forbiddenReply();
  }
  const userId = introspection.user.id;

  switch (request.method) {
    case "GET":
      const listConfigs = await ListConfig.getByUser(userId);
      return jsonReply({ listConfigs });
    case "POST":
      const createBody = (await request.json()) as CreateBody;
      const id = uuidv4();
      await prisma.listConfig.create({
        data: {
          id,
          name: createBody.name,
          userId,
          filter: {
            create: {
              includeAll: true,
              includeUntagged: true,
              time: { create: { type: ListFilterTimeType.ALL_TIME } },
            },
          },
          sort: {
            create: {
              property: ListSortProperty.CREATED_AT,
              direction: ListSortDirection.DESC,
            },
          },
        },
      });
      return jsonReply({ id });
    case "PUT":
      const updateBody = (await request.json()) as UpdateBody;
      await ListConfig.update(userId, updateBody);
      return jsonReply({ id: updateBody.id });
    case "DELETE":
      const status = await ListConfig.delete(userId, request.params.id);
      if (status) {
        return {
          status: 204,
        };
      }
      return {
        status: 400,
      };
  }
}

app.http("listConfig", {
  methods: ["GET", "POST", "PUT", "DELETE"],
  authLevel: "anonymous",
  handler: listConfig,
  route: "listConfig/{id?}",
});
