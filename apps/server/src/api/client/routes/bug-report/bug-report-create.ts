import { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';

import { apiErrorOutputSchema } from '@colanode/core';
import { database } from '@colanode/server/data/database';
import { createGithubIssue } from '@colanode/server/lib/bug-report/github-issues';
import {
  buildIssueBody,
  buildIssueTitle,
} from '@colanode/server/lib/bug-report/issue-body';

import { bugReportInputSchema, bugReportOutputSchema } from './schema';

export const bugReportCreateRoute: FastifyPluginCallbackZod = (
  instance,
  _,
  done
) => {
  instance.route({
    method: 'POST',
    url: '/',
    schema: {
      body: bugReportInputSchema,
      response: {
        200: bugReportOutputSchema,
        400: apiErrorOutputSchema,
      },
    },
    handler: async (request) => {
      const input = request.body;

      const reporter = await database
        .selectFrom('users')
        .select(['name'])
        .where('id', '=', request.workspace.user.id)
        .executeTakeFirst();

      const issueInput = {
        title: input.title,
        did: input.did,
        expected: input.expected,
        got: input.got,
        pins: input.pins,
        context: input.debugContext,
        reporter: { name: reporter?.name ?? 'Unknown reporter' },
      };

      const title = buildIssueTitle(issueInput);
      const body = buildIssueBody(issueInput);

      // Mint failure throws → global error-handler logs it + returns 500; the
      // widget shows "couldn't submit, retry" and keeps its queued pins.
      const { issueUrl, issueNumber } = await createGithubIssue(title, body);

      return { success: true, issueUrl, issueNumber };
    },
  });

  done();
};
