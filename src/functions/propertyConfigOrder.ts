import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply } from "..";

import { PropertyConfig } from "../lib/PropertyConfig";
import {
  PropertyConfigCreateBody,
  PropertyConfigUpdateBody,
  PropertyConfigUpdateOrderBody,
  propertyConfigUpdateOrderSchema,
  propertyConfigUpdateSchema,
} from "../models/PropertyConfig";
import { EntityPropertyConfig } from "api-spec/models/Entity";

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

  const orderBody = (await request.json()) as PropertyConfigUpdateOrderBody;

  const validation = propertyConfigUpdateOrderSchema.decode(orderBody);
  if (validation._tag === "Left") {
    return {
      status: 400,
      body: JSON.stringify(validation.left),
    };
  }

  for (const item of orderBody) {
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
