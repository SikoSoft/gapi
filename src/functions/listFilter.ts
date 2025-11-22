import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply } from "..";
import { ListFilter, ListSort } from "api-spec/models/List";
import { ListConfig } from "../lib/ListConfig";
import { List } from "api-spec/models";
import { HttpMethod } from "../models/Endpoint";

export type UpdateBody = ListFilter;

export async function listFilter(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) {
    return forbiddenReply();
  }
  const userId = introspection.user.id;

  const listConfigRes = await ListConfig.getById(request.params.id);
  if (listConfigRes.isErr()) {
    console.log("IS FUCKING ERROR");
    context.error(listConfigRes.error);
    return forbiddenReply();
  }

  if (listConfigRes.value.userId !== userId) {
    return forbiddenReply();
  }

  const updateBody = (await request.json()) as UpdateBody;

  console.log("UPDATE BODY", updateBody);

  await ListConfig.updateTags(request.params.id, updateBody.tagging);
  await ListConfig.updateTime(request.params.id, updateBody.time);
  await ListConfig.updateText(request.params.id, updateBody.text);
  await ListConfig.updateTypes(request.params.id, updateBody.includeTypes);

  const updateRes = await ListConfig.updateFilter(
    request.params.id,
    updateBody
  );
  if (updateRes.isErr()) {
    console.log("IS FUCKING ERROR 2");
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
