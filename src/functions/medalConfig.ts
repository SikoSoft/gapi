import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply } from "..";
import { Medal } from "../lib/Medal";
import { MedalConfigCreateBody, MedalConfigUpdateBody } from "../models/Medal";

export async function medalConfig(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) {
    return forbiddenReply();
  }

  const id = request.params.id ? parseInt(request.params.id, 10) : undefined;

  switch (request.method) {
    case "GET": {
      if (id !== undefined) {
        const res = await Medal.getConfig(id);
        if (res.isErr()) {
          context.error(res.error);
          return { status: 500 };
        }
        return jsonReply({ ...res.value });
      }
      const res = await Medal.getConfigs();
      if (res.isErr()) {
        context.error(res.error);
        return { status: 500 };
      }
      return jsonReply({ medalConfigs: res.value });
    }

    case "POST": {
      const body = (await request.json()) as MedalConfigCreateBody;
      const res = await Medal.createConfig(body);
      if (res.isErr()) {
        context.error(res.error);
        return { status: 500 };
      }
      return jsonReply({ ...res.value });
    }

    case "PUT": {
      if (id === undefined) {
        return { status: 400 };
      }
      const body = (await request.json()) as MedalConfigUpdateBody;
      const res = await Medal.updateConfig(id, body);
      if (res.isErr()) {
        context.error(res.error);
        return { status: 500 };
      }
      return jsonReply({ ...res.value });
    }

    case "DELETE": {
      if (id === undefined) {
        return { status: 400 };
      }
      const res = await Medal.deleteConfig(id);
      if (res.isErr()) {
        context.error(res.error);
        return { status: 500 };
      }
      return jsonReply({});
    }
  }
}

app.http("medalConfig", {
  methods: ["GET", "POST", "PUT", "DELETE"],
  authLevel: "anonymous",
  handler: medalConfig,
  route: "medalConfig/{id?}",
});
