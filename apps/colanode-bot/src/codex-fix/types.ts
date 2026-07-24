export type DispatchOutcome =
  'pending' | 'blocked' | 'no_changes' | 'pr_opened' | 'failed';

export type IssueDispatchState = {
  issueId: string;
  identifier: string;
  dispatchCommentId: string;
  dispatchedAt: string;
  taskId?: string;
  taskUrl?: string;
  branch?: string;
  outcome: DispatchOutcome;
  prUrl?: string;
  lastError?: string;
};

export type DispatcherStateV1 = {
  version: 1;
  initializedAt: string;
  approvedIssueIds: string[];
  issues: Record<string, IssueDispatchState>;
};

export type CloudTask = {
  id: string;
  url: string;
  title: string;
  status: string;
  updatedAt: string;
  environmentId: string | null;
  environmentLabel: string;
  summary: {
    filesChanged: number;
    linesAdded: number;
    linesRemoved: number;
  };
  isReview: boolean;
  attemptTotal: number;
};

export type CommandOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
};

export type CommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export type CommandRunner = (
  command: string,
  args: string[],
  options: CommandOptions
) => Promise<CommandResult>;
