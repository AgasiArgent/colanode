/**
 * GitHub issue minting for the pinpoint bug-report bridge. Server-held
 * fine-grained PAT only — reporters never need GitHub access.
 *
 * shortcut: reads process.env directly (matching the Clips template) instead of
 * colanode's config/resolveConfigReference indirection — fine for a single
 * server-only secret. Upgrade path: add a `bugReport` section to the config Zod
 * schema with `.transform(resolveConfigReference)` and supply `env://BUG_REPORT_GH_TOKEN`.
 */
export async function createGithubIssue(
  title: string,
  body: string
): Promise<{ issueUrl: string; issueNumber: number }> {
  const repo = process.env.BUG_REPORT_GH_REPO;
  const token = process.env.BUG_REPORT_GH_TOKEN;
  if (!repo || !token) {
    throw new Error('BUG_REPORT_GH_REPO / BUG_REPORT_GH_TOKEN not configured');
  }

  const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, body, labels: ['report'] }),
  });

  if (!res.ok) {
    throw new Error(
      `GitHub issue create failed: ${res.status} ${await res.text()}`
    );
  }

  const json = (await res.json()) as { html_url: string; number: number };
  return { issueUrl: json.html_url, issueNumber: json.number };
}
