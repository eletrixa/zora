<!-- Module: docs/lanes/collector.md · Tested: n/a -->
# Lane collector

**You build:** `collector/` — Bun scripts that run on the machine zora (not in the Worker), read public groupon.com pages and post what they saw to the lab.
**Read first:** `src/contracts/ingest.ts` (the payloads, import the types from there), `docs/lanes/monitor.md` section 3.
**Fixture:** a saved listing page is at `a scratch file outside the repo` (878 KB, HTTP 200 from zora on 2026-09-29). Cut the `<script type="application/ld+json">` blocks out of it into `test/collector/fixtures/listing.html` (keep it under 60 KB). The guide page text is `docs/reference/partner-guide-v7.txt` (it contains "Version 7.").
**Known:** single deal pages answer HTTP 403 from zora. Listing pages answer 200 and carry JSON-LD `ItemList` entries with `url`, `offers.price`, `offers.priceCurrency`, `offers.priceSpecification.price` (list price), `brand.name`.

## Files

- `collector/parse.ts`: pure functions. `parseListing(html, sourceUrl, observedAt): PublicPriceObservation[]` and `parseGuideVersion(text): string | null`.
- `collector/pages.json`: the listing pages to read, at most 12, e.g. `https://www.groupon.com/local/chicago/massage`. Pick common city and category pairs.
- `collector/run.ts`: `main(io)`; reads the pages one after another with at least 5 seconds between requests, a browser `User-Agent`, 25 second timeout; posts one `public_prices` batch per page and one `guide_version` batch per run to `<host>/ingest/observations` with `Authorization: Bearer <ZAL_INGEST_TOKEN>`.
- `collector/zorasocial-collector.service` and `.timer`: systemd **user** units, once a day at 05:30 UTC with `RandomizedDelaySec=900`, `ExecStart` = bun on `collector/run.ts`, working directory `%h/groupon/zorasocial`. `collector/README.md`: how to install and remove them (`systemctl --user`).

## Rules

1. Prices become integers in minor units: `"49.00"` → 4900. Parse the decimal string by hand; never multiply a float.
2. An entry without a URL under `https://www.groupon.com/deals/`, without a price, or with a currency other than USD is skipped and counted.
3. A page that answers anything but 200 is recorded in the run log and skipped. Three failures in a row stop the run. Never retry a page in the same run. Never follow a deal link.
4. Token: `ZAL_INGEST_TOKEN` from the environment, else that ONE variable from `~/s/.env.master`. Never printed.
5. The run prints one line per page (`url status entries accepted rejected`) and exits non-zero when nothing was accepted.
6. No dependencies beyond Bun. No headless browser.

## Tests you must have

Listing fixture parses to the expected observations (assert three of them exactly); price text to minor units incl. `"1,299.00"` and `"49"`; skipped entries; guide version found and not found; `main` with a fake fetch posts the right batches, waits between pages (fake sleep), stops after three failures, never prints the token.
