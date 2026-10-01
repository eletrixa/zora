---
rule: typescript/readonly-immutability
title: Readonly and Immutability
category: typescript
scope: [zorasocial]
priority: recommended
applies-to: [typescript]
---

> **Overrides**: Where this rule contradicts AGENTS.md, AGENTS.md wins.

# TypeScript Readonly and Immutability

Enforce immutability by default to prevent accidental mutations and make data flow predictable.

---

## Description

Immutable data structures are easier to reason about and debug. TypeScript's `readonly` modifier and utility types enforce immutability at compile time. Default to readonly; mutability should be an explicit, intentional choice.

---

## Specific Guidelines

### DO:
- Use `readonly` modifier for interface properties that shouldn't change
- Use `Readonly<T>` for deeply readonly objects
- Use `readonly T[]` or `ReadonlyArray<T>` for arrays that shouldn't be modified
- Use `as const` for literal objects and arrays that are configuration/constants
- Create new objects/arrays instead of mutating existing ones
- Mark function parameters as `readonly` when they shouldn't be modified

### DON'T:
- Mutate arrays with `.push()`, `.pop()`, `.splice()` on readonly arrays
- Reassign object properties when they're readonly
- Use `Object.assign()` or spread to mutate objects in place
- Trust that "I won't mutate it" without compiler enforcement

---

## Implementation Details

### Readonly Interface Properties:
```typescript
interface Product {
  readonly id: string;          // Never changes after creation
  readonly created_at: string;  // Never changes
  title: string;                // Can be updated
  retail_minor: number;         // Can be updated
}
```

### Readonly Arrays:
```typescript
// For constants
const VALID_STATUSES: readonly string[] = ['active', 'sold_out', 'expired'] as const;

// For function parameters
function processProducts(items: readonly Product[]): Product[] {
  // Can't modify 'items', must create new array
  return items.filter(p => p.status === 'active').map(p => ({ 
    ...p, 
    processed: true 
  }));
}
```

---

## Benefits

1. **Predictable data flow**: Data doesn't change unexpectedly
2. **Easier debugging**: No tracking down where mutation happened
3. **React optimization**: Immutability enables efficient re-render detection

