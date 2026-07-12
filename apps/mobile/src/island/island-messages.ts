import type { MutationInput, MutationResult } from '@colanode/client/mutations';
import type { QueryInput, QueryMap } from '@colanode/client/queries';
import type { Event, LocalNode } from '@colanode/client/types';
import type { WorkspaceRole } from '@colanode/core';

// The postMessage wire protocol between the editor island (Vite/WebView) and
// its React Native host. Mirrors the deleted pre-M1 `lib/types.ts` envelope
// style (one request/response pair per operation, correlated by id), trimmed
// to the slice the island needs and extended with the editor-command channel.
//
// This module is imported by BOTH sides: the island bundle (compiled by Vite,
// which resolves `@colanode/mobile` -> `./src`) and the native host (compiled
// by Metro/tsc). It is therefore pure types with type-only imports so it never
// pulls a runtime dependency into the Hermes bundle.

// ---------------------------------------------------------------------------
// island -> native
// ---------------------------------------------------------------------------

// Ready signal posted once the island script has installed its bridge and is
// waiting for identity/content from the host.
export type InitMessage = {
  type: 'init';
};

export type MutationMessage = {
  type: 'mutation';
  mutationId: string;
  input: MutationInput;
};

export type QueryMessage = {
  type: 'query';
  queryId: string;
  input: QueryInput;
};

export type QueryAndSubscribeMessage = {
  type: 'query_and_subscribe';
  queryId: string;
  key: string;
  input: QueryInput;
};

export type QueryUnsubscribeMessage = {
  type: 'query_unsubscribe';
  key: string;
};

export type ConsoleMessage = {
  type: 'console';
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  message: string;
};

// Fired after a successful `document.update` mutation so the native host can
// treat "Done" as showing fresh content.
export type ContentSavedMessage = {
  type: 'content_saved';
};

// Posted once the shared `Document` component has mounted and its editor is
// live, so the host can dismiss its loading/timeout state.
export type EditorReadyMessage = {
  type: 'editor_ready';
};

export type IslandToNativeMessage =
  | InitMessage
  | MutationMessage
  | QueryMessage
  | QueryAndSubscribeMessage
  | QueryUnsubscribeMessage
  | ConsoleMessage
  | ContentSavedMessage
  | EditorReadyMessage;

// ---------------------------------------------------------------------------
// native -> island
// ---------------------------------------------------------------------------

export type InitResultMessage = {
  type: 'init_result';
  userId: string;
  accountId: string;
  workspaceId: string;
  role: WorkspaceRole;
  node: LocalNode;
  theme: 'light' | 'dark';
};

export type MutationResultMessage = {
  type: 'mutation_result';
  mutationId: string;
  result: MutationResult<MutationInput>;
};

export type QueryResultMessage = {
  type: 'query_result';
  queryId: string;
  result: QueryMap[QueryInput['type']]['output'];
};

export type QueryAndSubscribeResultMessage = {
  type: 'query_and_subscribe_result';
  queryId: string;
  key: string;
  result: QueryMap[QueryInput['type']]['output'];
};

export type EventMessage = {
  type: 'event';
  event: Event;
};

export type EditorCommand =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'code'
  | 'heading1'
  | 'heading2'
  | 'bulletList'
  | 'taskList'
  | 'undo'
  | 'redo';

export type EditorCommandMessage = {
  type: 'editor_command';
  command: EditorCommand;
};

export type NativeToIslandMessage =
  | InitResultMessage
  | MutationResultMessage
  | QueryResultMessage
  | QueryAndSubscribeResultMessage
  | EventMessage
  | EditorCommandMessage;

export type IslandMessage = IslandToNativeMessage | NativeToIslandMessage;
