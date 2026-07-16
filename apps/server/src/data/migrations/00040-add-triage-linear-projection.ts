import { Migration, sql } from 'kysely';

export const addTriageLinearProjection: Migration = {
  up: async (db) => {
    // Optional per-project Linear mapping: {enabled, teamId, teamKey, cutoverAt, labels}
    // Identifiers only — never credentials (spec §7).
    await db.schema
      .alterTable('triage_projects')
      .addColumn('linear', 'jsonb', (col) =>
        col.notNull().defaultTo(sql`'{}'::jsonb`)
      )
      .execute();

    await db.schema
      .createTable('triage_cluster_relations')
      .addColumn('id', 'uuid', (col) =>
        col.notNull().primaryKey().defaultTo(sql`gen_random_uuid()`)
      )
      .addColumn('project_id', 'text', (col) =>
        col.notNull().references('triage_projects.id').onDelete('cascade')
      )
      .addColumn('cluster_a_id', 'uuid', (col) =>
        col.notNull().references('triage_clusters.id').onDelete('cascade')
      )
      .addColumn('cluster_b_id', 'uuid', (col) =>
        col.notNull().references('triage_clusters.id').onDelete('cascade')
      )
      .addColumn('kind', 'text', (col) =>
        col.notNull().defaultTo('possibly-related')
      )
      .addColumn('state', 'text', (col) => col.notNull().defaultTo('active'))
      .addColumn('confidence', 'real')
      .addColumn('reason', 'text', (col) => col.notNull().defaultTo(''))
      .addColumn('actor', 'text', (col) => col.notNull().defaultTo(''))
      .addColumn('dismissed_by', 'text')
      .addColumn('dismissed_reason', 'text')
      .addColumn('created_at', 'timestamptz', (col) =>
        col.notNull().defaultTo(sql`now()`)
      )
      .addColumn('updated_at', 'timestamptz')
      .addCheckConstraint(
        'triage_cluster_relations_kind_check',
        sql`kind in ('possibly-related')`
      )
      .addCheckConstraint(
        'triage_cluster_relations_state_check',
        sql`state in ('active','dismissed')`
      )
      // canonical ordering rejects self-relations AND unordered duplicates
      .addCheckConstraint(
        'triage_cluster_relations_order_check',
        sql`cluster_a_id < cluster_b_id`
      )
      .addUniqueConstraint('triage_cluster_relations_pair_unique', [
        'cluster_a_id',
        'cluster_b_id',
      ])
      .execute();

    await db.schema
      .createTable('triage_linear_issues')
      .addColumn('cluster_id', 'uuid', (col) =>
        col
          .notNull()
          .primaryKey()
          .references('triage_clusters.id')
          .onDelete('cascade')
      )
      .addColumn('issue_id', 'text', (col) => col.notNull())
      .addColumn('identifier', 'text', (col) => col.notNull().defaultTo(''))
      .addColumn('url', 'text', (col) => col.notNull().defaultTo(''))
      .addColumn('state_name', 'text', (col) => col.notNull().defaultTo(''))
      .addColumn('state_type', 'text', (col) => col.notNull().defaultTo(''))
      .addColumn('canonical_cluster_id', 'uuid', (col) =>
        col.references('triage_clusters.id').onDelete('set null')
      )
      .addColumn('duplicate_of_external', 'text')
      .addColumn('artifact_assets', 'jsonb', (col) =>
        col.notNull().defaultTo(sql`'{}'::jsonb`)
      )
      .addColumn('linear_updated_at', 'timestamptz')
      .addColumn('projected_at', 'timestamptz')
      .addColumn('error_code', 'text')
      .addColumn('error_message', 'text')
      .addColumn('created_at', 'timestamptz', (col) =>
        col.notNull().defaultTo(sql`now()`)
      )
      .addColumn('updated_at', 'timestamptz')
      .execute();

    await db.schema
      .createTable('triage_linear_sync_state')
      .addColumn('project_id', 'text', (col) =>
        col
          .notNull()
          .primaryKey()
          .references('triage_projects.id')
          .onDelete('cascade')
      )
      .addColumn('cursor_ts', 'timestamptz')
      .addColumn('last_success_at', 'timestamptz')
      .addColumn('updated_at', 'timestamptz')
      .execute();

    await db.schema
      .createIndex('triage_cluster_relations_project_idx')
      .on('triage_cluster_relations')
      .columns(['project_id', 'state'])
      .execute();
  },
  down: async (db) => {
    await db.schema.dropTable('triage_linear_sync_state').execute();
    await db.schema.dropTable('triage_linear_issues').execute();
    await db.schema.dropTable('triage_cluster_relations').execute();
    await db.schema.alterTable('triage_projects').dropColumn('linear').execute();
  },
};
