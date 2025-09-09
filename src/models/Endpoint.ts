import { Entity } from "api-spec/models";
import { EntityConfig } from "../lib/EntityConfig";
import { ActionBodyPayload, ActionItem, ActionList } from "./Action";
import { EntityConfigCreateBody, EntityConfigUpdateBody } from "./Entity";

export enum HttpMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
}

export enum EndpointName {
  ACTION = "action",
  ACTION_SUGGESTION = "actionSuggestion",
  ENTITY_CONFIG = "entityConfig",
  INTROSPECT = "introspect",
  LEADERBOARD = "leaderboard",
  LIST_CONFIG = "listConfig",
  LOGIN = "login",
  LOGOUT = "logout",
  OPERATION = "operation",
  PROPERTY_CONFIG = "propertyConfig",
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
      responseBody: ActionItem;
    };
    [HttpMethod.PUT]: {
      requestBody: ActionBodyPayload;
      responseBody: ActionItem;
    };
    [HttpMethod.DELETE]: {
      responseBody: null;
    };
  };
  [EndpointName.ENTITY_CONFIG]: {
    [HttpMethod.GET]: {
      responseBody: { entityConfigs: Entity.EntityConfig[] };
    };
    [HttpMethod.POST]: {
      requestBody: EntityConfigCreateBody;
      responseBody: EntityConfig;
    };
    [HttpMethod.PUT]: {
      requestBody: EntityConfigUpdateBody;
      responseBody: EntityConfig;
    };
    [HttpMethod.DELETE]: {
      responseBody: null;
    };
  };
}
