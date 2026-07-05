export type PinSnapshot = {
  comment: string;
  sourceFile: string | null;
  componentPath: string | null;
  selector: string;
};

export type BugReportConsoleEntry = {
  type: 'error' | 'warn' | 'exception';
  message: string;
  time: string;
};

export type BugReportDebugContext = {
  url: string;
  title: string;
  userAgent: string;
  screenSize: string;
  consoleErrors: BugReportConsoleEntry[];
  collectedAt: string;
};

export type BugReportCreateMutationInput = {
  type: 'bugReport.create';
  userId: string;
  workspaceId: string;
  title: string;
  did: string;
  expected: string;
  got: string;
  pins: PinSnapshot[];
  debugContext: BugReportDebugContext;
};

export type BugReportCreateMutationOutput = {
  success: boolean;
  issueUrl: string;
  issueNumber: number;
};

declare module '@colanode/client/mutations' {
  interface MutationMap {
    'bugReport.create': {
      input: BugReportCreateMutationInput;
      output: BugReportCreateMutationOutput;
    };
  }
}
