---
rule: _index
title: Zorasocial Coding Rules
type: index
version: 1.0
---

# Zorasocial Coding Rules

Rules and standards for the Zora Agent Lab project. Ported from the Global Code Settings with project-specific scope.

## Rules Reference

| Rule | Category | Priority | When it applies |
|------|----------|----------|-----------------|
| `file-headers.md` | conventions | required | all source files |
| `security/owasp-compliance.md` | security | required | all code |
| `security/security-testing.md` | security | required | when writing tests |
| `testing/first-principles.md` | testing | required | all test files |
| `testing/mock-boundaries.md` | testing | required | all test files |
| `testing/test-quality.md` | testing | recommended | all test files |
| `typescript/strict-typing.md` | typescript | recommended | TypeScript code |
| `typescript/nullability.md` | typescript | recommended | TypeScript code |
| `typescript/discriminated-unions.md` | typescript | recommended | TypeScript code |
| `typescript/readonly-immutability.md` | typescript | recommended | TypeScript code |
| `cloudflare/bindings.md` | cloudflare | recommended | Worker bindings |
| `cloudflare/configuration.md` | cloudflare | recommended | wrangler.jsonc |
| `cloudflare/worker-patterns.md` | cloudflare | recommended | Worker code |
| `http-api/api-design.md` | http-api | recommended | HTTP API routes |
| `http-api/sdk-patterns.md` | http-api | recommended | SDK/CLI code |
| `http-api/sse-patterns.md` | http-api | recommended | streaming endpoints |
| `tools/changelog-workflow.md` | tools | recommended | changelog updates |
| `tools/git-commit-workflow.md` | tools | recommended | git commits |

## How to Use These Rules

1. **New files** — Add headers from `file-headers.md`
2. **TypeScript code** — Follow the typescript/ rules for type safety
3. **Tests** — Follow testing/ rules for quality and structure
4. **Security** — Always follow security/ rules (required)
5. **APIs and Cloudflare** — Follow http-api/ and cloudflare/ rules for Worker code

## Overrides

Every rule file states: Where this rule contradicts `AGENTS.md`, `AGENTS.md` wins. See `AGENTS.md` for the binding safety invariants and TDD workflow that supersede these guidelines.
