import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import { LoginBodySchema, MfaVerifyBodySchema, MfaVerifySetupBodySchema, UserCreateBodySchema, UserSelfUpdateBodySchema, UserSchema, UserUpdateBodySchema } from "../models/Identity";
import { calculatedPropertyConfigCreateSchema, propertyConfigCreateSchema, propertyConfigUpdateOrderSchema } from "../models/PropertyConfig";
import { frontEndLogSchema } from "../models/FrontEndLog";
import { ChartRequestBodySchema } from "../models/Chart";
import { WorkspaceCreateBodySchema, WorkspaceUpdateBodySchema } from "../models/Workspace";
import { MedalConfigCreateBodySchema } from "../models/Medal";
import { NotificationMessageSchema } from "../models/Notification";
import { PushSubscriptionPayloadSchema } from "../models/PushSubscription";
import { AccessPolicyAssignmentSchema, AccessPolicyBodySchema, AccessPolicyGroupBodySchema } from "../models/Access";
import { ListConfigCreateBodySchema } from "../models/ListConfig";
import { TagCreateBodySchema } from "../models/Tag";
import { LeaderboardCreateBodySchema, LeaderboardRecordSchema } from "../models/Leaderboard";

export const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
});

// ─── Shared response schemas ──────────────────────────────────────────────────

const SuccessSchema = z.object({ success: z.boolean() });
const EmptySchema = z.object({});

const EntityPropertySchema = z.object({
  id: z.number(),
  propertyConfigId: z.number(),
  value: z.union([z.boolean(), z.number(), z.string(), z.null(), z.object({ src: z.string(), alt: z.string() })]),
  order: z.number(),
});

const EntityConfigSchema = z.object({
  id: z.number(),
  userId: z.string(),
  name: z.string(),
  description: z.string(),
  properties: z.array(z.record(z.string(), z.unknown())),
  revisionOf: z.number().nullable(),
  allowPropertyOrdering: z.boolean(),
  aiEnabled: z.boolean(),
  aiIdentifyPrompt: z.string(),
  public: z.boolean(),
  allowTags: z.boolean(),
  uniqueConstraints: z.array(z.object({ propertyIds: z.array(z.number()) })),
});

const EntitySchema = z.object({
  id: z.number(),
  userId: z.string(),
  type: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  tags: z.array(z.string()),
  properties: z.array(EntityPropertySchema),
  suggested: z.boolean(),
  identified: z.boolean(),
});

const AccessPolicySchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
  parties: z.array(z.record(z.string(), z.unknown())),
});

const AccessPolicyGroupSchema = z.object({
  id: z.number(),
  name: z.string(),
  users: z.array(z.object({ id: z.string(), name: z.string() })),
});

const ListConfigSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  filter: z.record(z.string(), z.unknown()),
  sort: z.record(z.string(), z.unknown()),
  themes: z.array(z.string()),
  setting: z.record(z.string(), z.unknown()),
});

const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  userId: z.string(),
  color: z.string(),
  theme: z.string(),
  showEverything: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  listConfigs: z.array(z.string()),
  streaks: z.array(z.number()),
  facts: z.array(z.number()),
  charts: z.array(z.number()),
});

const MedalSchema = z.object({
  id: z.number(),
  userId: z.string(),
  medalConfigId: z.number(),
  awardedAt: z.string(),
});

const StreakContextSchema = z.object({
  segmentUnit: z.enum(["hour", "day", "week", "month"]),
  length: z.number().int().positive(),
  innerContext: z.record(z.string(), z.unknown()),
  innerOperator: z.enum(["==", "!=", ">", ">=", "<", "<=", "contains"]),
  innerValue: z.union([z.string(), z.number(), z.boolean()]),
});

const MedalConfigSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
  series: z.string(),
  recurrence: z.number(),
  prestige: z.number(),
  icon: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  factRequests: z.array(z.record(z.string(), z.unknown())),
  streakRequests: z.array(z.object({ alias: z.string(), context: StreakContextSchema })),
  criteria: z.record(z.string(), z.unknown()),
});

