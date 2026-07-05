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
