import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import {
  forbiddenReply,
  getContext,
  getPerPage,
  getStart,
  introspect,
  jsonReply,
} from "..";
import { ListConfig } from "../lib/ListConfig";
import { Entity } from "../lib/Entity";

export async function list(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  let userId: string | null = null;
  if (introspection.isLoggedIn) {
    userId = introspection.user.id;
  }

  const listConfigsRes = await ListConfig.getById(request.params.id);
  if (listConfigsRes.isErr()) {
    context.error(listConfigsRes.error);
    return forbiddenReply();
  }

  const listConfig = listConfigsRes.value;

  const hasAccess = listConfig.userId === userId || listConfig.setting.public;
  if (!hasAccess) {
    return forbiddenReply();
  }

  const start = getStart(request);
  const perPage = getPerPage(request);
  const listContext = getContext(request);
  const entityListRes = await Entity.getList({
    userId: listConfig.userId,
    filter: listConfig.filter,
    context: listContext,
    sort: listConfig.sort,
    start,
    perPage,
  });

  console.log({ filter: listConfig.filter, sort: listConfig.sort });

  if (entityListRes.isErr()) {
    context.error(entityListRes.error);

    return {
      status: 500,
    };
  }
  return jsonReply(entityListRes.value);
}

app.http("list", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: list,
  route: "list/{id?}",
});