const CriteriaProgressSchema = z.object({
  alias: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

const MedalConfigWithProgressSchema = MedalConfigSchema.extend({
  criteriaProgress: z.array(CriteriaProgressSchema),
});

const EntityBodyPayloadSchema = z.object({
  entityConfigId: z.number().optional(),
  desc: z.string().optional(),
  timeZone: z.number().optional(),
  tags: z.array(z.string()).optional(),
  properties: z.array(EntityPropertySchema).optional(),
  published: z.boolean().optional(),
  userId: z.string().optional(),
  suggested: z.boolean().optional(),
  identified: z.boolean().optional(),
  createdAt: z.string().optional(),
});

const EntityConfigCreateBodySchema = z.object({
  userId: z.string(),
  name: z.string(),
  description: z.string(),
  properties: z.array(z.record(z.string(), z.unknown())).optional(),
  revisionOf: z.number().nullable().optional(),
  allowPropertyOrdering: z.boolean().optional(),
  aiEnabled: z.boolean().optional(),
  aiIdentifyPrompt: z.string().optional(),
  public: z.boolean().optional(),
  allowTags: z.boolean().optional(),
  uniqueConstraints: z.array(z.object({ propertyIds: z.array(z.number()) })).optional(),
});

const LoginResponseSchema = z.object({
  authToken: z.string(),
  userId: z.string(),
  username: z.string(),
  roles: z.array(z.string()),
});

const MfaLoginResponseSchema = z.object({
  pendingMfaToken: z.string(),
});

const UniqueConstraintsBodySchema = z.array(
  z.object({ propertyIds: z.array(z.number()) })
);

const ExportBodySchema = z.object({
  entityConfigIds: z.array(z.number()),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// ─── Register named schemas ───────────────────────────────────────────────────

const LoginBody = registry.register("LoginBody", LoginBodySchema);
const UserCreateBody = registry.register("UserCreateBody", UserCreateBodySchema);
const UserUpdateBody = registry.register("UserUpdateBody", UserUpdateBodySchema);
const UserSelfUpdateBody = registry.register("UserSelfUpdateBody", UserSelfUpdateBodySchema);
const User = registry.register("User", UserSchema);
const MfaVerifyBody = registry.register("MfaVerifyBody", MfaVerifyBodySchema);
const MfaVerifySetupBody = registry.register("MfaVerifySetupBody", MfaVerifySetupBodySchema);
const PropertyConfigCreateBody = registry.register("PropertyConfigCreateBody", propertyConfigCreateSchema);
const CalculatedPropertyConfigCreateBody = registry.register("CalculatedPropertyConfigCreateBody", calculatedPropertyConfigCreateSchema);
const PropertyConfigUpdateOrderBody = registry.register("PropertyConfigUpdateOrderBody", propertyConfigUpdateOrderSchema);
const FrontEndLogPayload = registry.register("FrontEndLogPayload", frontEndLogSchema);
const ChartRequestBody = registry.register("ChartRequestBody", ChartRequestBodySchema);
const WorkspaceCreateBody = registry.register("WorkspaceCreateBody", WorkspaceCreateBodySchema);
const WorkspaceUpdateBody = registry.register("WorkspaceUpdateBody", WorkspaceUpdateBodySchema);
const MedalConfigCreateBody = registry.register("MedalConfigCreateBody", MedalConfigCreateBodySchema);
const NotificationMessage = registry.register("NotificationMessage", NotificationMessageSchema);
const PushSubscriptionPayload = registry.register("PushSubscriptionPayload", PushSubscriptionPayloadSchema);
const AccessPolicyBody = registry.register("AccessPolicyBody", AccessPolicyBodySchema);
const AccessPolicyGroupBody = registry.register("AccessPolicyGroupBody", AccessPolicyGroupBodySchema);
const AccessPolicyAssignment = registry.register("AccessPolicyAssignment", AccessPolicyAssignmentSchema);
const ListConfigCreateBody = registry.register("ListConfigCreateBody", ListConfigCreateBodySchema);
const TagCreateBody = registry.register("TagCreateBody", TagCreateBodySchema);
const LeaderboardCreateBody = registry.register("LeaderboardCreateBody", LeaderboardCreateBodySchema);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const auth = { security: [{ bearerAuth: [] }] };
const json = (schema: z.ZodType) => ({ content: { "application/json": { schema } } });
const noContent = { description: "No content" };
const forbidden = { description: "Forbidden" };
const notFound = { description: "Not found" };
const badRequest = { description: "Bad request" };
const serverError = { description: "Internal server error" };

// ─── Auth routes ─────────────────────────────────────────────────────────────

registry.registerPath({
  tags: ["Auth"],
  method: "post",
  path: "/login",
  summary: "Log in with username and password",
  request: { body: { content: { "application/json": { schema: LoginBody } } } },
  responses: {
    200: { description: "Authenticated", ...json(LoginResponseSchema) },
    202: { description: "MFA required", ...json(MfaLoginResponseSchema) },
    401: { description: "Invalid credentials" },
    403: forbidden,
  },
});

registry.registerPath({
  tags: ["Auth"],
  method: "get",
  path: "/logout",
  summary: "Log out and revoke session token",
  ...auth,
  responses: {
    202: { description: "Session revoked" },
    400: badRequest,
  },
});

registry.registerPath({
  tags: ["Auth"],
  method: "get",
  path: "/user/introspect",
  summary: "Get current session introspection",
  ...auth,
  responses: {
    200: { description: "Introspection data", ...json(z.object({ introspection: z.record(z.string(), z.unknown()) })) },
    403: forbidden,
  },
});

registry.registerPath({
  tags: ["Auth"],
  method: "get",
  path: "/user/{id}",
  summary: "Get user by ID",
  ...auth,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: "User", ...json(User) },
    403: forbidden,
    404: notFound,
  },
});

registry.registerPath({
  tags: ["Auth"],
  method: "post",
  path: "/user",
  summary: "Register a new user account",
  request: { body: { content: { "application/json": { schema: UserCreateBody } } } },
  responses: {
    200: { description: "User created", ...json(z.object({ id: z.string() })) },
    400: badRequest,
    403: forbidden,
  },
});

registry.registerPath({
  tags: ["Auth"],
  method: "put",
  path: "/user",
  summary: "Update user (admin role update or self-update)",
  ...auth,
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.union([UserUpdateBody, UserSelfUpdateBody]),
        },
      },
    },
  },
  responses: {
    200: { description: "Updated", ...json(z.object({ success: z.boolean() })) },
    400: badRequest,
    403: forbidden,
  },
});

registry.registerPath({
  tags: ["Auth"],
  method: "get",
  path: "/mfaSetup",
  summary: "Generate TOTP secret for MFA setup",
  ...auth,
  responses: {
    200: { description: "TOTP credentials", ...json(z.object({ secret: z.string(), uri: z.string() })) },
    403: forbidden,
  },
});

registry.registerPath({
  tags: ["Auth"],
  method: "post",
  path: "/mfaVerify",
  summary: "Complete MFA login with a TOTP code",
  request: { body: { content: { "application/json": { schema: MfaVerifyBody } } } },
  responses: {
    200: { description: "Authenticated", ...json(LoginResponseSchema) },
    401: { description: "Invalid code" },
    400: badRequest,
  },
});

