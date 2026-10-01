/**
 * Registry of probe checks, in run order. Integrator-owned: lanes edit only their check file.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/probe/checks/index.ts
 * Deps:    src/probe/checks/*.ts
 * Tested:  test/contracts/registry.test.ts
 */
import type { ProbeCheck } from "../../contracts/ports";
import { check as openapiDrift } from "./openapi-drift";
import { check as guideVersion } from "./guide-version";
import { check as registration } from "./registration";
import { check as cataloguePage } from "./catalogue-page";
import { check as catalogueWalk } from "./catalogue-walk";
import { check as catalogueDelta } from "./catalogue-delta";
import { check as refusals } from "./refusals";
import { check as cartLifecycle } from "./cart-lifecycle";
import { check as priceMismatch } from "./price-mismatch";
import { check as buyLink } from "./buy-link";
import { check as orderRead } from "./order-read";

export const ALL_CHECKS: readonly ProbeCheck[] = [
  openapiDrift,
  guideVersion,
  registration,
  cataloguePage,
  catalogueWalk,
  catalogueDelta,
  refusals,
  cartLifecycle,
  priceMismatch,
  buyLink,
  orderRead,
];
