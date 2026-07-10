import type { LoginSuccessOutput } from '@colanode/core';

// Persist the freshly logged-in workspace as the app default so SessionGate
// opens it. Fire-and-forget: a failure only means the gate falls back to the
// first workspace, which for a fresh login is the same one.
export const rememberWorkspace = (output: LoginSuccessOutput) => {
  const userId = output.workspaces[0]?.user.id;
  if (!userId) {
    return;
  }
  window.colanode
    .executeMutation({
      type: 'metadata.update',
      namespace: 'app',
      key: 'workspace',
      value: JSON.stringify(userId),
    })
    .catch((error) =>
      console.warn('[Mobile] failed to remember workspace', error)
    );
};
