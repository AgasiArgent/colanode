import { AppService } from '@colanode/client/services/app-service';
import { Config } from '@colanode/mcp/config';

export type ToolContext = {
  app: AppService;
  config: Config;
  resolveUserId: (workspaceId?: string) => Promise<string>;
};

export type Tool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<string>;
};

// Tools are appended here as they are implemented (Tasks 3-6, 8).
export const tools: Tool[] = [];
