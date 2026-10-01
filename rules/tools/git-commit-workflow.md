---
category: tools
scope: [zorasocial]
applies-to: [all]
---

> **Overrides**: Where this rule contradicts AGENTS.md, AGENTS.md wins.

# Git Commit Workflow

## When to Commit

After completing **major development work** (passing tests, resolving a feature), automatically create a Git commit.

## Commit Process

1. **Stage changed files** -- commit only files related to the completed work
2. **Use lane-based naming**:
   - `<lane>: <outcome>` -- what was delivered
3. **Write descriptive body** -- explain what was changed and why, based on the tasks that led to these changes

## Rules

- ALWAYS commit after major development milestones
- ALWAYS use lane-based format for titles
- ALWAYS explain the reasoning in the commit body
- NEVER push automatically
- NEVER push to main branch

## Example

```
partner-client: implement retry backoff and error classification

- Added exponential backoff retry logic (2, 4, 8 seconds)
- Classified partner API error responses by retryability
- Added error reader tests for all error body shapes

The partner API can return errors in three body shapes.
This normalizes them to a common Result type.
```

