import {
  type AgentFieldSpec,
  buildChannelAttributes,
  buildDatabaseAttributes,
  buildDatabaseViewAttributes,
  buildRecordAttributes,
  buildSpaceAttributes,
  mergeRecordFields,
  toFieldValue,
} from '@colanode/agent-tools';
import {
  MutationInput,
  SuccessMutationResult,
} from '@colanode/client/mutations';
import { AppService } from '@colanode/client/services';
import { bootEngine } from '@colanode/client-node';
import { generateId, IdType } from '@colanode/core';
import type { FieldValue, RecordAttributes } from '@colanode/core';

import { loadTriageConfig } from './triage-config';
import {
  TriageOpsClient,
  type TriageCluster,
  type TriageProject,
  type TriageProjectColanode,
  type TriageReport,
} from './triage-ops-client';

/** The canonical 6 decisions (spec §5). They are the board's columns. */
const DECISIONS = [
  'approved-for-fix',
  'backlog',
  'works-as-intended',
  'needs-info',
  'duplicate',
  'ignored',
] as const;

const OUTCOME_FIELD = 'Исход';

/** The «Разбор» board (spec §4). `Исход` is the group-by. */
const BOARD_FIELDS: AgentFieldSpec[] = [
  { name: OUTCOME_FIELD, type: 'select', options: [...DECISIONS] },
  { name: 'Проект', type: 'text' },
  { name: 'Страница', type: 'text' },
  { name: 'Элемент', type: 'text' },
  { name: 'Компонент', type: 'text' },
  { name: 'Роль', type: 'text' },
  { name: 'Reporter', type: 'text' },
  { name: 'Кластер', type: 'text' },
  { name: 'Репортов', type: 'number' },
  { name: 'Скриншот', type: 'url' },
  { name: 'Видео', type: 'url' },
  { name: 'Заметка агенту', type: 'text' },
];

const SPACE_NAME = 'Разбор';
const DATABASE_NAME = 'Разбор';
const BOARD_VIEW_NAME = 'Доска';
const CHANNEL_NAME = '🐛-bugs';

/**
 * `executeMutation` returns a discriminated result rather than throwing, so a
 * silent `success: false` would leave the board half-built. Unwrap loudly.
 */
const runMutation = async <T extends MutationInput>(
  app: AppService,
  input: T
): Promise<SuccessMutationResult<T>['output']> => {
  const result = await app.mediator.executeMutation(input);
  if (!result.success) {
    throw new Error(`mutation ${input.type} failed: ${result.error.message}`);
  }
  return result.output;
};

const truncate = (value: string, max: number): string =>
  value.length <= max ? value : `${value.slice(0, max - 1)}…`;

const artifactUrl = (
  serverUrl: string,
  reportId: string,
  artifactId: string
): string =>
  `${serverUrl.replace(/\/$/, '')}/client/v1/triage/artifacts/${reportId}/${artifactId}`;

/**
 * Resolve the workspace user ids of the project's admins (they are emails in the
 * registry). Used to make them collaborators on the space — without this the
 * space stays private to the bot and NO HUMAN can see the board.
 */
const resolveAdminUserIds = async (
  app: AppService,
  userId: string,
  adminEmails: string[]
): Promise<string[]> => {
  if (adminEmails.length === 0) return [];
  const users = await app.mediator.executeQuery({ type: 'user.list', userId });
  const wanted = new Set(adminEmails.map((email) => email.toLowerCase()));
  return users
    .filter((user) => wanted.has(user.email.toLowerCase()))
    .map((user) => user.id);
};

