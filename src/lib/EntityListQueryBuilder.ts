import {
  ListFilter,
  ListSort,
  ListSortCustomProperty,
  ListSortDirection,
  ListSortNativeProperty,
  ListSortProperty,
} from "api-spec/models/List";
import { getDefaultFilter, prisma } from "..";
import { EntityPropTypeModelName, PrismaEntity } from "../models/Entity";
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
         .join(", ")}
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

    return `ORDER BY e."${sortColumn}" ${this.sort.direction}, e."id"`;
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
    if (this.filter.tagging.containsAllOf.length) {
      fragment += this.getFilterTagsContainsAllOfFragment();
    }

    if (this.filter.tagging.containsOneOf.length) {
      fragment += this.getFilterTagsContainsOneOfFragment();
    }

    return fragment;
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
