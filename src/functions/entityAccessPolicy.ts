import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply } from "..";
import { AccessPolicy } from "../lib/AccessPolicy";

interface EntityAccessPolicyBody {
  accessPolicyId: number;
}

export async function entityAccessPolicy(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) return forbiddenReply();
  const userId = introspection.user.id;

  const idParam = request.params.id;
  if (!idParam) return { status: 400 };
  const entityId = parseInt(idParam, 10);

  const body = (await request.json()) as EntityAccessPolicyBody;
  const result = await AccessPolicy.setEntityAccessPolicy(
    userId,
    entityId,
    body.accessPolicyId
  );

  if (result.isErr()) {
    context.error(result.error);
    return { status: 500 };
  }

  return jsonReply({ success: true });
}

app.http("entityAccessPolicy", {
  methods: ["PUT"],
  authLevel: "anonymous",
  handler: entityAccessPolicy,
  route: "entityAccessPolicy/{id}",
});
