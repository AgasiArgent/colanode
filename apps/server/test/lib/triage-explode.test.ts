import { describe, expect, it } from 'vitest';

import { explodeReport } from '@colanode/server/lib/triage/explode';

const base = {
  title: 'Save broken',
  did: 'clicked save',
  expected: 'saved',
  got: 'nothing happened',
  pageUrl: '/invoices',
  reporterName: 'Tester',
  pins: [] as unknown[],
  debugContext: {} as Record<string, unknown>,
  artifacts: [] as never[],
};

describe('explodeReport', () => {
  it('produces one pin item per pin with source refs', () => {
    const items = explodeReport({
      ...base,
      pins: [
        { comment: 'кнопка молчит', sourceFile: 'src/Save.tsx:12', selector: '#save', componentPath: 'InvoiceForm > SaveButton' },
        { comment: '', sourceFile: null, selector: '.total' },
      ],
      artifacts: [
        { id: 'a1', kind: 'screenshot', contentType: 'image/png', storagePath: 'p' },
      ],
    });
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      kind: 'pin',
      summary: 'кнопка молчит',
      sourceRef: {
        page: '/invoices',
        reporter: 'Tester',
        sourceFile: 'src/Save.tsx:12',
        selector: '#save',
        componentPath: 'InvoiceForm > SaveButton',
        pinIndex: 0,
        screenshotArtifactId: 'a1',
      },
    });
    expect(items[1]!.summary).toBe('Pin 2 on /invoices');
  });

  it('produces a record-issue item when a recording is present', () => {
    const items = explodeReport({
      ...base,
      debugContext: {
        recording: { recordingId: 'rec-1', recordingUrl: 'https://r/1' },
      },
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: 'record-issue',
      sourceRef: { recordingId: 'rec-1', recordingUrl: 'https://r/1' },
    });
  });

  it('truncates record-issue and legacy summaries to 500 chars', () => {
    const longTitle = 'x'.repeat(600);

    const recordItems = explodeReport({
      ...base,
      title: longTitle,
      debugContext: {
        recording: { recordingId: 'rec-1', recordingUrl: 'https://r/1' },
      },
    });
    expect(recordItems[0]!.summary).toHaveLength(500);

    const legacyItems = explodeReport({ ...base, title: longTitle });
    expect(legacyItems[0]!.summary).toHaveLength(500);
  });

  it('falls back to a single legacy item', () => {
    const items = explodeReport(base);
    expect(items).toEqual([
      {
        kind: 'legacy',
        summary: 'Save broken',
        sourceRef: {
          page: '/invoices',
          reporter: 'Tester',
          screenshotArtifactId: null,
          videoArtifactId: null,
        },
      },
    ]);
  });
});
