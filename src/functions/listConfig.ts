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
  themes: string[];
}

export async function listConfig(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn && !introspection.isSystem) {
    return forbiddenReply();
  }

  if (introspection.isSystem && request.method !== HttpMethod.GET) {
    return forbiddenReply();
  }

  switch (request.method) {
    case HttpMethod.GET:
      if (request.params.id) {
        const listConfigRes = await ListConfig.getById(request.params.id);
        if (listConfigRes.isErr()) {
          context.error(listConfigRes.error);
          return { status: 404 };
        }

        return jsonReply<List.ListConfig>({
          ...listConfigRes.value,
        });
      }

      if (introspection.isSystem) {
        const allListConfigsRes = await ListConfig.getAll();
        if (allListConfigsRes.isErr()) {
          context.error(allListConfigsRes.error);
          return { status: 500 };
        }

        return jsonReply<{ listConfigs: List.ListConfig[] }>({
          listConfigs: allListConfigsRes.value,
        });
      }

      const listConfigsRes = await ListConfig.getByUser(introspection.user.id);
      if (listConfigsRes.isErr()) {
        context.error(listConfigsRes.error);
        return forbiddenReply();
      }

      return jsonReply<{ listConfigs: List.ListConfig[] }>({
        listConfigs: listConfigsRes.value,
      });
    case HttpMethod.POST:
      const createBody = (await request.json()) as CreateBody;
      const createRes = await ListConfig.create(introspection.user.id, createBody.name);
      if (createRes.isErr()) {
        context.error(createRes.error);

        return { status: 400 };
      }

      return jsonReply<List.ListConfig>({ ...createRes.value });
    case HttpMethod.PUT:
      const updateBody = (await request.json()) as UpdateBody;
      const updateRes = await ListConfig.update(introspection.user.id, updateBody);
      if (updateRes.isErr()) {
        context.error(updateRes.error);

        return { status: 400 };
      }

      return jsonReply<List.ListConfig>({ ...updateRes.value });
    case HttpMethod.DELETE:
      const deleteItems = request.query.get("deleteItems") === "1";
      const deleteRes = deleteItems
        ? await ListConfig.deleteWithItems(introspection.user.id, request.params.id)
        : await ListConfig.delete(introspection.user.id, request.params.id);
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
