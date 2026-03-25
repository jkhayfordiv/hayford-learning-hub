const express = require('express');
const router = express.Router();
const requireTeacher = require('../middleware/requireTeacher');
const auth = require('../middleware/auth');
const { pool } = require('../db');

// @route   POST api/classes
// @desc    Create a new class
// @access  Private (Teacher/Admin/SuperAdmin)
router.post('/', requireTeacher, async (req, res) => {
  const { class_name, start_date, end_date, institution_id: req_institution_id, teacher_id: req_teacher_id } = req.body;
  const actor_id = req.user.id;
  const actor_role = req.user.role;
  
  // SuperAdmin/Admin can specify teacher_id and institution_id
  const isPrivileged = actor_role === 'super_admin' || actor_role === 'admin';
  const teacher_id = isPrivileged && req_teacher_id ? req_teacher_id : actor_id;
  const institution_id = isPrivileged && req_institution_id ? req_institution_id : req.user.institution_id;
  
  if (!class_name) {
    return res.status(400).json({ error: 'Class name is required' });
  }

  if (!institution_id) {
    return res.status(403).json({ error: 'You must be assigned to an institution to create classes. Contact your administrator.' });
  }

  try {
    const class_code = require('crypto').randomBytes(3).toString('hex').toUpperCase();

    const connection = await pool.getConnection();
    const [result] = await connection.query(
      'INSERT INTO classes (class_name, class_code, teacher_id, institution_id, start_date, end_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [class_name, class_code, teacher_id, institution_id, start_date || null, end_date || null]
    );
    
    connection.release();
    res.status(201).json({ success: true, message: 'Class created', id: result.insertId, class_code });
  } catch (error) {
    console.error('Create class error:', error);
    res.status(500).json({ error: 'Server error creating class' });
  }
});

// @route   GET api/classes/all
// @desc    Get all classes for Classes Directory (SuperAdmin: all, Admin: institution only)
// @access  Private (Admin/SuperAdmin only)
router.get('/all', requireTeacher, async (req, res) => {
  const role = req.user.role;
  const institution_id = req.user.institution_id;

  try {
    const connection = await pool.getConnection();
    
    let query, params;
    
    if (role === 'super_admin') {
      // SuperAdmin sees all classes across all institutions
      query = `
        SELECT c.*, i.name as institution_name, 
               u.first_name as teacher_first_name, u.last_name as teacher_last_name,
               COUNT(DISTINCT ce.user_id) as student_count
        FROM classes c
        LEFT JOIN institutions i ON c.institution_id = i.id
        LEFT JOIN users u ON c.teacher_id = u.id
        LEFT JOIN class_enrollments ce ON ce.class_id = c.id
        GROUP BY c.id, i.name, u.first_name, u.last_name
        ORDER BY c.created_at DESC
      `;
      params = [];
    } else if (role === 'admin' && institution_id) {
      // Admin sees only classes in their institution
      query = `
        SELECT c.*, i.name as institution_name,
               u.first_name as teacher_first_name, u.last_name as teacher_last_name,
               COUNT(DISTINCT ce.user_id) as student_count
        FROM classes c
        LEFT JOIN institutions i ON c.institution_id = i.id
        LEFT JOIN users u ON c.teacher_id = u.id
        LEFT JOIN class_enrollments ce ON ce.class_id = c.id
        WHERE c.institution_id = $1
        GROUP BY c.id, i.name, u.first_name, u.last_name
        ORDER BY c.created_at DESC
      `;
      params = [institution_id];
    } else {
      connection.release();
      return res.status(403).json({ error: 'Access denied' });
    }

    const [classes] = await connection.query(query, params);
    connection.release();
    res.json(classes);
  } catch (error) {
    console.error('Fetch all classes error:', error);
    res.status(500).json({ error: 'Server error fetching classes' });
  }
});

