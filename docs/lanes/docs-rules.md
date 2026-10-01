<!-- Module: docs/lanes/docs-rules.md · Tested: n/a -->
# Lane docs-rules

**You build:** `rules/`, `README.md`, `docs/architecture.md`. No code.
**Read first:** `AGENTS.md`, `docs/plan.md`, `lanes.json`, `src/app.ts`, `src/cron.ts`, `src/container.ts`, `src/contracts/*.ts`, `migrations/*.sql`, `bin/publish`, `bin/register`.

## `rules/`

Port the rules this stack needs from the owner's global coding rules (outside the repo) (start at `_index.md`). Copy each file's content, keep its frontmatter, and change `scope` to `[zorasocial]`. Port exactly these: `security/owasp-compliance.md`, `security/security-testing.md`, `testing/first-principles.md`, `testing/mock-boundaries.md`, `testing/test-quality.md`, `typescript/strict-typing.md`, `typescript/nullability.md`, `typescript/discriminated-unions.md`, `typescript/readonly-immutability.md`, `cloudflare/bindings.md`, `cloudflare/configuration.md`, `cloudflare/worker-patterns.md`, `http-api/` (all three), `tools/changelog-workflow.md`, `tools/git-commit-workflow.md`, and the File Headers rule from a sibling project's file-headers rule (change the Project line to `zorasocial — Zora Agent Lab on the Groupon Partner Storefront API`). Write `rules/_index.md`: one table, rule, priority, when it applies. Where a ported rule contradicts `AGENTS.md`, `AGENTS.md` wins: add one line at the top of that rule saying so.

## `README.md`

For a person who opens the repo for the first time: what the lab is (three products, one paragraph each), the address, how to run the gates, how to publish (`bin/publish`), how to register (`bin/register`, and that it runs once), where the secrets live (names only), how to install the collector, where the design lives. Under 120 lines. Plain words, short sentences.

## `docs/architecture.md`

One page: a mermaid diagram of the parts (Worker routes and gates, services, D1 tables, Workflow, cron jobs, zora collector, partner API), a table of cron jobs with their schedule, a table of the D1 tables with their writer and readers, and the request path of "agent asks for a massage in Chicago and gets a checkout link" as a numbered list.

Every fact must come from the files you read. Do not describe features that do not exist.
