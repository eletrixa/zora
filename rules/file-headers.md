---
rule: file-headers
title: File Headers
category: conventions
scope: [zorasocial]
priority: required
applies-to: [all source files]
tags: [conventions, headers, agents, coding-standards]
---

> **Overrides**: Where this rule contradicts AGENTS.md, AGENTS.md wins.

# File Headers

> [!info] Project rule
> Every source file starts with a structured header for instant orientation. Add on creation, update when touching existing files. Bundle header changes with the code change — no separate commits.

## When to Add/Update

1. **New files** — add at creation time.
2. **Existing files without a header** — add when you first touch the file.
3. **Existing files with an outdated header** — update to match current code when modifying.

## Format

Fields: **One-line summary, Project, Module, Deps, Tested** (+ optional Key responsibilities / Design constraints).

### TypeScript / JavaScript

```typescript
/**
 * <One-line summary of what this module does.>
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  <relative path from repo root>
 * Deps:    <key external dependencies>
 * Tested:  <path to test file, or "n/a">
 */
```

### SQL

```sql
-- <One-line summary of what this migration does.>
-- Project: zorasocial. Module: <path>. Tested: <test path or n/a>
```

### Bash

```bash
#!/usr/bin/env bash
# <One-line summary of what this script does.>
#
# Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
# Module:  <relative path from repo root>
# Deps:    <key external tools/binaries this script calls>
# Tested:  <path to test file, or "n/a">
```

## Field Reference

| Field | Purpose |
|---|---|
| **One-line summary** | Instant triage — "is this the file I need?" |
| **Project** | Context if the agent sees the file in isolation |
| **Module** | Canonical path — no guessing relative location |
| **Deps** | Know what's available without scanning all imports |
| **Tested** | Where to find or add tests |

## What to Leave Out

- Author / license / copyright, version numbers, change history (git's job), full API docs, generated-by notices.

