export enum ListFilterType {
  CONTAINS_ONE_OF = "containsOneOf",
  CONTAINS_ALL_OF = "containsAllOf",
}

export interface ListFilter {
  tagging: Record<ListFilterType, string[]>;
  includeUntagged: boolean;
  includeAll: boolean;
}
