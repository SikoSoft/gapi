import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { IdentityManager } from "../lib/IdentityManager";
import { forbiddenReply, introspect, jsonReply } from "..";
import { UserCreateBody, UserSelfUpdateBody, UserUpdateBody } from "../models/Identity";
import { AuthError } from "../errors/AuthError";

export async function user(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  const introspection = await introspect(request);
  console.log("introspection", introspection);

  switch (request.method) {
    case "POST": {
      const body = (await request.json()) as UserCreateBody;

      const ottRes = await IdentityManager.verifyOtt(body.ott);
      if (ottRes.isErr()) {
        context.error(ottRes.error);
        return { status: 500 };
      }
      if (!ottRes.value) {
        return forbiddenReply();
      }

      const res = await IdentityManager.createUser(
        body.username,
        body.firstName,
        body.lastName,
        body.password
      );

      if (res.isErr()) {
        return {
          status: 400,
        };
      }

      return jsonReply({ id: res.value });
    }
    case "PUT": {
      const updateBody = (await request.json()) as UserUpdateBody | UserSelfUpdateBody;
      context.log("updateBody", updateBody);

      if ("roles" in updateBody) {
        if (
          !introspection.isLoggedIn ||
          !introspection.user.roles.includes("admin")
        ) {
          return forbiddenReply();
        }

        const updateRes = await IdentityManager.updateUserRoles(
          updateBody.userId,
          updateBody.roles
        );
        if (updateRes.isErr()) {
          context.error(updateRes.error);
          return { status: 500 };
        }
        return jsonReply({ success: true });
      }

      if (!introspection.isLoggedIn) {
        return forbiddenReply();
      }

      const selfUpdateRes = await IdentityManager.updateUser(
        introspection.user.id,
        updateBody
      );
      if (selfUpdateRes.isErr()) {
        if (selfUpdateRes.error instanceof AuthError) {
          return jsonReply({ success: false, error: selfUpdateRes.error.message }, 400);
        }
        context.error(selfUpdateRes.error);
        return { status: 500 };
      }
      return jsonReply({ success: true });
    }
    case "GET":
      const userId = request.params.id;

      if (
        userId &&
        (!introspection.isLoggedIn || introspection.user.id !== userId)
      ) {
        return forbiddenReply();
      }

      if (userId) {
        const userRes = await IdentityManager.getUser(userId);
        if (userRes.isErr()) {
          return {
            status: 404,
          };
        }
        return jsonReply(userRes.value);
      }

      if (
        !introspection.isLoggedIn ||
        !introspection.user.roles.includes("admin")
      ) {
        return forbiddenReply();
      }

      const usersRes = await IdentityManager.getUsers();
      if (usersRes.isErr()) {
        return {
          status: 404,
        };
      }
      return jsonReply(usersRes.value);
    default:
      return jsonReply({ error: "Method not allowed" }, 405);
  }
}

app.http("user", {
  methods: ["POST", "PUT", "GET"],
  authLevel: "anonymous",
  handler: user,
  route: "user/{id?}",
});
