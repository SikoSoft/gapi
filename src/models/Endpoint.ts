import { Entity, Identity } from "api-spec/models";
import { EntityConfig } from "../lib/EntityConfig";
import { EntityConfigCreateBody, EntityConfigUpdateBody } from "./Entity";

export enum HttpMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
}

export enum EndpointName {
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
  [EndpointName.USER]: {
    [HttpMethod.GET]: {
      responseBody: Identity.User;
    };
    [HttpMethod.POST]: {
      requestBody: {
        username: string;
        firstName: string;
        lastName: string;
        password: string;
      };
      responseBody: { id: string };
    };
    [HttpMethod.PUT]: {
      requestBody: {
        username?: string;
        firstName?: string;
        lastName?: string;
        password?: string;
        roles?: string[];
      };
      responseBody: { success: boolean };
    };
  };
}
