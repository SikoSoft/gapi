import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect } from "..";
import { ListSort } from "api-spec/models/List";
import { ListConfig } from "../lib/ListConfig";
import { ErrorCode } from "../models/Error";

export type UpdateBody = ListSort;

export async function listSort(
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
    context.error(listConfigRes.error);
    return forbiddenReply();
  }

  const updateBody = (await request.json()) as UpdateBody;
  const updateRes = await ListConfig.updateSort(
    userId,
    request.params.id,
    updateBody
  );
  if (updateRes.isErr()) {
    context.error(updateRes.error);

    if (updateRes.error.name === ErrorCode.AccessError) {
      return { status: 403 };
    }

    return { status: 400 };
  }

  return { status: 204 };
}

app.http("listSort", {
  methods: ["PUT"],
  authLevel: "anonymous",
  handler: listSort,
  route: "listSort/{id?}",
});
