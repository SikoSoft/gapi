import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { jsonReply, prisma } from "..";

declare interface RequestBody {
  label: string;
}

export async function tag(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  switch (request.method) {
    case "POST":
      const body = (await request.json()) as RequestBody;
      await prisma.tag.create({
        data: {
          label: body.label,
        },
      });

    case "DELETE":

    case "GET":
      const rawTags = await prisma.tag.findMany({
        where: { label: { contains: request.params.query } },
      });
      const tags = rawTags.map((tag) => tag.label);
      return jsonReply({ tags });
  }

  return jsonReply({ time: new Date().toISOString() });
}

app.http("tag", {
  methods: ["GET", "POST", "DELETE"],
  authLevel: "anonymous",
  handler: tag,
  route: "tag/{query?}",
});
