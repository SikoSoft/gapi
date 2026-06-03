import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply } from "..";
import { Chart } from "../lib/Chart";
import { ChartRequestBody } from "../models/Chart";
import { ChartRequest, DataWindow, DataWindowType } from "api-spec/models/Statistic";

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

      let dataWindow: DataWindow;
      if (body.dataWindow.type === DataWindowType.CUSTOM) {
        dataWindow = {
          type: DataWindowType.CUSTOM,
          start: new Date(body.dataWindow.start),
          end: new Date(body.dataWindow.end),
        };
      } else {
        dataWindow = { type: body.dataWindow.type };
      }

      const chartRequest: ChartRequest = {
        ...body,
        dataWindow,
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
