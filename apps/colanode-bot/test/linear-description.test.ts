import { describe, expect, it } from 'vitest';

import {
  MACHINE_BEGIN,
  MACHINE_END,
  buildMachineBlock,
  mergeDescription,
} from '../src/linear/description';
import { QueueCluster } from '../src/linear/types';

const cluster: QueueCluster = {
  id: 'c-1',
  rootHypothesis: 'total not recalculated after discount',
  itemCount: 2,
  status: 'open',
  decision: null,
  items: [
    {
      id: 'i1',
      summary: 'stale total',
      triage: 'bug',
      sourceRef: { page: '/calc' },
    },
  ],
  reports: [
    {
      id: 'r1',
      title: 'wrong total',
      did: 'applied discount',
      expected: 'total updates',
      got: 'total unchanged',
      pageUrl: 'https://app.kvotaflow.ru/calc',
      reporterName: 'Denis',
      debugContext: { shortId: 'FB-1' },
      artifacts: [{ id: 'a1', kind: 'screenshot', contentType: 'image/png' }],
      recordingUrl: null,
    },
  ],
  relations: [
    {
      otherClusterId: 'c-2',
      otherIdentifier: 'KVO-18',
      state: 'active',
      reason: 'same screen',
    },
  ],
  linear: null,
};

describe('description builder', () => {
  it('builds a machine block with screenshots and the related summary', () => {
    const block = buildMachineBlock(cluster, {
      a1: 'https://uploads.linear.app/a1.png',
    });
    expect(block).toContain(
      '![screenshot FB-1](https://uploads.linear.app/a1.png)'
    );
    expect(block).toContain('KVO-18');
    expect(block).toContain('Approved for fix');
    expect(block).toContain('hypothesis');
    expect(block).not.toMatch(/@codex/i);
  });

  it('merge preserves human text outside the markers', () => {
    const machine = buildMachineBlock(cluster, {});
    const existing = `human intro\n\n${MACHINE_BEGIN}\nold\n${MACHINE_END}\n\nhuman notes`;
    const merged = mergeDescription(existing, machine);
    expect(merged.startsWith('human intro')).toBe(true);
    expect(merged.endsWith('human notes')).toBe(true);
    expect(merged).not.toContain('\nold\n');
    expect(merged).toContain(machine);
  });

  it('appends markers when the existing description has none', () => {
    const machine = buildMachineBlock(cluster, {});
    const merged = mergeDescription('manually written', machine);
    expect(merged.startsWith('manually written')).toBe(true);
    expect(merged).toContain(MACHINE_BEGIN);
  });
});
