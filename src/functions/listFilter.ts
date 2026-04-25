import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply } from "..";
import { ListFilter } from "api-spec/models/List";
import { ListConfig } from "../lib/ListConfig";

export type UpdateBody = ListFilter;

export async function listFilter(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("LIST FILTER", request.params.id);
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) {
    context.log("NOT LOGGED IN");
    return forbiddenReply();
  }
  const userId = introspection.user.id;

  context.log("USER ID", userId);

  const listConfigRes = await ListConfig.getById(request.params.id);
  if (listConfigRes.isErr()) {
    context.log("IS FUCKING ERROR");
    context.error(listConfigRes.error);
    return forbiddenReply();
  }

  context.log("LIST CONFIG", listConfigRes.value.userId);

  if (listConfigRes.value.userId !== userId) {
    return forbiddenReply();
  }

  const updateBody = (await request.json()) as UpdateBody;

  context.log("UPDATE BODY", updateBody);

  await ListConfig.updateTags(request.params.id, updateBody.tagging);
  await ListConfig.updateTime(request.params.id, updateBody.time);
  await ListConfig.updateTypes(request.params.id, updateBody.includeTypes);
  await ListConfig.updateProperties(request.params.id, updateBody.properties);

  const updateRes = await ListConfig.updateFilter(
    request.params.id,
    updateBody
  );
  if (updateRes.isErr()) {
    context.log("IS FUCKING ERROR 2");
    context.error(updateRes.error);

    return { status: 400 };
  }

  return { status: 204 };
}

app.http("listFilter", {
  methods: ["PUT"],
  authLevel: "anonymous",
  handler: listFilter,
  route: "listFilter/{id?}",
});
