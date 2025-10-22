import {
  ListContext,
  ListContextType,
  ListContextUnit,
  ListFilter,
  ListFilterTimeType,
  ListSort,
  ListSortDirection,
  ListSortProperty,
} from "api-spec/models/List";
import { getDefaultFilter } from "..";
import { EntityPropTypeModelName } from "../models/Entity";

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

  getQuery(): string {
    let query = `
      SELECT
        e.*,
        entityTags,
        IntValues,
        ShortTextValues,
        sortPropRows."value" as sortValue
      FROM
        "Entity" e

	LEFT JOIN LATERAL (
		SELECT COALESCE(json_agg(
			entityTag."label" ORDER BY entityTag."label"), '[]'::json
		) AS entityTags
		FROM "EntityTag" entityTag
		WHERE entityTag."entityId" = e."id"
		
	) entityTags ON true

      ${this.getPropTypesFragment()}
      ${this.getSortFragment()}


      ORDER BY sortValue DESC, e."id"
    
    `;
    return query;
  }

  getPropTypesFragment(): string {
    const propTypes: EntityPropTypeModelName[] = [
      "Boolean",
      "Date",
      "Image",
      "Int",
      "LongText",
      "ShortText",
    ];
    return propTypes.map((type) => this.getPropTypeFragment(type)).join("\n");
  }

  getPropTypeFragment(propType: EntityPropTypeModelName): string {
    return `
	    LEFT JOIN LATERAL (
		    SELECT json_agg(
			    json_build_object(
			    'entityId', ${propType}Prop."entityId",
			    'propertyValueId', ${propType}Prop."propertyValueId",
          ${
            propType === "Image"
              ? `'url', ${propType}PropVal."url",'altText', ${propType}PropVal."altText"`
              : `'value', ${propType}PropVal."value"`
          }
			  ) ORDER BY ${propType}Prop."order"
		  ) AS ${propType}Values
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
