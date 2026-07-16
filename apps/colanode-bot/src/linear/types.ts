// Mirrors the ops `GET /linear/queue` cluster output exactly (Task 6 /
// `linear-queue.ts` in apps/server). Both the description builder and the
// projector consume this shape.

export type QueueItem = {
  id: string;
  summary: string;
  triage: string | null;
  sourceRef: Record<string, unknown>;
};

export type QueueArtifact = {
  id: string;
  kind: string;
  contentType: string;
};

export type QueueReport = {
  id: string;
  title: string;
  did: string;
  expected: string;
  got: string;
  pageUrl: string;
  reporterName: string;
  debugContext: Record<string, unknown>;
  artifacts: QueueArtifact[];
  recordingUrl: string | null;
};

export type QueueRelation = {
  otherClusterId: string;
  otherIdentifier: string | null;
  state: string;
  reason: string;
};

export type QueueLinear = {
  issueId: string;
  identifier: string;
  url: string;
  stateType: string;
  artifactAssets: Record<string, string>;
  projectedAt: string | null;
};

export type QueueCluster = {
  id: string;
  rootHypothesis: string;
  itemCount: number;
  status: string;
  decision: string | null;
  items: QueueItem[];
  reports: QueueReport[];
  relations: QueueRelation[];
  linear: QueueLinear | null;
};
