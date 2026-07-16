import { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

import { database } from '@colanode/server/data/database';

const reconcileSchema = z.object({
  projectId: z.string().min(1),
  cursorTs: z.string(),
  issues: z.array(
    z.object({
      issueId: z.string(),
      identifier: z.string(),
      stateName: z.string(),
      stateType: z.string(),
      updatedAt: z.string(),
      duplicateOfIssueId: z.string().nullable(),
    })
  ),
  dismissedRelations: z.array(
    z.object({
      clusterAId: z.guid(),
      clusterBId: z.guid(),
    })
  ),
});

export const triageOpsLinearReconcileRoute: FastifyPluginCallbackZod = (
  instance,
  _,
  done
) => {
  instance.route({
    method: 'POST',
    url: '/linear/reconcile',
    schema: {
      body: reconcileSchema,
      response: {
        200: z.object({ applied: z.number() }),
      },
    },
    handler: async (request) => {
      const { projectId, cursorTs, issues, dismissedRelations } = request.body;
      const now = new Date();

      // Human decisions in Linear apply atomically (spec §9): state updates,
      // duplicate aliasing, dismissed relations, then the sync cursor.
      await database.transaction().execute(async (trx) => {
        for (const issue of issues) {
          // Duplicate of another projected cluster → local alias; of an
          // unknown (manually created) issue → duplicate-of-external;
          // undone in Linear → both cleared.
          const canonical = issue.duplicateOfIssueId
            ? await trx
                .selectFrom('triage_linear_issues')
                .select('cluster_id')
                .where('issue_id', '=', issue.duplicateOfIssueId)
                .executeTakeFirst()
            : null;

          await trx
            .updateTable('triage_linear_issues')
            .set({
              state_name: issue.stateName,
              state_type: issue.stateType,
              linear_updated_at: new Date(issue.updatedAt),
              canonical_cluster_id: canonical?.cluster_id ?? null,
              duplicate_of_external:
                issue.duplicateOfIssueId && !canonical
                  ? issue.duplicateOfIssueId
                  : null,
              updated_at: now,
            })
            .where('issue_id', '=', issue.issueId)
            .execute();
        }

        for (const pair of dismissedRelations) {
          // relation rows store the canonically ordered pair (a < b)
          const [a, b] =
            pair.clusterAId < pair.clusterBId
              ? [pair.clusterAId, pair.clusterBId]
              : [pair.clusterBId, pair.clusterAId];
          await trx
            .updateTable('triage_cluster_relations')
            .set({
              state: 'dismissed',
              dismissed_by: 'linear',
              updated_at: now,
            })
            .where('cluster_a_id', '=', a)
            .where('cluster_b_id', '=', b)
            .execute();
        }

        await trx
          .insertInto('triage_linear_sync_state')
          .values({
            project_id: projectId,
            cursor_ts: new Date(cursorTs),
            last_success_at: now,
            updated_at: now,
          })
          .onConflict((oc) =>
            oc.column('project_id').doUpdateSet({
              cursor_ts: new Date(cursorTs),
              last_success_at: now,
              updated_at: now,
            })
          )
          .execute();
      });

      return { applied: issues.length };
    },
  });

  done();
};
