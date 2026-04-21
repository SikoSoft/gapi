import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply } from "..";
import { AccessPolicy } from "../lib/AccessPolicy";

interface EntityConfigAccessPolicyBody {
  viewAccessPolicyId: number;
  editAccessPolicyId: number;
}

export async function entityConfigAccessPolicy(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) return forbiddenReply();
  const userId = introspection.user.id;

  const idParam = request.params.id;
  if (!idParam) return { status: 400 };
  const entityConfigId = parseInt(idParam, 10);

  const body = (await request.json()) as EntityConfigAccessPolicyBody;
  const result = await AccessPolicy.setEntityConfigAccessPolicy(
    userId,
    entityConfigId,
    body.viewAccessPolicyId,
    body.editAccessPolicyId
  );

  if (result.isErr()) {
    context.error(result.error);
    return { status: 500 };
  }

  return jsonReply({ success: true });
}

app.http("entityConfigAccessPolicy", {
  methods: ["PUT"],
  authLevel: "anonymous",
  handler: entityConfigAccessPolicy,
  route: "entityConfigAccessPolicy/{id}",
});
