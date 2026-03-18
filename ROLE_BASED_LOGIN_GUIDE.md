# Role-Based Login Gates Implementation Guide

## Overview
This guide documents the implementation of role-based login gates, allowing users to have multiple profiles (e.g., both Student and Teacher) under the same email address with different roles.

---

## What Changed

### Database Schema Changes
**Before:** `UNIQUE(email)` constraint prevented duplicate emails
**After:** `UNIQUE(email, role)` constraint allows same email with different roles

### Key Benefits
- ✅ A person can have both a Student profile and a Teacher profile
- ✅ Same email, different passwords per role
- ✅ Separate dashboards and data per role
- ✅ Login gate determines which profile to access

---

## Migration Steps

### IMPORTANT: Backup Your Database First!
```bash
# PostgreSQL backup command
pg_dump -U your_username -d hayford_learning_hub > backup_before_role_migration.sql
```

### Step 1: Run the Migration Script

**Copy and paste this SQL into your Neon database console:**

```sql
-- ============================================================================
-- MIGRATION: Role-Based Login Gates
-- ============================================================================

-- Step 1: Drop the existing UNIQUE(email) constraint
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_email_unique'
    ) THEN
        ALTER TABLE users DROP CONSTRAINT users_email_unique;
        RAISE NOTICE 'Dropped constraint: users_email_unique';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_email_key'
    ) THEN
        ALTER TABLE users DROP CONSTRAINT users_email_key;
        RAISE NOTICE 'Dropped constraint: users_email_key';
    END IF;
END
$$;

-- Step 2: Create the new composite UNIQUE(email, role) constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_email_role_unique'
    ) THEN
        ALTER TABLE users
        ADD CONSTRAINT users_email_role_unique UNIQUE(email, role);
        RAISE NOTICE 'Created constraint: users_email_role_unique';
    END IF;
END
$$;

-- Step 3: Create an index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

### Step 2: Verify Migration Success

Run this query to confirm the constraint was created:

```sql
SELECT conname, contype, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'users'::regclass 
  AND conname = 'users_email_role_unique';
```

**Expected output:**
```
conname                  | contype | pg_get_constraintdef
-------------------------+---------+----------------------
users_email_role_unique  | u       | UNIQUE (email, role)
```

### Step 3: Deploy Backend Changes

The backend has been updated to:
- Query users by `email AND role` during login
- Check for `email + role` combination during registration
- Allow duplicate emails with different roles

```bash
cd apps/hub-backend
pm2 restart hub-backend  # Or your process manager
```

### Step 4: Test the System

1. **Test Login with Role Selection**
   - Try logging in as a student
   - Try logging in as a teacher with the same email (if you have both profiles)

2. **Test User Creation**
   - Create a student account with email `test@example.com`
   - Create a teacher account with the SAME email `test@example.com`
   - Both should succeed without conflict

---

## How It Works

### Login Flow

**Frontend (LoginPage.jsx):**
```javascript
// User toggles between Student and Teacher login
const payload = { 
  email: formData.email, 
  password: formData.password, 
  role: isTeacherMode ? 'teacher' : 'student' 
};

// POST to /api/auth/login
```

**Backend (auth.js):**
```javascript
// Query by BOTH email AND role
const query = 'SELECT * FROM users WHERE email = $1 AND role = $2';
const params = [email, role];
```

### Registration Flow

**Admin Creates User (PlatformManager.jsx):**
```javascript
// POST to /api/auth/register with role specified
const payload = {
  first_name: 'John',
  last_name: 'Doe',
  email: 'john@example.com',
  password: 'password123',
  role: 'teacher',  // Can be student, teacher, admin
  institution_id: 5
};
```

**Backend (auth.js):**
```javascript
// Check if email+role combination already exists
const [existing] = await connection.query(
  'SELECT id FROM users WHERE email = $1 AND role = $2', 
  [email, role]
);

if (existing.length > 0) {
  return res.status(409).json({ 
    error: `An account with this email already exists for the ${role} role` 
  });
}
```

---

## Use Cases

### Use Case 1: Teacher Who Is Also a Student
**Scenario:** A teacher wants to take a professional development course as a student.

**Solution:**
1. Teacher logs in with `teacher@school.com` as **Teacher** → Sees teacher dashboard
2. Admin creates a student account with `teacher@school.com` as **Student**
3. Teacher logs in with `teacher@school.com` as **Student** → Sees student dashboard
4. Two separate profiles, same email, different passwords

### Use Case 2: Admin Who Teaches Classes
**Scenario:** An institution admin also teaches classes.

**Solution:**
1. Admin has profile with `admin@school.com` as **Admin**
2. Admin creates teacher profile with `admin@school.com` as **Teacher**
3. Can switch between admin and teacher dashboards by logging in with different role selection

### Use Case 3: Student Becomes Teacher
**Scenario:** A former student is now hired as a teacher.

**Solution:**
1. Student profile already exists with `person@school.com` as **Student**
2. Admin creates teacher profile with `person@school.com` as **Teacher**
3. Person can access both profiles independently
4. Student progress is preserved in student profile

---

## API Changes

### POST /api/auth/login

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "role": "student"  // REQUIRED: "student" or "teacher"
}
```

**Response (Success):**
```json
{
  "token": "jwt_token_here",
  "user": {
    "id": 123,
    "email": "user@example.com",
    "role": "student",
    "first_name": "John",
    "last_name": "Doe",
    "institution_id": 5,
    "classes": [...]
  }
}
```

