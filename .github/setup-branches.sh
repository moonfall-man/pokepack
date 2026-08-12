#!/bin/sh
# One-time setup: two branches, both protected, you as the only approver.
#
#   master  what everyone's copy of the tool reads.  Nothing lands here except
#           a reviewed PR from dev that passed CI.
#   dev     where pack submissions and work in progress land first.
#
# Contributors fork, PR into dev.  You review, merge, and promote dev -> master
# when you are happy.
#
# The two branches are locked down differently, and the reason is a GitHub rule
# with no way around it: nobody can approve their own pull request.
#
#   master  enforced on everyone, you included.  No direct pushes at all -- a
#           pull request and green CI are the only way in.  Zero approvals
#           required, because requiring one on a solo project means your own
#           release PR can never be merged by anybody, ever.
#   dev     one approval from the code owner, so nothing a contributor writes
#           lands without you clicking approve.  Admins bypass, which is what
#           lets you merge your own work in without a second person.
#
# So: strangers cannot get anything into either branch without your approval,
# and master cannot be pushed to by hand even by you.
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
  admins=$3
  approvals=$4
  gh api -X PUT "repos/$REPO/branches/$branch/protection" --input - >/dev/null <<JSON
{
  "required_status_checks": { "strict": true, "contexts": ["test", "validate"] },
  "enforce_admins": $admins,
  "required_pull_request_reviews": {
    "required_approving_review_count": $approvals,
    "require_code_owner_reviews": $( [ "$approvals" -gt 0 ] && echo true || echo false ),
    "dismiss_stale_reviews": true,
    "require_last_push_approval": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true,
  "required_linear_history": $linear
}
JSON
  echo "  protected: $branch (admins enforced: $admins, approvals: $approvals)"
}

# dev takes squash merges, so its history stays one commit per pack.  One
# approval from the code owner, and admins bypass so your own work still moves.
protect dev true false 1

# master takes an ordinary merge commit from dev.  Linear history here would
# force a squash, which rewrites the commits dev already has -- and then the two
# branches diverge and every promotion needs a force-push to fix.
#
# Enforced on admins, so not even you can push to it by hand; zero approvals, so
# your own release PR is not waiting on a second person who does not exist.
protect master false true 0

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
