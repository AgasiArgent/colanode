import {
  ColumnType,
  Insertable,
  JSONColumnType,
  Selectable,
  Updateable,
} from 'kysely';

import {
  NodeAttributes,
  NodeRole,
  NodeType,
  WorkspaceRole,
  UserStatus,
  DocumentType,
  DocumentContent,
  UpdateMergeMetadata,
} from '@colanode/core';
import { AccountAttributes } from '@colanode/server/types/accounts';

interface AccountTable {
  id: ColumnType<string, string, never>;
  name: ColumnType<string, string, string>;
  email: ColumnType<string, string, never>;
  avatar: ColumnType<string | null, string | null, string | null>;
  password: ColumnType<string | null, string | null, string | null>;
  attributes: JSONColumnType<
    AccountAttributes | null,
    string | null,
    string | null
  >;
  created_at: ColumnType<Date, Date, never>;
  updated_at: ColumnType<Date | null, Date | null, Date>;
  status: ColumnType<number, number, number>;
}

export type SelectAccount = Selectable<AccountTable>;
export type CreateAccount = Insertable<AccountTable>;
export type UpdateAccount = Updateable<AccountTable>;

interface DeviceTable {
  id: ColumnType<string, string, never>;
  account_id: ColumnType<string, string, never>;
  token_hash: ColumnType<string, string, string>;
  token_salt: ColumnType<string, string, string>;
  token_generated_at: ColumnType<Date, Date, Date>;
  previous_token_hash: ColumnType<string | null, string | null, string | null>;
  previous_token_salt: ColumnType<string | null, string | null, string | null>;
  type: ColumnType<number, number, number>;
  version: ColumnType<string, string, string>;
  platform: ColumnType<string | null, string | null, string | null>;
  ip: ColumnType<string | null, string | null, string | null>;
  created_at: ColumnType<Date, Date, never>;
  synced_at: ColumnType<Date | null, Date | null, Date>;
}

export type SelectDevice = Selectable<DeviceTable>;
export type CreateDevice = Insertable<DeviceTable>;
export type UpdateDevice = Updateable<DeviceTable>;

interface WorkspaceTable {
  id: ColumnType<string, string, never>;
  name: ColumnType<string, string, string>;
  description: ColumnType<string | null, string | null, string | null>;
  avatar: ColumnType<string | null, string | null, string | null>;
  attrs: ColumnType<string | null, string | null, string | null>;
  created_at: ColumnType<Date, Date, never>;
  updated_at: ColumnType<Date | null, Date | null, Date>;
  created_by: ColumnType<string, string, never>;
  updated_by: ColumnType<string | null, string | null, string>;
  status: ColumnType<number, number, number>;
  max_file_size: ColumnType<string | null, string | null, string | null>;
}

export type SelectWorkspace = Selectable<WorkspaceTable>;
export type CreateWorkspace = Insertable<WorkspaceTable>;
export type UpdateWorkspace = Updateable<WorkspaceTable>;

interface UserTable {
  id: ColumnType<string, string, never>;
  workspace_id: ColumnType<string, string, never>;
  account_id: ColumnType<string, string, never>;
  revision: ColumnType<string, never, never>;
  email: ColumnType<string, string, string>;
  role: ColumnType<WorkspaceRole, WorkspaceRole, WorkspaceRole>;
  name: ColumnType<string, string, string>;
  avatar: ColumnType<string | null, string | null, string | null>;
  custom_name: ColumnType<string | null, string | null, string | null>;
  custom_avatar: ColumnType<string | null, string | null, string | null>;
  storage_limit: ColumnType<string, string, string>;
  max_file_size: ColumnType<string, string, string>;
  created_at: ColumnType<Date, Date, never>;
  created_by: ColumnType<string, string, never>;
  updated_at: ColumnType<Date | null, Date | null, Date>;
  updated_by: ColumnType<string | null, string | null, string>;
  status: ColumnType<UserStatus, UserStatus, UserStatus>;
}

export type SelectUser = Selectable<UserTable>;
export type CreateUser = Insertable<UserTable>;
export type UpdateUser = Updateable<UserTable>;

