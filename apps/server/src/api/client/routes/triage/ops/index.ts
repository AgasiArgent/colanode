import { FastifyPluginCallback } from 'fastify';

import { triageOpsAuthenticator } from '@colanode/server/api/client/plugins/triage-ops-auth';

import { triageOpsClusterCreateRoute } from './cluster-create';
import { triageOpsClustersListRoute } from './clusters-list';
import { triageOpsItemPatchRoute } from './item-patch';
import { triageOpsProjectUpsertRoute } from './project-upsert';
import { triageOpsProjectsListRoute } from './projects-list';
import { triageOpsReportExplodeRoute } from './report-explode';
import { triageOpsReportsListRoute } from './reports-list';

export const triageOpsRoutes: FastifyPluginCallback = (instance, _, done) => {
  instance.register(triageOpsAuthenticator);
  instance.register(triageOpsProjectsListRoute);
  instance.register(triageOpsReportsListRoute);
  instance.register(triageOpsClustersListRoute);
  instance.register(triageOpsProjectUpsertRoute);
  instance.register(triageOpsReportExplodeRoute);
  instance.register(triageOpsItemPatchRoute);
  instance.register(triageOpsClusterCreateRoute);
  done();
};
