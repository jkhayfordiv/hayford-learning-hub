# Many-to-Many Class Enrollment Migration Guide

## Overview
This guide documents the migration from a single `class_id` column in the `users` table to a Many-to-Many relationship using the `class_enrollments` table. This allows users to be enrolled in multiple classes simultaneously.

---

## What Changed

### Database Schema Changes
1. **New Table**: `class_enrollments` 
   - Columns: `id`, `user_id`, `class_id`, `joined_at`
   - Unique constraint on `(user_id, class_id)` to prevent duplicate enrollments
   - Foreign keys with CASCADE delete to `users` and `classes`
   - Indexed on both `user_id` and `class_id` for performance

2. **Removed Column**: `users.class_id` (after migration)
   - This column will be dropped after data is migrated to `class_enrollments`

### Backend API Changes

#### New Endpoints
- `POST /api/users/enroll-class` - Enroll a student in a class
- `DELETE /api/users/unenroll-class` - Remove a student from a specific class
- `DELETE /api/users/:id/classes` - Remove a student from ALL classes
- `PATCH /api/classes/:id/teacher` - Reassign a class to a different teacher

#### Modified Endpoints
- `POST /api/auth/login` - Now returns `classes` array in JWT payload
- `GET /api/classes` - Students now receive array of all enrolled classes
- `GET /api/classes/all` - Uses `class_enrollments` for student counts
- `POST /api/classes/join` - Inserts into `class_enrollments` instead of updating `users.class_id`
- `DELETE /api/classes/leave` - Removes all enrollments for the user
- `GET /api/platform/users/all` - Returns `classes` array for each user
- `PATCH /api/platform/users/:id` - No longer accepts `class_id` parameter

#### Removed Endpoints
- `PATCH /api/users/assign-class` - Replaced by `POST /api/users/enroll-class`

---

## Migration Steps

### IMPORTANT: Backup Your Database First!
```bash
# PostgreSQL backup command
pg_dump -U your_username -d hayford_learning_hub > backup_before_migration.sql
```

### Step 1: Update Schema
Run the updated schema to create the `class_enrollments` table:

```bash
psql -U your_username -d hayford_learning_hub -f packages/database-client/schema.sql
```

This will:
- Create the `class_enrollments` table
- Create indexes on `user_id` and `class_id`
- Add foreign key constraints

### Step 2: Migrate Existing Data
Run the migration script to transfer existing `class_id` data:

```bash
psql -U your_username -d hayford_learning_hub -f packages/database-client/migrate_to_enrollments.sql
```

**What this does:**
1. Copies all existing `users.class_id` values to `class_enrollments`
2. Drops the foreign key constraint `fk_users_class`
3. **STOPS before dropping the column** (commented out for safety)

### Step 3: Verify Migration
Run these verification queries:

```sql
-- Check that enrollments were created
SELECT COUNT(*) as migrated_enrollments FROM class_enrollments;

-- Check users with class_id still set
SELECT COUNT(*) as users_with_class FROM users WHERE class_id IS NOT NULL;

-- These counts should match!

-- View sample enrollments
SELECT u.email, c.class_name, ce.joined_at 
FROM class_enrollments ce
JOIN users u ON ce.user_id = u.id
JOIN classes c ON ce.class_id = c.id
ORDER BY ce.joined_at DESC
LIMIT 20;
```

### Step 4: Deploy Backend Changes
Deploy the updated backend code:

```bash
cd apps/hub-backend
npm install  # If any dependencies changed
pm2 restart hub-backend  # Or your process manager
```

### Step 5: Test the System
1. **Login Test**: Verify users can log in and see their classes
2. **Enrollment Test**: Try enrolling a student in multiple classes
3. **Teacher View Test**: Verify teachers can see all students in their classes
4. **Admin Test**: Check that user listings show multiple classes

### Step 6: Drop the Old Column (ONLY AFTER TESTING)
Once you've verified everything works, you can drop the old `class_id` column:

```sql
-- FINAL STEP - Only run after thorough testing!
ALTER TABLE users DROP COLUMN IF EXISTS class_id;
```

---

## API Usage Examples

### Enroll a Student in a Class
```javascript
POST /api/users/enroll-class
Authorization: Bearer <admin_or_teacher_token>
Content-Type: application/json

{
  "email": "student@example.com",
  "class_id": 5
}
```

### Unenroll a Student from a Specific Class
```javascript
DELETE /api/users/unenroll-class
Authorization: Bearer <admin_or_teacher_token>
Content-Type: application/json

{
  "user_id": 123,
  "class_id": 5
}
```

### Reassign a Class to a Different Teacher
```javascript
PATCH /api/classes/42/teacher
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "teacher_id": 7
}
```

