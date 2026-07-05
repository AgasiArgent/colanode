export type BugReportPin = {
  comment: string;
  sourceFile: string | null;
  componentPath: string | null;
  selector: string;
};

export type BugReportContext = {
  url: string;
  title: string;
  userAgent: string;
  screenSize: string;
  consoleErrors: { type: string; message: string; time: string }[];
  collectedAt: string;
};

export type BugReportIssueInput = {
  title: string;
  did: string;
  expected: string;
  got: string;
  pins: BugReportPin[];
  context: BugReportContext;
  reporter: { name: string };
};

export function buildIssueTitle(input: BugReportIssueInput): string {
  if (input.title.trim()) return input.title.trim();
  const component = input.pins.find((p) => p.componentPath)?.componentPath;
  return `${component ?? 'Bug report'} — ${input.context.title || 'colanode'}`;
}

function renderPin(pin: BugReportPin, index: number): string {
  const anchor = pin.sourceFile
    ? `\`${pin.sourceFile}\`${pin.componentPath ? ` — \`${pin.componentPath}\`` : ''}`
    : '_no source resolved_';
  const note = pin.comment ? ` — note: "${pin.comment}"` : '';
  return `${index + 1}. ${anchor} — selector \`${pin.selector}\`${note}`;
}

export function buildIssueBody(input: BugReportIssueInput): string {
  const lines: string[] = [];

  lines.push(
    `**Reported by:** ${input.reporter.name} (colanode) · via pinpoint widget`
  );
  lines.push(`**Page:** ${input.context.url}`, '');

  if (input.did) lines.push(`**Did:** ${input.did}`);
  if (input.expected) lines.push(`**Expected:** ${input.expected}`);
  if (input.got) lines.push(`**Got:** ${input.got}`);
  lines.push('');

  lines.push(
    `**Pinned source (${input.pins.length} pins, most useful first):**`
  );
  input.pins.forEach((pin, i) => lines.push(renderPin(pin, i)));
  lines.push('');

  const errors = input.context.consoleErrors;
  lines.push(`**Console errors (${errors.length}):**`);
  for (const e of errors.slice(0, 5)) lines.push(`- \`${e.message}\``);
  // shortcut: Phase 1 debugContext captures console only — network capture is a
  // follow-up, so failed-request count is always 0 here.
  lines.push('**Failed requests (0):**', '');

  lines.push('_Reported from colanode pinpoint widget._');
  return lines.join('\n');
}
