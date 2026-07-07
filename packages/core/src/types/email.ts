import { z } from 'zod/v4';

// Canonical email schema for all user-supplied email inputs (register, login,
// password reset, workspace invite). Trims and lowercases BEFORE validating so
// that "Foo@Example.com " and "foo@example.com" resolve to the same account —
// without this, differing case creates duplicate accounts and invites that
// silently target the wrong (empty) account.
export const emailSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
  z.email({ error: 'Invalid email address' })
);