const provisionProject = async (
  app: AppService,
  ops: TriageOpsClient,
  project: TriageProject,
  accountId: string
): Promise<{ colanode: TriageProjectColanode; userId: string }> => {
  const existing = project.colanode;

  // 1. Workspace — reuse if the registry already points at one.
  let workspaceId = existing.workspaceId;
  let userId: string;
  if (workspaceId) {
    const workspaces = await app.mediator.executeQuery({
      type: 'workspace.list',
    });
    const workspace = workspaces.find(
      (item) => item.workspaceId === workspaceId
    );
    if (!workspace) {
      throw new Error(
        `project ${project.id} points at workspace ${workspaceId}, which the bot cannot see`
      );
    }
    userId = workspace.userId;
  } else {
    const created = await runMutation(app, {
      type: 'workspace.create',
      name: `${project.name} — триаж`,
      description: `Разбор баг-репортов проекта ${project.name}`,
      accountId,
      avatar: null,
    });
    workspaceId = created.id;
    userId = created.userId;
    console.log(`[triage] created workspace ${workspaceId}`);
  }

  // 2. Invite the registry's admins (partial-success shape — inspect errors).
  if (project.admins.length > 0) {
    const invited = await runMutation(app, {
      type: 'users.create',
      userId,
      users: project.admins.map((email) => ({ email, role: 'admin' })),
    });
    for (const error of invited.errors) {
      console.warn(`[triage] invite failed: ${JSON.stringify(error)}`);
    }
  }
  const adminUserIds = await resolveAdminUserIds(app, userId, project.admins);

  // 3. Space — the bot MUST create it so it lands as node-role `admin` there.
  //    Its workspace role is only `collaborator`, but creating a database and a
  //    board view requires node role `editor`. Being the space's admin is what
  //    grants that.
  const spaceId = generateId(IdType.Space);
  await runMutation(app, {
    type: 'node.create',
    userId,
    nodeId: spaceId,
    attributes: buildSpaceAttributes(
      SPACE_NAME,
      userId,
      `Кластеры баг-репортов проекта ${project.name}`
    ),
  });

  // The space is created private with the bot as its only collaborator, so
  // without this the humans would never see the board.
  if (adminUserIds.length > 0) {
    await runMutation(app, {
      type: 'node.collaborator.create',
      userId,
      nodeId: spaceId,
      collaboratorIds: adminUserIds,
      role: 'admin',
    });
  }

  // 4. «Разбор» database + board view grouped by Исход.
  const database = buildDatabaseAttributes(DATABASE_NAME, spaceId, BOARD_FIELDS);
  const databaseId = generateId(IdType.Database);
  await runMutation(app, {
    type: 'node.create',
    userId,
    nodeId: databaseId,
    attributes: database.attributes,
  });

  const outcomeFieldId = database.fieldIds[OUTCOME_FIELD];
  if (!outcomeFieldId) {
    throw new Error(`board is missing its group-by field "${OUTCOME_FIELD}"`);
  }
  const viewId = generateId(IdType.DatabaseView);
  await runMutation(app, {
    type: 'node.create',
    userId,
    nodeId: viewId,
    attributes: buildDatabaseViewAttributes(
      BOARD_VIEW_NAME,
      databaseId,
      'board',
      outcomeFieldId
    ),
  });

  // 5. #🐛-bugs channel.
  const channelId = generateId(IdType.Channel);
  await runMutation(app, {
    type: 'node.create',
    userId,
    nodeId: channelId,
    attributes: buildChannelAttributes(CHANNEL_NAME, spaceId),
  });

  // 6. Persist the map BEFORE projecting — the generated field/option ids are
  //    the only way a later run can write records, and persisting late would
  //    make a crash re-provision everything.
  const colanode: TriageProjectColanode = {
    workspaceId,
    spaceId,
    databaseId,
    channelId,
    fields: database.fieldIds,
    decisionOptions: database.optionIds[OUTCOME_FIELD] ?? {},
  };
  await ops.updateProjectColanode(project.id, project.name, colanode);
  console.log(
    `[triage] provisioned ${project.id}: space=${spaceId} db=${databaseId} channel=${channelId}`
  );

  return { colanode, userId };
};

const buildClusterFields = (
  cluster: TriageCluster,
  reportsById: Map<string, TriageReport>,
  project: TriageProject,
  colanode: TriageProjectColanode,
  serverUrl: string
): Record<string, FieldValue> => {
  const fieldIds = colanode.fields ?? {};
  const fields: Record<string, FieldValue> = {};

  const set = (name: string, type: AgentFieldSpec['type'], value: unknown) => {
    const fieldId = fieldIds[name];
    if (!fieldId || value === undefined || value === null || value === '') {
      return;
    }
    fields[fieldId] = toFieldValue(type, value);
  };

  // The first item's report is the representative evidence for the cluster.
  const primaryItem = cluster.items[0];
  const report = primaryItem
    ? reportsById.get(primaryItem.reportId)
    : undefined;
  const sourceRef = (primaryItem?.sourceRef ?? {}) as Record<string, unknown>;

  const decisionOptionId = cluster.decision
    ? colanode.decisionOptions?.[cluster.decision]
    : undefined;
  if (decisionOptionId && fieldIds[OUTCOME_FIELD]) {
    fields[fieldIds[OUTCOME_FIELD]] = toFieldValue('select', decisionOptionId);
  }

  set('Проект', 'text', project.name);
  set('Страница', 'text', report?.pageUrl);
  set('Элемент', 'text', sourceRef.selector);
  set('Компонент', 'text', sourceRef.componentPath);
  set('Роль', 'text', sourceRef.role);
  set('Reporter', 'text', report?.reporterName);
  set('Кластер', 'text', cluster.id);
  set('Репортов', 'number', cluster.itemCount);
  set(
    'Заметка агенту',
    'text',
    primaryItem?.agentNote || cluster.rootHypothesis
  );

  if (report) {
    for (const kind of ['screenshot', 'video'] as const) {
      const artifact = report.artifacts.find((item) => item.kind === kind);
      if (artifact) {
        set(
          kind === 'screenshot' ? 'Скриншот' : 'Видео',
          'url',
          artifactUrl(serverUrl, report.id, artifact.id)
        );
      }
    }
  }

  return fields;
};

