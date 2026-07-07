import { Migration, sql } from 'kysely';

export const normalizeAccountEmails: Migration = {
  up: async (db) => {
    // Collapse existing emails to their canonical lowercase form so the unique
    // index below can be created and lookups stay consistent. Fails loudly if
    // real case-variant duplicates already exist (they must be merged first).
    await sql`UPDATE accounts SET email = LOWER(email) WHERE email <> LOWER(email)`.execute(
      db
    );

    // Enforce case-insensitive uniqueness at the database level so differing
    // case can never create duplicate accounts, even if the application-level
    // normalization (emailSchema) is ever bypassed.
    await sql`CREATE UNIQUE INDEX accounts_email_lower_unique ON accounts (LOWER(email))`.execute(
      db
    );
  },
  down: async (db) => {
    await sql`DROP INDEX IF EXISTS accounts_email_lower_unique`.execute(db);
  },
};
