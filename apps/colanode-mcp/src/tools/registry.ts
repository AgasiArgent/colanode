import { MutationInput, MutationResult } from '@colanode/client/mutations';
import { AppService } from '@colanode/client/services/app-service';
import { Config } from '@colanode/mcp/config';
import { createChannelTool } from '@colanode/mcp/tools/create-channel';
import { createPageTool } from '@colanode/mcp/tools/create-page';
import { getDocumentTool } from '@colanode/mcp/tools/get-document';
import { listNodesTool } from '@colanode/mcp/tools/list-nodes';
import { listWorkspacesTool } from '@colanode/mcp/tools/list-workspaces';
import { searchRecordsTool } from '@colanode/mcp/tools/search-records';
import { updatePageTool } from '@colanode/mcp/tools/update-page';

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

export const runMutation = async <T extends MutationInput>(
  ctx: ToolContext,
  input: T
): Promise<MutationResult<T>> => {
  const result = await ctx.app.mediator.executeMutation(input);
  if (!result.success) {
    throw new Error(`${input.type} failed: ${result.error.message}`);
  }
  return result;
};

// Tools are appended here as they are implemented (Tasks 3-6, 8).
export const tools: Tool[] = [
  listWorkspacesTool,
  listNodesTool,
  getDocumentTool,
  searchRecordsTool,
  createPageTool,
  updatePageTool,
  createChannelTool,
];
