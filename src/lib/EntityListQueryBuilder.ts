import {
  FilterProperty,
  ListFilter,
  ListSort,
  ListSortCustomProperty,
  ListSortDirection,
  ListSortNativeProperty,
  ListSortProperty,
  TextType,
} from "api-spec/models/List";
import { getDefaultFilter, prisma } from "..";
import { PrismaEntity } from "../models/Entity";
import { Util } from "./Util";
import { DataType } from "api-spec/models/Entity";

export class EntityListQueryBuilder {
  private params: Record<string, any> = {};
  private userId: string = "";
  private filter: ListFilter = getDefaultFilter();
  private sort: ListSort = {
    property: ListSortNativeProperty.CREATED_AT,
    direction: ListSortDirection.DESC,
  };
  private pagination: { start: number; perPage: number } = {
    start: 0,
    perPage: 25,
  };
  private isCustomSort: boolean = false;

  constructor() {}

  setUserId(userId: string) {
    this.userId = userId;
    this.registerParam("userId", this.userId);
  }

  setFilter(filter: ListFilter) {
    this.filter = filter;
  }

  setSort(sort: ListSort) {
    this.sort = sort;
    const sortProperty = this.sort.property;

    if ((sortProperty as ListSortCustomProperty)?.propertyId !== undefined) {
      this.isCustomSort = true;
    }
  }

  setPagination(start: number, perPage: number) {
    this.pagination = { start, perPage };
  }

  buildQuery(countOnly: boolean = false): string {
    let query = `
      SELECT
      ${
        countOnly
          ? "COUNT(*)"
          : `
        e.*,
        tags,
       ${Object.values(DataType)
         .map((type) => `"${type}Properties"`)
         .join(", ")},
        "accessPolicy"
        ${this.isCustomSort ? `, sortPropRows."value" as sortValue` : ""}`
      }
      FROM
        "Entity" e
        `;

    if (!countOnly) {
      this.registerParam("limit", this.pagination.perPage);
      this.registerParam("offset", this.pagination.start);

      query += `
        ${this.getTagsFragment()}
        ${this.getPropTypesFragment()}
        ${this.getAccessPolicyFragment()}
        ${this.getSortJoinFragment()}
        `;
    }

    query += `
      WHERE
        e."userId" = {userId}::uuid
        ${this.getFilterFragment()}
    `;

    if (!countOnly) {
      query += `
      ${this.getSortFragment()}
        LIMIT {limit} OFFSET {offset}
      `;
    }

    return query;
  }

  getQuery(): string {
    return this.buildQuery();
  }

  async runQuery(): Promise<PrismaEntity[]> {
    let query = this.getQuery();

    for (const key in this.params) {
      query = query.replace(
        new RegExp(`\\{${key}\\}`, "g"),
        `$${Object.keys(this.params).indexOf(key) + 1}`
      );
    }

    const result = (await prisma.$queryRawUnsafe(
      query,
      ...Object.values(this.params)
    )) as PrismaEntity[];
    return result;
  }

  buildIdsQuery(): string {
    return `
      SELECT e."id"
      FROM "Entity" e
      WHERE
        e."userId" = {userId}::uuid
        ${this.getFilterFragment()}
    `;
  }

  async runIdsQuery(): Promise<number[]> {
    let query = this.buildIdsQuery();

    for (const key in this.params) {
      query = query.replace(
        new RegExp(`\\{${key}\\}`, "g"),
        `$${Object.keys(this.params).indexOf(key) + 1}`
      );
    }

    const result = (await prisma.$queryRawUnsafe(
      query,
      ...Object.values(this.params)
    )) as { id: number }[];
    return result.map(r => r.id);
  }

  registerParam(placeholder: string, value: any) {
    this.params[placeholder] = value;
  }

  getCountQuery(): string {
    return this.buildQuery(true);
  }

  getTagsFragment(): string {
    return `
    	LEFT JOIN LATERAL (
		    SELECT COALESCE(json_agg(
          json_build_object(
            'label', entityTag."label"
          ) ORDER BY entityTag."label"), '[]'::json
		    ) AS tags
		  FROM "EntityTag" entityTag
		  WHERE entityTag."entityId" = e."id"	
	  ) tags ON true
   `;
  }

  getPropTypesFragment(): string {
    return Object.values(DataType)
      .map((type) => this.getPropTypeFragment(type))
      .join("\n");
  }

