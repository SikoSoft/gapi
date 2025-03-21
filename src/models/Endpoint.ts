import { ActionBodyPayload, ActionList } from "./Action";

export enum HttpMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
}

export enum EndpointName {
  ACTION = "action",
  ACTION_SUGGESTION = "actionSuggestion",
  INTROSPECT = "introspect",
  LEADERBOARD = "leaderboard",
  LIST_CONFIG = "listConfig",
  LOGIN = "login",
  LOGOUT = "logout",
  OPERATION = "operation",
  SETTING = "setting",
  TAG = "tag",
  TAG_SUGGESTION = "tagSuggestion",
  USER = "user",
}

export interface EndpointConfig {
  [EndpointName.ACTION]: {
    [HttpMethod.GET]: {
      responseBody: ActionList;
    };
    [HttpMethod.POST]: {
      requestBody: ActionBodyPayload;
      responseBody: any;
    };
  };
}
