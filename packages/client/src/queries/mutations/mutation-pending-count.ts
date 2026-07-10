export type MutationPendingCountQueryInput = {
  type: 'mutation.pending-count';
  userId: string;
};

export type MutationPendingCountQueryOutput = {
  pendingCount: number;
  serverAvailable: boolean;
};

declare module '@colanode/client/queries' {
  interface QueryMap {
    'mutation.pending-count': {
      input: MutationPendingCountQueryInput;
      output: MutationPendingCountQueryOutput;
    };
  }
}
