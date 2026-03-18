# Tenant Isolation Security Implementation Guide

## Overview
This document details the tenant isolation security measures implemented across the Hayford Learning Hub backend to prevent admins from accessing or modifying resources outside their institution.

---

## Security Principle

**Tenant Isolation Rule:**
- **SuperAdmin** (`super_admin`): Global access to all institutions
- **Admin** (`admin`): Access ONLY to their own institution
- **Teacher** (`teacher`): Access ONLY to their own institution
- **Student** (`student`): Access ONLY to their own data

---

## Implementation Summary

### Files Modified
1. **`apps/hub-backend/routes/platform.js`**
   - `PATCH /users/:id` - User updates
   - `DELETE /users/:id` - User deletion

2. **`apps/hub-backend/routes/users.js`**
   - `POST /enroll-class` - Student enrollment
   - `DELETE /unenroll-class` - Student unenrollment

3. **`apps/hub-backend/routes/classes.js`**
   - `PUT /classes/:id` - Class updates
   - `PATCH /classes/:id/teacher` - Teacher reassignment
   - `DELETE /classes/:id` - Class deletion

---

## Security Checks Implemented

### 1. platform.js - PATCH /users/:id

**Before (Vulnerable):**
```javascript
// Admin could update ANY user regardless of institution
UPDATE users SET role = $1 WHERE id = $2
```

**After (Secure):**
```javascript
// Admin can only update users in their institution
if (actor_role === 'admin') {
  // Pre-check: verify user belongs to admin's institution
  const [userCheck] = await connection.query(
    'SELECT id, institution_id FROM users WHERE id = $1',
    [id]
  );
  
  if (userCheck[0].institution_id !== actor_institution_id) {
    return res.status(403).json({ 
      error: 'Access denied: User belongs to a different institution' 
    });
  }
}

// SQL query includes institution_id constraint for admins
UPDATE users SET role = $1 WHERE id = $2 AND institution_id = $3
```

**Security Impact:**
- ✅ Admin cannot modify users from other institutions
- ✅ Returns 403 Forbidden if attempted
- ✅ SuperAdmin retains global access

---

### 2. platform.js - DELETE /users/:id

**Before (Vulnerable):**
```javascript
// Admin could delete ANY user
DELETE FROM users WHERE id = $1
```

**After (Secure):**
```javascript
// Check institution ownership
const [userRows] = await connection.query(
  'SELECT role, first_name, last_name, institution_id FROM users WHERE id = $1', 
  [id]
);

// TENANT ISOLATION: Admin can only delete users in their institution
if (actor_role === 'admin' && userInstitutionId !== actor_institution_id) {
  return res.status(403).json({ 
    error: 'Access denied: User belongs to a different institution' 
  });
}
```

**Security Impact:**
- ✅ Admin cannot delete users from other institutions
- ✅ Pre-validation prevents unauthorized access
- ✅ SuperAdmin retains global access

---

### 3. users.js - POST /enroll-class

**Before (Vulnerable):**
```javascript
// Admin could enroll students in classes from ANY institution
SELECT id, institution_id FROM classes WHERE id = $1
```

**After (Secure):**
```javascript
// Admin can only enroll in classes within their institution
let classQuery, classParams;
if (actor_role === 'super_admin') {
  classQuery = 'SELECT id, institution_id FROM classes WHERE id = $1';
  classParams = [class_id];
} else {
  // Admin/Teacher: add institution_id constraint
  classQuery = 'SELECT id, institution_id FROM classes WHERE id = $1 AND institution_id = $2';
  classParams = [class_id, actor_institution_id];
}
```

**Security Impact:**
- ✅ Admin cannot enroll students in classes from other institutions
- ✅ Returns 403 if class doesn't exist in their institution
- ✅ Prevents cross-institution data leakage

---

### 4. users.js - DELETE /unenroll-class

**Before (Vulnerable):**
```javascript
// Admin could unenroll students from ANY class
DELETE FROM class_enrollments WHERE user_id = $1 AND class_id = $2
```

**After (Secure):**
```javascript
// Verify class belongs to admin's institution
if (actor_role !== 'super_admin') {
  const [classCheck] = await connection.query(
    'SELECT id FROM classes WHERE id = $1 AND institution_id = $2',
    [class_id, actor_institution_id]
  );
  
  if (classCheck.length === 0) {
    return res.status(403).json({ 
      error: 'Access denied: Class belongs to a different institution' 
    });
  }
}
```

**Security Impact:**
- ✅ Admin cannot unenroll students from classes in other institutions
- ✅ Pre-validation prevents unauthorized modifications
- ✅ SuperAdmin retains global access

---

### 5. classes.js - PUT /classes/:id