  getPropTypeFragment(dataType: DataType): string {
    const dataTypeCamelCase = dataType;
    const dataTypePascalCase = Util.capitalize(dataType);

    const valueExpr =
      dataTypePascalCase === "Date"
        ? `( (EXTRACT(EPOCH FROM ${dataTypePascalCase}PropVal."value") * 1000)::bigint )`
        : `${dataTypePascalCase}PropVal."value"`;

    return `
	    LEFT JOIN LATERAL (
		    SELECT json_agg(
			    json_build_object(
			    'entityId', ${dataTypePascalCase}Prop."entityId",
			    'propertyValueId', ${dataTypePascalCase}Prop."propertyValueId",
          'propertyConfigId', ${dataTypePascalCase}Prop."propertyConfigId",
          'order', ${dataTypePascalCase}Prop."order",
          ${
            dataTypePascalCase === "Image"
              ? `'propertyValue', json_build_object('url', ${dataTypePascalCase}PropVal."url",'altText', ${dataTypePascalCase}PropVal."altText")`
              : `'propertyValue', json_build_object('value', ${valueExpr})`
          }
			  ) ORDER BY ${dataTypePascalCase}Prop."order"
		  ) AS "${dataTypeCamelCase}Properties"
		  FROM "Entity${dataTypePascalCase}Property" ${dataTypePascalCase}Prop
		  JOIN "${dataTypePascalCase}PropertyValue" ${dataTypePascalCase}PropVal ON ${dataTypePascalCase}Prop."propertyValueId" = ${dataTypePascalCase}PropVal."id"
		  WHERE ${dataTypePascalCase}Prop."entityId" = e."id"
    ) ${dataTypePascalCase}Props ON true
   `;
  }

  getAccessPolicyFragment(): string {
    const partiesSubquery = (policyAlias: string) => `
      COALESCE((
        SELECT json_agg(
          json_build_object(
            'id', party."id",
            'type', party."type",
            'name', CASE
              WHEN party."type" = 'user' THEN u."username"
              WHEN party."type" = 'group' THEN grp."name"
              ELSE ''
            END,
            'userId', party."userId",
            'groupId', party."groupId"::text,
            'users', CASE
              WHEN party."type" = 'group' THEN (
                SELECT COALESCE(json_agg(json_build_object('id', gu."userId", 'name', guu."username")), '[]'::json)
                FROM "AccessPolicyGroupUser" gu
                JOIN "User" guu ON guu."id" = gu."userId"
                WHERE gu."groupId" = party."groupId"
              )
              ELSE NULL
            END
          )
        )
        FROM "AccessPolicyParty" party
        LEFT JOIN "User" u ON u."id" = party."userId"
        LEFT JOIN "AccessPolicyGroup" grp ON grp."id" = party."groupId"
        WHERE party."accessPolicyId" = ${policyAlias}."id"
      ), '[]'::json)
    `;

    return `
      LEFT JOIN LATERAL (
        SELECT json_build_object(
          'entityId', eap."entityId",
          'viewAccessPolicyId', eap."viewAccessPolicyId",
          'editAccessPolicyId', eap."editAccessPolicyId",
          'viewAccessPolicy', CASE WHEN vap."id" IS NOT NULL THEN json_build_object(
            'id', vap."id",
            'name', vap."name",
            'description', vap."description",
            'parties', ${partiesSubquery("vap")}
          ) ELSE NULL END,
          'editAccessPolicy', CASE WHEN editap."id" IS NOT NULL THEN json_build_object(
            'id', editap."id",
            'name', editap."name",
            'description', editap."description",
            'parties', ${partiesSubquery("editap")}
          ) ELSE NULL END
        ) AS "accessPolicy"
        FROM "EntityAccessPolicy" eap
        LEFT JOIN "AccessPolicy" vap ON vap."id" = eap."viewAccessPolicyId"
        LEFT JOIN "AccessPolicy" editap ON editap."id" = eap."editAccessPolicyId"
        WHERE eap."entityId" = e."id"
      ) entityAccessPolicyData ON true
    `;
  }

  getCustomSortJoinFragment(): string {
    const sortProperty = this.sort.property as ListSortCustomProperty;
    const propTypeCamelCase = sortProperty.dataType;
    const propTypePascalCase = Util.capitalize(sortProperty.dataType);

    return `
      LEFT JOIN LATERAL (
		    SELECT ${propTypeCamelCase}PropVal."value"
		    FROM "Entity${propTypePascalCase}Property" ${propTypeCamelCase}Prop
		    JOIN "${propTypePascalCase}PropertyValue" ${propTypeCamelCase}PropVal ON ${propTypeCamelCase}Prop."propertyValueId" = ${propTypeCamelCase}PropVal."id"
		    WHERE ${propTypeCamelCase}Prop."entityId" = e."id"
		    AND ${propTypeCamelCase}Prop."propertyConfigId" = ${sortProperty.propertyId}
		    LIMIT 1
	    ) sortPropRows ON true
      `;
  }

  getSortJoinFragment(): string {
    if (!this.isCustomSort) {
      return "";
    }

    return this.getCustomSortJoinFragment();
  }

  getNativeSortFragment(): string {
    const sortProperty = this.sort.property as ListSortNativeProperty;

    const sortColumn = Object.values(ListSortNativeProperty).includes(
      sortProperty
    )
      ? sortProperty
      : ListSortNativeProperty.CREATED_AT;

    return `ORDER BY e."${sortColumn}" ${this.sort.direction}`;
  }

  getCustomSortFragment(): string {
    return `ORDER BY sortValue ${this.sort.direction}, e."id"`;
  }

  getSortFragment(): string {
    if (!this.isCustomSort) {
      return this.getNativeSortFragment();
    }

    return this.getCustomSortFragment();
  }

