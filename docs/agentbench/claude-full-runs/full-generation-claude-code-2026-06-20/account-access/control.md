# Transcript

## commands_run

- `npm run proof`

## files_changed

- `src/system.js`

## final_status

PASS — `npm run proof` exits cleanly with no assertion failures.

## short_reason

`canExport` only granted access when the global `user.role` was `admin`, so
Lena (global role `viewer`) was denied. The issue and trace require export
through account membership with a matching session. The fix keeps the global
admin path and adds an account-scoped path: when `flags.accountScopedRoles` is
set, it allows export if the user's account membership role is `finance_admin`
(or `admin`) and, when `flags.sessionBinding` is set, the session's `accountId`
matches the account. The membership-based grant reports `source: "account"`.
