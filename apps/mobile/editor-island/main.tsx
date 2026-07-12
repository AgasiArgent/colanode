// Tailwind + shadcn styling for the shared packages/ui components. Kept first
// so the base layer is registered before any component styles.
import '@colanode/ui/styles/globals.css';

import type { Editor } from '@tiptap/core';
import { createRoot } from 'react-dom/client';
import superjson from 'superjson';

import { eventBus } from '@colanode/client/lib';
import type { MutationInput, MutationResult } from '@colanode/client/mutations';
import type { QueryInput, QueryMap } from '@colanode/client/queries';
import { generateId, IdType } from '@colanode/core';
import type {
  EditorCommand,
  IslandToNativeMessage,
  NativeToIslandMessage,
} from '@colanode/mobile/island/island-messages';
import { collections } from '@colanode/ui/collections';
import { Document } from '@colanode/ui/components/documents/document';
import { WorkspaceContext } from '@colanode/ui/contexts/workspace';
// Loads the editor command augmentations (`toggleBold`, `toggleHeading1`, …),
// declared in `declare module '@tiptap/core'` blocks inside the extension
// modules. Mobile's tsc resolves @colanode/ui through its built .d.ts, which
// strip DocumentEditor's value-only extension imports — so without this barrel
// import those augmentations never reach this file and `chain().toggleBold()`
// would not type-check. Runtime cost is nil: Document already pulls the barrel.
import '@colanode/ui/editor/extensions';

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  }
}

// The live editor instance, captured through DocumentEditor's onEditorCreate
// hook so inbound `editor_command` messages can drive it.
let activeEditor: Editor | null = null;

// Guards against a duplicate mount if `init_result` were ever delivered twice.
let mounted = false;

const pendingPromises = new Map<string, (value: unknown) => void>();

const postMessage = (message: IslandToNativeMessage) => {
  window.ReactNativeWebView?.postMessage(superjson.stringify(message));
};

window.colanode = {
  // The island only mounts after the host has signed in and sent init_result,
  // so any consumer calling init() is by definition post-init.
  init: async () => 'success',
  // No reset bridge yet; reloading the WebView is the best-effort equivalent.
  reset: async () => {
    window.location.reload();
  },
  executeMutation: <T extends MutationInput>(input: T) => {
    const mutationId = generateId(IdType.Mutation);
    const promise = new Promise<MutationResult<T>>((resolve) => {
      pendingPromises.set(mutationId, resolve as (value: unknown) => void);
    });

    postMessage({ type: 'mutation', mutationId, input });

    // Let the host treat "Done" as fresh once a document write lands.
    if (input.type === 'document.update') {
      promise.then((result) => {
        if (result.success) {
          postMessage({ type: 'content_saved' });
        }
      });
    }

    return promise;
  },
  executeQuery: <T extends QueryInput>(input: T) => {
    const queryId = generateId(IdType.Query);
    const promise = new Promise<QueryMap[T['type']]['output']>((resolve) => {
      pendingPromises.set(queryId, resolve as (value: unknown) => void);
    });

    postMessage({ type: 'query', queryId, input });
    return promise;
  },
  executeQueryAndSubscribe: <T extends QueryInput>(key: string, input: T) => {
    const queryId = generateId(IdType.Query);
    const promise = new Promise<QueryMap[T['type']]['output']>((resolve) => {
      pendingPromises.set(queryId, resolve as (value: unknown) => void);
    });

    postMessage({ type: 'query_and_subscribe', queryId, key, input });
    return promise;
  },
  unsubscribeQuery: async (key: string) => {
    postMessage({ type: 'query_unsubscribe', key });
  },
  saveTempFile: async () => {
    throw new Error('saveTempFile is not supported in the editor island');
  },
  openExternalUrl: async (url: string) => {
    window.open(url, '_blank');
  },
  showItemInFolder: async () => {
    // No-op, same as web.
  },
  showFileSaveDialog: async () => undefined,
  push: {
    enable: async () => false,
    disable: async () => {
      // No push inside the island.
    },
    getState: async () => 'unsupported',
    isSupported: () => false,
  },
};

