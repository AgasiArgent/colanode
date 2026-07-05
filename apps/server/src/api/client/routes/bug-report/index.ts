import { FastifyPluginCallback } from 'fastify';

import { bugReportCreateRoute } from './bug-report-create';

export const bugReportRoutes: FastifyPluginCallback = (instance, _, done) => {
  instance.register(bugReportCreateRoute);
  done();
};