interface NodeTable {
  id: ColumnType<string, string, never>;
  type: ColumnType<NodeType, never, never>;
  parent_id: ColumnType<string | null, never, never>;
  root_id: ColumnType<string, string, never>;
  workspace_id: ColumnType<string, string, never>;
  revision: ColumnType<string, string, string>;
  attributes: JSONColumnType<NodeAttributes, string | null, string | null>;
  created_at: ColumnType<Date, Date, never>;
  created_by: ColumnType<string, string, never>;
  updated_at: ColumnType<Date | null, Date | null, Date>;
  updated_by: ColumnType<string | null, string | null, string>;
}

export type SelectNode = Selectable<NodeTable>;
export type CreateNode = Insertable<NodeTable>;
export type UpdateNode = Updateable<NodeTable>;

interface NodeUpdateTable {
  id: ColumnType<string, string, never>;
  node_id: ColumnType<string, string, never>;
  root_id: ColumnType<string, string, never>;
  workspace_id: ColumnType<string, string, never>;
  revision: ColumnType<string, never, never>;
  data: ColumnType<Uint8Array, Uint8Array, Uint8Array>;
  created_at: ColumnType<Date, Date, never>;
  created_by: ColumnType<string, string, never>;
  merged_updates: ColumnType<
    UpdateMergeMetadata[] | null,
    string | null,
    string | null
  >;
}

export type SelectNodeUpdate = Selectable<NodeUpdateTable>;
export type CreateNodeUpdate = Insertable<NodeUpdateTable>;
export type UpdateNodeUpdate = Updateable<NodeUpdateTable>;

interface NodeInteractionTable {
  node_id: ColumnType<string, string, never>;
  collaborator_id: ColumnType<string, string, never>;
  root_id: ColumnType<string, string, never>;
  workspace_id: ColumnType<string, string, never>;
  revision: ColumnType<string, never, never>;
  first_seen_at: ColumnType<Date | null, Date | null, Date | null>;
  last_seen_at: ColumnType<Date | null, Date | null, Date | null>;
  first_opened_at: ColumnType<Date | null, Date | null, Date | null>;
  last_opened_at: ColumnType<Date | null, Date | null, Date | null>;
}

export type SelectNodeInteraction = Selectable<NodeInteractionTable>;
export type CreateNodeInteraction = Insertable<NodeInteractionTable>;
export type UpdateNodeInteraction = Updateable<NodeInteractionTable>;

interface NodeReactionTable {
  node_id: ColumnType<string, string, never>;
  collaborator_id: ColumnType<string, string, never>;
  root_id: ColumnType<string, string, never>;
  workspace_id: ColumnType<string, string, never>;
  revision: ColumnType<string, never, never>;
  reaction: ColumnType<string, string, string>;
  created_at: ColumnType<Date, Date, Date>;
  deleted_at: ColumnType<Date | null, Date | null, Date | null>;
}

export type SelectNodeReaction = Selectable<NodeReactionTable>;
export type CreateNodeReaction = Insertable<NodeReactionTable>;
export type UpdateNodeReaction = Updateable<NodeReactionTable>;

interface NodeTombstoneTable {
  id: ColumnType<string, string, never>;
  root_id: ColumnType<string, string, never>;
  workspace_id: ColumnType<string, string, never>;
  revision: ColumnType<string, never, never>;
  deleted_at: ColumnType<Date, Date, Date>;
  deleted_by: ColumnType<string, string, never>;
}

export type SelectNodeTombstone = Selectable<NodeTombstoneTable>;
export type CreateNodeTombstone = Insertable<NodeTombstoneTable>;
export type UpdateNodeTombstone = Updateable<NodeTombstoneTable>;

interface NodePathTable {
  ancestor_id: ColumnType<string, string, never>;
  descendant_id: ColumnType<string, string, never>;
  workspace_id: ColumnType<string, string, never>;
  level: ColumnType<number, number, number>;
}

export type SelectNodePath = Selectable<NodePathTable>;
export type CreateNodePath = Insertable<NodePathTable>;
export type UpdateNodePath = Updateable<NodePathTable>;