  getFilterFragment(): string {
    let fragment = "";

    if (this.filter.includeTypes && this.filter.includeTypes.length) {
      fragment += ` AND e."entityConfigId" = ANY({types}::int[]) `;
      this.registerParam("types", this.filter.includeTypes);
    }

    if (this.filter.tagging.containsAllOf.length) {
      fragment += this.getFilterTagsContainsAllOfFragment();
    }

    if (this.filter.tagging.containsOneOf.length) {
      fragment += this.getFilterTagsContainsOneOfFragment();
    }

    if (this.filter.properties && this.filter.properties.length > 0) {
      this.filter.properties.forEach((prop, index) => {
        fragment += this.getFilterPropertyFragment(prop, index);
      });
    }

    return fragment;
  }

  buildTextCondition(
    operation: TextType,
    value: string,
    propValParam: string
  ): (column: string) => string {
    switch (operation) {
      case TextType.STARTS_WITH:
        this.registerParam(propValParam, `${value}%`);
        return (col) => `${col} ILIKE {${propValParam}}::text`;
      case TextType.ENDS_WITH:
        this.registerParam(propValParam, `%${value}`);
        return (col) => `${col} ILIKE {${propValParam}}::text`;
      case TextType.CONTAINS:
      default:
        this.registerParam(propValParam, `%${value}%`);
        return (col) => `${col} ILIKE {${propValParam}}::text`;
    }
  }

  getFilterPropertyFragment(prop: FilterProperty, index: number): string {
    const propIdParam = `filterPropId${index}`;
    const propValParam = `filterPropVal${index}`;
    const value = prop.value;

    this.registerParam(propIdParam, prop.propertyId);

    if (typeof value === "boolean") {
      this.registerParam(propValParam, value);
      return `
        AND EXISTS (
          SELECT 1
          FROM "EntityBooleanProperty" ebp
          JOIN "BooleanPropertyValue" bpv ON ebp."propertyValueId" = bpv."id"
          WHERE ebp."entityId" = e."id"
          AND ebp."propertyConfigId" = {${propIdParam}}::int
          AND bpv."value" = {${propValParam}}::boolean
        )
      `;
    }

    if (typeof value === "number") {
      this.registerParam(propValParam, value);
      return `
        AND EXISTS (
          SELECT 1
          FROM "EntityIntProperty" eip
          JOIN "IntPropertyValue" ipv ON eip."propertyValueId" = ipv."id"
          WHERE eip."entityId" = e."id"
          AND eip."propertyConfigId" = {${propIdParam}}::int
          AND ipv."value" = {${propValParam}}::int
        )
      `;
    }

    if (typeof value === "string") {
      const textCondition = this.buildTextCondition(prop.operation, value, propValParam);
      return `
        AND (
          EXISTS (
            SELECT 1
            FROM "EntityShortTextProperty" estp
            JOIN "ShortTextPropertyValue" stpv ON estp."propertyValueId" = stpv."id"
            WHERE estp."entityId" = e."id"
            AND estp."propertyConfigId" = {${propIdParam}}::int
            AND ${textCondition('stpv."value"')}
          )
          OR EXISTS (
            SELECT 1
            FROM "EntityLongTextProperty" eltp
            JOIN "LongTextPropertyValue" ltpv ON eltp."propertyValueId" = ltpv."id"
            WHERE eltp."entityId" = e."id"
            AND eltp."propertyConfigId" = {${propIdParam}}::int
            AND ${textCondition('ltpv."value"')}
          )
        )
      `;
    }

    return "";
  }

  getFilterTagsContainsOneOfFragment(): string {
    const tagLabels = this.filter.tagging.containsOneOf || [];
    if (tagLabels.length === 0) {
      return "";
    }

    this.registerParam("tagLabels", tagLabels);

    return `
      ${
        this.filter.includeUntagged
          ? ` AND ( ${this.getFilterTagsUnfilteredFragment()} OR `
          : " AND "
      }

      EXISTS (
        SELECT 1
        FROM "EntityTag" entityTag
        WHERE entityTag."entityId" = e."id"
          AND entityTag."label" = ANY({tagLabels}::text[])
      )
      ${this.filter.includeUntagged ? ")" : " "}
    `;
  }

  getFilterTagsContainsAllOfFragment(): string {
    const tagLabels = this.filter.tagging.containsAllOf || [];
    if (tagLabels.length === 0) {
      return "";
    }

    this.registerParam("tagLabels", tagLabels);

    return `
      ${
        this.filter.includeUntagged
          ? ` AND ( ${this.getFilterTagsUnfilteredFragment()} OR `
          : " AND "
      }

     (
        SELECT COUNT(DISTINCT entityTag."label")
        FROM "EntityTag" entityTag
        WHERE entityTag."entityId" = e."id"
          AND entityTag."label" = ANY({tagLabels}::text[])
      ) = array_length({tagLabels}::text[], 1)
      ${this.filter.includeUntagged ? ")" : " "}
    `;
  }

  getFilterTagsUnfilteredFragment(): string {
    return `
      NOT EXISTS (
        SELECT 1 FROM "EntityTag" entityTag WHERE entityTag."entityId" = e."id"
      )`;
  }
}