registry.registerPath({
  tags: ["Auth"],
  method: "post",
  path: "/mfaVerifySetup",
  summary: "Confirm and save a TOTP secret",
  ...auth,
  request: { body: { content: { "application/json": { schema: MfaVerifySetupBody } } } },
  responses: {
    200: { description: "MFA enabled", ...json(EmptySchema) },
    400: badRequest,
    401: { description: "Invalid code" },
  },
});

registry.registerPath({
  tags: ["Auth"],
  method: "post",
  path: "/ott",
  summary: "Create a one-time token (admin only)",
  ...auth,
  responses: {
    200: { description: "Token created", ...json(z.object({ token: z.string() })) },
    403: forbidden,
  },
});

registry.registerPath({
  tags: ["Auth"],
  method: "post",
  path: "/setupAdmin",
  summary: "Bootstrap initial admin account (requires ALLOW_CREATE_ADMIN=1)",
  responses: {
    200: { description: "Admin created", ...json(z.object({ id: z.string() })) },
    403: forbidden,
  },
});

// ─── Entity Config routes ─────────────────────────────────────────────────────

registry.registerPath({
  tags: ["Entity Config"],
  method: "get",
  path: "/entityConfig",
  summary: "List all entity configs for the current user",
  ...auth,
  responses: {
    200: { description: "Entity configs", ...json(z.object({ entityConfigs: z.array(EntityConfigSchema) })) },
    403: forbidden,
  },
});

registry.registerPath({
  tags: ["Entity Config"],
  method: "post",
  path: "/entityConfig",
  summary: "Create an entity config",
  ...auth,
  request: { body: { content: { "application/json": { schema: EntityConfigCreateBodySchema } } } },
  responses: {
    200: { description: "Created entity config", ...json(EntityConfigSchema) },
    403: forbidden,
    500: serverError,
  },
});

registry.registerPath({
  tags: ["Entity Config"],
  method: "put",
  path: "/entityConfig",
  summary: "Update an entity config",
  ...auth,
  request: { body: { content: { "application/json": { schema: EntityConfigSchema } } } },
  responses: {
    200: { description: "Updated entity config", ...json(EntityConfigSchema) },
    403: forbidden,
    500: serverError,
  },
});

registry.registerPath({
  tags: ["Entity Config"],
  method: "delete",
  path: "/entityConfig/{id}",
  summary: "Delete an entity config",
  ...auth,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    204: noContent,
    400: badRequest,
    403: forbidden,
  },
});

registry.registerPath({
  tags: ["Entity Config"],
  method: "put",
  path: "/entityConfigAccessPolicy/{id}",
  summary: "Set access policy for an entity config",
  ...auth,
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: AccessPolicyAssignment } } },
  },
  responses: {
    200: { description: "Updated", ...json(SuccessSchema) },
    403: forbidden,
    500: serverError,
  },
});

registry.registerPath({
  tags: ["Entity Config"],
  method: "put",
  path: "/uniqueConstraints/{entityConfigId}",
  summary: "Set unique constraints for an entity config",
  ...auth,
  request: {
    params: z.object({ entityConfigId: z.string() }),
    body: { content: { "application/json": { schema: UniqueConstraintsBodySchema } } },
  },
  responses: {
    200: { description: "Updated", ...json(SuccessSchema) },
    400: badRequest,
    403: forbidden,
    500: serverError,
  },
});

// ─── Entity routes ────────────────────────────────────────────────────────────

registry.registerPath({
  tags: ["Entity"],
  method: "get",
  path: "/entity",
  summary: "List entities",
  ...auth,
  request: {
    query: z.object({
      start: z.string().optional(),
      perPage: z.string().optional(),
      filter: z.string().optional(),
      sort: z.string().optional(),
    }),
  },
  responses: {
    200: { description: "Entity list", ...json(z.object({ entities: z.array(EntitySchema), total: z.number() })) },
    403: forbidden,
    500: serverError,
  },
});

registry.registerPath({
  tags: ["Entity"],
  method: "get",
  path: "/entity/{id}",
  summary: "Get a single entity",
  ...auth,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: "Entity", ...json(EntitySchema) },
    403: forbidden,
    500: serverError,
  },
});

registry.registerPath({
  tags: ["Entity"],
  method: "post",
  path: "/entity",
  summary: "Create an entity",
  ...auth,
  request: { body: { content: { "application/json": { schema: EntityBodyPayloadSchema } } } },
  responses: {
    200: { description: "Created entity", ...json(EntitySchema) },
    400: badRequest,
    403: forbidden,
    500: serverError,
  },
});

registry.registerPath({
  tags: ["Entity"],
  method: "put",
  path: "/entity/{id}",
  summary: "Update an entity",
  ...auth,
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: EntityBodyPayloadSchema } } },
  },
  responses: {
    200: { description: "Updated entity", ...json(EntitySchema) },
    400: badRequest,
    403: forbidden,
    500: serverError,
  },
});

registry.registerPath({
  tags: ["Entity"],
  method: "delete",
  path: "/entity/{id}",
  summary: "Delete an entity",
  ...auth,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: "Deleted entity", ...json(EntitySchema) },
    403: forbidden,
    500: serverError,
  },
});

registry.registerPath({
  tags: ["Entity"],
  method: "put",
  path: "/entityAccessPolicy/{id}",
  summary: "Set access policy for an entity",
  ...auth,
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: AccessPolicyAssignment } } },
  },
  responses: {
    200: { description: "Updated", ...json(SuccessSchema) },
    400: badRequest,
    403: forbidden,
    500: serverError,
  },
});

// ─── List Config routes ───────────────────────────────────────────────────────

registry.registerPath({
  tags: ["List Config"],
  method: "get",
  path: "/listConfig",
  summary: "List all list configs",
  ...auth,
  responses: {
    200: { description: "List configs", ...json(z.object({ listConfigs: z.array(ListConfigSchema) })) },
    403: forbidden,
  },
});

