---
rule: typescript/strict-typing
title: Strict Typing
category: typescript
scope: [zorasocial]
priority: recommended
applies-to: [typescript]
---

> **Overrides**: Where this rule contradicts AGENTS.md, AGENTS.md wins.

# TypeScript Strict Typing

Enforce strict type safety to catch bugs at compile time rather than runtime.

---

## Description

TypeScript's power lies in its type system. This rule enforces strict typing practices that eliminate entire categories of runtime errors. Never use `any`; prefer `unknown` for external data; always validate before narrowing.

---

## Specific Guidelines

### DO:
- Use `unknown` for all external data (API responses, user input, parsed JSON)
- Create type guards to narrow `unknown` types safely
- Enable all strict mode flags in `tsconfig.json`
- Use explicit return types for public functions
- Validate data at boundaries before type assertions

### DON'T:
- Use `any` type anywhere in production code
- Use type assertions (`as Type`) without validation
- Disable strict mode flags with `@ts-ignore` or `@ts-expect-error`
- Use `as unknown as Type` double-cast pattern
- Trust external data without runtime validation

---

## Implementation Details

### Required tsconfig.json settings:
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true
  }
}
```

### Type Guard Pattern:
```typescript
function isProduct(data: unknown): data is Product {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    typeof (data as Record<string, unknown>).id === 'string' &&
    'retail_minor' in data &&
    typeof (data as Record<string, unknown>).retail_minor === 'number'
  );
}
```

### Validation at Boundaries:
```typescript
import { z } from 'zod';

const ProductSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  retail_minor: z.number().int().positive(),
});

type Product = z.infer<typeof ProductSchema>;

async function fetchProduct(id: string): Promise<Product> {
  const response = await fetch(`/api/products/${id}`);
  const data: unknown = await response.json();
  return ProductSchema.parse(data); // Throws if invalid
}
```

---

## Benefits

1. **Compile-time error detection**: Catch type mismatches before runtime
2. **Self-documenting code**: Types serve as documentation
3. **Refactoring confidence**: TypeScript catches breaking changes

