import { runMutation, Tool } from '@colanode/agent-tools/registry';
import {
  DatabaseViewAttributes,
  DatabaseViewLayout,
  generateFractionalIndex,
  generateId,
  IdType,
} from '@colanode/core';

/**
 * Build a view of a database. A board is simply `layout: 'board'` plus a
 * `groupBy` pointing at a select field of that database.
 */
export const buildDatabaseViewAttributes = (
  name: string,
  databaseId: string,
  layout: DatabaseViewLayout,
  groupByFieldId?: string
): DatabaseViewAttributes => ({
  type: 'database_view',
  name,
  parentId: databaseId,
  layout,
  index: generateFractionalIndex(null, null),
  avatar: null,
  groupBy: groupByFieldId ?? null,
});

export const createDatabaseViewTool: Tool = {
  name: 'colanode_create_database_view',
  description:
    'Create a view of a database. Use layout "board" with group_by_field_id ' +
    'set to a select field id for a kanban board, or "table" / "calendar".',
  inputSchema: {
    type: 'object',
    properties: {
      workspace_id: { type: 'string' },
      database_id: { type: 'string' },
      name: { type: 'string' },
      layout: { type: 'string', enum: ['table', 'board', 'calendar'] },
      group_by_field_id: {
        type: 'string',
        description: 'Select field id to group a board by',
      },
    },
    required: ['database_id', 'name', 'layout'],
  },
  run: async (args, ctx) => {
    const userId = await ctx.resolveUserId(
      args.workspace_id as string | undefined
    );
    const nodeId = generateId(IdType.DatabaseView);
    await runMutation(ctx, {
      type: 'node.create',
      userId,
      nodeId,
      attributes: buildDatabaseViewAttributes(
        args.name as string,
        args.database_id as string,
        args.layout as DatabaseViewLayout,
        args.group_by_field_id as string | undefined
      ),
    });
    return `Created database view ${nodeId}`;
  },
};
