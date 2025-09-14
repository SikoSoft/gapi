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
    case HttpMethod.GET:
      const listConfigsRes = await ListConfig.getByUser(userId);
      if (listConfigsRes.isErr()) {
        return forbiddenReply();
      }

      return jsonReply<{ listConfigs: List.ListConfig[] }>({
        listConfigs: listConfigsRes.value,
      });
    case HttpMethod.POST:
      const createBody = (await request.json()) as CreateBody;
      const createRes = await ListConfig.create(
        createBody.userId,
        createBody.name
      );
      if (createRes.isErr()) {
        context.error(createRes.error);

        return { status: 400 };
      }

      return jsonReply<List.ListConfig>({ ...createRes.value });
    case HttpMethod.PUT:
      const updateBody = (await request.json()) as UpdateBody;
      const updateRes = await ListConfig.update(userId, updateBody);
      if (updateRes.isErr()) {
        context.error(updateRes.error);

        return { status: 400 };
      }

      return jsonReply<List.ListConfig>({ ...updateRes.value });
    case HttpMethod.DELETE:
      const deleteRes = await ListConfig.delete(userId, request.params.id);
      if (deleteRes.isErr()) {
        context.error(deleteRes.error);

        return { status: 400 };
      }

      if (!deleteRes.value) {
        return { status: 404 };
      }

      return {
        status: 204,
      };
  }
}

app.http("listConfig", {
  methods: ["GET", "POST", "PUT", "DELETE"],
  authLevel: "anonymous",
  handler: listConfig,
  route: "listConfig/{id?}",
});
