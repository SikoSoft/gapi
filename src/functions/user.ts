import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { IdentityManager } from "../lib/IdentityManager";
import { jsonReply } from "..";
import { UserCreateBody, UserUpdateBody } from "../models/Identity";

export async function user(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  switch (request.method) {
    case "POST":
      const body = (await request.json()) as UserCreateBody;
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
    case "PUT":
      let success = false;
      const updateBody = (await request.json()) as UserUpdateBody;
      context.log("updateBody", updateBody);

      if (updateBody.roles) {
        const updateRes = await IdentityManager.updateUserRoles(
          updateBody.userId,
          updateBody.roles
        );
        success = updateRes.isOk();
      }

      return jsonReply({ success });
    case "GET":
      const userId = request.params.id;
      if (userId) {
        const userRes = await IdentityManager.getUser(userId);
        if (userRes.isErr()) {
          return {
            status: 404,
          };
        }
        return jsonReply(userRes.value);
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