const readRecordAttributes = async (
  app: AppService,
  userId: string,
  recordId: string
): Promise<RecordAttributes | null> => {
  const nodes = await app.mediator.executeQuery({
    type: 'node.list',
    userId,
    filters: [{ field: ['id'], operator: 'eq', value: recordId }],
    sorts: [],
    limit: 1,
  });
  const node = nodes[0];
  if (!node || node.type !== 'record') return null;
  return node as unknown as RecordAttributes;
};

const projectClusters = async (
  app: AppService,
  ops: TriageOpsClient,
  project: TriageProject,
  colanode: TriageProjectColanode,
  userId: string,
  serverUrl: string
): Promise<{ created: number; updated: number }> => {
  const databaseId = colanode.databaseId;
  if (!databaseId) throw new Error(`project ${project.id} has no databaseId`);

  const [clusters, reports] = await Promise.all([
    ops.listClusters(project.id),
    ops.listExplodedReports(project.id),
  ]);
  const reportsById = new Map(reports.map((report) => [report.id, report]));

  let created = 0;
  let updated = 0;

  for (const cluster of clusters) {
    const fields = buildClusterFields(
      cluster,
      reportsById,
      project,
      colanode,
      serverUrl
    );
    const name = truncate(cluster.rootHypothesis || `Кластер ${cluster.id}`, 100);

    if (!cluster.boardRecordId) {
      const recordId = generateId(IdType.Record);
      await runMutation(app, {
        type: 'node.create',
        userId,
        nodeId: recordId,
        attributes: buildRecordAttributes(databaseId, name, fields),
      });
      // Persist the link so the next run updates instead of duplicating. This
      // is the whole idempotency mechanism.
      await ops.setClusterBoardRecord(cluster.id, recordId);
      created += 1;
      continue;
    }

    const existing = await readRecordAttributes(
      app,
      userId,
      cluster.boardRecordId
    );
    if (!existing) {
      console.warn(
        `[triage] cluster ${cluster.id} points at missing record ${cluster.boardRecordId} — skipping`
      );
      continue;
    }

    // node.update REPLACES attributes, so send the complete object.
    await runMutation(app, {
      type: 'node.update',
      userId,
      nodeId: cluster.boardRecordId,
      attributes: {
        ...existing,
        name,
        fields: mergeRecordFields(existing.fields ?? {}, fields),
      },
    });
    updated += 1;
  }

  return { created, updated };
};

export const runTriageProjection = async (): Promise<void> => {
  const config = loadTriageConfig();
  const ops = new TriageOpsClient(config.opsUrl, config.opsToken);

  const app = await bootEngine({
    serverUrl: config.serverUrl,
    email: config.botEmail,
    password: config.botPassword,
    dataDir: config.dataDir,
  });

  const accounts = app.getAccounts();
  const account = accounts[0];
  if (!account) throw new Error('bot has no account after boot');

  const projects = await ops.listProjects();
  const active = projects.filter((project) => !project.killSwitch);
  if (active.length === 0) {
    console.log('[triage] no active projects');
    return;
  }

  for (const project of active) {
    if (project.linear?.enabled) {
      console.log(
        `triage-project: ${project.id} is Linear-projected — skipping Colanode board (no second human surface)`
      );
      continue;
    }

    const needsProvision = !project.colanode?.databaseId;
    const { colanode, userId } = needsProvision
      ? await provisionProject(app, ops, project, account.id)
      : await (async () => {
          const workspaces = await app.mediator.executeQuery({
            type: 'workspace.list',
          });
          const workspace = workspaces.find(
            (item) => item.workspaceId === project.colanode.workspaceId
          );
          if (!workspace) {
            throw new Error(
              `project ${project.id} references workspace ${project.colanode.workspaceId}, which the bot cannot see`
            );
          }
          return { colanode: project.colanode, userId: workspace.userId };
        })();

    const { created, updated } = await projectClusters(
      app,
      ops,
      project,
      colanode,
      userId,
      config.serverUrl
    );
    console.log(
      `[triage] ${project.id}: ${created} record(s) created, ${updated} updated`
    );
  }
};

runTriageProjection()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[triage] projection failed:', error);
    process.exit(1);
  });
