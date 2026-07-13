import { runMutation, Tool } from '@colanode/agent-tools/registry';
import { generateId, IdType, SpaceAttributes } from '@colanode/core';

/**
 * Spaces are roots: they carry no parentId. The creator must be an `admin`
 * collaborator (the space model rejects the create otherwise), and that node
 * role is also what later lets the bot create databases/views inside it.
 */
export const buildSpaceAttributes = (
  name: string,
  botUserId: string,
  description?: string
): SpaceAttributes => ({
  type: 'space',
  name,
  description: description ?? null,
  avatar: null,
  collaborators: { [botUserId]: 'admin' },
  visibility: 'private',
});

export const createSpaceTool: Tool = {
  name: 'colanode_create_space',
  description:
    'Create a space (a workspace root container). The calling user becomes an ' +
    'admin collaborator of the space. Returns the new space id.',
  inputSchema: {
    type: 'object',
    properties: {
      workspace_id: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
    },
    required: ['name'],
  },
  run: async (args, ctx) => {
    const userId = await ctx.resolveUserId(
      args.workspace_id as string | undefined
    );
    const nodeId = generateId(IdType.Space);
    await runMutation(ctx, {
      type: 'node.create',
      userId,
      nodeId,
      attributes: buildSpaceAttributes(
        args.name as string,
        userId,
        args.description as string | undefined
      ),
    });
    return `Created space ${nodeId}`;
  },
};
