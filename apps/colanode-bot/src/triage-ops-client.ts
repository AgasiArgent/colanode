export type TriageProjectColanode = {
  workspaceId?: string;
  spaceId?: string;
  databaseId?: string;
  channelId?: string;
  fields?: Record<string, string>;
  decisionOptions?: Record<string, string>;
};

export type TriageProject = {
  id: string;
  name: string;
  colanode: TriageProjectColanode;
  admins: string[];
  killSwitch: boolean;
};

export type TriageItem = {
  id: string;
  reportId: string;
  kind: string;
  summary: string;
  sourceRef: Record<string, unknown>;
  triage: string | null;
  triageReason: string;
  agentNote: string;
  status: string;
};

export type TriageCluster = {
  id: string;
  projectId: string;
  rootHypothesis: string;
  itemCount: number;
  status: string;
  boardRecordId: string | null;
  chatCardId: string | null;
  decision: string | null;
  items: TriageItem[];
};

export type TriageArtifact = {
  id: string;
  kind: 'screenshot' | 'video' | 'console';
  contentType: string;
};

export type TriageReport = {
  id: string;
  reporterName: string;
  title: string;
  did: string;
  expected: string;
  got: string;
  pageUrl: string;
  pageTitle: string;
  artifacts: TriageArtifact[];
};

/**
 * Thin typed client over the triage ops-API. Fails loudly — a projection run
 * that silently skipped a failed call would leave the board quietly stale.
 */
export class TriageOpsClient {
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
        ...(body === undefined
          ? {}
          : { 'Content-Type': 'application/json' }),
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

  async listProjects(): Promise<TriageProject[]> {
    const data = await this.request<{ projects: TriageProject[] }>(
      'GET',
      '/projects'
    );
    return data.projects;
  }

  async listClusters(projectId: string): Promise<TriageCluster[]> {
    const data = await this.request<{ clusters: TriageCluster[] }>(
      'GET',
      `/clusters?projectId=${encodeURIComponent(projectId)}`
    );
    return data.clusters;
  }

  /** Clustered items come from exploded reports, so that is the status to pull. */
  async listExplodedReports(projectId: string): Promise<TriageReport[]> {
    const data = await this.request<{ reports: TriageReport[] }>(
      'GET',
      `/reports?status=exploded&projectId=${encodeURIComponent(projectId)}`
    );
    return data.reports;
  }

  async updateProjectColanode(
    projectId: string,
    name: string,
    colanode: TriageProjectColanode
  ): Promise<void> {
    await this.request('PUT', `/projects/${encodeURIComponent(projectId)}`, {
      name,
      colanode,
    });
  }

  async setClusterBoardRecord(
    clusterId: string,
    boardRecordId: string
  ): Promise<void> {
    await this.request('PATCH', `/clusters/${encodeURIComponent(clusterId)}`, {
      boardRecordId,
    });
  }
}
