import { describe, expect, it } from 'vitest';

import { buildChannelAttributes } from '@colanode/agent-tools/create-channel';
import { buildDatabaseAttributes } from '@colanode/agent-tools/create-database';
import { buildDatabaseViewAttributes } from '@colanode/agent-tools/create-database-view';
import { buildPageAttributes } from '@colanode/agent-tools/create-page';
import { buildRecordAttributes } from '@colanode/agent-tools/create-record';
import { buildSpaceAttributes } from '@colanode/agent-tools/create-space';
import { toFieldValue } from '@colanode/agent-tools/fields';
import { buildNodeListInput } from '@colanode/agent-tools/list-nodes';
import { textToContent } from '@colanode/agent-tools/post-message';
import { mergeRecordFields } from '@colanode/agent-tools/update-record';

describe('buildNodeListInput', () => {
  it('filters by parentId when given', () => {
    const input = buildNodeListInput('us-1', { parentId: 'sp-1' });
    expect(input).toEqual({
      type: 'node.list',
      userId: 'us-1',
      filters: [{ field: ['parentId'], operator: 'eq', value: 'sp-1' }],
      sorts: [],
      limit: 100,
    });
  });

  it('filters by rootId and respects an explicit limit', () => {
    const input = buildNodeListInput('us-1', { rootId: 'sp-9', limit: 10 });
    expect(input.filters).toEqual([
      { field: ['rootId'], operator: 'eq', value: 'sp-9' },
    ]);
    expect(input.limit).toBe(10);
  });

  it('returns no filters when neither parentId nor rootId given', () => {
    expect(buildNodeListInput('us-1', {}).filters).toEqual([]);
  });
});

describe('buildPageAttributes', () => {
  it('builds a page with parentId and optional avatar', () => {
    expect(buildPageAttributes('Notes', 'sp-1')).toEqual({
      type: 'page',
      name: 'Notes',
      parentId: 'sp-1',
      avatar: null,
    });
    expect(buildPageAttributes('Notes', 'sp-1', 'av-9').avatar).toBe('av-9');
  });
});

describe('buildChannelAttributes', () => {
  it('builds a channel with parentId', () => {
    expect(buildChannelAttributes('general', 'sp-1')).toEqual({
      type: 'channel',
      name: 'general',
      parentId: 'sp-1',
      avatar: null,
    });
  });
});

describe('buildRecordAttributes', () => {
  it('sets parentId to the databaseId and includes fields', () => {
    const attrs = buildRecordAttributes('db-1', 'Acme', {});
    expect(attrs).toEqual({
      type: 'record',
      parentId: 'db-1',
      databaseId: 'db-1',
      name: 'Acme',
      avatar: null,
      fields: {},
    });
  });
});

describe('buildSpaceAttributes', () => {
  it('makes the bot an admin collaborator and sets no parentId', () => {
    const attrs = buildSpaceAttributes('Triage', 'us-bot', 'Auto triage');
    expect(attrs.type).toBe('space');
    expect(attrs.name).toBe('Triage');
    expect(attrs.description).toBe('Auto triage');
    expect(attrs.collaborators['us-bot']).toBe('admin');
    expect(attrs.visibility).toBe('private');
    expect(attrs).not.toHaveProperty('parentId');
  });

  it('defaults description to null', () => {
    expect(buildSpaceAttributes('Triage', 'us-bot').description).toBeNull();
  });
});

