export type TriageBotConfig = {
  serverUrl: string;
  botEmail: string;
  botPassword: string;
  dataDir: string;
  opsUrl: string;
  opsToken: string;
};

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name}`);
  }
  return value;
};

/**
 * Config for the triage projection run.
 *
 * Deliberately NOT `loadConfig()` from config.ts: that one requires the LLM_*
 * vars for the mention-reply daemon, and the projection makes no LLM calls —
 * it is a deterministic bot. Requiring an LLM key here would be a lie.
 */
export const loadTriageConfig = (): TriageBotConfig => ({
  serverUrl: required('COLANODE_SERVER_URL'),
  botEmail: required('COLANODE_BOT_EMAIL'),
  botPassword: required('COLANODE_BOT_PASSWORD'),
  dataDir: required('COLANODE_DATA_DIR'),
  opsUrl: required('TRIAGE_OPS_URL'),
  opsToken: required('TRIAGE_OPS_TOKEN'),
});
