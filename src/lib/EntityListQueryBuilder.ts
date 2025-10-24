import {
  ListFilter,
  ListSort,
  ListSortDirection,
  ListSortProperty,
} from "api-spec/models/List";
import { getDefaultFilter } from "..";
import { EntityPropTypeModelName } from "../models/Entity";
import { Util } from "./Util";
import { DataType } from "api-spec/models/Entity";

export class EntityListQueryBuilder {
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
       ${Object.values(DataType)
         .map((type) => `"${type}Properties"`)
         .join(", ")},
        sortPropRows."value" as sortValue`
      }
      FROM
        "Entity" e`;

    if (!countOnly) {
      query += this.getTagsFragment();
      query += this.getPropTypesFragment();
      query += this.getSortFragment(DataType.INT);
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
    return Object.values(DataType)
      .map((type) => this.getPropTypeFragment(type))
      .join("\n");
  }

  getPropTypeFragment(dataType: DataType): string {
    const dataTypeCamelCase = dataType;
    const dataTypePascalCase = Util.capitalize(dataType);

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
              : `'propertyValue', json_build_object('value', ${dataTypePascalCase}PropVal."value")`
          }
			  ) ORDER BY ${dataTypePascalCase}Prop."order"
		  ) AS "${dataTypeCamelCase}Properties"
		  FROM "Entity${dataTypePascalCase}Property" ${dataTypePascalCase}Prop
		  JOIN "${dataTypePascalCase}PropertyValue" ${dataTypePascalCase}PropVal ON ${dataTypePascalCase}Prop."propertyValueId" = ${dataTypePascalCase}PropVal."id"
		  WHERE ${dataTypePascalCase}Prop."entityId" = e."id"
    ) ${dataTypePascalCase}Props ON true
   `;
  }

  getSortFragment(dataType: DataType): string {
    const propTypeCamelCase = dataType;
    const propTypePascalCase = Util.capitalize(dataType);

    return `
      LEFT JOIN LATERAL (
		    SELECT ${propTypeCamelCase}PropVal."value"
		    FROM "Entity${propTypePascalCase}Property" ${propTypeCamelCase}Prop
		    JOIN "${propTypePascalCase}PropertyValue" ${propTypeCamelCase}PropVal ON ${propTypeCamelCase}Prop."propertyValueId" = ${propTypeCamelCase}PropVal."id"
		    WHERE ${propTypeCamelCase}Prop."entityId" = e."id"
		    AND ${propTypeCamelCase}Prop."propertyConfigId" = 11
		    LIMIT 1
	    ) sortPropRows ON true
   `;
  }
}
