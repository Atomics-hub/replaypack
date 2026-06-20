# Account-scoped export access ignores membership

Lena is a global viewer, but she is `finance_admin` in `acct_harbor`.

The export resolver must use the active account membership when account-scoped roles are enabled. It must also reject access when the session is bound to another account.

Expected:

```json
{
  "can_export": true,
  "role_source": "account_membership"
}
```
