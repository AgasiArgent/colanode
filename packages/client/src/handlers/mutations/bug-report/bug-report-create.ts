import { parseApiError } from '@colanode/client/lib/ky';
import { MutationHandler } from '@colanode/client/lib/types';
import { MutationError, MutationErrorCode } from '@colanode/client/mutations';
import {
  BugReportCreateMutationInput,
  BugReportCreateMutationOutput,
} from '@colanode/client/mutations/bug-report/bug-report-create';
import { AppService } from '@colanode/client/services/app-service';

export class BugReportCreateMutationHandler
  implements MutationHandler<BugReportCreateMutationInput>
{
  private readonly app: AppService;

  constructor(app: AppService) {
    this.app = app;
  }

  async handleMutation(
    input: BugReportCreateMutationInput
  ): Promise<BugReportCreateMutationOutput> {
    const workspaceService = this.app.getWorkspace(input.userId);
    if (!workspaceService) {
      throw new MutationError(
        MutationErrorCode.WorkspaceNotFound,
        'Workspace not found.'
      );
    }

    try {
      const response = await workspaceService.account.client
        .post(
          `v1/workspaces/${workspaceService.workspace.workspaceId}/bug-report`,
          {
            json: {
              title: input.title,
              did: input.did,
              expected: input.expected,
              got: input.got,
              pins: input.pins,
              debugContext: input.debugContext,
            },
          }
        )
        .json<BugReportCreateMutationOutput>();

      return response;
    } catch (error) {
      const apiError = await parseApiError(error);
      throw new MutationError(MutationErrorCode.ApiError, apiError.message);
    }
  }
}
