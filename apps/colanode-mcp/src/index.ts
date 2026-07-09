import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { Tool, ToolContext, tools } from '@colanode/agent-tools';
import { getEngine, makeUserIdResolver } from '@colanode/mcp/bootstrap';
import { loadConfig } from '@colanode/mcp/config';
import { deleteNodeTool } from '@colanode/mcp/tools/delete-node';

const main = async (): Promise<void> => {
  const config = loadConfig();
  const allTools: Tool[] = [...tools, deleteNodeTool];
  const server = new Server(
    { name: 'colanode', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = allTools.find((t) => t.name === request.params.name);
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
        resolveUserId: makeUserIdResolver(app, config),
      };
      const text = await tool.run(request.params.arguments ?? {}, ctx);
      return { content: [{ type: 'text', text }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { isError: true, content: [{ type: 'text', text: message }] };
    }
  });

  // The engine targets Electron/browser hosts where an unhandled rejection is
  // logged, not fatal. Match those semantics: a background sync hiccup must
  // not take the whole MCP down. stderr lands in the client's MCP logs.
  process.on('unhandledRejection', (reason) => {
    console.error('colanode-mcp unhandled rejection:', reason);
  });

  // The engine keeps the event loop alive (timers, sockets, sqlite), and the
  // SDK's stdio transport never watches for stdin EOF — without explicit exits
  // every closed client session leaks a live MCP process.
  process.stdin.on('end', () => process.exit(0));
  process.stdin.on('close', () => process.exit(0));
  process.on('SIGINT', () => process.exit(0));
  process.on('SIGTERM', () => process.exit(0));

  await server.connect(new StdioServerTransport());
};

main().catch((error) => {
  console.error('colanode-mcp failed to start:', error);
  process.exit(1);
});