registry.registerPath({
  tags: ["List Config"],
  method: "get",
  path: "/listConfig/{id}",
  summary: "Get a single list config",
  ...auth,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: "List config", ...json(ListConfigSchema) },
    404: notFound,
  },
});

registry.registerPath({
  tags: ["List Config"],
  method: "post",
  path: "/listConfig",
  summary: "Create a list config",
  ...auth,
  request: { body: { content: { "application/json": { schema: ListConfigCreateBody } } } },
  responses: {
    200: { description: "Created list config", ...json(ListConfigSchema) },
    400: badRequest,
    403: forbidden,
  },
});

registry.registerPath({
  tags: ["List Config"],
  method: "put",
  path: "/listConfig/{id}",
  summary: "Update a list config",
  ...auth,
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: ListConfigSchema } } },
  },
  responses: {
    200: { description: "Updated list config", ...json(ListConfigSchema) },
    400: badRequest,
    403: forbidden,
  },
});

registry.registerPath({
  tags: ["List Config"],
  method: "delete",
  path: "/listConfig/{id}",
  summary: "Delete a list config",
  ...auth,
  request: {
    params: z.object({ id: z.string() }),
    query: z.object({ deleteItems: z.string().optional() }),
  },
  responses: {
    204: noContent,
    400: badRequest,
    404: notFound,
  },
});

registry.registerPath({
  tags: ["List Config"],
  method: "get",
  path: "/list/{id}",
  summary: "Get a list with entities (public or owned)",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "List with entities",
      ...json(z.object({ entities: z.array(EntitySchema), total: z.number(), listConfig: ListConfigSchema })),
    },
    403: forbidden,
    500: serverError,
  },
});

registry.registerPath({
  tags: ["List Config"],
  method: "put",
  path: "/listFilter/{id}",
  summary: "Update the filter for a list config",
  ...auth,
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: z.record(z.string(), z.unknown()) } } },
  },
  responses: {
    204: noContent,
    400: badRequest,
    403: forbidden,
  },
});

registry.registerPath({
  tags: ["List Config"],
  method: "put",
  path: "/listSort/{id}",
  summary: "Update the sort for a list config",
  ...auth,
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: z.record(z.string(), z.unknown()) } } },
  },
  responses: {
    204: noContent,
    400: badRequest,
    403: forbidden,
  },
});

registry.registerPath({
  tags: ["List Config"],
  method: "put",
  path: "/listThemes/{id}",
  summary: "Update the themes for a list config",
  ...auth,
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: z.array(z.string()) } } },
  },
  responses: {
    204: noContent,
    400: badRequest,
    403: forbidden,
  },
});

registry.registerPath({
  tags: ["List Config"],
  method: "put",
  path: "/listConfigAccessPolicy/{id}",
  summary: "Set access policy for a list config",
  ...auth,
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: AccessPolicyAssignment } } },
  },
  responses: {
    200: { description: "Updated", ...json(SuccessSchema) },
    400: badRequest,
    403: forbidden,
    500: serverError,
  },
});

// ─── Property Config routes ───────────────────────────────────────────────────

registry.registerPath({
  tags: ["Property Config"],
  method: "post",
  path: "/propertyConfig/{entityConfigId}",
  summary: "Create a property config (standard or calculated)",
  ...auth,
  request: {
    params: z.object({ entityConfigId: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.union([PropertyConfigCreateBody, CalculatedPropertyConfigCreateBody]),
        },
      },
    },
  },
  responses: {
    200: { description: "Created property config", ...json(z.record(z.string(), z.unknown())) },
    400: badRequest,
    403: forbidden,
    500: serverError,
  },
});

registry.registerPath({
  tags: ["Property Config"],
  method: "put",
  path: "/propertyConfig/{entityConfigId}/{id}",
  summary: "Update a property config (standard or calculated)",
  ...auth,
  request: {
    params: z.object({ entityConfigId: z.string(), id: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.union([PropertyConfigCreateBody, CalculatedPropertyConfigCreateBody]),
        },
      },
    },
  },
  responses: {
    200: { description: "Updated property config", ...json(z.record(z.string(), z.unknown())) },
    400: badRequest,
    403: forbidden,
    409: { description: "Revision conflict" },
    500: serverError,
  },
});

registry.registerPath({
  tags: ["Property Config"],
  method: "delete",
  path: "/propertyConfig/{entityConfigId}/{id}",
  summary: "Delete a property config",
  ...auth,
  request: { params: z.object({ entityConfigId: z.string(), id: z.string() }) },
  responses: {
    204: noContent,
    400: badRequest,
    403: forbidden,
  },
});

registry.registerPath({
  tags: ["Property Config"],
  method: "put",
  path: "/propertyConfigOrder/{entityConfigId}",
  summary: "Reorder property configs",
  ...auth,
  request: {
    params: z.object({ entityConfigId: z.string() }),
    body: { content: { "application/json": { schema: PropertyConfigUpdateOrderBody } } },
  },
  responses: {
    204: noContent,
    400: badRequest,
    403: forbidden,
    500: serverError,
  },
});

registry.registerPath({
  tags: ["Property Config"],
  method: "get",
  path: "/propertySuggestion/{propertyConfigId}/{query}",
  summary: "Get property value suggestions",
  ...auth,
  request: { params: z.object({ propertyConfigId: z.string(), query: z.string() }) },
  responses: {
    200: { description: "Suggestions", ...json(z.object({ suggestions: z.array(z.unknown()) })) },
    403: forbidden,
    500: serverError,
  },
});

// ─── Setting routes ───────────────────────────────────────────────────────────

registry.registerPath({
  tags: ["Settings"],
  method: "get",
  path: "/setting",
  summary: "Get all settings for the current user and system",
  ...auth,
  responses: {
    200: { description: "Settings", ...json(z.object({ user: z.record(z.string(), z.unknown()), system: z.record(z.string(), z.unknown()) })) },
    403: forbidden,
  },
});

