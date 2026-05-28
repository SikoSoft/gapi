import { ChartRequest } from "api-spec/models/Statistic";

export interface ChartSegment {
  key: string;
  start: Date;
  end: Date;
}

export interface ChartRequestBody extends Omit<ChartRequest, "dataWindow"> {
  dataWindow: {
    start: string;
    end: string;
  };
}
