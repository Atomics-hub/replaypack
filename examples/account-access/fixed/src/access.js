export function resolveExportAccess({ user, account, session, flags }) {
  if (!flags.account_scoped_roles) {
    return userRoleResult({ user, account });
  }

  if (flags.session_account_binding && session.active_account_id !== account.id) {
    return {
      account_id: account.id,
      user_id: user.id,
      can_export: false,
      role_source: "session_mismatch"
    };
  }

  const membership = account.memberships?.[user.id];
  const role = membership?.role ?? user.role;

  return {
    account_id: account.id,
    user_id: user.id,
    can_export: role === "admin" || role === "finance_admin",
    role_source: membership ? "account_membership" : "user"
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
