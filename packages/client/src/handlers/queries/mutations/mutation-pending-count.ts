import { WorkspaceQueryHandlerBase } from '@colanode/client/handlers/queries/workspace-query-handler-base';
import { ChangeCheckResult, QueryHandler } from '@colanode/client/lib/types';
import { QueryError, QueryErrorCode } from '@colanode/client/queries';
import {
  MutationPendingCountQueryInput,
  MutationPendingCountQueryOutput,
} from '@colanode/client/queries/mutations/mutation-pending-count';
import { Event } from '@colanode/client/types/events';

export class MutationPendingCountQueryHandler
  extends WorkspaceQueryHandlerBase
  implements QueryHandler<MutationPendingCountQueryInput>
{
  public async handleQuery(
    input: MutationPendingCountQueryInput
  ): Promise<MutationPendingCountQueryOutput> {
    const workspace = this.getWorkspace(input.userId);

    const row = await workspace.database
      .selectFrom('mutations')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .executeTakeFirst();

    return {
      pendingCount: row?.count ?? 0,
      serverAvailable: workspace.account.server.isAvailable,
    };
  }

  public async checkForChanges(
    event: Event,
    input: MutationPendingCountQueryInput,
    _: MutationPendingCountQueryOutput
  ): Promise<ChangeCheckResult<MutationPendingCountQueryInput>> {
    if (
      event.type === 'workspace.deleted' &&
      event.workspace.userId === input.userId
    ) {
      return {
        hasChanges: true,
        result: { pendingCount: 0, serverAvailable: false },
      };
    }

    if (
      event.type === 'mutation.queue.changed' &&
      event.workspace.userId === input.userId
    ) {
      return this.requery(input);
    }

    if (
      event.type === 'account.connection.opened' ||
      event.type === 'account.connection.closed' ||
      event.type === 'server.availability.changed'
    ) {
      return this.requery(input);
    }

    return { hasChanges: false };
  }

  private async requery(
    input: MutationPendingCountQueryInput
  ): Promise<ChangeCheckResult<MutationPendingCountQueryInput>> {
    try {
      const result = await this.handleQuery(input);
      return { hasChanges: true, result };
    } catch (error) {
      // The workspace may have been deleted concurrently with this event
      // (e.g. an account.connection.closed event arriving after the
      // workspace was removed). getWorkspace() throws in that case, and an
      // uncaught rejection here would permanently stall the mediator's
      // event-processing loop for every live query in the app.
      if (
        error instanceof QueryError &&
        error.code === QueryErrorCode.WorkspaceNotFound
      ) {
        return { hasChanges: false };
      }

      throw error;
    }
  }
}
