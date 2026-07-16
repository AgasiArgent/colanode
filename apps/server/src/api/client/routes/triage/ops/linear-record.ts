import { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

import { database } from '@colanode/server/data/database';

const recordSchema = z.object({
  // empty when a create failed before any issue existed — the row still
  // records error_code/error_message for operator visibility (spec §10)
  issueId: z.string().default(''),
  identifier: z.string().default(''),
  url: z.string().default(''),
  stateName: z.string().default(''),
  stateType: z.string().default(''),
  artifactAssets: z.record(z.string(), z.string()).default({}),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
});

export const triageOpsLinearRecordRoute: FastifyPluginCallbackZod = (
  instance,
  _,
  done
) => {
  instance.route({
    method: 'PUT',
    url: '/linear/issues/:clusterId',
    schema: {
      params: z.object({ clusterId: z.guid() }),
      body: recordSchema,
      response: {
        200: z.object({}),
      },
    },
    handler: async (request) => {
      const body = request.body;
      const fields = {
        issue_id: body.issueId,
        identifier: body.identifier,
        url: body.url,
        state_name: body.stateName,
        state_type: body.stateType,
        artifact_assets: JSON.stringify(body.artifactAssets),
        // a failed projection keeps the cluster dirty for the next run
        ...(body.errorCode ? {} : { projected_at: new Date() }),
        error_code: body.errorCode ?? null,
        error_message: body.errorMessage ?? null,
      };

      await database
        .insertInto('triage_linear_issues')
        .values({ cluster_id: request.params.clusterId, ...fields })
        .onConflict((oc) =>
          oc
            .column('cluster_id')
            .doUpdateSet({ ...fields, updated_at: new Date() })
        )
        .execute();

      return {};
    },
  });

  done();
};
