/**
 * Props of every page and the renderer type. FROZEN after Wave 0. A page is a pure function
 * from props to a full HTML document; it never reads the database or the request.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/contracts/pages.ts
 * Deps:    src/contracts/ports.ts, src/contracts/reports.ts
 * Tested:  n/a (types only)
 */
import type { CheckoutResult, DealCard, DealDetail, OrderStatusResult, PriceChangeRow, SearchQuery } from "./ports";
import type { PriceTruthReport, ScorecardReport, SyncStatus, TopCategory, TopCity, TopDealsReport } from "./reports";

export type PageRenderer<P> = (props: P) => string | Promise<string>;

export interface LoginPageProps {
  /** Path to open after login. Already validated: starts with "/" and not "//". */
  readonly next: string;
  readonly wrong: boolean;
  /** Too many failed attempts; the form is shown disabled. */
  readonly locked: boolean;
}

export interface ReturnPageProps {
  /** null when the shopper arrived without a valid grouponOrderUuid. */
  readonly uuid: string | null;
  /** null = not read yet; the page polls /3pd/return/status. */
  readonly order: OrderStatusResult | null;
}

export interface FinderPageProps {
  readonly query: SearchQuery;
  readonly searched: boolean;
  readonly cards: readonly DealCard[];
  /** How many deals the catalogue copy holds that can be sold. 0 = nothing loaded yet. */
  readonly listableDeals: number;
  /** When nothing was searched, the theme the cards were picked for (rotates daily). null = no picks. */
  readonly featuredTheme: string | null;
  /** The pickers shared with Top deals: the 50 cities with the most listable products, and the tagged
   *  categories things-to-do first. Empty before the first city refresh or category walk. */
  readonly cities: readonly TopCity[];
  readonly categories: readonly TopCategory[];
  /** Epoch milliseconds at render time, so the page can say when the next delta sync runs. */
  readonly now: number;
}

export interface DealPageProps {
  readonly deal: DealDetail;
  readonly priceHistory: readonly PriceChangeRow[];
}

export interface CheckoutPageProps {
  readonly result: CheckoutResult;
}

export interface PriceTruthPageProps {
  readonly report: PriceTruthReport;
  /**
   * The catalogue sync runs as recorded, the same value the Scorecard gets, so both pages state the
   * last delta sync, the syncs today and the last full load from one record (CEO review 1, loop 5).
   */
  readonly sync: SyncStatus;
  /** Epoch milliseconds at render time, so the page can say when the next delta sync runs. */
  readonly now: number;
}

export interface ScorecardPageProps {
  readonly report: ScorecardReport;
  readonly sync: SyncStatus;
  /** Epoch milliseconds at render time, so the page can say how old the latest run is. */
  readonly now: number;
}

export interface TopDealsPageProps {
  readonly report: TopDealsReport;
  /** Epoch milliseconds at render time, so the page can say when the next delta sync runs. */
  readonly now: number;
}

export interface NotFoundPageProps {
  readonly path: string;
}
