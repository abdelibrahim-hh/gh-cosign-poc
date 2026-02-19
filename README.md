# Co-Signer POC

AI-powered PR risk assessment and auto-approval GitHub Action.

## How it works

1. A PR is opened or updated, triggering the **HERO Stub** workflow
2. On HERO Stub completion, the **Co-Signer** workflow runs via `workflow_run`
3. Co-Signer checks deterministic guardrails (blocked paths, dependency files, file count)
4. If guardrails don't trigger, it sends the PR diff to Claude Sonnet for risk assessment (1-10)
5. PRs scoring ≤ 3 are auto-approved; higher scores require human review

## Testing locally

```bash
cd .github/actions/co-signer
npm install
npm test              # run unit tests
npm run build         # rebuild ncc bundle
```

## Required secrets

| Secret | Description |
|--------|-------------|
| `COSIGN_APP_ID` | GitHub App ID |
| `COSIGN_PRIVATE_KEY` | GitHub App private key (.pem) |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |

## E2E test

1. **Low-risk:** edit `README.md` on a branch, open PR — expect auto-approval (risk ≤ 3)
2. **Guardrail:** edit a workflow file — expect ABSTAIN, no approval
