import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply } from "..";
import { Chart } from "../lib/Chart";
import { ChartRequestBody, ChartUpdateBody } from "../models/Chart";
import { ChartConfig, ChartRequest, ChartVersion, DataWindow, DataWindowType } from "api-spec/models/Statistic";
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

function buildConfig(body: ChartRequestBody): ChartConfig {
  const dataWindow = buildDataWindow(body);
  if (body.config.version === ChartVersion.V2) {
    return { ...body.config, dataWindow };
  }
  return { ...body.config, dataWindow };
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
    case HttpMethod.GET: {
      const idParam = request.params.id;
      if (idParam) {
        const id = parseInt(idParam, 10);
        if (isNaN(id)) {
          return { status: 400 };
        }
        const res = await Chart.getChart(userId, id);
        if (res.isErr()) {
          context.error(res.error);
          return { status: 500 };
        }
        if (!res.value) {
          return { status: 404 };
        }
        return jsonReply({ ...res.value });
      } else {
        const res = await Chart.getCharts(userId);
        if (res.isErr()) {
          context.error(res.error);
          return { status: 500 };
        }
        return jsonReply({ charts: res.value });
      }
    }

    case HttpMethod.POST: {
      const body = (await request.json()) as ChartRequestBody;

      const chartRequest: ChartRequest = {
        config: buildConfig(body),
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

    case HttpMethod.DELETE: {
      const idParam = request.params.id;
      if (!idParam) {
        return { status: 400 };
      }
      const id = parseInt(idParam, 10);
      if (isNaN(id)) {
        return { status: 400 };
      }
      const res = await Chart.deleteChart(userId, id);
      if (res.isErr()) {
        context.error(res.error);
        return { status: 500 };
      }
      return { status: 204 };
    }

    default:
      return { status: 405 };
  }
}

app.http("chart", {
  methods: ["GET", "POST", "PUT", "DELETE"],
  authLevel: "anonymous",
  handler: chart,
  route: "chart/{id?}",
});