interface CollaborationTable {
  node_id: ColumnType<string, string, never>;
  collaborator_id: ColumnType<string, string, never>;
  workspace_id: ColumnType<string, string, never>;
  revision: ColumnType<string, never, never>;
  role: ColumnType<NodeRole, NodeRole, NodeRole>;
  created_at: ColumnType<Date, Date, never>;
  created_by: ColumnType<string, string, never>;
  updated_at: ColumnType<Date | null, Date | null, Date | null>;
  updated_by: ColumnType<string | null, string | null, string | null>;
  deleted_at: ColumnType<Date | null, Date | null, Date | null>;
  deleted_by: ColumnType<string | null, string | null, string | null>;
}

export type SelectCollaboration = Selectable<CollaborationTable>;
export type CreateCollaboration = Insertable<CollaborationTable>;
export type UpdateCollaboration = Updateable<CollaborationTable>;

interface DocumentTable {
  id: ColumnType<string, string, never>;
  type: ColumnType<DocumentType, never, never>;
  workspace_id: ColumnType<string, string, never>;
  revision: ColumnType<string, string, string>;
  content: JSONColumnType<DocumentContent, string, string>;
  created_at: ColumnType<Date, Date, never>;
  created_by: ColumnType<string, string, never>;
  updated_at: ColumnType<Date | null, Date | null, Date>;
  updated_by: ColumnType<string | null, string | null, string>;
}

export type SelectDocument = Selectable<DocumentTable>;
export type CreateDocument = Insertable<DocumentTable>;
export type UpdateDocument = Updateable<DocumentTable>;

interface DocumentUpdateTable {
  id: ColumnType<string, string, never>;
  document_id: ColumnType<string, string, never>;
  root_id: ColumnType<string, string, never>;
  workspace_id: ColumnType<string, string, never>;
  revision: ColumnType<string, never, never>;
  data: ColumnType<Uint8Array, Uint8Array, Uint8Array>;
  created_at: ColumnType<Date, Date, never>;
  created_by: ColumnType<string, string, never>;
  merged_updates: ColumnType<
    UpdateMergeMetadata[] | null,
    string | null,
    string | null
  >;
}

export type SelectDocumentUpdate = Selectable<DocumentUpdateTable>;
export type CreateDocumentUpdate = Insertable<DocumentUpdateTable>;
export type UpdateDocumentUpdate = Updateable<DocumentUpdateTable>;

interface UploadTable {
  file_id: ColumnType<string, string, never>;
  upload_id: ColumnType<string, string, string>;
  workspace_id: ColumnType<string, string, never>;
  root_id: ColumnType<string, string, never>;
  mime_type: ColumnType<string, string, string>;
  size: ColumnType<number, number, number>;
  path: ColumnType<string, string, string>;
  version_id: ColumnType<string, string, string>;
  created_at: ColumnType<Date, Date, Date>;
  created_by: ColumnType<string, string, string>;
  uploaded_at: ColumnType<Date | null, Date | null, Date | null>;
}

export type SelectUpload = Selectable<UploadTable>;
export type CreateUpload = Insertable<UploadTable>;
export type UpdateUpload = Updateable<UploadTable>;

interface NodeEmbeddingTable {
  node_id: ColumnType<string, string, never>;
  chunk: ColumnType<number, number, number>;
  revision: ColumnType<string, string, string>;
  workspace_id: ColumnType<string, string, never>;
  text: ColumnType<string, string, string>;
  summary: ColumnType<string | null, string | null, string | null>;
  embedding_vector: ColumnType<number[], number[], number[]>;
  search_vector: ColumnType<never, never, never>;
  created_at: ColumnType<Date, Date, never>;
  updated_at: ColumnType<Date | null, Date | null, Date | null>;
}

export type SelectNodeEmbedding = Selectable<NodeEmbeddingTable>;
export type CreateNodeEmbedding = Insertable<NodeEmbeddingTable>;
export type UpdateNodeEmbedding = Updateable<NodeEmbeddingTable>;

interface DocumentEmbeddingTable {
  document_id: ColumnType<string, string, never>;
  chunk: ColumnType<number, number, number>;
  revision: ColumnType<string, string, string>;
  workspace_id: ColumnType<string, string, never>;
  text: ColumnType<string, string, string>;
  summary: ColumnType<string | null, string | null, string | null>;
  embedding_vector: ColumnType<number[], number[], number[]>;
  search_vector: ColumnType<never, never, never>;
  created_at: ColumnType<Date, Date, never>;
  updated_at: ColumnType<Date | null, Date | null, Date | null>;
}

