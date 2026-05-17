#!/usr/bin/env bash
set -euo pipefail

HEADED=""
for arg in "$@"; do
    [[ "$arg" == "--headed" ]] && HEADED="--headed"
done

CLEANUP="ǀCleanup.test.ts"

TEST_FILES=(
    "generic.test.ts"
    "User.test.ts"
    "Group.test.ts"
    "Permissions.test.ts"
    "Poll.test.ts"
    "Thread.test.ts"
    "Chat.test.ts"
    "Notification.test.ts"
    "Schedule.test.ts"
    "Kanban.test.ts"
    "Delegation.test.ts"
    "Imac.test.ts"
)

run_cleanup() {
    echo "--- Running cleanup ---"
    npx playwright test "$CLEANUP" $HEADED
}

for test_file in "${TEST_FILES[@]}"; do
    run_cleanup
    echo "--- Running $test_file ---"
    npx playwright test "$test_file" $HEADED
done

run_cleanup
echo "--- All tests complete ---"
