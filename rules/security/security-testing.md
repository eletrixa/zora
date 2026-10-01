---
category: security
scope: [zorasocial]
priority: required
applies-to: [all]
---

> **Overrides**: Where this rule contradicts AGENTS.md, AGENTS.md wins.

# Security Testing Rules

This document defines how to write security tests following TDD principles.

---

## TDD Security Workflow

Follow **RED -> GREEN -> REFACTOR** for every security fix:

1. **RED**: Write a failing test that exposes the vulnerability
2. **GREEN**: Implement the fix to make the test pass
3. **REFACTOR**: Clean up, update documentation

---

## Required Security Tests

These tests MUST pass on every PR:

| Test File | Purpose |
|-----------|---------|
| Input validation tests | No XSS or injection payloads |
| no-hardcoded-secrets.test.ts | No API keys in source |
| cors-configuration.test.ts | No wildcard CORS |

### Running Security Tests

```bash
# All tests
bun run test

# Security-specific pattern
bun run test --grep "security|auth"
```

---

## Test Patterns

### 1. Test Vulnerability is IMPOSSIBLE

Write tests that verify vulnerabilities cannot exist:

```typescript
// GOOD - Test that weak patterns are impossible
it('does NOT use predictable patterns', () => {
  const password = generateSecurePassword();
  expect(password).toHaveLength(32);
});

// GOOD - Test that API keys are never in source
it('config must not contain hardcoded API keys', async () => {
  const content = await fs.readFile('src/partner/client.ts', 'utf-8');
  expect(content).not.toMatch(/grpn_/);
});
```

### 2. Test All Attack Vectors

Test both positive (allowed) and negative (blocked) cases:

```typescript
// GOOD - Test allowed and blocked
it('accepts valid requests', () => {
  const result = validateRequest({ token: validToken });
  expect(result.ok).toBe(true);
});

it('rejects invalid tokens', () => {
  const result = validateRequest({ token: 'invalid' });
  expect(result.ok).toBe(false);
});
```

---

## Continuous Security

### Pre-commit Checks

Add security tests to pre-commit hooks if configured.

### CI Pipeline

All tests run on every PR.

---

## References

- `test/` - Test directory
- AGENTS.md - Lane testing rules
