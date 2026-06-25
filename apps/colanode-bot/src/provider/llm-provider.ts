export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export interface LlmProvider {
  generateReply(messages: ChatMessage[], system: string): Promise<string>;
}

export const buildChatRequest = (
  model: string,
  system: string,
  messages: ChatMessage[]
): { model: string; messages: { role: string; content: string }[] } => ({
  model,
  messages: [{ role: 'system', content: system }, ...messages],
});

export type OpenAiCompatibleOptions = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

export class OpenAiCompatibleProvider implements LlmProvider {
  private readonly options: OpenAiCompatibleOptions;

  constructor(options: OpenAiCompatibleOptions) {
    this.options = options;
  }

  async generateReply(
    messages: ChatMessage[],
    system: string
  ): Promise<string> {
    const response = await fetch(`${this.options.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.options.apiKey}`,
      },
      body: JSON.stringify(
        buildChatRequest(this.options.model, system, messages)
      ),
    });
    if (!response.ok) {
      throw new Error(
        `LLM request failed: HTTP ${response.status} ${response.statusText}`
      );
    }
    const json = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('LLM returned an empty response');
    }
    return content;
  }
}