registry.registerPath({
  tags: ["Settings"],
  method: "put",
  path: "/setting/{listConfigId}",
  summary: "Update a setting",
  ...auth,
  request: {
    params: z.object({ listConfigId: z.string() }),
    query: z.object({ isSystem: z.string().optional() }),
    body: { content: { "application/json": { schema: z.record(z.string(), z.unknown()) } } },
  },
  responses: {
    204: noContent,
    400: badRequest,
    403: forbidden,
  },
});

// ─── Tag routes ───────────────────────────────────────────────────────────────

registry.registerPath({
  tags: ["Tags"],
  method: "get",
  path: "/tag/{query}",
  summary: "Search tags by prefix",
  ...auth,
  request: { params: z.object({ query: z.string() }) },
  responses: {
    200: { description: "Matching tags", ...json(z.object({ tags: z.array(z.string()) })) },
    403: forbidden,
  },
});

registry.registerPath({
  tags: ["Tags"],
  method: "post",
  path: "/tag",
  summary: "Create a tag",
  ...auth,
  request: { body: { content: { "application/json": { schema: TagCreateBody } } } },
  responses: {
    200: { description: "Created tag", ...json(z.object({ label: z.string() })) },
    403: forbidden,
  },
});

registry.registerPath({
  tags: ["Tags"],
  method: "delete",
  path: "/tag/{query}",
  summary: "Delete a tag",
  ...auth,
  request: { params: z.object({ query: z.string() }) },
  responses: {
    200: { description: "Deleted", ...json(EmptySchema) },
    403: forbidden,
  },
});

registry.registerPath({
  tags: ["Tags"],
  method: "get",
  path: "/tagSuggestion/{query}",
  summary: "Get tag suggestions for an entity description",
  ...auth,
  request: { params: z.object({ query: z.string() }) },
  responses: {
    200: { description: "Tag suggestions", ...json(z.object({ suggestions: z.array(z.string()) })) },
    403: forbidden,
    500: serverError,
  },
});

// ─── Operations ───────────────────────────────────────────────────────────────

registry.registerPath({
  tags: ["Operations"],
  method: "post",
  path: "/operation",
  summary: "Perform a bulk operation on entities",
  ...auth,
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            operation: z.record(z.string(), z.unknown()),
            entities: z.array(z.number()),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: "Operation result", ...json(z.object({ status: z.number() })) },
    400: badRequest,
    403: forbidden,
    500: serverError,
  },
});

// ─── Access Policy routes ─────────────────────────────────────────────────────

registry.registerPath({
  tags: ["Access Policy"],
  method: "get",
  path: "/accessPolicy",
  summary: "List all access policies",
  ...auth,
  responses: {
    200: { description: "Access policies", ...json(z.object({ policies: z.array(AccessPolicySchema) })) },
    403: forbidden,
  },
});

registry.registerPath({
  tags: ["Access Policy"],
  method: "post",
  path: "/accessPolicy",
  summary: "Create an access policy",
  ...auth,
  request: { body: { content: { "application/json": { schema: AccessPolicyBody } } } },
  responses: {
    200: { description: "Created policy", ...json(z.object({ policy: AccessPolicySchema })) },
    403: forbidden,
    500: serverError,
  },
});

registry.registerPath({
  tags: ["Access Policy"],
  method: "put",
  path: "/accessPolicy/{id}",
  summary: "Update an access policy",
  ...auth,
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: AccessPolicyBody } } },
  },
  responses: {
    200: { description: "Updated policy", ...json(z.object({ policy: AccessPolicySchema })) },
    400: badRequest,
    403: forbidden,
    500: serverError,
  },
});

registry.registerPath({
  tags: ["Access Policy"],
  method: "delete",
  path: "/accessPolicy/{id}",
  summary: "Delete an access policy",
  ...auth,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    204: noContent,
    400: badRequest,
    403: forbidden,
    500: serverError,
  },
});

registry.registerPath({
  tags: ["Access Policy"],
  method: "get",
  path: "/accessPolicyGroup",
  summary: "List all access policy groups",
  ...auth,
  responses: {
    200: { description: "Groups", ...json(z.object({ groups: z.array(AccessPolicyGroupSchema) })) },
    403: forbidden,
  },
});

registry.registerPath({
  tags: ["Access Policy"],
  method: "post",
  path: "/accessPolicyGroup",
  summary: "Create an access policy group",
  ...auth,
  request: { body: { content: { "application/json": { schema: AccessPolicyGroupBody } } } },
  responses: {
    200: { description: "Created group", ...json(z.object({ group: AccessPolicyGroupSchema })) },
    403: forbidden,
    500: serverError,
  },
});

registry.registerPath({
  tags: ["Access Policy"],
  method: "put",
  path: "/accessPolicyGroup/{id}",
  summary: "Update an access policy group",
  ...auth,
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: AccessPolicyGroupBody } } },
  },
  responses: {
    200: { description: "Updated group", ...json(z.object({ group: AccessPolicyGroupSchema })) },
    400: badRequest,
    403: forbidden,
    500: serverError,
  },
});

registry.registerPath({
  tags: ["Access Policy"],
  method: "delete",
  path: "/accessPolicyGroup/{id}",
  summary: "Delete an access policy group",
  ...auth,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    204: noContent,
    400: badRequest,
    403: forbidden,
    500: serverError,
  },
});

registry.registerPath({
  tags: ["Access Policy"],
  method: "get",
  path: "/accessPolicyParty/{query}",
  summary: "Search for access policy parties (users or groups)",
  ...auth,
  request: { params: z.object({ query: z.string() }) },
  responses: {
    200: { description: "Matching parties", ...json(z.object({ parties: z.array(z.record(z.string(), z.unknown())) })) },
    403: forbidden,
    500: serverError,
  },
});

