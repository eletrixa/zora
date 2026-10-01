---
category: tools
scope: [zorasocial]
applies-to: [all]
---

> **Overrides**: Where this rule contradicts AGENTS.md, AGENTS.md wins.

# Changelog Workflow

Best practices for maintaining the project changelog (`CHANGELOG.md`).

---

## Purpose

The changelog tracks all significant changes to the project, providing:
- Clear history of features, fixes, and improvements
- Version documentation for releases
- Context for future developers and AI agents

---

## When to Update

Update `CHANGELOG.md` after completing:

- **New features** - Any user-facing functionality
- **Bug fixes** - Resolved issues affecting users
- **Refactors** - Significant code restructuring
- **Infrastructure changes** - Build, deployment, tooling updates
- **Documentation** - Major documentation additions

---

## Format

Follow this structure for each version entry:

```markdown
## [Unreleased]

### Feature/Change Name

Brief description of the main change.

- Item 1: Change description
- Item 2: Change description

---
```

---

## Rules

- **ALWAYS** update `CHANGELOG.md` when significant changes are made
- **ALWAYS** list files added/modified for traceability
- **ALWAYS** keep versions in descending order (newest first)
- **NEVER** remove or modify historical entries
- **NEVER** skip version updates for significant changes

---

## Integration with Git Commits

After completing work:

1. Run tests and linting
2. **Update `CHANGELOG.md`** with changes
3. Create git commit

The changelog update should be part of the same commit as the feature/fix.

