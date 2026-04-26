export interface SmhiParameter {
  name: string;
  levelType: string;
  level: number;
  unit: string;
  values: number[];
}

export interface SmhiTimeSeries {
  validTime: string;
  parameters: SmhiParameter[];
}

export interface SmhiWeatherData {
  approvedTime: string;
  referenceTime: string;
  timeSeries: SmhiTimeSeries[];
}

export interface LocationWeather {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  weather: SmhiWeatherData | null;
  error?: string;
}

export interface AllLocationsWeather {
  locations: LocationWeather[];
}