// ─── Workspace routes ─────────────────────────────────────────────────────────

registry.registerPath({
  tags: ["Workspace"],
  method: "get",
  path: "/workspace",
  summary: "List all workspaces",
  ...auth,
  responses: {
    200: { description: "Workspaces", ...json(z.object({ workspaces: z.array(WorkspaceSchema) })) },
    403: forbidden,
    500: serverError,
  },
});

registry.registerPath({
  tags: ["Workspace"],
  method: "get",
  path: "/workspace/{id}",
  summary: "Get a workspace by ID",
  ...auth,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: "Workspace", ...json(WorkspaceSchema) },
    403: forbidden,
    404: notFound,
  },
});

registry.registerPath({
  tags: ["Workspace"],
  method: "post",
  path: "/workspace",
  summary: "Create a workspace",
  ...auth,
  request: { body: { content: { "application/json": { schema: WorkspaceCreateBody } } } },
  responses: {
    200: { description: "Created workspace", ...json(WorkspaceSchema) },
    400: badRequest,
    403: forbidden,
  },
});

registry.registerPath({
  tags: ["Workspace"],
  method: "put",
  path: "/workspace/{id}",
  summary: "Update a workspace",
  ...auth,
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: WorkspaceUpdateBody } } },
  },
  responses: {
    200: { description: "Updated workspace", ...json(WorkspaceSchema) },
    400: badRequest,
    403: forbidden,
  },
});

registry.registerPath({
  tags: ["Workspace"],
  method: "delete",
  path: "/workspace/{id}",
  summary: "Delete a workspace",
  ...auth,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    204: noContent,
    400: badRequest,
    403: forbidden,
    404: notFound,
  },
});

// ─── Medal routes ─────────────────────────────────────────────────────────────

registry.registerPath({
  tags: ["Medals"],
  method: "get",
  path: "/medal",
  summary: "Get medals awarded to the current user",
  ...auth,
  responses: {
    200: { description: "Medals", ...json(z.object({ medals: z.array(MedalSchema) })) },
    403: forbidden,
    500: serverError,
  },
});

registry.registerPath({
  tags: ["Medals"],
  method: "get",
  path: "/medalConfig",
  summary: "List medal configs",
  ...auth,
  responses: {
    200: { description: "Medal configs", ...json(z.object({ medalConfigs: z.array(MedalConfigWithProgressSchema) })) },
    403: forbidden,
    500: serverError,
  },
});

registry.registerPath({
  tags: ["Medals"],
  method: "get",
  path: "/medalConfig/{id}",
  summary: "Get a medal config",
  ...auth,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: "Medal config", ...json(MedalConfigWithProgressSchema) },
    403: forbidden,
    500: serverError,
  },
});

registry.registerPath({
  tags: ["Medals"],
  method: "post",
  path: "/medalConfig",
  summary: "Create a medal config",
  ...auth,
  request: { body: { content: { "application/json": { schema: MedalConfigCreateBody } } } },
  responses: {
    200: { description: "Created medal config", ...json(MedalConfigSchema) },
    403: forbidden,
    500: serverError,
  },
});

registry.registerPath({
  tags: ["Medals"],
  method: "put",
  path: "/medalConfig/{id}",
  summary: "Update a medal config",
  ...auth,
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: MedalConfigCreateBody } } },
  },
  responses: {
    200: { description: "Updated medal config", ...json(MedalConfigSchema) },
    400: badRequest,
    403: forbidden,
    500: serverError,
  },
});

registry.registerPath({
  tags: ["Medals"],
  method: "delete",
  path: "/medalConfig/{id}",
  summary: "Delete a medal config",
  ...auth,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: "Deleted", ...json(EmptySchema) },
    400: badRequest,
    403: forbidden,
    500: serverError,
  },
});

// ─── Statistics / Chart routes ────────────────────────────────────────────────

registry.registerPath({
  tags: ["Statistics"],
  method: "post",
  path: "/chart",
  summary: "Generate chart data",
  ...auth,
  request: { body: { content: { "application/json": { schema: ChartRequestBody } } } },
  responses: {
    200: { description: "Chart data", ...json(z.object({ segments: z.array(z.record(z.string(), z.unknown())) })) },
    403: forbidden,
    500: serverError,
  },
});

// ─── Data export/import ───────────────────────────────────────────────────────

registry.registerPath({
  tags: ["Data"],
  method: "post",
  path: "/data/{operation}",
  summary: "Export or import data (operation: 'export' | 'import')",
  ...auth,
  request: {
    params: z.object({ operation: z.enum(["export", "import"]) }),
    body: { content: { "application/json": { schema: z.union([ExportBodySchema, z.record(z.string(), z.unknown())]) } } },
  },
  responses: {
    200: { description: "Data result", ...json(z.record(z.string(), z.unknown())) },
    403: forbidden,
    500: serverError,
  },
});

registry.registerPath({
  tags: ["Data"],
  method: "delete",
  path: "/data/{operation}",
  summary: "Nuke data by operation type (requires ENABLE_NUKE=1)",
  ...auth,
  request: { params: z.object({ operation: z.string() }) },
  responses: {
    202: { description: "Nuked" },
    400: badRequest,
    403: forbidden,
  },
});

// ─── Streak / Fact config routes ─────────────────────────────────────────────

const StreakSchema = z.object({
  id: z.number(),
  name: z.string(),
  userId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  context: StreakContextSchema,
});

const StreakResultSchema = z.object({
  streakId: z.number(),
  current: z.number(),
  longest: z.number(),
});