// @route   GET api/classes
// @desc    Get classes (for teacher: their created classes, for student: their enrolled class)
// @access  Private
router.get('/', auth, async (req, res) => {
  const user_id = req.user.id;
  const role = req.user.role;
  const institution_id = req.user.institution_id;

  try {
    const connection = await pool.getConnection();
    
    if (role === 'teacher' || role === 'admin' || role === 'super_admin') {
      const includeArchived = String(req.query.include_archived || '').toLowerCase() === 'true';
      const ownedOnly = String(req.query.owned_only || '').toLowerCase() === 'true';

      let query, params;
      if (ownedOnly) {
        // Force personal view for ANY role: only classes where I am teacher_id OR enrolled
        query = includeArchived
          ? `SELECT DISTINCT c.* FROM classes c 
             LEFT JOIN class_enrollments ce ON c.id = ce.class_id 
             WHERE c.teacher_id = $1 OR ce.user_id = $1 
             ORDER BY c.created_at DESC`
          : `SELECT DISTINCT c.* FROM classes c 
             LEFT JOIN class_enrollments ce ON c.id = ce.class_id 
             WHERE (c.teacher_id = $1 OR ce.user_id = $1) 
             AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE) 
             ORDER BY c.created_at DESC`;
        params = [user_id];
      } else if (role === 'super_admin') {
        // Super admin sees all classes across all institutions
        query = includeArchived
          ? 'SELECT * FROM classes ORDER BY created_at DESC'
          : 'SELECT * FROM classes WHERE (end_date IS NULL OR end_date >= CURRENT_DATE) ORDER BY created_at DESC';
        params = [];
      } else if (role === 'admin' && institution_id) {
        // Admin sees all classes in their institution
        query = includeArchived
          ? 'SELECT * FROM classes WHERE institution_id = $1 ORDER BY created_at DESC'
          : 'SELECT * FROM classes WHERE institution_id = $1 AND (end_date IS NULL OR end_date >= CURRENT_DATE) ORDER BY created_at DESC';
        params = [institution_id];
      } else {
        // Teacher sees classes they created (teacher_id) OR classes they are enrolled in as a user
        // Using DISTINCT to avoid duplicates if a teacher is both the creator and enrolled (rare but possible)
        query = includeArchived
          ? `SELECT DISTINCT c.* FROM classes c 
             LEFT JOIN class_enrollments ce ON c.id = ce.class_id 
             WHERE c.teacher_id = $1 OR ce.user_id = $1 
             ORDER BY c.created_at DESC`
          : `SELECT DISTINCT c.* FROM classes c 
             LEFT JOIN class_enrollments ce ON c.id = ce.class_id 
             WHERE (c.teacher_id = $1 OR ce.user_id = $1) 
             AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE) 
             ORDER BY c.created_at DESC`;
        params = [user_id];
      }

      const [classes] = await connection.query(query, params);
      connection.release();
      return res.json(classes);
    } else {
      // Student - fetch all enrolled classes
      const [classInfo] = await connection.query(
        `SELECT c.* 
         FROM classes c
         JOIN class_enrollments ce ON ce.class_id = c.id
         WHERE ce.user_id = $1
         ORDER BY ce.joined_at DESC`,
        [user_id]
      );
      connection.release();
      return res.json(classInfo);
    }
  } catch (error) {
    console.error('Fetch classes error:', error);
    res.status(500).json({ error: 'Server error fetching classes' });
  }
});

