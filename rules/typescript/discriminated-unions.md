---
rule: typescript/discriminated-unions
title: Discriminated Unions
category: typescript
scope: [zorasocial]
priority: recommended
applies-to: [typescript]
---

> **Overrides**: Where this rule contradicts AGENTS.md, AGENTS.md wins.

# TypeScript Discriminated Unions

Model state machines and polymorphic data with discriminated unions for compile-time safety.

---

## Description

Discriminated unions (also called tagged unions) use a literal type property to distinguish between variants. Combined with exhaustive switch statements, they guarantee all states are handled and prevent invalid state combinations.

---

## Specific Guidelines

### DO:
- Use discriminated unions for UI states (loading, error, success, idle)
- Use discriminated unions for polymorphic data (different action types, response variants)
- Always include an exhaustive `default: never` check in switch statements
- Use a consistent discriminant property name (`kind`, `type`, or `status`)
- Keep variant interfaces close to the union definition

### DON'T:
- Use separate boolean flags for mutually exclusive states
- Use optional properties when a discriminated union is more appropriate
- Forget the `default: never` exhaustive check
- Use if/else chains for discriminated union matching

---

## Implementation Details

### Standard Pattern:
```typescript
// Define variants with literal discriminant
type ApiResponse<T> =
  | { kind: 'success'; data: T; timestamp: string }
  | { kind: 'error'; error: string; code: number }
  | { kind: 'retry'; delay_ms: number };

// Exhaustive handling
function handleResponse<T>(response: ApiResponse<T>): void {
  switch (response.kind) {
    case 'success':
      console.log('Success:', response.data);
      break;
    case 'error':
      console.error(`Error ${response.code}:`, response.error);
      break;
    case 'retry':
      setTimeout(() => {}, response.delay_ms);
      break;
    default: {
      const _exhaustive: never = response;
      throw new Error(`Unhandled kind: ${_exhaustive}`);
    }
  }
}
```

---

## Benefits

1. **Impossible states are unrepresentable**: Can't have loading AND error set
2. **Exhaustive checking**: TypeScript errors when cases are missing
3. **Self-documenting**: Union definition shows all possible states
4. **Refactoring safety**: Adding new variants causes compile errors everywhere