window.eventBus = eventBus;

const runEditorCommand = (command: EditorCommand) => {
  const editor = activeEditor;
  if (!editor) {
    return;
  }

  switch (command) {
    case 'bold':
      editor.chain().focus().toggleBold().run();
      break;
    case 'italic':
      editor.chain().focus().toggleItalic().run();
      break;
    case 'strike':
      editor.chain().focus().toggleStrike().run();
      break;
    case 'code':
      editor.chain().focus().toggleCode().run();
      break;
    case 'heading1':
      editor.chain().focus().toggleHeading1().run();
      break;
    case 'heading2':
      editor.chain().focus().toggleHeading2().run();
      break;
    case 'bulletList':
      editor.chain().focus().toggleBulletList().run();
      break;
    case 'taskList':
      editor.chain().focus().toggleTaskList().run();
      break;
    // The editor has no tiptap History extension — Yjs owns undo/redo via
    // DocumentEditor's handleKeyDown. shortcut: replay the keyboard shortcut
    // rather than reach into the module-private performUndo/performRedo.
    case 'undo':
    case 'redo':
      editor.view.dom.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'z',
          metaKey: true,
          shiftKey: command === 'redo',
          bubbles: true,
          cancelable: true,
        })
      );
      break;
  }
};

const mount = async (message: Extract<NativeToIslandMessage, { type: 'init_result' }>) => {
  if (mounted) {
    return;
  }
  mounted = true;

  document.documentElement.classList.toggle('dark', message.theme === 'dark');

  await collections.preload();

  const root = createRoot(document.getElementById('root')!);
  root.render(
    <WorkspaceContext.Provider
      value={{
        userId: message.userId,
        accountId: message.accountId,
        workspaceId: message.workspaceId,
        role: message.role,
        collections: collections.workspace(message.userId),
      }}
    >
      <Document
        node={message.node}
        canEdit
        // eslint-disable-next-line jsx-a11y/no-autofocus -- primary field focused when the page opens for editing
        autoFocus="start"
        onEditorCreate={(editor) => {
          activeEditor = editor;
          postMessage({ type: 'editor_ready' });
        }}
      />
    </WorkspaceContext.Provider>
  );
};

const handleMessage = (message: NativeToIslandMessage) => {
  switch (message.type) {
    case 'init_result':
      mount(message);
      break;
    case 'mutation_result': {
      const resolve = pendingPromises.get(message.mutationId);
      if (resolve) {
        resolve(message.result);
        pendingPromises.delete(message.mutationId);
      }
      break;
    }
    case 'query_result': {
      const resolve = pendingPromises.get(message.queryId);
      if (resolve) {
        resolve(message.result);
        pendingPromises.delete(message.queryId);
      }
      break;
    }
    case 'query_and_subscribe_result': {
      const resolve = pendingPromises.get(message.queryId);
      if (resolve) {
        resolve(message.result);
        pendingPromises.delete(message.queryId);
      }
      break;
    }
    case 'event':
      eventBus.publish(message.event);
      break;
    case 'editor_command':
      runEditorCommand(message.command);
      break;
  }
};

window.addEventListener('message', (event) => {
  if (typeof event.data !== 'string') {
    return;
  }

  const message = superjson.parse<NativeToIslandMessage>(event.data);
  handleMessage(message);
});

// Pipe console + uncaught errors to the host so island logs surface in Metro.
const pipe = (level: 'log' | 'warn' | 'error' | 'info' | 'debug') => {
  const original = console[level].bind(console);
  console[level] = (...args: unknown[]) => {
    original(...args);
    postMessage({ type: 'console', level, message: args.join(' ') });
  };
};

pipe('log');
pipe('warn');
pipe('error');
pipe('info');
pipe('debug');

window.addEventListener('error', (event) => {
  postMessage({ type: 'console', level: 'error', message: event.message });
});

window.addEventListener('unhandledrejection', (event) => {
  postMessage({
    type: 'console',
    level: 'error',
    message: String(event.reason),
  });
});

// Signal readiness so the host replies with init_result (identity + node).
postMessage({ type: 'init' });
