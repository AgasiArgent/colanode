import { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

import { database } from '@colanode/server/data/database';

// Only user-facing repro links may surface in Linear — never triage-store
// capability URLs or internal storage paths (spec §11).
const REPRO_ORIGIN = 'https://repro.kvotaflow.ru/';

const recordingUrlOf = (debug: Record<string, unknown>): string | null => {
  const rec = (debug.recording ?? {}) as Record<string, unknown>;
  const url = typeof rec.recordingUrl === 'string' ? rec.recordingUrl : null;
  return url && url.startsWith(REPRO_ORIGIN) ? url : null;
};

const projectLinearSchema = z.object({
  enabled: z.boolean().optional(),
  teamId: z.string().optional(),
  teamKey: z.string().optional(),
  cutoverAt: z.string().optional(),
  labels: z.record(z.string(), z.string()).optional(),
});

const queueItemSchema = z.object({
  id: z.string(),
  summary: z.string(),
  triage: z.string().nullable(),
  sourceRef: z.record(z.string(), z.unknown()),
});

const queueReportSchema = z.object({
  id: z.string(),
  title: z.string(),
  did: z.string(),
  expected: z.string(),
  got: z.string(),
  pageUrl: z.string(),
  reporterName: z.string(),
  debugContext: z.record(z.string(), z.unknown()),
  artifacts: z.array(
    z.object({
      id: z.string(),
      kind: z.string(),
      contentType: z.string(),
    })
  ),
  recordingUrl: z.string().nullable(),
});

const queueRelationSchema = z.object({
  otherClusterId: z.string(),
  otherIdentifier: z.string().nullable(),
  state: z.string(),
  reason: z.string(),
});

const queueLinearSchema = z.object({
  issueId: z.string(),
  identifier: z.string(),
  url: z.string(),
  stateType: z.string(),
  artifactAssets: z.record(z.string(), z.string()),
  projectedAt: z.string().nullable(),
});

const queueClusterSchema = z.object({
  id: z.string(),
  rootHypothesis: z.string(),
  itemCount: z.number(),
  status: z.string(),
  decision: z.string().nullable(),
  items: z.array(queueItemSchema),
  reports: z.array(queueReportSchema),
  relations: z.array(queueRelationSchema),
  linear: queueLinearSchema.nullable(),
});

export const triageOpsLinearQueueRoute: FastifyPluginCallbackZod = (
  instance,
  _,
  done
) => {
  instance.route({
    method: 'GET',
    url: '/linear/queue',
    schema: {
      querystring: z.object({ projectId: z.string().min(1) }),
      response: {
        200: z.object({
          project: z.object({ id: z.string(), linear: projectLinearSchema }),
          clusters: z.array(queueClusterSchema),
        }),
      },
    },
    handler: async (request) => {
      const project = await database
        .selectFrom('triage_projects')
        .selectAll()
        .where('id', '=', request.query.projectId)
        .executeTakeFirst();
      if (!project || !project.linear.enabled) {
        return {
          project: {
            id: request.query.projectId,
            linear: project?.linear ?? {},
          },
          clusters: [],
        };
      }
      const cutover = project.linear.cutoverAt
        ? new Date(project.linear.cutoverAt)
        : new Date(0);

      const clusters = await database
        .selectFrom('triage_clusters')
        .leftJoin(
          'triage_linear_issues',
          'triage_linear_issues.cluster_id',
          'triage_clusters.id'
        )
        .selectAll('triage_clusters')
        .select([
          'triage_linear_issues.issue_id as li_issue_id',
          'triage_linear_issues.identifier as li_identifier',
          'triage_linear_issues.url as li_url',
          'triage_linear_issues.state_type as li_state_type',
          'triage_linear_issues.artifact_assets as li_artifact_assets',
          'triage_linear_issues.projected_at as li_projected_at',
          'triage_linear_issues.canonical_cluster_id as li_canonical',
          'triage_linear_issues.duplicate_of_external as li_dup_external',
        ])
        .where('triage_clusters.project_id', '=', request.query.projectId)
        .where('triage_clusters.created_at', '>=', cutover)
        .execute();

      // Duplicate aliases are never projection targets (spec §9).
      const eligible = clusters.filter(
        (c) => !c.li_canonical && !c.li_dup_external
      );
      const pending = eligible.filter(
        (c) =>
          !c.li_projected_at ||
          (c.updated_at && c.updated_at > c.li_projected_at)
      );

      const eligibleIds = eligible.map((c) => c.id);
      const relations =
        eligibleIds.length > 0
          ? await database
              .selectFrom('triage_cluster_relations')
              .selectAll()
              .where('state', '=', 'active')
              .where((eb) =>
                eb.or([
                  eb('cluster_a_id', 'in', eligibleIds),
                  eb('cluster_b_id', 'in', eligibleIds),
                ])
              )
              .execute()
          : [];

      const relationsOf = (clusterId: string) =>
        relations.filter(
          (r) => r.cluster_a_id === clusterId || r.cluster_b_id === clusterId
        );

      // A projected cluster with a newer active relation needs re-projection.
      const pendingIds = new Set(pending.map((c) => c.id));
      const queue = [
        ...pending,
        ...eligible.filter(
          (c) =>
            !pendingIds.has(c.id) &&
            c.li_projected_at &&
            relationsOf(c.id).some(
              (r) => r.created_at > (c.li_projected_at as Date)
            )
        ),
      ];

      const queueIds = queue.map((c) => c.id);
      const items =
        queueIds.length > 0
          ? await database
              .selectFrom('triage_items')
              .select(['id', 'cluster_id', 'report_id', 'summary', 'triage', 'source_ref'])
              .where('cluster_id', 'in', queueIds)
              .execute()
          : [];

      const reportIds = [...new Set(items.map((i) => i.report_id))];
      const reports =
        reportIds.length > 0
          ? await database
              .selectFrom('triage_reports')
              .selectAll()
              .where('id', 'in', reportIds)
              .execute()
          : [];

      const otherClusterIds = [
        ...new Set(
          queueIds.flatMap((id) =>
            relationsOf(id).map((r) =>
              r.cluster_a_id === id ? r.cluster_b_id : r.cluster_a_id
            )
          )
        ),
      ];
      const otherLinearRows =
        otherClusterIds.length > 0
          ? await database
              .selectFrom('triage_linear_issues')
              .select(['cluster_id', 'identifier'])
              .where('cluster_id', 'in', otherClusterIds)
              .execute()
          : [];

      return {
        project: { id: project.id, linear: project.linear },
        clusters: queue.map((cluster) => {
          const own = items.filter((i) => i.cluster_id === cluster.id);
          const ownReportIds = new Set(own.map((i) => i.report_id));
          return {
            id: cluster.id,
            rootHypothesis: cluster.root_hypothesis,
            itemCount: cluster.item_count,
            status: cluster.status,
            decision: cluster.decision,
            items: own.map((i) => ({
              id: i.id,
              summary: i.summary,
              triage: i.triage,
              sourceRef: i.source_ref,
            })),
            reports: reports
              .filter((r) => ownReportIds.has(r.id))
              .map((r) => ({
                id: r.id,
                title: r.title,
                did: r.did,
                expected: r.expected,
                got: r.got,
                pageUrl: r.page_url,
                reporterName: r.reporter_name,
                debugContext: r.debug_context,
                // refs only — storagePath never leaves the triage store
                artifacts: r.artifacts.map((a) => ({
                  id: a.id,
                  kind: a.kind,
                  contentType: a.contentType,
                })),
                recordingUrl: recordingUrlOf(r.debug_context),
              })),
            relations: relationsOf(cluster.id).map((r) => {
              const otherClusterId =
                r.cluster_a_id === cluster.id ? r.cluster_b_id : r.cluster_a_id;
              return {
                otherClusterId,
                otherIdentifier:
                  otherLinearRows.find((l) => l.cluster_id === otherClusterId)
                    ?.identifier ?? null,
                state: r.state,
                reason: r.reason,
              };
            }),
            linear:
              cluster.li_issue_id !== null
                ? {
                    issueId: cluster.li_issue_id,
                    identifier: cluster.li_identifier ?? '',
                    url: cluster.li_url ?? '',
                    stateType: cluster.li_state_type ?? '',
                    artifactAssets: cluster.li_artifact_assets ?? {},
                    projectedAt: cluster.li_projected_at
                      ? cluster.li_projected_at.toISOString()
                      : null,
                  }
                : null,
          };
        }),
      };
    },
  });

  done();
};