describe('buildDatabaseAttributes', () => {
  const built = buildDatabaseAttributes('Clusters', 'sp-1', [
    { name: 'Status', type: 'select', options: ['Open', 'Done'] },
    { name: 'Hits', type: 'number' },
    { name: 'Link', type: 'url' },
  ]);

  it('parents the database to the space', () => {
    expect(built.attributes.type).toBe('database');
    expect(built.attributes.parentId).toBe('sp-1');
    expect(built.attributes.name).toBe('Clusters');
  });

  it('generates an id and an index for every field', () => {
    const fields = Object.values(built.attributes.fields);
    expect(fields).toHaveLength(3);
    for (const field of fields) {
      expect(field.id).toBeTruthy();
      expect(field.index).toBeTruthy();
    }
    // fields are keyed by their generated id
    for (const [key, field] of Object.entries(built.attributes.fields)) {
      expect(key).toBe(field.id);
    }
  });

  it('surfaces the generated field ids by logical field name', () => {
    expect(Object.keys(built.fieldIds).sort()).toEqual([
      'Hits',
      'Link',
      'Status',
    ]);
    expect(built.fieldIds.Status).toBe(
      built.attributes.fields[built.fieldIds.Status!]!.id
    );
  });

  it('builds select options keyed by option id with id, name, color, index', () => {
    const statusField = built.attributes.fields[built.fieldIds.Status!]!;
    expect(statusField.type).toBe('select');
    if (statusField.type !== 'select') {
      throw new Error('expected a select field');
    }

    const options = statusField.options!;
    expect(Object.keys(options)).toHaveLength(2);
    for (const [key, option] of Object.entries(options)) {
      expect(key).toBe(option.id);
      expect(option.name).toBeTruthy();
      expect(option.color).toBeTruthy();
      expect(option.index).toBeTruthy();
    }
  });

  it('surfaces the generated option ids by field name and option name', () => {
    const openId = built.optionIds.Status!.Open!;
    const statusField = built.attributes.fields[built.fieldIds.Status!]!;
    if (statusField.type !== 'select') {
      throw new Error('expected a select field');
    }
    expect(statusField.options![openId]!.name).toBe('Open');
  });

  it('does not attach options to non-select fields', () => {
    const hits = built.attributes.fields[built.fieldIds.Hits!]!;
    expect(hits.type).toBe('number');
    expect(hits).not.toHaveProperty('options');
    expect(built.optionIds.Hits).toBeUndefined();
  });
});

describe('buildDatabaseViewAttributes', () => {
  it('builds a board view grouped by a select field', () => {
    const attrs = buildDatabaseViewAttributes(
      'Board',
      'db-1',
      'board',
      'fd-status'
    );
    expect(attrs.type).toBe('database_view');
    expect(attrs.layout).toBe('board');
    expect(attrs.parentId).toBe('db-1');
    expect(attrs.groupBy).toBe('fd-status');
    expect(attrs.name).toBe('Board');
    expect(attrs.index).toBeTruthy();
  });

  it('builds a table view with no groupBy', () => {
    const attrs = buildDatabaseViewAttributes('All', 'db-1', 'table');
    expect(attrs.layout).toBe('table');
    expect(attrs.groupBy).toBeNull();
  });
});

describe('toFieldValue', () => {
  it('maps a select value to a string field value holding the option id', () => {
    expect(toFieldValue('select', 'so-open')).toEqual({
      type: 'string',
      value: 'so-open',
    });
  });

  it('maps url, email and phone to string field values', () => {
    expect(toFieldValue('url', 'https://a.dev')).toEqual({
      type: 'string',
      value: 'https://a.dev',
    });
    expect(toFieldValue('email', 'a@b.dev').type).toBe('string');
    expect(toFieldValue('phone', '+123').type).toBe('string');
  });

  it('maps number to a number field value', () => {
    expect(toFieldValue('number', 7)).toEqual({ type: 'number', value: 7 });
  });

  it('maps text to a text field value', () => {
    expect(toFieldValue('text', 'hello')).toEqual({
      type: 'text',
      value: 'hello',
    });
  });

  it('maps multi_select to a string_array of option ids', () => {
    expect(toFieldValue('multi_select', ['so-1', 'so-2'])).toEqual({
      type: 'string_array',
      value: ['so-1', 'so-2'],
    });
  });

  it('maps boolean to a boolean field value', () => {
    expect(toFieldValue('boolean', true)).toEqual({
      type: 'boolean',
      value: true,
    });
  });

  it('throws when the value does not match the field type', () => {
    expect(() => toFieldValue('number', 'seven')).toThrow();
  });
});

describe('mergeRecordFields', () => {
  it('keeps existing fields and overwrites the updated ones', () => {
    const existing = {
      'fd-status': { type: 'string', value: 'so-open' },
      'fd-hits': { type: 'number', value: 1 },
    } as const;
    const merged = mergeRecordFields(existing, {
      'fd-hits': { type: 'number', value: 2 },
      'fd-link': { type: 'string', value: 'https://a.dev' },
    });
    expect(merged).toEqual({
      'fd-status': { type: 'string', value: 'so-open' },
      'fd-hits': { type: 'number', value: 2 },
      'fd-link': { type: 'string', value: 'https://a.dev' },
    });
  });

  it('does not mutate the existing fields object', () => {
    const existing = { 'fd-hits': { type: 'number', value: 1 } } as const;
    mergeRecordFields(existing, { 'fd-hits': { type: 'number', value: 9 } });
    expect(existing['fd-hits'].value).toBe(1);
  });
});

describe('textToContent', () => {
  it('wraps a plain string into a tiptap doc paragraph', () => {
    expect(textToContent('hi')).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }],
    });
  });
});
