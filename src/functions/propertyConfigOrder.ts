import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply } from "..";

import { PropertyConfig } from "../lib/PropertyConfig";
import {
  propertyConfigUpdateOrderSchema,
} from "../models/PropertyConfig";

export async function propertyConfigOrder(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) {
    return forbiddenReply();
  }
  const userId = introspection.user.id;
  const entityConfigId = parseInt(request.params.entityConfigId);

  const orderBody = (await request.json()) as unknown;

  const result = propertyConfigUpdateOrderSchema.safeParse(orderBody);
  if (!result.success) {
    return {
      status: 400,
      body: JSON.stringify(result.error.issues),
    };
  }

  for (const item of result.data) {
    const updatedRes = await PropertyConfig.updateOrder(
      entityConfigId,
      item.id,
      item.order
    );

    if (updatedRes.isErr()) {
      context.error(updatedRes.error);

      return {
        status: 500,
        body: updatedRes.error.message,
      };
    }
  }
  return {
    status: 204,
  };
}

app.http("propertyConfigOrder", {
  methods: ["PUT"],
  authLevel: "anonymous",
  handler: propertyConfigOrder,
  route: "propertyConfigOrder/{entityConfigId}",
});
