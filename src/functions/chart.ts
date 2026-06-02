import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply } from "..";
import { Chart } from "../lib/Chart";
import { ChartRequestBody } from "../models/Chart";
import { ChartRequest } from "api-spec/models/Statistic";

export async function chart(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) {
    return forbiddenReply();
  }

  const userId = introspection.user.id;

  switch (request.method) {
    case "POST": {
      const body = (await request.json()) as ChartRequestBody;

      const chartRequest: ChartRequest = {
        ...body,
        dataWindow: {
          start: new Date(body.dataWindow.start),
          end: new Date(body.dataWindow.end),
        },
      };

      const res = await Chart.getChartData(chartRequest, userId);
      if (res.isErr()) {
        context.error(res.error);
        return { status: 500 };
      }

      return jsonReply({ segmentedData: res.value });
    }

    default:
      return { status: 405 };
  }
}

app.http("chart", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: chart,
  route: "chart",
});
