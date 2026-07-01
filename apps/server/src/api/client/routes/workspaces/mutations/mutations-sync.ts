import { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';

import {
  SyncMutationResult,
  MutationStatus,
  Mutation,
  syncMutationsInputSchema,
  ApiErrorCode,
  WorkspaceStatus,
} from '@colanode/core';
import { toSafeLogFields } from '@colanode/server/api/client/lib/log-error';
import { updateDocumentFromMutation } from '@colanode/server/lib/documents';
import { createLogger } from '@colanode/server/lib/logger';
import {
  markNodeAsOpened,
  markNodeAsSeen,
} from '@colanode/server/lib/node-interactions';
import { markNotificationRead } from '@colanode/server/lib/notifications';
import {
  createNodeReaction,
  deleteNodeReaction,
} from '@colanode/server/lib/node-reactions';
import {
  createNodeFromMutation,
  updateNodeFromMutation,
  deleteNodeFromMutation,
} from '@colanode/server/lib/nodes';
import { WorkspaceContext } from '@colanode/server/types/api';

const logger = createLogger('api:client:workspaces:mutations-sync');

export const mutationsSyncRoute: FastifyPluginCallbackZod = (
  instance,
  _,
  done
) => {
  instance.route({
    method: 'POST',
    url: '/',
    schema: {
      body: syncMutationsInputSchema,
    },
    handler: async (request, reply) => {
      const input = request.body;
      const workspace = request.workspace;

      if (workspace.status === WorkspaceStatus.Readonly) {
        return reply.code(403).send({
          code: ApiErrorCode.WorkspaceReadonly,
          message: 'Workspace is readonly and you cannot make any changes.',
        });
      }

      const results: SyncMutationResult[] = [];
      for (const mutation of input.mutations) {
        try {
          const status = await handleMutation(workspace, mutation);
          results.push({
            id: mutation.id,
            status: status,
          });
        } catch (error) {
          logger.error(
            toSafeLogFields(error),
            `Failed to apply mutation ${mutation.id} (type: ${mutation.type}) for workspace ${workspace.id}`
          );
          results.push({
            id: mutation.id,
            status: MutationStatus.INTERNAL_SERVER_ERROR,
          });
        }
      }

      return { results };
    },
  });

  done();
};

const handleMutation = async (
  workspace: WorkspaceContext,
  mutation: Mutation
): Promise<MutationStatus> => {
  if (mutation.type === 'node.create') {
    return await createNodeFromMutation(workspace, mutation.data);
  } else if (mutation.type === 'node.update') {
    return await updateNodeFromMutation(workspace, mutation.data);
  } else if (mutation.type === 'node.delete') {
    return await deleteNodeFromMutation(workspace, mutation.data);
  } else if (mutation.type === 'node.reaction.create') {
    return await createNodeReaction(workspace, mutation);
  } else if (mutation.type === 'node.reaction.delete') {
    return await deleteNodeReaction(workspace, mutation);
  } else if (mutation.type === 'node.interaction.seen') {
    return await markNodeAsSeen(workspace, mutation);
  } else if (mutation.type === 'node.interaction.opened') {
    return await markNodeAsOpened(workspace, mutation);
  } else if (mutation.type === 'document.update') {
    return await updateDocumentFromMutation(workspace, mutation.data);
  } else if (mutation.type === 'notification.read') {
    return await markNotificationRead(workspace, mutation);
  } else {
    return MutationStatus.METHOD_NOT_ALLOWED;
  }
};
