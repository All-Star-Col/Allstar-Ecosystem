# Git Conventions (Observed + Practical)

Scope note: this file captures what is enforced by repository automation today, plus practical team guidance that stays compatible with those automations.

## What is enforced today

- Main integration branch used by workflows: `main`.
- CI/CD triggers are path-based:
  - API deploy workflow triggers on changes under `services/api-service/**` (and its workflow file).
  - Frontend deploy workflow triggers on changes under `applications/web-app/**` (plus configured workflow paths).

Implication: keeping commits scoped by area reduces accidental deploy triggers.

## Recommended branch and commit flow

1. Create a focused branch per change set.
2. Keep commits atomic by domain (web, api, docs, infra).
3. Run relevant checks before opening PR (see `engineering/testing-strategy.md`).
4. Open PR to `main`.
5. If your change touches deploy paths, expect corresponding workflow runs.

## Commit message guidance (not currently enforced)

- Use short imperative subject lines.
- Mention scope when useful, for example:
  - `docs(engineering): refresh testing strategy`
  - `api(forms): map identifier validation to 422`
  - `web(data-viewer): preserve request id on errors`

This is recommended for readability; no commit-message linter is visible in the repo.

## PR scope guidance

- Prefer small PRs over mixed mega-PRs.
- Do not include unrelated file churn.
- For documentation changes, state whether behavior is observed or `TBD`.
- For code changes, include test evidence or explain why tests were not run.

## Safety rules

- Never commit secrets, tokens, env files, or credential artifacts.
- Avoid force pushes on shared branches unless the team explicitly agrees.
- Do not rewrite history of merged branches.

## TBD / optional

- Official branch naming policy is not documented in the repository.
- Branch protection rules and required checks are not documented in repository files.
- Merge strategy policy (squash/rebase/merge commit) is not documented in repository files.
