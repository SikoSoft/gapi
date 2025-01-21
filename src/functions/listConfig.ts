import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { getDefaultFilter, getDefaultSort, jsonReply } from "..";
import { ListConfig } from "api-spec/models/List";

const defaultListConfig: ListConfig = {
  name: "Example config",
  id: "test-id",
  filter: getDefaultFilter(),
  sort: getDefaultSort(),
};

export async function listConfig(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  switch (request.method) {
    case "GET":
      return jsonReply({ listConfigs: [defaultListConfig] });
    case "POST":
      let status = false;
      return jsonReply({ status });
  }
}

app.http("listConfig", {
  methods: ["GET", "POST", "PUT", "DELETE"],
  authLevel: "anonymous",
  handler: listConfig,
  route: "listConfig/{id?}",
});