// @route   POST api/classes/join
// @desc    Join a class using a code and retroactively assign existing class assignments
// @access  Private (Student only)
router.post('/join', auth, async (req, res) => {
  const { class_code } = req.body;
  const user_id = req.user.id;

  if (!class_code) {
    return res.status(400).json({ error: 'Class code is required' });
  }

  try {
    const connection = await pool.getConnection();
    // Codes are generated as uppercase hex
    // PHASE 2.4: Fetch institution_id along with class_id
    const [classes] = await connection.query(
      'SELECT id, institution_id FROM classes WHERE class_code = $1 AND (end_date IS NULL OR end_date >= CURRENT_DATE)',
      [class_code.toUpperCase()]
    );
    
    if (classes.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Invalid class code' });
    }

    const class_id = classes[0].id;
    const institution_id = classes[0].institution_id;
    
    // Insert enrollment (ON CONFLICT DO NOTHING prevents duplicate enrollments)
    await connection.query(
      'INSERT INTO class_enrollments (user_id, class_id) VALUES ($1, $2) ON CONFLICT (user_id, class_id) DO NOTHING',
      [user_id, class_id]
    );
    
    // Update user's institution_id if not already set
    await connection.query(
      'UPDATE users SET institution_id = $1 WHERE id = $2 AND institution_id IS NULL',
      [institution_id, user_id]
    );

    // Retroactively assign existing class assignments to the new student
    const [existingAssignments] = await connection.query(
      `SELECT teacher_id, module_id, assignment_type, grammar_topic_id, instructions, due_date
       FROM assigned_tasks
       WHERE student_id IS NULL AND class_id = $1`,
      [class_id]
    );

    if (existingAssignments.length > 0) {
      // Insert assignments for this student, avoiding duplicates
      for (const assignment of existingAssignments) {
        try {
          await connection.query(
            `INSERT INTO assigned_tasks (teacher_id, student_id, module_id, assignment_type, grammar_topic_id, instructions, due_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              assignment.teacher_id,
              user_id,
              assignment.module_id,
              assignment.assignment_type,
              assignment.grammar_topic_id,
              assignment.instructions,
              assignment.due_date
            ]
          );
        } catch (dupError) {
          // Ignore duplicate constraint violations; continue with next assignment
          console.warn('Duplicate assignment skipped for student', user_id, dupError.message);
        }
      }
    }
    
    connection.release();
    res.json({ success: true, message: 'Successfully joined class', class_id, retroactiveAssignments: existingAssignments.length });
  } catch (error) {
    console.error('Join class error:', error);
    res.status(500).json({ error: 'Server error joining class' });
  }
});

// @route   PUT api/classes/:id
// @desc    Update a class's name and dates
// @access  Private (Teacher only)
router.put('/:id', requireTeacher, async (req, res) => {
  const class_id = req.params.id;
  const { class_name, start_date, end_date } = req.body;
  const teacher_id = req.user.id;
  const actor_role = req.user.role;
  const actor_institution_id = req.user.institution_id;

  try {
    const connection = await pool.getConnection();
    
    // TENANT ISOLATION: Verify ownership and institution access
    const [existing] = await connection.query(
      'SELECT teacher_id, institution_id FROM classes WHERE id = $1', 
      [class_id]
    );
    
    if (existing.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Class not found' });
    }
    
    // Check ownership or admin privileges
    const isOwner = Number(existing[0].teacher_id) === Number(teacher_id);
    const isPrivileged = actor_role === 'admin' || actor_role === 'super_admin';
    
    if (!isOwner && !isPrivileged) {
      connection.release();
      return res.status(403).json({ error: 'Unauthorized to edit this class' });
    }
    
    // TENANT ISOLATION: Admin can only edit classes in their institution
    if (actor_role === 'admin' && Number(existing[0].institution_id) !== Number(actor_institution_id)) {
      connection.release();
      return res.status(403).json({ error: 'Access denied: Class belongs to a different institution' });
    }

    // Build UPDATE query with tenant isolation
    let updateQuery, updateParams;
    if (actor_role === 'super_admin') {
      updateQuery = 'UPDATE classes SET class_name = $1, start_date = $2, end_date = $3 WHERE id = $4';
      updateParams = [class_name, start_date || null, end_date || null, class_id];
    } else {
      // Admin/Teacher: add institution_id constraint
      updateQuery = 'UPDATE classes SET class_name = $1, start_date = $2, end_date = $3 WHERE id = $4 AND institution_id = $5';
      updateParams = [class_name, start_date || null, end_date || null, class_id, actor_institution_id];
    }
    
    const [result] = await connection.query(updateQuery, updateParams);
    const updated = result?.affectedRows ?? result?.rowCount ?? 0;
    
    connection.release();
    
    if (updated === 0) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }
    
    res.json({ success: true, message: 'Class updated successfully' });
  } catch (error) {
    console.error('Update class error:', error);
    res.status(500).json({ error: 'Server error updating class' });
  }
});

// @route   PATCH api/classes/:id/teacher
// @desc    Reassign a class to a different teacher (Admin/SuperAdmin only)
// @access  Private (Admin/SuperAdmin)
router.patch('/:id/teacher', requireTeacher, async (req, res) => {
  const class_id = req.params.id;
  const { teacher_id } = req.body;
  const actor_role = req.user.role;
  const actor_institution_id = req.user.institution_id;

  if (actor_role !== 'admin' && actor_role !== 'super_admin') {
    return res.status(403).json({ error: 'Only admins can reassign teachers to classes' });
  }

  if (!teacher_id) {
    return res.status(400).json({ error: 'Teacher ID is required' });
  }

  try {
    const connection = await pool.getConnection();
    
    // TENANT ISOLATION: Verify class exists and belongs to admin's institution
    let classQuery, classParams;
    if (actor_role === 'super_admin') {
      classQuery = 'SELECT id, institution_id FROM classes WHERE id = $1';
      classParams = [class_id];
    } else {
      classQuery = 'SELECT id, institution_id FROM classes WHERE id = $1 AND institution_id = $2';
      classParams = [class_id, actor_institution_id];
    }
    
    const [classRows] = await connection.query(classQuery, classParams);
    
    if (classRows.length === 0) {
      connection.release();
      return res.status(403).json({ error: 'Class not found or access denied' });
    }

    // Verify new teacher exists and has appropriate role
    const [teacherRows] = await connection.query(
      'SELECT id, role, institution_id FROM users WHERE id = $1',
      [teacher_id]
    );
    
    if (teacherRows.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const teacher = teacherRows[0];
    if (teacher.role !== 'teacher' && teacher.role !== 'admin' && teacher.role !== 'super_admin') {
      connection.release();
      return res.status(400).json({ error: 'User must have teacher, admin, or super_admin role' });
    }

    // TENANT ISOLATION: For admins, ensure teacher is in the same institution
    if (actor_role === 'admin' && Number(teacher.institution_id) !== Number(actor_institution_id)) {
      connection.release();
      return res.status(403).json({ error: 'Cannot assign teachers from other institutions' });
    }

    // Update the class teacher_id with tenant isolation
    let updateQuery, updateParams;
    if (actor_role === 'super_admin') {
      updateQuery = 'UPDATE classes SET teacher_id = $1 WHERE id = $2';
      updateParams = [teacher_id, class_id];
    } else {
      updateQuery = 'UPDATE classes SET teacher_id = $1 WHERE id = $2 AND institution_id = $3';
      updateParams = [teacher_id, class_id, actor_institution_id];
    }
    
    const [result] = await connection.query(updateQuery, updateParams);
    const updated = result?.affectedRows ?? result?.rowCount ?? 0;
    
    connection.release();
    
    if (updated === 0) {
      return res.status(403).json({ error: 'Class not found or access denied' });
    }
    
    res.json({ success: true, message: 'Teacher reassigned successfully', class_id, teacher_id });
  } catch (error) {
    console.error('Reassign teacher error:', error);
    res.status(500).json({ error: 'Server error reassigning teacher' });
  }
});

// @route   DELETE api/classes/:id
// @desc    Delete a class and cascade its relationships
// @access  Private (Teacher only)
router.delete('/:id', requireTeacher, async (req, res) => {
  const class_id = req.params.id;
  const teacher_id = Number(req.user.id);
  const actor_role = req.user.role;
  const actor_institution_id = req.user.institution_id;

  try {
    const connection = await pool.getConnection();
    
    // TENANT ISOLATION: Verify ownership and institution access
    const [existing] = await connection.query(
      'SELECT teacher_id, institution_id FROM classes WHERE id = $1', 
      [class_id]
    );
    
    if (existing.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Class not found' });
    }
    
    const isOwner = Number(existing[0].teacher_id) === Number(teacher_id);
    const isPrivileged = actor_role === 'admin' || actor_role === 'super_admin';
    
    if (!isOwner && !isPrivileged) {
      connection.release();
      return res.status(403).json({ error: 'Unauthorized to delete this class' });
    }
    
    // TENANT ISOLATION: Admin can only delete classes in their institution
    if (actor_role === 'admin' && Number(existing[0].institution_id) !== Number(actor_institution_id)) {
      connection.release();
      return res.status(403).json({ error: 'Access denied: Class belongs to a different institution' });
    }

    // Remove all student enrollments for this class (CASCADE will handle this automatically, but explicit is safer)
    await connection.query('DELETE FROM class_enrollments WHERE class_id = $1', [class_id]);

    // Delete class with tenant isolation
    let deleteQuery, deleteParams;
    if (actor_role === 'super_admin') {
      deleteQuery = 'DELETE FROM classes WHERE id = $1';
      deleteParams = [class_id];
    } else {
      // Admin/Teacher: add institution_id constraint
      deleteQuery = 'DELETE FROM classes WHERE id = $1 AND institution_id = $2';
      deleteParams = [class_id, actor_institution_id];
    }
    
    const [result] = await connection.query(deleteQuery, deleteParams);
    const deleted = result?.affectedRows ?? result?.rowCount ?? 0;
    
    connection.release();
    
    if (deleted === 0) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }
    
    res.json({ success: true, message: 'Class deleted successfully' });
  } catch (error) {
    console.error('Delete class error:', error);
    res.status(500).json({ error: 'Server error deleting class' });
  }
});

// @route   GET api/classes/:id/details
// @desc    Get class details including enrolled students and assignments
// @access  Private (Teacher/Admin/SuperAdmin)
router.get('/:id/details', requireTeacher, async (req, res) => {
  const class_id = req.params.id;
  const actor_role = req.user.role;
  const actor_institution_id = req.user.institution_id;
  const actor_id = req.user.id;

  try {
    const connection = await pool.getConnection();
    
    // TENANT ISOLATION: Verify access to this class
    const [classRows] = await connection.query(
      'SELECT c.*, i.name as institution_name, u.first_name as teacher_first_name, u.last_name as teacher_last_name FROM classes c LEFT JOIN institutions i ON c.institution_id = i.id LEFT JOIN users u ON c.teacher_id = u.id WHERE c.id = $1',
      [class_id]
    );
    
    if (classRows.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Class not found' });
    }
    
    const classInfo = classRows[0];
    
    // Check access permissions
    // Use Number() to coerce IDs — DB returns integers, JWT may provide strings
    const isOwner = Number(classInfo.teacher_id) === Number(actor_id);
    const isAdmin = actor_role === 'admin' && Number(classInfo.institution_id) === Number(actor_institution_id);
    const isSuperAdmin = actor_role === 'super_admin';
    
    if (!isOwner && !isAdmin && !isSuperAdmin) {
      connection.release();
      return res.status(403).json({ error: 'Access denied to this class' });
    }
    
    // Get enrolled students
    const [students] = await connection.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, ce.joined_at
       FROM class_enrollments ce
       JOIN users u ON ce.user_id = u.id
       WHERE ce.class_id = $1
       ORDER BY u.last_name, u.first_name`,
      [class_id]
    );
    
    // Get unique assignments for this class with aggregated counts
    const [assignmentGroups] = await connection.query(
      `SELECT 
         MIN(a.id) as id,
         a.module_id, 
         a.assignment_type, 
         a.grammar_topic_id, 
         a.writing_task_type, 
         a.instructions, 
         a.due_date,
         MIN(a.created_at) as created_at,
         m.module_name, 
         m.module_type,
         COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_count,
         COUNT(a.student_id) as total_assigned
       FROM assigned_tasks a
       JOIN learning_modules m ON a.module_id = m.id
       WHERE a.class_id = $1 AND a.student_id IS NOT NULL
       GROUP BY a.module_id, a.assignment_type, a.grammar_topic_id, a.writing_task_type, 
                a.instructions, a.due_date, m.module_name, m.module_type
       ORDER BY MIN(a.created_at) DESC`,
      [class_id]
    );
    
    // For each assignment group, get the student submission details
    const assignments = [];
    for (const assignment of assignmentGroups) {
      const [studentSubmissions] = await connection.query(
        `SELECT 
           a.id as assignment_id,
           a.student_id,
           a.status,
           u.first_name as student_first_name,
           u.last_name as student_last_name
         FROM assigned_tasks a
         JOIN users u ON a.student_id = u.id
         WHERE a.class_id = $1 
           AND a.module_id = $2 
           AND a.assignment_type = $3
           AND (a.grammar_topic_id = $4 OR (a.grammar_topic_id IS NULL AND $4 IS NULL))
           AND (a.instructions = $5 OR (a.instructions IS NULL AND $5 IS NULL))
           AND (a.due_date = $6 OR (a.due_date IS NULL AND $6 IS NULL))
         ORDER BY u.last_name, u.first_name`,
        [class_id, assignment.module_id, assignment.assignment_type, assignment.grammar_topic_id, assignment.instructions, assignment.due_date]
      );
      
      assignments.push({
        ...assignment,
        student_submissions: studentSubmissions
      });
    }
    
    connection.release();
    
    res.json({
      class: classInfo,
      students,
      assignments
    });
  } catch (error) {
    console.error('Fetch class details error:', error);
    res.status(500).json({ error: 'Server error fetching class details' });
  }
});

// @route   DELETE api/classes/leave
// @desc    Hard remove a student from a class and clean incomplete assignments
// @access  Private (Student only)
router.delete('/leave', auth, async (req, res) => {
  const user_id = req.user.id;

  try {
    const connection = await pool.getConnection();

    // Get all enrolled class_ids before removal
    const [enrollments] = await connection.query('SELECT class_id FROM class_enrollments WHERE user_id = $1', [user_id]);
    if (enrollments.length === 0) {
      connection.release();
      return res.status(400).json({ error: 'You are not enrolled in any class' });
    }
    const classIds = enrollments.map(e => e.class_id);

    // Delete all enrollments
    await connection.query('DELETE FROM class_enrollments WHERE user_id = $1', [user_id]);

    // Clean up incomplete assigned_tasks from all enrolled classes
    // Note: We identify class-originated tasks by joining through assignments that were assigned to the class (student_id IS NULL)
    const [result] = await connection.query(
      `DELETE FROM assigned_tasks
       WHERE student_id = $1
         AND status = 'pending'
         AND (teacher_id, module_id, assignment_type, grammar_topic_id) IN (
           SELECT teacher_id, module_id, assignment_type, grammar_topic_id
           FROM assigned_tasks
           WHERE student_id IS NULL AND class_id = ANY($2)
         )`,
      [user_id, classIds]
    );

    connection.release();
    res.json({
      success: true,
      message: 'Successfully left all classes and cleaned incomplete assignments',
      classesLeft: classIds.length,
      cleanedAssignments: result.rowCount
    });
  } catch (error) {
    console.error('Leave class error:', error);
    res.status(500).json({ error: 'Server error leaving class' });
  }
});

module.exports = router;
