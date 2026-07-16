import { LinearIssueChange } from './client';
import { QueueCluster } from './types';

// Mirrors the `linear` jsonb column on triage_projects as the queue route
// returns it (every key optional — a not-yet-configured project round-trips).
export type ProjectLinearConfig = {
  enabled?: boolean;
  teamId?: string;
  teamKey?: string;
  cutoverAt?: string;
  labels?: Record<string, string>;
};

export type LinearOpsProject = {
  id: string;
  name: string;
  killSwitch: boolean;
};

export type LinearQueue = {
  project: { id: string; linear: ProjectLinearConfig };
  clusters: QueueCluster[];
};

export type RecordIssueBody = {
  issueId: string;
  identifier?: string;
  url?: string;
  stateName?: string;
  stateType?: string;
  artifactAssets?: Record<string, string>;
  errorCode?: string;
  errorMessage?: string;
};

export type ReconcileBody = {
  cursorTs: string;
  issues: LinearIssueChange[];
  dismissedRelations: { clusterAId: string; clusterBId: string }[];
};

/**
 * Thin typed client over the triage ops-API for the Linear projector
 * (pattern of `TriageOpsClient`). Fails loudly — a run that silently skipped
 * a failed call would leave Linear quietly stale.
 */
export class LinearOpsClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string
  ) {}

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `triage ops ${method} ${path} failed: ${response.status} ${text.slice(0, 200)}`
      );
    }

    return (await response.json()) as T;
  }

  async listProjects(): Promise<LinearOpsProject[]> {
    const data = await this.request<{ projects: LinearOpsProject[] }>(
      'GET',
      '/projects'
    );
    return data.projects;
  }

  async getQueue(projectId: string): Promise<LinearQueue> {
    return this.request<LinearQueue>(
      'GET',
      `/linear/queue?projectId=${encodeURIComponent(projectId)}`
    );
  }

  async recordIssue(clusterId: string, body: RecordIssueBody): Promise<void> {
    await this.request(
      'PUT',
      `/linear/issues/${encodeURIComponent(clusterId)}`,
      body
    );
  }

  async reconcile(
    projectId: string,
    body: ReconcileBody
  ): Promise<{ applied: number }> {
    return this.request<{ applied: number }>('POST', '/linear/reconcile', {
      projectId,
      ...body,
    });
  }

  /**
   * Artifact bytes come from the capability-URL download route, which lives
   * at the API origin OUTSIDE the ops prefix: TRIAGE_OPS_URL ends in
   * `/client/v1/triage/ops`, the download route is
   * `/client/v1/triage/artifacts/:reportId/:artifactId`.
   */
  async fetchArtifact(
    reportId: string,
    artifactId: string
  ): Promise<{ bytes: Uint8Array; contentType: string }> {
    const origin = new URL(this.baseUrl).origin;
    const response = await fetch(
      `${origin}/client/v1/triage/artifacts/${encodeURIComponent(reportId)}/${encodeURIComponent(artifactId)}`
    );

    if (!response.ok) {
      throw new Error(
        `triage artifact ${reportId}/${artifactId} download failed: ${response.status}`
      );
    }

    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      contentType:
        response.headers.get('content-type') ?? 'application/octet-stream',
    };
  }
}
