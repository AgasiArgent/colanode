import { Migration, sql } from 'kysely';

export const createTriageTables: Migration = {
  up: async (db) => {
    await db.schema
      .createTable('triage_projects')
      .addColumn('id', 'text', (col) => col.notNull().primaryKey())
      .addColumn('name', 'text', (col) => col.notNull())
      .addColumn('ingest_token', 'text', (col) => col.notNull().unique())
      .addColumn('colanode', 'jsonb', (col) =>
        col.notNull().defaultTo(sql`'{}'::jsonb`)
      )
      .addColumn('admins', 'jsonb', (col) =>
        col.notNull().defaultTo(sql`'[]'::jsonb`)
      )
      .addColumn('kill_switch', 'boolean', (col) =>
        col.notNull().defaultTo(false)
      )
      .addColumn('created_at', 'timestamptz', (col) =>
        col.notNull().defaultTo(sql`now()`)
      )
      .addColumn('updated_at', 'timestamptz')
      .execute();

    await db.schema
      .createTable('triage_reports')
      .addColumn('id', 'uuid', (col) =>
        col.notNull().primaryKey().defaultTo(sql`gen_random_uuid()`)
      )
      .addColumn('project_id', 'text', (col) =>
        col.notNull().references('triage_projects.id').onDelete('cascade')
      )
      .addColumn('source_adapter', 'text', (col) => col.notNull().defaultTo(''))
      .addColumn('reporter_id', 'text')
      .addColumn('reporter_name', 'text', (col) => col.notNull().defaultTo(''))
      .addColumn('title', 'text', (col) => col.notNull().defaultTo(''))
      .addColumn('did', 'text', (col) => col.notNull().defaultTo(''))
      .addColumn('expected', 'text', (col) => col.notNull().defaultTo(''))
      .addColumn('got', 'text', (col) => col.notNull().defaultTo(''))
      .addColumn('page_url', 'text', (col) => col.notNull().defaultTo(''))
      .addColumn('page_title', 'text', (col) => col.notNull().defaultTo(''))
      .addColumn('pins', 'jsonb', (col) =>
        col.notNull().defaultTo(sql`'[]'::jsonb`)
      )
      .addColumn('debug_context', 'jsonb', (col) =>
        col.notNull().defaultTo(sql`'{}'::jsonb`)
      )
      .addColumn('artifacts', 'jsonb', (col) =>
        col.notNull().defaultTo(sql`'[]'::jsonb`)
      )
      .addColumn('status', 'text', (col) => col.notNull().defaultTo('new'))
      .addColumn('created_at', 'timestamptz', (col) =>
        col.notNull().defaultTo(sql`now()`)
      )
      .addCheckConstraint(
        'triage_reports_status_check',
        sql`status in ('new','exploded')`
      )
      .execute();

    await db.schema
      .createTable('triage_clusters')
      .addColumn('id', 'uuid', (col) =>
        col.notNull().primaryKey().defaultTo(sql`gen_random_uuid()`)
      )
      .addColumn('project_id', 'text', (col) =>
        col.notNull().references('triage_projects.id').onDelete('cascade')
      )
      .addColumn('root_hypothesis', 'text', (col) => col.notNull().defaultTo(''))
      .addColumn('item_count', 'integer', (col) => col.notNull().defaultTo(0))
      .addColumn('status', 'text', (col) => col.notNull().defaultTo('open'))
      .addColumn('board_record_id', 'text')
      .addColumn('chat_card_id', 'text')
      .addColumn('created_at', 'timestamptz', (col) =>
        col.notNull().defaultTo(sql`now()`)
      )
      .addColumn('updated_at', 'timestamptz')
      .addCheckConstraint(
        'triage_clusters_status_check',
        sql`status in ('open','decided','escalated')`
      )
      .execute();

    await db.schema
      .createTable('triage_items')
      .addColumn('id', 'uuid', (col) =>
        col.notNull().primaryKey().defaultTo(sql`gen_random_uuid()`)
      )
      .addColumn('report_id', 'uuid', (col) =>
        col.notNull().references('triage_reports.id').onDelete('cascade')
      )
      .addColumn('project_id', 'text', (col) => col.notNull())
      .addColumn('kind', 'text', (col) => col.notNull())
      .addColumn('summary', 'text', (col) => col.notNull().defaultTo(''))
      .addColumn('source_ref', 'jsonb', (col) =>
        col.notNull().defaultTo(sql`'{}'::jsonb`)
      )
      .addColumn('triage', 'text')
      .addColumn('triage_reason', 'text', (col) => col.notNull().defaultTo(''))
      .addColumn('confidence', 'real')
      .addColumn('cluster_id', 'uuid', (col) =>
        col.references('triage_clusters.id').onDelete('set null')
      )
      .addColumn('decision', 'text')
      .addColumn('agent_note', 'text', (col) => col.notNull().defaultTo(''))
      .addColumn('status', 'text', (col) => col.notNull().defaultTo('new'))
      .addColumn('audit', 'jsonb', (col) =>
        col.notNull().defaultTo(sql`'[]'::jsonb`)
      )
      .addColumn('created_at', 'timestamptz', (col) =>
        col.notNull().defaultTo(sql`now()`)
      )
      .addColumn('updated_at', 'timestamptz')
      .addCheckConstraint(
        'triage_items_kind_check',
        sql`kind in ('pin','record-issue','legacy')`
      )
      .addCheckConstraint(
        'triage_items_triage_check',
        sql`triage is null or triage in ('bug','feature','unclear','no-fly')`
      )
      .addCheckConstraint(
        'triage_items_decision_check',
        sql`decision is null or decision in ('approved-for-fix','backlog','works-as-intended','needs-info','duplicate','ignored')`
      )
      .addCheckConstraint(
        'triage_items_status_check',
        sql`status in ('new','triaged','clustered','decided','escalated')`
      )
      .execute();

    await db.schema
      .createIndex('triage_reports_project_status_idx')
      .on('triage_reports')
      .columns(['project_id', 'status'])
      .execute();
    await db.schema
      .createIndex('triage_items_report_id_idx')
      .on('triage_items')
      .column('report_id')
      .execute();
    await db.schema
      .createIndex('triage_items_cluster_id_idx')
      .on('triage_items')
      .column('cluster_id')
      .execute();
    await db.schema
      .createIndex('triage_items_project_status_idx')
      .on('triage_items')
      .columns(['project_id', 'status'])
      .execute();
    await db.schema
      .createIndex('triage_clusters_project_status_idx')
      .on('triage_clusters')
      .columns(['project_id', 'status'])
      .execute();
  },
  down: async (db) => {
    await db.schema.dropTable('triage_items').execute();
    await db.schema.dropTable('triage_clusters').execute();
    await db.schema.dropTable('triage_reports').execute();
    await db.schema.dropTable('triage_projects').execute();
  },
};
