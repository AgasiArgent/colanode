const SECRET_ENV_NAMES = ['LINEAR_API_KEY', 'TRIAGE_OPS_TOKEN'] as const;

export const sanitizedChildEnv = (
  baseEnv: NodeJS.ProcessEnv
): NodeJS.ProcessEnv => {
  const env = { ...baseEnv };
  for (const name of SECRET_ENV_NAMES) {
    delete env[name];
  }
  return env;
};