### Student Joins a Class with Code
```javascript
POST /api/classes/join
Authorization: Bearer <student_token>
Content-Type: application/json

{
  "class_code": "ABC123"
}
```

---

## Frontend Integration Notes

### JWT Payload Changes
The user object in the JWT now includes:

```javascript
{
  id: 123,
  role: "student",
  institution_id: 5,
  first_name: "John",
  last_name: "Doe",
  email: "john@example.com",
  classes: [
    { id: 10, class_name: "IELTS Prep A", class_code: "ABC123", joined_at: "2024-01-15" },
    { id: 15, class_name: "IELTS Prep B", class_code: "DEF456", joined_at: "2024-02-01" }
  ],
  class_id: 10,      // Backwards compatibility: first class
  class_name: "IELTS Prep A"  // Backwards compatibility
}
```

### Backwards Compatibility
- `class_id` and `class_name` still exist in the payload for backwards compatibility
- They represent the **first** (most recent) class enrollment
- New code should use the `classes` array instead

### User Listings Response
The `/api/platform/users/all` endpoint now returns:

```javascript
[
  {
    id: 123,
    first_name: "John",
    last_name: "Doe",
    email: "john@example.com",
    role: "student",
    institution_id: 5,
    institution_name: "ABC Institute",
    created_at: "2024-01-01",
    classes: [
      { class_id: 10, class_name: "IELTS Prep A" },
      { class_id: 15, class_name: "IELTS Prep B" }
    ],
    class_id: 10,      // Backwards compatibility
    class_name: "IELTS Prep A"  // Backwards compatibility
  }
]
```

---

## Rollback Plan

If you need to rollback the migration:

### Step 1: Restore from Backup
```bash
psql -U your_username -d hayford_learning_hub < backup_before_migration.sql
```

### Step 2: Redeploy Old Backend Code
```bash
git checkout <previous_commit>
cd apps/hub-backend
pm2 restart hub-backend
```

---

## Teacher Assignment Fix

The new `PATCH /api/classes/:id/teacher` endpoint fixes the issue where classes become invisible to teachers when they are moved to a different institution or role.

**How it works:**
1. Admin/SuperAdmin calls the endpoint with the new `teacher_id`
2. System verifies the new teacher has appropriate role (teacher/admin/super_admin)
3. System updates `classes.teacher_id` to the new teacher
4. The class now appears in the new teacher's class list

**Example:**
```javascript
// Move class 42 to teacher with ID 7
PATCH /api/classes/42/teacher
{
  "teacher_id": 7
}
```

---

## Troubleshooting

### Issue: Migration script fails with "duplicate key value"
**Solution**: Some enrollments may already exist. This is safe to ignore as the script uses `ON CONFLICT DO NOTHING`.

### Issue: Students can't see their classes after migration
**Solution**: 
1. Check that enrollments were created: `SELECT * FROM class_enrollments WHERE user_id = <student_id>`
2. Verify the backend is using the new code (check logs for enrollment queries)
3. Clear browser localStorage and re-login

### Issue: Teacher can't see students in their class
**Solution**:
1. Verify `classes.teacher_id` is set correctly
2. Check that students have enrollments: `SELECT * FROM class_enrollments WHERE class_id = <class_id>`
3. Use the teacher reassignment endpoint if needed

### Issue: User listings show empty classes array
**Solution**: The PostgreSQL query uses `json_agg` which requires PostgreSQL 9.3+. Verify your PostgreSQL version.

---

## Performance Considerations

### Indexes
The migration creates two indexes:
- `idx_class_enrollments_user_id` - Fast lookup of user's classes
- `idx_class_enrollments_class_id` - Fast lookup of class's students

### Query Optimization
- User login: Single JOIN query to fetch all classes
- Class listings: Uses `COUNT(DISTINCT ce.user_id)` for accurate student counts
- Platform user listings: Uses `json_agg` to aggregate classes efficiently

---

## Summary of Files Changed

### Schema
- `packages/database-client/schema.sql` - Added `class_enrollments` table
- `packages/database-client/migrate_to_enrollments.sql` - Migration script (NEW)

### Backend Routes
- `apps/hub-backend/routes/auth.js` - Updated login to fetch multiple classes
- `apps/hub-backend/routes/users.js` - New enroll/unenroll endpoints
- `apps/hub-backend/routes/classes.js` - Updated all class-related queries
- `apps/hub-backend/routes/platform.js` - Updated user listings with classes array

### Documentation
- `MIGRATION_GUIDE.md` - This file (NEW)

---

## Questions or Issues?

If you encounter any issues during migration:
1. Check the backend logs for SQL errors
2. Verify database schema matches expected structure
3. Ensure all foreign key constraints are in place
4. Test with a small subset of users first

**DO NOT proceed with Step 6 (dropping the column) until you've thoroughly tested the system!**
