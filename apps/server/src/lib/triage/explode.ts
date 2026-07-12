import { TriageArtifactRef } from '@colanode/server/data/schema';

export interface ExplodeInput {
  title: string;
  did: string;
  expected: string;
  got: string;
  pageUrl: string;
  reporterName: string;
  pins: unknown[];
  debugContext: Record<string, unknown>;
  artifacts: TriageArtifactRef[];
}

export interface TriageItemDraft {
  kind: 'pin' | 'record-issue' | 'legacy';
  summary: string;
  sourceRef: Record<string, unknown>;
}

const MAX_SUMMARY_LENGTH = 500;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const str = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const truncate = (value: string): string => value.slice(0, MAX_SUMMARY_LENGTH);

export const explodeReport = (input: ExplodeInput): TriageItemDraft[] => {
  const baseRef = {
    page: input.pageUrl,
    reporter: input.reporterName,
    screenshotArtifactId:
      input.artifacts.find((a) => a.kind === 'screenshot')?.id ?? null,
    videoArtifactId:
      input.artifacts.find((a) => a.kind === 'video')?.id ?? null,
  };

  const pins = input.pins.filter(isRecord);
  if (pins.length > 0) {
    return pins.map((pin, index) => ({
      kind: 'pin' as const,
      summary: str(pin.comment) || `Pin ${index + 1} on ${input.pageUrl}`,
      sourceRef: {
        ...baseRef,
        comment: str(pin.comment),
        sourceFile: pin.sourceFile ?? null,
        selector: pin.selector ?? null,
        componentPath: pin.componentPath ?? null,
        pinIndex: index,
      },
    }));
  }

  const recording = isRecord(input.debugContext.recording)
    ? input.debugContext.recording
    : null;
  if (recording && str(recording.recordingId)) {
    return [
      {
        kind: 'record-issue',
        summary: truncate(input.title || input.got || 'Recorded issue'),
        sourceRef: {
          ...baseRef,
          recordingId: str(recording.recordingId),
          recordingUrl: str(recording.recordingUrl),
        },
      },
    ];
  }

  return [
    {
      kind: 'legacy',
      summary: truncate(input.title || input.got || input.did || 'Feedback'),
      sourceRef: baseRef,
    },
  ];
};