**Before (Vulnerable):**
```javascript
// Admin could update ANY class
UPDATE classes SET class_name = $1, start_date = $2, end_date = $3 WHERE id = $4
```

**After (Secure):**
```javascript
// Fetch class with institution_id
const [existing] = await connection.query(
  'SELECT teacher_id, institution_id FROM classes WHERE id = $1', 
  [class_id]
);

// TENANT ISOLATION: Admin can only edit classes in their institution
if (actor_role === 'admin' && existing[0].institution_id !== actor_institution_id) {
  return res.status(403).json({ 
    error: 'Access denied: Class belongs to a different institution' 
  });
}

// SQL query includes institution_id constraint for admins
if (actor_role === 'super_admin') {
  updateQuery = 'UPDATE classes SET class_name = $1, start_date = $2, end_date = $3 WHERE id = $4';
} else {
  updateQuery = 'UPDATE classes SET class_name = $1, start_date = $2, end_date = $3 WHERE id = $4 AND institution_id = $5';
  updateParams.push(actor_institution_id);
}
```

**Security Impact:**
- ✅ Admin cannot modify classes from other institutions
- ✅ Double-layer protection: pre-check + SQL constraint
- ✅ Returns 403 or 404 if unauthorized

---

### 6. classes.js - PATCH /classes/:id/teacher

**Before (Vulnerable):**
```javascript
// Admin could reassign teachers for ANY class
UPDATE classes SET teacher_id = $1 WHERE id = $2
```

**After (Secure):**
```javascript
// Verify class belongs to admin's institution
if (actor_role === 'super_admin') {
  classQuery = 'SELECT id, institution_id FROM classes WHERE id = $1';
} else {
  classQuery = 'SELECT id, institution_id FROM classes WHERE id = $1 AND institution_id = $2';
  classParams = [class_id, actor_institution_id];
}

// Verify new teacher is in the same institution
if (actor_role === 'admin' && teacher.institution_id !== actor_institution_id) {
  return res.status(403).json({ 
    error: 'Cannot assign teachers from other institutions' 
  });
}

// SQL update with institution constraint
if (actor_role === 'super_admin') {
  updateQuery = 'UPDATE classes SET teacher_id = $1 WHERE id = $2';
} else {
  updateQuery = 'UPDATE classes SET teacher_id = $1 WHERE id = $2 AND institution_id = $3';
  updateParams = [teacher_id, class_id, actor_institution_id];
}
```

**Security Impact:**
- ✅ Admin cannot reassign teachers for classes in other institutions
- ✅ Admin cannot assign teachers from other institutions
- ✅ Triple-layer protection: class check + teacher check + SQL constraint

---

### 7. classes.js - DELETE /classes/:id

**Before (Vulnerable):**
```javascript
// Admin could delete ANY class
DELETE FROM classes WHERE id = $1
```

**After (Secure):**
```javascript
// Fetch class with institution_id
const [existing] = await connection.query(
  'SELECT teacher_id, institution_id FROM classes WHERE id = $1', 
  [class_id]
);

// TENANT ISOLATION: Admin can only delete classes in their institution
if (actor_role === 'admin' && existing[0].institution_id !== actor_institution_id) {
  return res.status(403).json({ 
    error: 'Access denied: Class belongs to a different institution' 
  });
}

// SQL delete with institution constraint
if (actor_role === 'super_admin') {
  deleteQuery = 'DELETE FROM classes WHERE id = $1';
} else {
  deleteQuery = 'DELETE FROM classes WHERE id = $1 AND institution_id = $2';
  deleteParams = [class_id, actor_institution_id];
}
```

**Security Impact:**
- ✅ Admin cannot delete classes from other institutions
- ✅ Pre-validation + SQL constraint for defense in depth
- ✅ Returns 403 or 404 if unauthorized

---

## Security Patterns Used

### Pattern 1: Pre-Validation Check
```javascript
// Check resource ownership BEFORE attempting modification
if (actor_role === 'admin') {
  const [resource] = await connection.query(
    'SELECT institution_id FROM table WHERE id = $1',
    [resource_id]
  );
  
  if (resource[0].institution_id !== actor_institution_id) {
    return res.status(403).json({ error: 'Access denied' });
  }
}
```

### Pattern 2: SQL Constraint
```javascript
// Add institution_id to WHERE clause for admins
if (actor_role === 'super_admin') {
  query = 'UPDATE table SET field = $1 WHERE id = $2';
  params = [value, id];
} else {
  query = 'UPDATE table SET field = $1 WHERE id = $2 AND institution_id = $3';
  params = [value, id, actor_institution_id];
}
```

