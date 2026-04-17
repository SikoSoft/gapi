import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply } from "..";
import { AccessPolicy } from "../lib/AccessPolicy";
import { Access } from "api-spec/models";

interface PolicyBody {
  name: string;
  description: string;
  parties: Access.AccessPolicyParty[];
}

export async function accessPolicy(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) return forbiddenReply();

  const idParam = request.params.id;

  switch (request.method) {
    case "GET": {
      const result = await AccessPolicy.get();
      if (result.isErr()) {
        context.error(result.error);
        return { status: 500 };
      }
      return jsonReply({ policies: result.value });
    }

    case "POST": {
      const body = (await request.json()) as PolicyBody;
      const result = await AccessPolicy.create(
        body.name,
        body.description,
        body.parties
      );
      if (result.isErr()) {
        context.error(result.error);
        return { status: 500 };
      }
      return jsonReply({ policy: result.value });
    }

    case "PUT": {
      if (!idParam) return { status: 400 };
      const id = parseInt(idParam, 10);
      const body = (await request.json()) as PolicyBody;
      const result = await AccessPolicy.update(
        id,
        body.name,
        body.description,
        body.parties
      );
      if (result.isErr()) {
        context.error(result.error);
        return { status: 500 };
      }
      return jsonReply({ policy: result.value });
    }

    case "DELETE": {
      if (!idParam) return { status: 400 };
      const id = parseInt(idParam, 10);
      const result = await AccessPolicy.delete(id);
      if (result.isErr()) {
        context.error(result.error);
        return { status: 500 };
      }
      return { status: 204 };
    }
  }

  return { status: 405 };
}

app.http("accessPolicy", {
  methods: ["GET", "POST", "PUT", "DELETE"],
  authLevel: "anonymous",
  handler: accessPolicy,
  route: "accessPolicy/{id?}",
});
