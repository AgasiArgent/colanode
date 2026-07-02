import {
  MutationStatus,
  PushSubscriptionCreateMutation,
  PushSubscriptionDeleteMutation,
  generateId,
  IdType,
} from '@colanode/core';
import { database } from '@colanode/server/data/database';
import { WorkspaceContext } from '@colanode/server/types/api';

// shortcut: push subscriptions are one-per-browser-install by web-platform
// constraint (a service-worker registration holds exactly one push
// subscription). `account_id`/`device_id` are immutable per row (see
// schema.ts), so a different account subscribing with the same endpoint
// replaces the row outright rather than updating it in place — this takes
// over that install's push channel, which is expected, not a bug.
export const createPushSubscription = async (
  workspace: WorkspaceContext,
  mutation: PushSubscriptionCreateMutation
): Promise<MutationStatus> => {
  await database.transaction().execute(async (trx) => {
    await trx
      .deleteFrom('push_subscriptions')
      .where('endpoint', '=', mutation.data.endpoint)
      .execute();

    await trx
      .insertInto('push_subscriptions')
      .values({
        id: generateId(IdType.Device),
        account_id: workspace.user.accountId,
        device_id: mutation.data.deviceId,
        endpoint: mutation.data.endpoint,
        p256dh: mutation.data.p256dh,
        auth: mutation.data.auth,
        created_at: new Date(mutation.data.createdAt),
      })
      .execute();
  });

  return MutationStatus.OK;
};

export const deletePushSubscription = async (
  workspace: WorkspaceContext,
  mutation: PushSubscriptionDeleteMutation
): Promise<MutationStatus> => {
  await database
    .deleteFrom('push_subscriptions')
    .where('account_id', '=', workspace.user.accountId)
    .where('endpoint', '=', mutation.data.endpoint)
    .execute();

  return MutationStatus.OK;
};
