import { runMutation, Tool, ToolContext } from '@colanode/agent-tools/registry';
import { RecordAttributes } from '@colanode/core';

type RecordFields = RecordAttributes['fields'];

/** Overwrite the updated fields, keep every other existing field. */
export const mergeRecordFields = (
  existing: RecordFields,
  updates: RecordFields
): RecordFields => ({ ...existing, ...updates });

const updateRecordOnce = async (
  ctx: ToolContext,
  userId: string,
  recordId: string,
  name: string | undefined,
  fields: RecordFields
): Promise<void> => {
  const nodes = await ctx.app.mediator.executeQuery({
    type: 'node.list',
    userId,
    filters: [{ field: ['id'], operator: 'eq', value: recordId }] as never,
    sorts: [],
    limit: 1,
  });
  const current = nodes[0];
  if (!current || current.type !== 'record') {
    throw new Error(`Record ${recordId} not found`);
  }

  // node.update REPLACES the attributes, so send the complete object back.
  const next: RecordAttributes = {
    type: 'record',
    parentId: current.parentId ?? current.databaseId,
    databaseId: current.databaseId,
    name: name ?? current.name,
    avatar: current.avatar ?? null,
    sourceMessageId: current.sourceMessageId ?? null,
    fields: mergeRecordFields(current.fields, fields),
  };

  await runMutation(ctx, {
    type: 'node.update',
    userId,
    nodeId: recordId,
    attributes: next,
  });
};

export const updateRecordTool: Tool = {
  name: 'colanode_update_record',
  description:
    'Update a record: rename it and/or set field values. Fields you do not ' +
    'pass keep their current value. `fields` is a map of fieldId to a field ' +
    'value object, e.g. {"fd-1": {"type": "string", "value": "so-2"}}.',
  inputSchema: {
    type: 'object',
    properties: {
      workspace_id: { type: 'string' },
      record_id: { type: 'string' },
      name: { type: 'string' },
      fields: {
        type: 'object',
        description: 'Map of fieldId to a field value object',
      },
    },
    required: ['record_id'],
  },
  run: async (args, ctx) => {
    const userId = await ctx.resolveUserId(
      args.workspace_id as string | undefined
    );
    const recordId = args.record_id as string;
    const name = args.name as string | undefined;
    const fields = (args.fields as RecordFields) ?? {};

    try {
      await updateRecordOnce(ctx, userId, recordId, name, fields);
    } catch {
      // Re-read and retry once: the record may have moved on under us.
      await updateRecordOnce(ctx, userId, recordId, name, fields);
    }
    return `Updated record ${recordId}`;
  },
};
