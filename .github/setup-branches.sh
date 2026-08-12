#!/bin/sh
# One-time setup: one protected branch, you as the only approver.
#
#   master   what everyone's copy of the tool reads.  Nothing lands here except
#            a pull request you approved, with green CI.
#
# There used to be a `dev` branch in front of it.  It was removed, and the
# reasoning is worth keeping because the idea is tempting:
#
#   A second long-lived branch buys nothing that master's own protection does
#   not already give -- no direct pushes, a pull request as the only way in,
#   your review required, CI green required -- and it costs a second pull
#   request for every change.  Worse, the two branches drift apart the moment
#   anything is squash-merged between them, because a squash gives one branch a
#   single commit where the other has ten: identical code, unrelated history,
#   and git then reads the same work arriving twice as a conflict in files
#   nobody touched.  That happened twice in one evening before the cause was
#   clear.
#
#   Short-lived feature branches never live long enough to drift.  Add a staging
#   branch the day you actually need one -- adding a branch is free, untangling
#   two divergent ones is not.
#
# Run once, after the repo exists on GitHub:
#   sh .github/setup-branches.sh
#
# Needs the GitHub CLI, logged in:  gh auth login
set -e

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo "Setting up $REPO"

gh api -X PATCH "repos/$REPO" -f default_branch=master >/dev/null
echo "  default branch: master"

# Squash merging stays available: with only short-lived branches merging into
# master, squashing is the *right* button -- it keeps master's history one
# commit per change, and the branch it squashed is deleted immediately after.
gh api -X PATCH "repos/$REPO" \
  -F allow_squash_merge=true \
  -F allow_merge_commit=true \
  -F delete_branch_on_merge=true >/dev/null
echo "  merges: branches deleted after merge"

# strict=false on purpose.  "Require branches to be up to date before merging"
# means every pull request demands an Update branch click the moment anything
# else lands, which on a one-person project is pure friction for a race that
# barely exists -- and CI runs on master after the merge regardless.
gh api -X PUT "repos/$REPO/branches/master/protection" --input - >/dev/null <<'JSON'
{
  "required_status_checks": { "strict": false, "contexts": ["test", "validate"] },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "require_code_owner_reviews": false,
    "dismiss_stale_reviews": true,
    "require_last_push_approval": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true,
  "required_linear_history": false
}
JSON
echo "  protected: master (no direct pushes, enforced on admins too)"

# Zero approvals required, and that is not a hole -- it is the only workable
# setting for a solo maintainer.  GitHub forbids approving your own pull
# request, so requiring one would leave your own releases unmergeable by anyone,
# for ever.  A stranger still cannot merge: they have no write access, and the
# merge button is yours alone.  Raise this to 1 the day a second maintainer
# arrives, and add .github/CODEOWNERS back to the required-review setting.

# Actions get a read-only token and cannot approve pull requests.
gh api -X PUT "repos/$REPO/actions/permissions/workflow" \
  -f default_workflow_permissions=read \
  -F can_approve_pull_request_reviews=false >/dev/null
echo "  Actions: read-only token, cannot approve PRs"

# Pages, for the gallery.  Turned on here rather than by the workflow: creating
# the site needs a token that can write repo settings, and the workflow's token
# is read-only by the line above.  Already-enabled is not an error.
gh api -X POST "repos/$REPO/pages" -f build_type=workflow >/dev/null 2>&1 \
  && echo "  Pages: on, published by the gallery workflow" \
  || echo "  Pages: already on"

# A fresh github-pages environment only lets the default branch deploy; allow
# any protected branch so it keeps working if the default ever moves.
gh api -X PUT "repos/$REPO/environments/github-pages" --input - >/dev/null 2>&1 \
  && echo "  Pages: protected branches may deploy" || true
{"deployment_branch_policy":{"protected_branches":true,"custom_branch_policies":false}}
JSON

cat <<'DONE'

One thing the API cannot set -- do this in the browser once:

  Settings -> Actions -> General -> Fork pull request workflows
    "Require approval for all external contributors"
    Otherwise a stranger's first PR runs CI without you looking at it.

Check it worked by trying to push straight to master. It should be refused.
DONE
