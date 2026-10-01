/**
 * Top deals: the daily top cities job and the read model behind /top-deals.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/top-deals/index.ts
 * Deps:    src/top-deals/cities.ts, src/top-deals/read-model.ts
 * Tested:  test/top-deals/cities.test.ts, test/top-deals/read-model.test.ts, test/top-deals/query-plan.test.ts
 */
export { TOP_CITY_COUNT, runTopCitiesRefresh } from "./cities";
export { LABEL_LIMIT, TOP_DEALS_LIMIT, buildTopDealsSql, createTopDealsReadModel } from "./read-model";
export type { BoundSql } from "./read-model";
