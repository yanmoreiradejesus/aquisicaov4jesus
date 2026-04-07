

## Problem

The "META" submenu page lives at route `/mix-compra`, but Thiago's `user_page_access` records still contain the old path `/metas` (from when the page was called "Metas"). The `ProtectedRoute` checks `hasPageAccess("/mix-compra")` which fails because his DB entry says `/metas`.

Yan (admin) works because `isAdmin` bypasses the check entirely.

## Solution

Two changes needed:

### 1. Database migration: update existing access records
Run a migration to rename `/metas` to `/mix-compra` in the `user_page_access` table for all users who have `/metas` but not `/mix-compra`:

```sql
UPDATE public.user_page_access 
SET page_path = '/mix-compra' 
WHERE page_path = '/metas';
```

### 2. Update the `handle_new_user` function
The function already inserts `/mix-compra` for the first user, so no change needed there. But we should verify it doesn't still reference `/metas` anywhere.

## Technical detail
- File: No code file changes needed — only the DB migration
- The `handle_new_user` function already uses `/mix-compra`, so new users are fine
- Only existing users with the old `/metas` path are affected

