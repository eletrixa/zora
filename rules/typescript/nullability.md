---
rule: typescript/nullability
title: Nullability Handling
category: typescript
scope: [zorasocial]
priority: recommended
applies-to: [typescript]
---

> **Overrides**: Where this rule contradicts AGENTS.md, AGENTS.md wins.

# TypeScript Nullability Handling

Handle null and undefined explicitly to prevent runtime errors.

---

## Description

With `strictNullChecks` enabled, TypeScript requires explicit handling of `null` and `undefined`. This rule enforces patterns that make nullability obvious and handled safely.

---

## Specific Guidelines

### DO:
- Use explicit union types: `T | null` or `T | undefined`
- Use optional chaining (`?.`) for safe property access
- Use nullish coalescing (`??`) for default values
- Narrow nullable types before use with type guards
- Prefer `undefined` for optional values, `null` for explicit absence
- Return early for null/undefined cases

### DON'T:
- Use non-null assertion (`!`) without runtime validation
- Use `|| defaultValue` when you mean `?? defaultValue`
- Ignore TypeScript's null check warnings
- Use `as T` to cast away nullability
- Mix `null` and `undefined` semantics inconsistently

---

## Implementation Details

### Optional Chaining:
```typescript
// Safe property access
const userName = user?.profile?.name;
const firstItem = items?.[0];
const result = callback?.();
```

### Nullish Coalescing:
```typescript
// Only falls back if null/undefined (not falsy)
const value = input ?? defaultValue;
const maxResults = config.limit ?? 100;
const displayName = user.name ?? 'Anonymous';
```

### Type Guards:
```typescript
function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
```

---

## Benefits

1. **Prevent runtime crashes**: Handle null before use
2. **Self-documenting**: Type shows if value can be absent
3. **Compiler assistance**: TypeScript reminds you to handle null
4. **Cleaner code**: Early returns instead of nested conditionals

