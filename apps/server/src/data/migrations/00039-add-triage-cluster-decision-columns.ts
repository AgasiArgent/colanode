import { Migration, sql } from 'kysely';

export const addTriageClusterDecisionColumns: Migration = {
  up: async (db) => {
    await db.schema
      .alterTable('triage_clusters')
      .addColumn('decision', 'text')
      .addColumn('audit', 'jsonb', (col) =>
        col.notNull().defaultTo(sql`'[]'::jsonb`)
      )
      .execute();

    // mirrors triage_items_decision_check — a cluster decides for its items
    await db.schema
      .alterTable('triage_clusters')
      .addCheckConstraint(
        'triage_clusters_decision_check',
        sql`decision is null or decision in ('approved-for-fix','backlog','works-as-intended','needs-info','duplicate','ignored')`
      )
      .execute();
  },
  down: async (db) => {
    await db.schema
      .alterTable('triage_clusters')
      .dropConstraint('triage_clusters_decision_check')
      .execute();

    await db.schema
      .alterTable('triage_clusters')
      .dropColumn('decision')
      .dropColumn('audit')
      .execute();
  },
};
