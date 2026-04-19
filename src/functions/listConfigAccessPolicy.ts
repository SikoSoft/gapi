import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply } from "..";
import { AccessPolicy } from "../lib/AccessPolicy";

interface ListConfigAccessPolicyBody {
  viewAccessPolicyId: number;
  editAccessPolicyId: number;
}

export async function listConfigAccessPolicy(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) return forbiddenReply();
  const userId = introspection.user.id;

  const idParam = request.params.id;
  if (!idParam) return { status: 400 };

  const body = (await request.json()) as ListConfigAccessPolicyBody;
  const result = await AccessPolicy.setListConfigAccessPolicy(
    userId,
    idParam,
    body.viewAccessPolicyId,
    body.editAccessPolicyId
  );

  if (result.isErr()) {
    context.error(result.error);
    return { status: 500 };
  }

  return jsonReply({ success: true });
}

app.http("listConfigAccessPolicy", {
  methods: ["PUT"],
  authLevel: "anonymous",
  handler: listConfigAccessPolicy,
  route: "listConfigAccessPolicy/{id}",
});