export type SelectDocumentEmbedding = Selectable<DocumentEmbeddingTable>;
export type CreateDocumentEmbedding = Insertable<DocumentEmbeddingTable>;
export type UpdateDocumentEmbedding = Updateable<DocumentEmbeddingTable>;

interface CounterTable {
  key: ColumnType<string, string, never>;
  value: ColumnType<string, string, string>;
  created_at: ColumnType<Date, Date, never>;
  updated_at: ColumnType<Date | null, Date | null, Date | null>;
}

interface NotificationTable {
  id: ColumnType<string, string, never>;
  user_id: ColumnType<string, string, never>;
  workspace_id: ColumnType<string, string, never>;
  root_id: ColumnType<string, string, never>;
  type: ColumnType<string, string, never>;
  source_node_id: ColumnType<string, string, never>;
  actor_id: ColumnType<string | null, string | null, never>;
  preview: ColumnType<Record<string, unknown>, Record<string, unknown>, never>;
  created_at: ColumnType<Date, Date, never>;
  read_at: ColumnType<Date | null, Date | null, Date | null>;
  revision: ColumnType<string, never, never>;
}

export type SelectNotification = Selectable<NotificationTable>;
export type CreateNotification = Insertable<NotificationTable>;
export type UpdateNotification = Updateable<NotificationTable>;

interface PushSubscriptionTable {
  id: ColumnType<string, string, never>;
  account_id: ColumnType<string, string, never>;
  device_id: ColumnType<string, string, never>;
  endpoint: ColumnType<string, string, string>;
  p256dh: ColumnType<string, string, string>;
  auth: ColumnType<string, string, string>;
  created_at: ColumnType<Date, Date, never>;
  updated_at: ColumnType<Date | null, Date | null, Date | null>;
  last_failure_at: ColumnType<Date | null, Date | null, Date | null>;
}

export type SelectPushSubscription = Selectable<PushSubscriptionTable>;
export type CreatePushSubscription = Insertable<PushSubscriptionTable>;
export type UpdatePushSubscription = Updateable<PushSubscriptionTable>;

interface ApnsSubscriptionTable {
  id: ColumnType<string, string, never>;
  account_id: ColumnType<string, string, never>;
  device_id: ColumnType<string, string, never>;
  device_token: ColumnType<string, string, string>;
  created_at: ColumnType<Date, Date, never>;
  updated_at: ColumnType<Date | null, Date | null, Date | null>;
  last_failure_at: ColumnType<Date | null, Date | null, Date | null>;
}

export type SelectApnsSubscription = Selectable<ApnsSubscriptionTable>;
export type CreateApnsSubscription = Insertable<ApnsSubscriptionTable>;
export type UpdateApnsSubscription = Updateable<ApnsSubscriptionTable>;

interface NotificationMuteTable {
  id: ColumnType<string, string, never>;
  user_id: ColumnType<string, string, never>;
  node_id: ColumnType<string, string, never>;
  workspace_id: ColumnType<string, string, never>;
  muted: ColumnType<boolean, boolean, boolean>;
  created_at: ColumnType<Date, Date, never>;
  updated_at: ColumnType<Date | null, Date | null, Date | null>;
  revision: ColumnType<string, never, never>;
}

export type SelectNotificationMute = Selectable<NotificationMuteTable>;
export type CreateNotificationMute = Insertable<NotificationMuteTable>;
export type UpdateNotificationMute = Updateable<NotificationMuteTable>;

// The projection map a bot needs to write a cluster into Colanode. Record field
// values are keyed by generated field ids, so the ids have to be persisted here
// or a later run cannot address the fields it created. Every key is optional —
// a project may be only partially projected.
export interface TriageProjectColanode {
  workspaceId?: string;
  spaceId?: string;
  databaseId?: string;
  channelId?: string;
  /** logical field name -> colanode field id */
  fields?: Record<string, string>;
  /** decision -> select option id */
  decisionOptions?: Record<string, string>;
}

export interface TriageArtifactRef {
  id: string;
  kind: 'screenshot' | 'video' | 'console';
  contentType: string;
  storagePath: string;
}

export interface TriageAuditEntry {
  at: string;
  actor: string;
  changes: Record<string, unknown>;
}

