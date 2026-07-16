export type LinearIssue = {
  id: string;
  identifier: string;
  url: string;
  stateName: string;
  stateType: string;
  description: string;
};

export type LinearIssueChange = {
  issueId: string;
  identifier: string;
  stateName: string;
  stateType: string;
  updatedAt: string;
  duplicateOfIssueId: string | null;
};

type IssueNode = {
  id: string;
  identifier: string;
  url: string;
  description: string | null;
  state: { name: string; type: string };
};

type UpdatedIssueNode = {
  id: string;
  identifier: string;
  updatedAt: string;
  state: { name: string; type: string };
  relations: { nodes: { type: string; relatedIssue: { id: string } }[] };
};

const LINEAR_GRAPHQL_URL = 'https://api.linear.app/graphql';
const REQUEST_TIMEOUT_MS = 30_000;

const ISSUE_BY_ID = `query IssueById($id: String!) { issue(id: $id) { id identifier url description state { name type } } }`;
const ISSUE_CREATE = `mutation IssueCreate($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier url description state { name type } } } }`;
const ISSUE_UPDATE = `mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success } }`;
const FILE_UPLOAD = `mutation FileUpload($contentType: String!, $filename: String!, $size: Int!) { fileUpload(contentType: $contentType, filename: $filename, size: $size) { success uploadFile { uploadUrl assetUrl headers { key value } } } }`;
const RELATION_CREATE = `mutation RelationCreate($input: IssueRelationCreateInput!) { issueRelationCreate(input: $input) { success } }`;
const UPDATED_ISSUES = `query UpdatedIssues($teamId: ID!, $since: DateTimeOrDuration!, $after: String) {
  issues(filter: { team: { id: { eq: $teamId } }, updatedAt: { gt: $since } }, first: 50, after: $after) {
    nodes { id identifier updatedAt state { name type } relations { nodes { type relatedIssue { id } } } }
    pageInfo { hasNextPage endCursor }
  }
}`;

const toLinearIssue = (node: IssueNode): LinearIssue => ({
  id: node.id,
  identifier: node.identifier,
  url: node.url,
  stateName: node.state.name,
  stateType: node.state.type,
  description: node.description ?? '',
});

/**
 * Typed client for the Linear GraphQL API. Holds the API key received from
 * the caller (config threads it in) — never reads env, never logs the key.
 */
export class LinearApi {
  constructor(private readonly apiKey: string) {}

  private async graphql<T>(
    query: string,
    variables: Record<string, unknown>
  ): Promise<T> {
    const response = await fetch(LINEAR_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        Authorization: this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      // Sanitized: status only — never the request headers or the key.
      throw new Error(`Linear GraphQL request failed: HTTP ${response.status}`);
    }

    const payload = (await response.json()) as {
      data?: T;
      errors?: { message?: string }[];
    };

    if (payload.errors && payload.errors.length > 0) {
      const messages = payload.errors
        .map((error) => error.message ?? 'unknown error')
        .join('; ');
      throw new Error(`Linear GraphQL error: ${messages}`);
    }

    if (payload.data === undefined) {
      throw new Error('Linear GraphQL response contained no data');
    }

    return payload.data;
  }

  async issueById(id: string): Promise<LinearIssue | null> {
    try {
      const data = await this.graphql<{ issue: IssueNode | null }>(
        ISSUE_BY_ID,
        { id }
      );
      return data.issue ? toLinearIssue(data.issue) : null;
    } catch (error) {
      // Some API versions report a missing issue as an error, not null.
      if (error instanceof Error && /entity not found/i.test(error.message)) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Lookup-first create: duplicate-UUID behavior of issueCreate is
   * undocumented, so an existing issue is returned without a create attempt,
   * and a create failure that looks like a duplicate falls back to re-query.
   */
  async ensureIssue(input: {
    id: string;
    teamId: string;
    title: string;
    description: string;
    labelIds: string[];
  }): Promise<LinearIssue> {
    const existing = await this.issueById(input.id);
    if (existing) {
      return existing;
    }

    try {
      const data = await this.graphql<{
        issueCreate: { success: boolean; issue: IssueNode };
      }>(ISSUE_CREATE, { input });
      return toLinearIssue(data.issueCreate.issue);
    } catch (error) {
      if (
        error instanceof Error &&
        // Empirically (2026-07-16 probe): Linear rejects a repeated create
        // with "conflict on insert of Issue".
        /already exists|duplicate|conflict on insert/i.test(error.message)
      ) {
        const created = await this.issueById(input.id);
        if (created) {
          return created;
        }
      }
      throw error;
    }
  }

  async updateIssueDescription(id: string, description: string): Promise<void> {
    await this.graphql<{ issueUpdate: { success: boolean } }>(ISSUE_UPDATE, {
      id,
      input: { description },
    });
  }

  /** Two-step upload: fileUpload mutation, then PUT to the pre-signed URL. */
  async uploadFile(
    bytes: Uint8Array,
    contentType: string,
    filename: string
  ): Promise<string> {
    const data = await this.graphql<{
      fileUpload: {
        success: boolean;
        uploadFile: {
          uploadUrl: string;
          assetUrl: string;
          headers: { key: string; value: string }[];
        };
      };
    }>(FILE_UPLOAD, { contentType, filename, size: bytes.byteLength });

    const { uploadUrl, assetUrl, headers } = data.fileUpload.uploadFile;

    const putHeaders: Record<string, string> = {
      'Content-Type': contentType,
    };
    for (const header of headers) {
      putHeaders[header.key] = header.value;
    }

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: putHeaders,
      body: bytes,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Linear file upload PUT failed: HTTP ${response.status}`);
    }

    return assetUrl;
  }

  async createRelation(
    issueId: string,
    relatedIssueId: string
  ): Promise<void> {
    try {
      await this.graphql<{ issueRelationCreate: { success: boolean } }>(
        RELATION_CREATE,
        { input: { issueId, relatedIssueId, type: 'related' } }
      );
    } catch (error) {
      if (error instanceof Error && /already exists/i.test(error.message)) {
        return;
      }
      throw error;
    }
  }

  async issuesUpdatedSince(
    teamId: string,
    since: string
  ): Promise<LinearIssueChange[]> {
    const changes: LinearIssueChange[] = [];
    let after: string | null = null;

    do {
      const data: {
        issues: {
          nodes: UpdatedIssueNode[];
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
        };
      } = await this.graphql(UPDATED_ISSUES, { teamId, since, after });

      for (const node of data.issues.nodes) {
        const duplicateRelation = node.relations.nodes.find(
          (relation) => relation.type === 'duplicate'
        );
        changes.push({
          issueId: node.id,
          identifier: node.identifier,
          stateName: node.state.name,
          stateType: node.state.type,
          updatedAt: node.updatedAt,
          duplicateOfIssueId: duplicateRelation?.relatedIssue.id ?? null,
        });
      }

      after = data.issues.pageInfo.hasNextPage
        ? data.issues.pageInfo.endCursor
        : null;
    } while (after !== null);

    return changes;
  }
}
