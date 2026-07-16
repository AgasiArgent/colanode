export type LinearProjectorConfig = {
  opsUrl: string;
  opsToken: string;
  linearApiKey: string;
};

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name}`);
  }
  return value;
};

/**
 * Config for the deterministic Linear projector run.
 *
 * Deliberately no Colanode or LLM vars: the projector is a plain node process
 * talking only to the triage ops-API and Linear, and it is the ONLY reader of
 * LINEAR_API_KEY (spec §5.3, §11) — the LLM sweep never sees the credential.
 */
export const loadLinearProjectorConfig = (): LinearProjectorConfig => ({
  opsUrl: required('TRIAGE_OPS_URL'),
  opsToken: required('TRIAGE_OPS_TOKEN'),
  linearApiKey: required('LINEAR_API_KEY'),
});