const FactSchema = z.object({
  id: z.number(),
  name: z.string(),
  userId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  context: z.record(z.string(), z.unknown()),
});

const FactResultSchema = z.object({
  factId: z.number(),
  value: z.union([z.string(), z.number()]),
});

registry.registerPath({
  tags: ["Streaks"],
  method: "get",
  path: "/streakRequest",
  summary: "List saved streak configs with current and longest counts",
  ...auth,
  request: { query: z.object({ bypassCache: z.string().optional() }) },
  responses: {
    200: { description: "Streaks and results", ...json(z.object({ streaks: z.array(StreakSchema), results: z.array(StreakResultSchema) })) },
    403: forbidden,
    500: serverError,
  },
});

registry.registerPath({
  tags: ["Streaks"],
  method: "post",
  path: "/streakRequest",
  summary: "Create a saved streak config",
  ...auth,
  request: { body: { content: { "application/json": { schema: z.object({ name: z.string(), context: StreakContextSchema }) } } } },
  responses: {
    200: { description: "Created streak", ...json(z.object({ streak: StreakSchema })) },
    400: badRequest,
    403: forbidden,
    500: serverError,
  },
});

registry.registerPath({
  tags: ["Streaks"],
  method: "put",
  path: "/streakRequest/{id}",
  summary: "Update a saved streak config",
  ...auth,
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: z.object({ name: z.string().optional(), context: StreakContextSchema.optional() }) } } },
  },
  responses: {
    200: { description: "Updated streak", ...json(z.object({ streak: StreakSchema })) },
    400: badRequest,
    403: forbidden,
    404: notFound,
    500: serverError,
  },
});

registry.registerPath({
  tags: ["Facts"],
  method: "get",
  path: "/factRequest",
  summary: "List saved fact configs with current resolved values",
  ...auth,
  request: { query: z.object({ bypassCache: z.string().optional() }) },
  responses: {
    200: { description: "Facts and results", ...json(z.object({ facts: z.array(FactSchema), results: z.array(FactResultSchema) })) },
    403: forbidden,
    500: serverError,
  },
});

registry.registerPath({
  tags: ["Facts"],
  method: "post",
  path: "/factRequest",
  summary: "Create a saved fact config",
  ...auth,
  request: { body: { content: { "application/json": { schema: z.object({ name: z.string(), context: z.record(z.string(), z.unknown()) }) } } } },
  responses: {
    200: { description: "Created fact", ...json(z.object({ fact: FactSchema })) },
    400: badRequest,
    403: forbidden,
    500: serverError,
  },
});

registry.registerPath({
  tags: ["Facts"],
  method: "put",
  path: "/factRequest/{id}",
  summary: "Update a saved fact config",
  ...auth,
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: z.object({ name: z.string().optional(), context: z.record(z.string(), z.unknown()).optional() }) } } },
  },
  responses: {
    200: { description: "Updated fact", ...json(z.object({ fact: FactSchema })) },
    400: badRequest,
    403: forbidden,
    404: notFound,
    500: serverError,
  },
});

// ─── Fact cache ───────────────────────────────────────────────────────────────

registry.registerPath({
  tags: ["Fact Cache"],
  method: "delete",
  path: "/factCache",
  summary: "Invalidate all fact cache entries for the current user",
  ...auth,
  responses: {
    200: { description: "Invalidated", ...json(z.object({ invalidated: z.string() })) },
    403: forbidden,
    500: serverError,
  },
});

registry.registerPath({
  tags: ["Fact Cache"],
  method: "delete",
  path: "/factCache/{contextKey}",
  summary: "Invalidate a specific fact cache entry",
  ...auth,
  request: { params: z.object({ contextKey: z.string() }) },
  responses: {
    200: { description: "Invalidated", ...json(z.object({ invalidated: z.string() })) },
    403: forbidden,
    500: serverError,
  },
});

registry.registerPath({
  tags: ["Fact Cache"],
  method: "delete",
  path: "/factRequestCache/{id}",
  summary: "Invalidate the cache for a single saved fact config",
  ...auth,
  request: { params: z.object({ id: z.coerce.number() }) },
  responses: {
    200: { description: "Invalidated", ...json(z.object({ invalidated: z.number() })) },
    400: { description: "Invalid id" },
    403: forbidden,
    404: { description: "Fact not found" },
    500: serverError,
  },
});

registry.registerPath({
  tags: ["Fact Cache"],
  method: "delete",
  path: "/streakRequestCache/{id}",
  summary: "Invalidate the cache for a single saved streak config",
  ...auth,
  request: { params: z.object({ id: z.coerce.number() }) },
  responses: {
    200: { description: "Invalidated", ...json(z.object({ invalidated: z.number() })) },
    400: { description: "Invalid id" },
    403: forbidden,
    404: { description: "Streak not found" },
    500: serverError,
  },
});

// ─── File upload ──────────────────────────────────────────────────────────────

registry.registerPath({
  tags: ["Files"],
  method: "post",
  path: "/file/{path}",
  summary: "Upload an image file",
  ...auth,
  request: {
    params: z.object({ path: z.string() }),
    body: { content: { "multipart/form-data": { schema: z.object({ file: z.string() }) } } },
  },
  responses: {
    200: { description: "Uploaded", ...json(z.object({ url: z.string() })) },
    400: badRequest,
    403: forbidden,
  },
});

// ─── Front-end logging ────────────────────────────────────────────────────────

registry.registerPath({
  tags: ["Logging"],
  method: "post",
  path: "/log",
  summary: "Report a client-side error",
  request: { body: { content: { "application/json": { schema: FrontEndLogPayload } } } },
  responses: {
    202: { description: "Accepted" },
    400: badRequest,
    500: serverError,
  },
});

// ─── Notifications ────────────────────────────────────────────────────────────

