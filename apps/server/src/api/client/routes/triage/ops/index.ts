import { FastifyPluginCallback } from 'fastify';

import { triageOpsAuthenticator } from '@colanode/server/api/client/plugins/triage-ops-auth';

import { triageOpsClusterAttachRoute } from './cluster-attach';
import { triageOpsClusterCreateRoute } from './cluster-create';
import { triageOpsClusterPatchRoute } from './cluster-patch';
import { triageOpsClustersCandidatesRoute } from './clusters-candidates';
import { triageOpsClustersListRoute } from './clusters-list';
import { triageOpsItemPatchRoute } from './item-patch';
import { triageOpsItemsListRoute } from './items-list';
import { triageOpsProjectUpsertRoute } from './project-upsert';
import { triageOpsProjectsListRoute } from './projects-list';
import { triageOpsReportExplodeRoute } from './report-explode';
import { triageOpsReportsListRoute } from './reports-list';

export const triageOpsRoutes: FastifyPluginCallback = (instance, _, done) => {
  instance.register(triageOpsAuthenticator);
  instance.register(triageOpsProjectsListRoute);
  instance.register(triageOpsReportsListRoute);
  instance.register(triageOpsItemsListRoute);
  instance.register(triageOpsClustersCandidatesRoute);
  instance.register(triageOpsClustersListRoute);
  instance.register(triageOpsProjectUpsertRoute);
  instance.register(triageOpsReportExplodeRoute);
  instance.register(triageOpsItemPatchRoute);
  instance.register(triageOpsClusterCreateRoute);
  instance.register(triageOpsClusterPatchRoute);
  instance.register(triageOpsClusterAttachRoute);
  done();
};