interface TriageProjectTable {
  id: ColumnType<string, string, never>;
  name: ColumnType<string, string, string>;
  ingest_token: ColumnType<string, string, string>;
  colanode: JSONColumnType<
    TriageProjectColanode,
    string | undefined,
    string | undefined
  >;
  admins: JSONColumnType<string[], string | undefined, string | undefined>;
  linear: JSONColumnType<
    TriageProjectLinear,
    string | undefined,
    string | undefined
  >;
  kill_switch: ColumnType<boolean, boolean | undefined, boolean>;
  created_at: ColumnType<Date, Date | undefined, never>;
  updated_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
}

export type SelectTriageProject = Selectable<TriageProjectTable>;
export type CreateTriageProject = Insertable<TriageProjectTable>;
export type UpdateTriageProject = Updateable<TriageProjectTable>;

interface TriageReportTable {
  id: ColumnType<string, string | undefined, never>;
  project_id: ColumnType<string, string, never>;
  source_adapter: ColumnType<string, string | undefined, never>;
  reporter_id: ColumnType<string | null, string | null | undefined, never>;
  reporter_name: ColumnType<string, string | undefined, never>;
  title: ColumnType<string, string | undefined, never>;
  did: ColumnType<string, string | undefined, never>;
  expected: ColumnType<string, string | undefined, never>;
  got: ColumnType<string, string | undefined, never>;
  page_url: ColumnType<string, string | undefined, never>;
  page_title: ColumnType<string, string | undefined, never>;
  pins: JSONColumnType<unknown[], string | undefined, never>;
  debug_context: JSONColumnType<
    Record<string, unknown>,
    string | undefined,
    never
  >;
  artifacts: JSONColumnType<TriageArtifactRef[], string | undefined, never>;
  status: ColumnType<string, string | undefined, string>;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export type SelectTriageReport = Selectable<TriageReportTable>;
export type CreateTriageReport = Insertable<TriageReportTable>;
export type UpdateTriageReport = Updateable<TriageReportTable>;

interface TriageClusterTable {
  id: ColumnType<string, string | undefined, never>;
  project_id: ColumnType<string, string, never>;
  root_hypothesis: ColumnType<string, string | undefined, string>;
  item_count: ColumnType<number, number | undefined, number>;
  status: ColumnType<string, string | undefined, string>;
  board_record_id: ColumnType<string | null, string | null | undefined, string | null>;
  chat_card_id: ColumnType<string | null, string | null | undefined, string | null>;
  decision: ColumnType<string | null, string | null | undefined, string | null>;
  audit: JSONColumnType<TriageAuditEntry[], string | undefined, string>;
  created_at: ColumnType<Date, Date | undefined, never>;
  updated_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
}

export type SelectTriageCluster = Selectable<TriageClusterTable>;
export type CreateTriageCluster = Insertable<TriageClusterTable>;
export type UpdateTriageCluster = Updateable<TriageClusterTable>;

interface TriageItemTable {
  id: ColumnType<string, string | undefined, never>;
  report_id: ColumnType<string, string, never>;
  project_id: ColumnType<string, string, never>;
  kind: ColumnType<string, string, never>;
  summary: ColumnType<string, string | undefined, string>;
  source_ref: JSONColumnType<Record<string, unknown>, string | undefined, string>;
  triage: ColumnType<string | null, string | null | undefined, string | null>;
  triage_reason: ColumnType<string, string | undefined, string>;
  confidence: ColumnType<number | null, number | null | undefined, number | null>;
  cluster_id: ColumnType<string | null, string | null | undefined, string | null>;
  decision: ColumnType<string | null, string | null | undefined, string | null>;
  agent_note: ColumnType<string, string | undefined, string>;
  status: ColumnType<string, string | undefined, string>;
  audit: JSONColumnType<TriageAuditEntry[], string | undefined, string>;
  created_at: ColumnType<Date, Date | undefined, never>;
  updated_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
}

export type SelectTriageItem = Selectable<TriageItemTable>;
export type CreateTriageItem = Insertable<TriageItemTable>;
export type UpdateTriageItem = Updateable<TriageItemTable>;

// Optional Linear projection mapping for a project. Identifiers only — the
// API key lives in the projector's environment, never in the database.
export interface TriageProjectLinear {
  enabled?: boolean;
  teamId?: string;
  teamKey?: string;
  /** ISO timestamp; clusters created before it are never auto-projected */
  cutoverAt?: string;
  /** triage class -> Linear label id */
  labels?: Record<string, string>;
}

interface TriageClusterRelationTable {
  id: ColumnType<string, string | undefined, never>;
  project_id: ColumnType<string, string, never>;
  cluster_a_id: ColumnType<string, string, never>;
  cluster_b_id: ColumnType<string, string, never>;
  kind: ColumnType<string, string | undefined, never>;
  state: ColumnType<string, string | undefined, string>;
  confidence: ColumnType<number | null, number | null | undefined, never>;
  reason: ColumnType<string, string | undefined, never>;
  actor: ColumnType<string, string | undefined, never>;
  dismissed_by: ColumnType<string | null, string | null | undefined, string | null>;
  dismissed_reason: ColumnType<string | null, string | null | undefined, string | null>;
  created_at: ColumnType<Date, Date | undefined, never>;
  updated_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
}

export type SelectTriageClusterRelation = Selectable<TriageClusterRelationTable>;
export type CreateTriageClusterRelation = Insertable<TriageClusterRelationTable>;
export type UpdateTriageClusterRelation = Updateable<TriageClusterRelationTable>;

interface TriageLinearIssueTable {
  cluster_id: ColumnType<string, string, never>;
  issue_id: ColumnType<string, string, string>;
  identifier: ColumnType<string, string | undefined, string>;
  url: ColumnType<string, string | undefined, string>;
  state_name: ColumnType<string, string | undefined, string>;
  state_type: ColumnType<string, string | undefined, string>;
  canonical_cluster_id: ColumnType<string | null, string | null | undefined, string | null>;
  duplicate_of_external: ColumnType<string | null, string | null | undefined, string | null>;
  artifact_assets: JSONColumnType<
    Record<string, string>,
    string | undefined,
    string
  >;
  linear_updated_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  projected_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  error_code: ColumnType<string | null, string | null | undefined, string | null>;
  error_message: ColumnType<string | null, string | null | undefined, string | null>;
  created_at: ColumnType<Date, Date | undefined, never>;
  updated_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
}

export type SelectTriageLinearIssue = Selectable<TriageLinearIssueTable>;
export type CreateTriageLinearIssue = Insertable<TriageLinearIssueTable>;
export type UpdateTriageLinearIssue = Updateable<TriageLinearIssueTable>;

interface TriageLinearSyncStateTable {
  project_id: ColumnType<string, string, never>;
  cursor_ts: ColumnType<Date | null, Date | null | undefined, Date | null>;
  last_success_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  updated_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
}

export type SelectTriageLinearSyncState = Selectable<TriageLinearSyncStateTable>;
export type CreateTriageLinearSyncState = Insertable<TriageLinearSyncStateTable>;
export type UpdateTriageLinearSyncState = Updateable<TriageLinearSyncStateTable>;

export interface DatabaseSchema {
  accounts: AccountTable;
  devices: DeviceTable;
  workspaces: WorkspaceTable;
  users: UserTable;
  nodes: NodeTable;
  node_updates: NodeUpdateTable;
  node_interactions: NodeInteractionTable;
  node_reactions: NodeReactionTable;
  node_paths: NodePathTable;
  node_tombstones: NodeTombstoneTable;
  collaborations: CollaborationTable;
  documents: DocumentTable;
  document_updates: DocumentUpdateTable;
  uploads: UploadTable;
  node_embeddings: NodeEmbeddingTable;
  document_embeddings: DocumentEmbeddingTable;
  counters: CounterTable;
  notifications: NotificationTable;
  push_subscriptions: PushSubscriptionTable;
  apns_subscriptions: ApnsSubscriptionTable;
  notification_mutes: NotificationMuteTable;
  triage_projects: TriageProjectTable;
  triage_reports: TriageReportTable;
  triage_clusters: TriageClusterTable;
  triage_items: TriageItemTable;
  triage_cluster_relations: TriageClusterRelationTable;
  triage_linear_issues: TriageLinearIssueTable;
  triage_linear_sync_state: TriageLinearSyncStateTable;
}
