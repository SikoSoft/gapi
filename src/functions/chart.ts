import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply } from "..";
import { Chart } from "../lib/Chart";
import { ChartRequestBody, ChartUpdateBody } from "../models/Chart";
import { ChartRequest, DataWindow, DataWindowType } from "api-spec/models/Statistic";
import { HttpMethod } from "../models/Endpoint";

function buildDataWindow(body: ChartRequestBody): DataWindow {
  if (body.config.dataWindow.type === DataWindowType.CUSTOM) {
    return {
      type: DataWindowType.CUSTOM,
      start: new Date(body.config.dataWindow.start),
      end: new Date(body.config.dataWindow.end),
    };
  }
  return { type: body.config.dataWindow.type };
}

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
    case HttpMethod.POST: {
      const body = (await request.json()) as ChartRequestBody;

      const chartRequest: ChartRequest = {
        config: {
          ...body.config,
          dataWindow: buildDataWindow(body),
        },
        name: body.name,
        save: body.save,
      };

      const res = await Chart.getChartData(chartRequest, userId);
      if (res.isErr()) {
        context.error(res.error);
        return { status: 500 };
      }

      if (body.save && body.name) {
        const saveRes = await Chart.saveChart(userId, body.name, body.config);
        if (saveRes.isErr()) {
          context.error(saveRes.error);
          return { status: 500 };
        }
        return jsonReply({ segmentedData: res.value, chart: saveRes.value });
      }

      return jsonReply({ segmentedData: res.value });
    }

    case HttpMethod.PUT: {
      const idParam = request.params.id;
      if (!idParam) {
        return { status: 400 };
      }
      const id = parseInt(idParam, 10);
      if (isNaN(id)) {
        return { status: 400 };
      }

      const body = (await request.json()) as ChartUpdateBody;

      const updateRes = await Chart.updateChart(userId, id, body.name, body.config);
      if (updateRes.isErr()) {
        context.error(updateRes.error);
        return { status: 500 };
      }

      return jsonReply({ chart: updateRes.value });
    }

    default:
      return { status: 405 };
  }
}

app.http("chart", {
  methods: ["POST", "PUT"],
  authLevel: "anonymous",
  handler: chart,
  route: "chart/{id?}",
});
