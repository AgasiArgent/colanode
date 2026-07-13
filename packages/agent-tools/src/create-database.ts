import { AgentFieldSpec, selectOptionColor } from '@colanode/agent-tools/fields';
import { runMutation, Tool } from '@colanode/agent-tools/registry';
import {
  DatabaseAttributes,
  FieldAttributes,
  generateFractionalIndex,
  generateId,
  IdType,
  SelectOptionAttributes,
} from '@colanode/core';

export type BuiltDatabase = {
  attributes: DatabaseAttributes;
  /** logical field name -> generated field id */
  fieldIds: Record<string, string>;
  /** logical field name -> (option name -> generated option id) */
  optionIds: Record<string, Record<string, string>>;
};

const buildOptions = (
  names: string[]
): { options: Record<string, SelectOptionAttributes>; ids: Record<string, string> } => {
  const options: Record<string, SelectOptionAttributes> = {};
  const ids: Record<string, string> = {};

  let index: string | null = null;
  names.forEach((name, position) => {
    const id = generateId(IdType.SelectOption);
    index = generateFractionalIndex(index, null);
    options[id] = {
      id,
      name,
      color: selectOptionColor(position),
      index,
    };
    ids[name] = id;
  });

  return { options, ids };
};

/**
 * Build a database under a space from logical field specs, generating a field
 * id per field (and an option id per select option) and surfacing those ids so
 * the caller can persist them and later address records by field id.
 */
export const buildDatabaseAttributes = (
  name: string,
  spaceId: string,
  fields: AgentFieldSpec[]
): BuiltDatabase => {
  const attributeFields: Record<string, FieldAttributes> = {};
  const fieldIds: Record<string, string> = {};
  const optionIds: Record<string, Record<string, string>> = {};

  let index: string | null = null;
  for (const spec of fields) {
    const id = generateId(IdType.Field);
    index = generateFractionalIndex(index, null);
    fieldIds[spec.name] = id;

    if (spec.type === 'select' || spec.type === 'multi_select') {
      const { options, ids } = buildOptions(spec.options ?? []);
      optionIds[spec.name] = ids;
      attributeFields[id] = {
        id,
        type: spec.type,
        name: spec.name,
        index,
        options,
      };
    } else {
      attributeFields[id] = { id, type: spec.type, name: spec.name, index };
    }
  }

  return {
    attributes: {
      type: 'database',
      name,
      parentId: spaceId,
      avatar: null,
      fields: attributeFields,
    },
    fieldIds,
    optionIds,
  };
};

export const createDatabaseTool: Tool = {
  name: 'colanode_create_database',
  description:
    'Create a database under a space. Pass the fields you want as a list of ' +
    '{name, type, options?} — ids are generated for you and returned, so use ' +
    'the returned field ids (and select option ids) when writing records.',
  inputSchema: {
    type: 'object',
    properties: {
      workspace_id: { type: 'string' },
      space_id: { type: 'string', description: 'Space to nest the database in' },
      name: { type: 'string' },
      fields: {
        type: 'array',
        description: 'Fields to create on the database',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            type: {
              type: 'string',
              enum: [
                'boolean',
                'email',
                'multi_select',
                'number',
                'phone',
                'select',
                'text',
                'url',
              ],
            },
            options: {
              type: 'array',
              items: { type: 'string' },
              description: 'Option names, for select / multi_select only',
            },
          },
          required: ['name', 'type'],
        },
      },
    },
    required: ['space_id', 'name'],
  },
  run: async (args, ctx) => {
    const userId = await ctx.resolveUserId(
      args.workspace_id as string | undefined
    );
    const nodeId = generateId(IdType.Database);
    const built = buildDatabaseAttributes(
      args.name as string,
      args.space_id as string,
      (args.fields as AgentFieldSpec[]) ?? []
    );
    await runMutation(ctx, {
      type: 'node.create',
      userId,
      nodeId,
      attributes: built.attributes,
    });
    return [
      `Created database ${nodeId}`,
      `fields: ${JSON.stringify(built.fieldIds)}`,
      `options: ${JSON.stringify(built.optionIds)}`,
    ].join('\n');
  },
};
