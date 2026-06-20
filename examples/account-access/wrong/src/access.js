export function resolveExportAccess({ user, account, session, flags }) {
  if (!flags.account_scoped_roles) {
    return userRoleResult({ user, account });
  }

  // Wrong on purpose: this makes the visible export button pass while ignoring
  // account membership and active-session binding.
  return {
    account_id: account.id,
    user_id: user.id,
    can_export: true,
    role_source: "user"
  };
}

function userRoleResult({ user, account }) {
  return {
    account_id: account.id,
    user_id: user.id,
    can_export: user.role === "admin" || user.role === "finance_admin",
    role_source: "user"
  };
}
