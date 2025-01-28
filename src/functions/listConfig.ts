import { v4 as uuidv4 } from "uuid";
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
} from "..";
import {
  ListConfig,
  ListSortDirection,
  ListSortProperty,
} from "api-spec/models/List";

const defaultListConfig: ListConfig = {
  name: "Example config",
  id: "test-id",
  filter: getDefaultFilter(),
  sort: getDefaultSort(),
};

export interface RequestBody {
  id: string;
  name: string;
  userId: string;
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

  const body = (await request.json()) as RequestBody;

  switch (request.method) {
    case "GET":
      return jsonReply({ listConfigs: [defaultListConfig] });
    case "POST":
      let status = false;
      const id = uuidv4();
      await prisma.listConfig.create({
        data: {
          id,
          name: body.name,
          userId,
          filter: {
            create: { includeAll: true, includeUntagged: true },
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
      await prisma.listConfig.update({
        data: { id: body.id, name: body.name },
        where: {
          id: body.id,
          userId,
        },
      });
      return jsonReply({ id: body.id });
  }
}

app.http("listConfig", {
  methods: ["GET", "POST", "PUT", "DELETE"],
  authLevel: "anonymous",
  handler: listConfig,
  route: "listConfig/{id?}",
});