registry.registerPath({
  tags: ["Notifications"],
  method: "post",
  path: "/notification",
  summary: "Send a push notification (system only)",
  request: { body: { content: { "application/json": { schema: NotificationMessage } } } },
  responses: {
    204: noContent,
    400: badRequest,
    403: forbidden,
    500: serverError,
  },
});

registry.registerPath({
  tags: ["Notifications"],
  method: "post",
  path: "/pushSubscription",
  summary: "Register a push subscription",
  ...auth,
  request: { body: { content: { "application/json": { schema: PushSubscriptionPayload } } } },
  responses: {
    204: noContent,
    400: badRequest,
    403: forbidden,
    500: serverError,
  },
});

registry.registerPath({
  tags: ["Notifications"],
  method: "delete",
  path: "/pushSubscription",
  summary: "Remove a push subscription",
  ...auth,
  request: {
    body: {
      content: {
        "application/json": { schema: z.object({ endpoint: z.string() }) },
      },
    },
  },
  responses: {
    204: noContent,
    400: badRequest,
    403: forbidden,
    500: serverError,
  },
});

// ─── Leaderboard ──────────────────────────────────────────────────────────────

registry.registerPath({
  tags: ["Leaderboard"],
  method: "get",
  path: "/leaderboard",
  summary: "Get leaderboard scores",
  responses: {
    200: {
      description: "Leaderboard",
      ...json(z.object({ rank: z.number(), records: z.array(LeaderboardRecordSchema) })),
    },
  },
});

registry.registerPath({
  tags: ["Leaderboard"],
  method: "post",
  path: "/leaderboard",
  summary: "Submit a leaderboard score",
  request: { body: { content: { "application/json": { schema: LeaderboardCreateBody } } } },
  responses: {
    200: {
      description: "Leaderboard with new rank",
      ...json(z.object({ rank: z.number(), records: z.array(LeaderboardRecordSchema) })),
    },
  },
});

// ─── Weather ──────────────────────────────────────────────────────────────────

registry.registerPath({
  tags: ["Weather"],
  method: "get",
  path: "/weather",
  summary: "Get current weather for all configured locations",
  ...auth,
  responses: {
    200: { description: "Weather data", ...json(z.object({ locations: z.array(z.record(z.string(), z.unknown())) })) },
    403: forbidden,
    500: serverError,
  },
});

// ─── AI / Assist ──────────────────────────────────────────────────────────────

registry.registerPath({
  tags: ["AI Assist"],
  method: "get",
  path: "/assist",
  summary: "Trigger AI list config suggestions (system only)",
  responses: {
    204: noContent,
    403: forbidden,
    500: serverError,
  },
});

registry.registerPath({
  tags: ["AI Assist"],
  method: "post",
  path: "/assist/entity",
  summary: "Proxy an entity to the AI assist service",
  ...auth,
  request: {
    body: { content: { "multipart/form-data": { schema: z.object({ file: z.string() }) } } },
  },
  responses: {
    200: { description: "AI assist response", ...json(z.record(z.string(), z.unknown())) },
    400: badRequest,
    403: forbidden,
    500: serverError,
  },
});

registry.registerPath({
  tags: ["AI Assist"],
  method: "get",
  path: "/assist/health",
  summary: "Check AI assist service health",
  responses: {
    200: { description: "Health status" },
    500: serverError,
  },
});

registry.registerPath({
  tags: ["AI Assist"],
  method: "post",
  path: "/suggestEntity/{date}",
  summary: "Create AI-suggested entities for a date (system only)",
  request: {
    params: z.object({ date: z.string() }),
    query: z.object({ ignoreLock: z.string().optional() }),
    body: {
      content: {
        "application/json": { schema: z.array(EntityBodyPayloadSchema) },
      },
    },
  },
  responses: {
    200: { description: "Created suggested entities", ...json(z.object({ entities: z.array(EntitySchema) })) },
    400: badRequest,
    403: forbidden,
    409: { description: "Suggestion already locked for date" },
    500: serverError,
  },
});

registry.registerPath({
  tags: ["AI Assist"],
  method: "get",
  path: "/suggestAccept",
  summary: "Accept a suggested entity via one-time token",
  request: { query: z.object({ token: z.string() }) },
  responses: {
    200: { description: "Accepted or rejected", ...json(SuccessSchema) },
    403: forbidden,
    500: serverError,
  },
});

// ─── Google ───────────────────────────────────────────────────────────────────

registry.registerPath({
  tags: ["Google"],
  method: "get",
  path: "/google/link",
  summary: "Generate Google OAuth URL for account linking",
  ...auth,
  request: { query: z.object({ returnUrl: z.string().optional() }) },
  responses: {
    200: { description: "OAuth URL", ...json(z.object({ url: z.string() })) },
    403: forbidden,
  },
});

registry.registerPath({
  tags: ["Google"],
  method: "get",
  path: "/google/callback",
  summary: "OAuth callback — saves Google account and redirects",
  request: { query: z.object({ code: z.string(), state: z.string() }) },
  responses: {
    302: { description: "Redirect to returnUrl" },
    400: badRequest,
    500: serverError,
  },
});

registry.registerPath({
  tags: ["Google"],
  method: "get",
  path: "/google/event",
  summary: "Get Google Calendar events for the linked account",
  ...auth,
  responses: {
    200: { description: "Calendar events", ...json(z.object({ events: z.array(z.record(z.string(), z.unknown())) })) },
    403: forbidden,
    405: { description: "Method not allowed" },
  },
});

// ─── Generator ───────────────────────────────────────────────────────────────

export function generateDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: "3.0.0",
    info: {
      title: "Gapi",
      version: "1.0.0",
      description: "REST API for the Orbit frontend",
    },
    servers: [{ url: "http://localhost:9999/api", description: "Local" }],
  });
}
