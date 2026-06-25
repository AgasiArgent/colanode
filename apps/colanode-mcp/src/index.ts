import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { getEngine, makeUserIdResolver } from '@colanode/mcp/bootstrap';
import { loadConfig } from '@colanode/mcp/config';
import { ToolContext, tools } from '@colanode/mcp/tools/registry';

const main = async (): Promise<void> => {
  const config = loadConfig();
  const server = new Server(
    { name: 'colanode', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find((t) => t.name === request.params.name);
    if (!tool) {
      return {
        isError: true,
        content: [
          { type: 'text', text: `Unknown tool: ${request.params.name}` },
        ],
      };
    }
    try {
      const app = await getEngine();
      const ctx: ToolContext = {
        app,
        config,
        resolveUserId: makeUserIdResolver(app, config),
      };
      const text = await tool.run(request.params.arguments ?? {}, ctx);
      return { content: [{ type: 'text', text }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { isError: true, content: [{ type: 'text', text: message }] };
    }
  });

  await server.connect(new StdioServerTransport());
};

main().catch((error) => {
  console.error('colanode-mcp failed to start:', error);
  process.exit(1);
});