**Response (Error - No Account for Role):**
```json
{
  "error": "Invalid credentials or no account found for this role"
}
```

### POST /api/auth/register

**Request:**
```json
{
  "first_name": "Jane",
  "last_name": "Smith",
  "email": "jane@example.com",
  "password": "password123",
  "role": "teacher",
  "institution_id": 5
}
```

**Response (Success):**
```json
{
  "message": "teacher account created successfully",
  "userId": 456
}
```

**Response (Error - Duplicate Email+Role):**
```json
{
  "error": "An account with this email already exists for the teacher role"
}
```

---

## Frontend Integration

### LoginPage.jsx
✅ **Already Updated** - No changes needed!

The login page already sends the `role` parameter based on the toggle:
```javascript
const payload = isLogin 
  ? { email: formData.email, password: formData.password, role: isTeacherMode ? 'teacher' : 'student' }
  : { ...formData, role: 'student' };
```

### PlatformManager.jsx
✅ **Already Updated** - No changes needed!

The user creation form already includes role selection and sends it to the backend.

---

## Database Constraint Details

### Old Constraint
```sql
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE(email);
```
**Problem:** Prevented `john@example.com` from having both student and teacher profiles.

### New Constraint
```sql
ALTER TABLE users ADD CONSTRAINT users_email_role_unique UNIQUE(email, role);
```
**Solution:** Allows `john@example.com` to have:
- One student profile
- One teacher profile
- One admin profile
- One super_admin profile

---

## Testing Checklist

- [ ] Run migration script in Neon console
- [ ] Verify constraint was created successfully
- [ ] Deploy updated backend code
- [ ] Test student login
- [ ] Test teacher login
- [ ] Create student account with email `test@example.com`
- [ ] Create teacher account with SAME email `test@example.com`
- [ ] Verify both accounts can log in independently
- [ ] Verify correct dashboard loads for each role
- [ ] Test password reset (if implemented)

---

## Rollback Plan

If you need to rollback:

### Step 1: Restore from Backup
```bash
psql -U your_username -d hayford_learning_hub < backup_before_role_migration.sql
```

### Step 2: Redeploy Old Backend Code
```bash
git checkout <previous_commit>
cd apps/hub-backend
pm2 restart hub-backend
```

---

## Troubleshooting

### Issue: "An account with this email already exists for the student role"
**Cause:** You're trying to create a duplicate email+role combination.
**Solution:** This is expected behavior. Use a different email or different role.

### Issue: "Invalid credentials or no account found for this role"
**Cause:** User is trying to log in with a role they don't have a profile for.
**Solution:** 
1. Check which roles exist for that email:
   ```sql
   SELECT role, first_name, last_name FROM users WHERE email = 'user@example.com';
   ```
2. Create the missing role profile if needed.

### Issue: Migration fails with "constraint already exists"
**Cause:** The constraint was already created in a previous run.
**Solution:** This is safe to ignore. The migration script uses `IF NOT EXISTS` to prevent errors.

### Issue: Users can't log in after migration
**Cause:** Backend code not deployed or old constraint still exists.
**Solution:**
1. Verify constraint:
   ```sql
   SELECT conname FROM pg_constraint WHERE conrelid = 'users'::regclass;
   ```
2. Ensure `users_email_role_unique` exists and `users_email_unique` does NOT exist.
3. Restart backend: `pm2 restart hub-backend`

---

## Security Considerations

### Password Independence
- Each role profile has its own password
- Changing password for student profile does NOT affect teacher profile
- This is intentional for security and flexibility

### Data Isolation
- Student data is completely separate from teacher data
- Class enrollments are role-specific
- Scores and progress are tied to the specific user profile (id + role)

### Session Management
- JWT tokens include the role
- Frontend stores the active role in localStorage
- Switching roles requires logging out and logging back in

---

## Summary of Files Changed

### Database
- `packages/database-client/schema.sql` - Updated UNIQUE constraint
- `packages/database-client/migrate_role_based_login.sql` - Migration script (NEW)

### Backend
- `apps/hub-backend/routes/auth.js` - Updated login and registration logic

### Frontend
- ✅ No changes needed - already compatible!

### Documentation
- `ROLE_BASED_LOGIN_GUIDE.md` - This file (NEW)

---

## SQL Commands for Manual Execution

**Run these commands in your Neon database console in order:**

```sql
-- 1. Drop old UNIQUE(email) constraint
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_email_unique') THEN
        ALTER TABLE users DROP CONSTRAINT users_email_unique;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_email_key') THEN
        ALTER TABLE users DROP CONSTRAINT users_email_key;
    END IF;
END $$;

-- 2. Create new UNIQUE(email, role) constraint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_email_role_unique') THEN
        ALTER TABLE users ADD CONSTRAINT users_email_role_unique UNIQUE(email, role);
    END IF;
END $$;

-- 3. Create index for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 4. Verify the constraint
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'users'::regclass AND conname = 'users_email_role_unique';
```

---

## Questions or Issues?

If you encounter any issues:
1. Check the backend logs for SQL errors
2. Verify the constraint exists using the verification query
3. Ensure backend code is deployed and restarted
4. Test with a new email first before using existing emails

**The migration is safe and reversible. All existing user data is preserved.**