### Pattern 3: Result Verification
```javascript
const [result] = await connection.query(query, params);
const affected = result?.affectedRows ?? result?.rowCount ?? 0;

if (affected === 0) {
  return res.status(404).json({ error: 'Resource not found or access denied' });
}
```

---

## Testing Checklist

### Test Scenario 1: Admin Cross-Institution User Update
**Setup:**
- Admin A belongs to Institution 1
- User B belongs to Institution 2

**Test:**
```bash
PATCH /api/users/{user_b_id}
Authorization: Bearer {admin_a_token}
Body: { "role": "teacher" }
```

**Expected Result:**
- ❌ 403 Forbidden
- Error: "Access denied: User belongs to a different institution"

---

### Test Scenario 2: Admin Cross-Institution Class Deletion
**Setup:**
- Admin A belongs to Institution 1
- Class X belongs to Institution 2

**Test:**
```bash
DELETE /api/classes/{class_x_id}
Authorization: Bearer {admin_a_token}
```

**Expected Result:**
- ❌ 403 Forbidden
- Error: "Access denied: Class belongs to a different institution"

---

### Test Scenario 3: Admin Enrolling Student in Foreign Class
**Setup:**
- Admin A belongs to Institution 1
- Class Y belongs to Institution 2
- Student S exists

**Test:**
```bash
POST /api/users/enroll-class
Authorization: Bearer {admin_a_token}
Body: { "email": "student@example.com", "class_id": {class_y_id} }
```

**Expected Result:**
- ❌ 403 Forbidden
- Error: "Class not found or access denied"

---

### Test Scenario 4: SuperAdmin Global Access
**Setup:**
- SuperAdmin has global privileges
- Resources exist in multiple institutions

**Test:**
```bash
# Should succeed for ANY institution
PATCH /api/users/{any_user_id}
DELETE /api/classes/{any_class_id}
POST /api/users/enroll-class
```

**Expected Result:**
- ✅ 200 OK
- All operations succeed regardless of institution

---

## SQL Injection Prevention

All tenant isolation checks use **parameterized queries** to prevent SQL injection:

```javascript
// ✅ SAFE - Parameterized
const query = 'SELECT * FROM users WHERE id = $1 AND institution_id = $2';
const params = [userId, institutionId];
await connection.query(query, params);

// ❌ UNSAFE - String concatenation (NOT USED)
const query = `SELECT * FROM users WHERE id = ${userId} AND institution_id = ${institutionId}`;
```

**All parameter indices are correctly managed:**
- Parameters are indexed sequentially ($1, $2, $3, etc.)
- Dynamic query building maintains correct parameter order
- No string interpolation is used for user input

---

## Error Messages

### 403 Forbidden
Returned when admin attempts to access resources in another institution:
- "Access denied: User belongs to a different institution"
- "Access denied: Class belongs to a different institution"
- "Cannot assign teachers from other institutions"

### 404 Not Found
Returned when resource doesn't exist OR access is denied:
- "User not found or access denied"
- "Class not found or access denied"
- "Enrollment not found"

**Note:** Using 404 instead of 403 in some cases prevents information leakage about resource existence.

---

## Deployment Checklist

- [x] All PATCH endpoints have tenant isolation
- [x] All DELETE endpoints have tenant isolation
- [x] All POST endpoints that modify resources have tenant isolation
- [x] SuperAdmin bypass logic is correct
- [x] SQL parameters are safely indexed
- [x] Error messages don't leak sensitive information
- [x] Pre-validation checks are in place
- [x] SQL constraints are in place (defense in depth)
- [x] Result verification confirms affected rows

---

## Performance Considerations

### Additional Queries
Some endpoints now perform additional validation queries:
- `PATCH /users/:id`: +1 query (user institution check)
- `DELETE /unenroll-class`: +1 query (class institution check)

**Impact:** Minimal - these are simple indexed lookups.

### Optimization Opportunities
1. **Caching:** Institution membership could be cached in JWT
2. **Single Query:** Some pre-checks could be combined with main query
3. **Indexes:** Ensure `institution_id` columns are indexed

---

## Summary

**Security Improvements:**
- ✅ Admins cannot access resources outside their institution
- ✅ SuperAdmins retain global access
- ✅ Defense in depth: pre-validation + SQL constraints
- ✅ SQL injection prevention via parameterized queries
- ✅ Proper error handling and status codes

**Files Modified:**
- `apps/hub-backend/routes/platform.js` (2 endpoints)
- `apps/hub-backend/routes/users.js` (2 endpoints)
- `apps/hub-backend/routes/classes.js` (3 endpoints)

**Total Endpoints Secured:** 7 destructive endpoints

**No database schema changes required** - all security is enforced at the application layer.
