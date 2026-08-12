#!/bin/sh
# One-time setup: two branches, both protected, you as the only approver.
#
#   master  what everyone's copy of the tool reads.  Nothing lands here except
#           a reviewed PR from dev that passed CI.
#   dev     where pack submissions and work in progress land first.
#
# Contributors fork, PR into dev.  You review, merge, and promote dev -> master
# when you are happy.  Neither branch can be pushed to directly, force-pushed,
# or deleted -- including by you, which is the point.
#
# Run once, after the repo exists on GitHub:
#   sh .github/setup-branches.sh
#
# Needs the GitHub CLI, logged in:  gh auth login
set -e

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
OWNER=$(gh api user -q .login)
echo "Setting up $REPO (owner: $OWNER)"

# --- the dev branch, if it does not exist yet
if ! git show-ref --quiet refs/heads/dev; then
  git branch dev master
  git push -u origin dev
fi

# Contributors should land on dev, not master, when they open a PR.
gh api -X PATCH "repos/$REPO" -f default_branch=dev >/dev/null
echo "  default branch for new PRs: dev"

protect() {
  branch=$1
  linear=$2
  # enforce_admins=false leaves you a way to promote dev -> master without a
  # second human.  GitHub will not let anyone approve their own PR, so with it
  # true and no collaborators, your own release PR would sit unmergeable for
  # ever.  Everyone else still needs your approval; this is the one hole and it
  # is yours.
  gh api -X PUT "repos/$REPO/branches/$branch/protection" --input - >/dev/null <<JSON
{
  "required_status_checks": { "strict": true, "contexts": ["test", "validate"] },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "require_code_owner_reviews": true,
    "dismiss_stale_reviews": true,
    "require_last_push_approval": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true,
  "required_linear_history": $linear
}
JSON
  echo "  protected: $branch (1 approval, CODEOWNERS required, no force-push, no delete)"
}

# dev takes squash merges, so its history stays one commit per pack.
protect dev true
# master takes an ordinary merge commit from dev.  Linear history here would
# force a squash, which rewrites the commits dev already has -- and then the two
# branches diverge and every promotion needs a force-push to fix.
protect master false

# A fork's workflow run can otherwise start the moment a stranger opens a PR.
gh api -X PUT "repos/$REPO/actions/permissions/workflow" \
  -f default_workflow_permissions=read \
  -F can_approve_pull_request_reviews=false >/dev/null
echo "  Actions: read-only token, cannot approve PRs"

cat <<'DONE'

Two things the API cannot set -- do these in the browser once:

  Settings -> Actions -> General -> Fork pull request workflows
    "Require approval for all external contributors"
    Otherwise a stranger's first PR runs CI without you looking at it.

  Settings -> Moderation -> Interaction limits (only if it gets busy)

Check it worked by trying to push straight to master. It should be refused.
DONE
