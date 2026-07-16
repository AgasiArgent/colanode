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
  // optional (no default) so an error record that omits it cannot wipe assets
  artifactAssets: z.record(z.string(), z.string()).optional(),
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
      const errorFields = {
        error_code: body.errorCode ?? null,
        error_message: body.errorMessage ?? null,
      };
      const assetFields =
        body.artifactAssets === undefined
          ? {}
          : { artifact_assets: JSON.stringify(body.artifactAssets) };
      const fields = {
        issue_id: body.issueId,
        identifier: body.identifier,
        url: body.url,
        state_name: body.stateName,
        state_type: body.stateType,
        // a failed projection keeps the cluster dirty for the next run
        ...(body.errorCode ? {} : { projected_at: new Date() }),
        ...assetFields,
        ...errorFields,
      };
      // An error record must not wipe previously recorded issue state — the
      // projector relies on the stored identifier/url/assets to skip
      // re-uploads and render related issues. On errorCode, update only the
      // error columns plus any assets uploaded before the failure.
      const updateFields = body.errorCode
        ? { ...assetFields, ...errorFields }
        : fields;

      await database
        .insertInto('triage_linear_issues')
        .values({ cluster_id: request.params.clusterId, ...fields })
        .onConflict((oc) =>
          oc
            .column('cluster_id')
            .doUpdateSet({ ...updateFields, updated_at: new Date() })
        )
        .execute();

      return {};
    },
  });

  done();
};
