import { describe, expect, it } from 'vitest';

import { buildChatRequest } from '@colanode/bot/provider/llm-provider';

describe('buildChatRequest', () => {
  it('prepends the system message before the dialog', () => {
    const body = buildChatRequest('gpt-x', 'be nice', [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ]);
    expect(body).toEqual({
      model: 'gpt-x',
      messages: [
        { role: 'system', content: 'be nice' },
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello' },
      ],
    });
  });
});
