import { QueueCluster, QueueReport } from './types';

// HTML comment markers delimiting the machine-owned description section
// (spec §8). Human text outside the markers is never touched.
export const MACHINE_BEGIN = '<!-- triage:machine:begin -->';
export const MACHINE_END = '<!-- triage:machine:end -->';

const shortIdOf = (report: QueueReport): string => {
  const shortId = report.debugContext.shortId;
  return typeof shortId === 'string' && shortId.length > 0
    ? shortId
    : report.id;
};

const impactSection = (cluster: QueueCluster): string[] => {
  const count = cluster.reports.length;
  return [
    '## Impact',
    '',
    `- Reports: ${count}`,
    // The queue payload carries no report timestamps; first/last seen is
    // reconstructable from the triage store via the evidence report IDs below.
    `- First/last seen: see evidence report IDs in the triage store`,
  ];
};

const behaviorSection = (cluster: QueueCluster): string[] => {
  const lines = ['## Observed and expected behavior', ''];
  for (const report of cluster.reports) {
    lines.push(
      `**${shortIdOf(report)}** — ${report.title} (${report.reporterName}, ${report.pageUrl})`,
      '',
      `- Did: ${report.did}`,
      `- Expected: ${report.expected}`,
      `- Observed: ${report.got}`,
      ''
    );
  }
  return lines.slice(0, -1);
};

const hypothesisSection = (cluster: QueueCluster): string[] => {
  const lines = [
    '## Reproduction clues and root-cause hypothesis',
    '',
    `Root-cause hypothesis (unverified, a hypothesis until confirmed in code): ${cluster.rootHypothesis}`,
  ];
  if (cluster.items.length > 0) {
    lines.push('', 'Clues from triaged items:');
    for (const item of cluster.items) {
      const triage = item.triage ? ` [${item.triage}]` : '';
      lines.push(`- ${item.summary}${triage}`);
    }
  }
  return lines;
};

const screenshotsSection = (
  cluster: QueueCluster,
  assets: Record<string, string>
): string[] => {
  const lines: string[] = [];
  for (const report of cluster.reports) {
    const shortId = shortIdOf(report);
    for (const artifact of report.artifacts) {
      if (artifact.kind !== 'screenshot') {
        continue;
      }
      const assetUrl = assets[artifact.id];
      lines.push(
        assetUrl
          ? `![screenshot ${shortId}](${assetUrl})`
          : '_screenshot omitted (>10 MB)_'
      );
    }
  }
  return lines.length > 0 ? ['## Screenshots', '', ...lines] : [];
};

const videosSection = (cluster: QueueCluster): string[] => {
  const lines = cluster.reports
    .filter((report) => report.recordingUrl !== null)
    .map((report) => `- ${shortIdOf(report)}: ${report.recordingUrl}`);
  return lines.length > 0 ? ['## Recordings', '', ...lines] : [];
};

const evidenceSection = (cluster: QueueCluster): string[] => [
  '## Evidence',
  '',
  ...cluster.reports.map(
    (report) => `- Report \`${report.id}\` (${shortIdOf(report)})`
  ),
];

const sourceSection = (cluster: QueueCluster): string[] => [
  '## Source',
  '',
  `- Triage cluster: \`${cluster.id}\``,
  `- Projected at: ${cluster.linear?.projectedAt ?? 'pending'}`,
];

const relatedSection = (cluster: QueueCluster): string[] => {
  const active = cluster.relations.filter(
    (relation) => relation.state === 'active' && relation.otherIdentifier
  );
  if (active.length === 0) {
    return [];
  }
  const lines = ['## Possible related issues — review before coding', ''];
  for (const relation of active) {
    lines.push(
      `${relation.otherIdentifier}`,
      `Why linked: ${relation.reason}`,
      ''
    );
  }
  // Agent instruction verbatim from spec §8.
  lines.push(
    'Agent instruction: compare the linked issue before changing code. Cover both in',
    'one PR only if the same root cause and code change resolve both; otherwise leave',
    'them separate and explain why.'
  );
  return lines;
};

const humanGateSection = (): string[] => [
  '## Next step (human gate)',
  '',
  'Move to **Approved for fix**. Automation will delegate the issue to Codex and open a draft PR.',
];

/**
 * Pure assembly of the machine-owned description content (without the
 * markers — `mergeDescription` places it between them). Idempotent for the
 * same cluster + assets input, so re-projection never churns the issue.
 */
export const buildMachineBlock = (
  cluster: QueueCluster,
  assets: Record<string, string>
): string => {
  const sections = [
    impactSection(cluster),
    behaviorSection(cluster),
    hypothesisSection(cluster),
    screenshotsSection(cluster, assets),
    videosSection(cluster),
    evidenceSection(cluster),
    sourceSection(cluster),
    relatedSection(cluster),
    humanGateSection(),
  ].filter((section) => section.length > 0);

  return sections.map((section) => section.join('\n')).join('\n\n');
};

/**
 * Replaces the text between the machine markers with `machineBlock`,
 * preserving human text outside the markers byte-for-byte. When the markers
 * are absent (or the description is empty), the machine section is appended.
 * Uses indexOf, never regex — human text may contain regex metacharacters.
 */
export const mergeDescription = (
  existing: string | null,
  machineBlock: string
): string => {
  const section = `${MACHINE_BEGIN}\n${machineBlock}\n${MACHINE_END}`;
  if (existing === null || existing.length === 0) {
    return section;
  }
  const begin = existing.indexOf(MACHINE_BEGIN);
  const end = existing.indexOf(MACHINE_END);
  if (begin === -1 || end === -1 || end < begin) {
    return `${existing}\n\n${section}`;
  }
  return (
    existing.slice(0, begin) +
    section +
    existing.slice(end + MACHINE_END.length)
  );
};
