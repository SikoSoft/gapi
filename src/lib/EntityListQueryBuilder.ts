import {
  ListFilter,
  ListSort,
  ListSortDirection,
  ListSortProperty,
} from "api-spec/models/List";
import { getDefaultFilter } from "..";
import { EntityPropTypeModelName } from "../models/Entity";
import { Util } from "./Util";

export class EntityListQueryBuilder {
  static propTypes: EntityPropTypeModelName[] = [
    "Boolean",
    "Date",
    "Image",
    "Int",
    "LongText",
    "ShortText",
  ];
  private userId: string = "";
  private filter: ListFilter = getDefaultFilter();
  private sort: ListSort = {
    property: ListSortProperty.CREATED_AT,
    direction: ListSortDirection.DESC,
  };
  private pagination: { start: number; perPage: number } = {
    start: 0,
    perPage: 25,
  };

  constructor() {}

  setUserId(userId: string) {
    this.userId = userId;
  }

  setFilter(filter: ListFilter) {
    this.filter = filter;
  }

  setSort(sort: ListSort) {
    this.sort = sort;
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
       ${EntityListQueryBuilder.propTypes
         .map((type) => `"${Util.uncapitalize(type)}Properties"`)
         .join(", ")},
        sortPropRows."value" as sortValue`
      }
      FROM
        "Entity" e`;

    if (!countOnly) {
      query += this.getTagsFragment();
      query += this.getPropTypesFragment();
      query += this.getSortFragment();
      query += `ORDER BY sortValue DESC, e."id"`;
    }

    return query;
  }

  getQuery(): string {
    return this.buildQuery();
  }

  getCountQuery(): string {
    return this.buildQuery(true);
  }

  getTagsFragment(): string {
    return `
    	LEFT JOIN LATERAL (
		    SELECT COALESCE(json_agg(
			    entityTag."label" ORDER BY entityTag."label"), '[]'::json
		    ) AS tags
		  FROM "EntityTag" entityTag
		  WHERE entityTag."entityId" = e."id"	
	  ) tags ON true
   `;
  }

  getPropTypesFragment(): string {
    return EntityListQueryBuilder.propTypes
      .map((type) => this.getPropTypeFragment(type))
      .join("\n");
  }

  getPropTypeFragment(propType: EntityPropTypeModelName): string {
    const propTypeCamelCase = Util.uncapitalize(propType);

    return `
	    LEFT JOIN LATERAL (
		    SELECT json_agg(
			    json_build_object(
			    'entityId', ${propType}Prop."entityId",
			    'propertyValueId', ${propType}Prop."propertyValueId",
          'propertyConfigId', ${propType}Prop."propertyConfigId",
          'order', ${propType}Prop."order",
          ${
            propType === "Image"
              ? `'propertyValue', json_build_object('url', ${propType}PropVal."url",'altText', ${propType}PropVal."altText")`
              : `'propertyValue', json_build_object('value', ${propType}PropVal."value")`
          }
			  ) ORDER BY ${propType}Prop."order"
		  ) AS "${propTypeCamelCase}Properties"
		  FROM "Entity${propType}Property" ${propType}Prop
		  JOIN "${propType}PropertyValue" ${propType}PropVal ON ${propType}Prop."propertyValueId" = ${propType}PropVal."id"
		  WHERE ${propType}Prop."entityId" = e."id"
    ) ${propType}Props ON true
   `;
  }

  getSortFragment(): string {
    return `
      LEFT JOIN LATERAL (
		    SELECT intPropVal."value"
		    FROM "EntityIntProperty" intProp
		    JOIN "IntPropertyValue" intPropVal ON intPropVal."id" = intProp."propertyValueId"
		    WHERE intProp."entityId" = e."id"
		    AND intProp."propertyConfigId" = 11
		    LIMIT 1
	    ) sortPropRows ON true
   `;
  }
}
