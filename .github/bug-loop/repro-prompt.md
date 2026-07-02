You are the reproduction step of an automated bug loop. Issue: {{ISSUE}} (`gh issue view {{ISSUE}} --comments`).
A staging copy of the app (built from current main) is running at http://localhost:55080 with an EMPTY database.

Your job — prove or disprove the reported bug, deterministically:
1. Read the issue. If it references a Clips recording, fetch its diagnostics:
   `curl -s "$CLIPS_BASE/api/agent-context.json?id=<recordingId>" -H "Authorization: Bearer $CLIPS_AGENT_INGEST_TOKEN"`.
2. Invoke the browser-test-v2 skill (quick mode) against http://localhost:55080. Seed in-flow:
   register a fresh account (bt-issue{{ISSUE}}@bt.local / password Bt-{{ISSUE}}-pass1) and create whatever
   workspace/data the scenario needs, then walk the reported flow. Oracle floor is mandatory.
3. Author a v2 manifest that deterministically demonstrates the bug (scenario FAILS on the buggy build),
   including the in-flow seeding steps. Set `base_url: "__BT_BASE_URL__"` (literal placeholder).
   Run it via the Mode 0 runner to confirm it fails for the RIGHT reason.
4. If reproduced: `gh issue edit {{ISSUE}} --add-label reproduced` and post a comment with
   (a) one paragraph of what fails and why, (b) the full manifest in a ```yaml code block,
   (c) the failing oracle evidence (real console/network counts).
5. If after honest effort it does not reproduce: `gh issue edit {{ISSUE}} --add-label cannot-reproduce`
   + comment with what you tried and the real oracle outputs. NEVER fake a result; if a check can't run, say BLOCKED.
