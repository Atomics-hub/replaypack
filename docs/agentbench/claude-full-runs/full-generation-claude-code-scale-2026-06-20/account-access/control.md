# Transcript — account-access

## commands_run

- `npm run proof` (before fix) — failed: `AssertionError` `false !== true`
- `npm run proof` (after fix) — passed, exit code 0

## files_changed

- `src/system.js` — reworked `canExport` to authorize export via account membership plus matching session, keeping the global-admin path as a fallback.

## final_status

PASS — `npm run proof` exits 0 with no assertion error.

## short_reason

The issue requires Lena to export "through account membership and matching session," and the trace notes her global role is `viewer` while her account membership is `finance_admin`. The original `canExport` only checked `user.role === "admin"`, so a viewer with a `finance_admin` membership was denied. The fix checks the user's membership role against the export-capable roles when `accountScopedRoles` is enabled, and (when `sessionBinding` is on) requires `session.accountId` to match `account.id`. The global-admin check remains as a fallback, so existing admin behavior is preserved.
