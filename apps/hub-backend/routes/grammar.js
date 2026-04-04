const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { pool } = require('../db');
const { gradeGrammarActivity } = require('../services/aiService');

// Error category to pathway mapping
const ERROR_CATEGORY_TO_PATHWAY = {
  'Tense Consistency': 'The Time Matrix',
  'Present Perfect vs. Past Simple': 'The Time Matrix',
  'Subject-Verb Agreement': 'The Time Matrix',
  'Sentence Boundaries (Fragments/Comma Splices)': 'The Architecture',
  'Relative Clauses': 'The Architecture',
  'Subordination': 'The Architecture',
  'Word Order': 'The Architecture',
  'Parallel Structure': 'The Architecture',
  'Transitional Devices': 'The Connectors',
  'Prepositional Accuracy': 'The Connectors',
  'Article Usage': 'The Modifiers',
  'Countability & Plurals': 'The Modifiers',
  'Word Forms': 'The Modifiers',
  'Pronoun Reference': 'The Modifiers',
  'Gerunds vs. Infinitives': 'The Nuance',
  'Passive Voice Construction': 'The Nuance',
  'Collocations': 'The Nuance',
  'Academic Register': 'The Nuance',
  'Nominalization': 'The Nuance',
  'Hedging': 'The Nuance'
};

// Error tag to region mapping for weakness-based recommendations
const ERROR_TAG_TO_REGION = {
  'tense_consistency': 'The Time Matrix',
  'present_perfect_past_simple': 'The Time Matrix',
  'passive_voice': 'The Time Matrix',
  'sentence_boundaries': 'The Architecture',
  'relative_clauses': 'The Architecture',
  'subordination': 'The Architecture',
  'word_order': 'The Architecture',
  'parallel_structure': 'The Architecture',
  'transitional_devices': 'The Connectors',
  'prepositional_accuracy': 'The Connectors',
  'article_usage': 'The Modifiers',
  'subject_verb_agreement': 'The Modifiers',
  'countability_and_plurals': 'The Modifiers',
  'word_forms': 'The Modifiers',
  'pronoun_reference': 'The Modifiers',
  'hedging': 'The Nuance',
  'academic_register': 'The Nuance',
  'gerunds_infinitives': 'The Nuance',
  'nominalization': 'The Nuance',
  'collocations': 'The Nuance'
};

// GET /api/grammar/regions - Get all 5 macro-regions with node counts
router.get('/regions', auth, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    try {
      // Get all regions with node counts
      const [regions] = await connection.query(`
        SELECT 
          region,
          COUNT(*) as total_nodes,
          COUNT(CASE WHEN tier = 'Bronze' THEN 1 END) as bronze_count,
          COUNT(CASE WHEN tier = 'Silver' THEN 1 END) as silver_count,
          COUNT(CASE WHEN tier = 'Gold' THEN 1 END) as gold_count
        FROM grammar_nodes
        WHERE tier != 'Diagnostic'
        GROUP BY region
        ORDER BY region
      `);

      // Get user's progress for each region
      const [userProgress] = await connection.query(`
        SELECT 
          gn.region,
          COUNT(CASE WHEN ugp.status = 'completed' THEN 1 END) as completed_nodes,
          COUNT(CASE WHEN ugp.status = 'in_progress' THEN 1 END) as in_progress_nodes
        FROM grammar_nodes gn
        LEFT JOIN user_grammar_progress ugp ON gn.node_id = ugp.node_id AND ugp.user_id = $1
        WHERE gn.tier != 'Diagnostic'
        GROUP BY gn.region
      `, [req.user.id]);

      // Combine data
      const regionData = regions.map(region => {
        const progress = userProgress.find(p => p.region === region.region) || { completed_nodes: 0, in_progress_nodes: 0 };
        return {
          region: region.region,
          total_nodes: parseInt(region.total_nodes),
          completed_nodes: parseInt(progress.completed_nodes),
          in_progress_nodes: parseInt(progress.in_progress_nodes),
          bronze_count: parseInt(region.bronze_count),
          silver_count: parseInt(region.silver_count),
          gold_count: parseInt(region.gold_count)
        };
      });

      res.json({ regions: regionData });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching regions:', error);
    res.status(500).json({ error: 'Failed to fetch regions' });
  }
});

// GET /api/grammar/regions/:regionName - Get all nodes for a specific region
router.get('/regions/:regionName', auth, async (req, res) => {
  try {
    const { regionName } = req.params;
    const connection = await pool.getConnection();
    
    try {
      // Convert URL slug (e.g. "the-time-matrix") to match DB region name (e.g. "The Time Matrix")
      // Use case-insensitive comparison with hyphens replaced by spaces
      const regionSearch = regionName.replace(/-/g, ' ');

      // Debug: log what regions exist in the database
      const [allRegions] = await connection.query(`SELECT DISTINCT region FROM grammar_nodes`);
      console.log('[DEBUG] regionName param:', regionName);
      console.log('[DEBUG] regionSearch:', regionSearch);
      console.log('[DEBUG] All regions in DB:', allRegions.map(r => r.region));

      // Get all nodes for the region
      const [nodes] = await connection.query(`
        SELECT 
          gn.node_id,
          gn.region,
          gn.tier,
          gn.title,
          gn.description,
          gn.display_order,
          gn.content_json->>'prerequisites' as prerequisites,
          COALESCE(ugp.status, 'locked') as status,
          ugp.attempts,
          ugp.last_score,
          ugp.completed_at
        FROM grammar_nodes gn
        LEFT JOIN user_grammar_progress ugp ON gn.node_id = ugp.node_id AND ugp.user_id = $1
        WHERE LOWER(gn.region) = LOWER($2)
        ORDER BY gn.display_order, gn.node_id
      `, [req.user.id, regionSearch]);

      console.log('[DEBUG] Nodes found:', nodes.length);
      if (nodes.length > 0) {
        console.log('[DEBUG] First node:', nodes[0].node_id, nodes[0].region);
      }

      // Also try a direct count query to rule out JOIN issues
      const [countResult] = await connection.query(
        `SELECT COUNT(*) as cnt FROM grammar_nodes WHERE LOWER(region) = LOWER($1)`,
        [regionSearch]
      );
      console.log('[DEBUG] Direct count (no JOIN):', countResult[0]?.cnt);

      const isStaffUser = ['teacher', 'admin', 'super_admin'].includes(req.user.role);
      // Parse prerequisites and determine unlocked status
      const nodesWithStatus = nodes.map(node => ({
        ...node,
        prerequisites: node.prerequisites ? JSON.parse(node.prerequisites) : [],
        attempts: parseInt(node.attempts) || 0,
        last_score: parseInt(node.last_score) || null,
        status: isStaffUser ? 'unlocked' : node.status
      }));

      res.json({ nodes: nodesWithStatus });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching region nodes:', error);
    res.status(500).json({ error: 'Failed to fetch region nodes' });
  }
});

// GET /api/grammar/nodes/:nodeId - Get full node content (lazy-loaded)
router.get('/nodes/:nodeId', auth, async (req, res) => {
  try {
    const { nodeId } = req.params;
    const connection = await pool.getConnection();
    
    try {
      // Get node with full content
      const [nodes] = await connection.query(`
        SELECT 
          gn.*,
          COALESCE(ugp.status, 'locked') as user_status,
          ugp.attempts,
          ugp.last_score,
          ugp.last_attempt_at,
          ugp.completed_at
        FROM grammar_nodes gn
        LEFT JOIN user_grammar_progress ugp ON gn.node_id = ugp.node_id AND ugp.user_id = $1
        WHERE gn.node_id = $2
      `, [req.user.id, nodeId]);

      if (nodes.length === 0) {
        return res.status(404).json({ error: 'Node not found' });
      }

      const node = nodes[0];
      
      // Parse content_json
      const content = typeof node.content_json === 'string' 
        ? JSON.parse(node.content_json) 
        : node.content_json;

      const isStaffViewer = ['teacher', 'admin', 'super_admin'].includes(req.user.role);
      res.json({
        node_id: node.node_id,
        region: node.region,
        tier: node.tier,
        title: node.title,
        description: node.description,
        display_order: node.display_order,
        prerequisites: content.prerequisites || [],
        lesson_content_markdown: content.lesson_content_markdown || '',
        mastery_check: content.mastery_check || {},
        rewards: content.rewards || {},
        user_status: isStaffViewer ? 'unlocked' : node.user_status,
        attempts: parseInt(node.attempts) || 0,
        last_score: parseInt(node.last_score) || null,
        last_attempt_at: node.last_attempt_at,
        completed_at: node.completed_at
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching node:', error);
    res.status(500).json({ error: 'Failed to fetch node' });
  }
});

// GET /api/grammar/progress - Get user's progress across all nodes
router.get('/progress', auth, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    try {
      // Get overall progress and total mastery points
      const [progress] = await connection.query(`
        SELECT 
          COUNT(*) as total_nodes,
          COUNT(CASE WHEN ugp.status = 'completed' THEN 1 END) as completed_nodes,
          COUNT(CASE WHEN ugp.status = 'in_progress' THEN 1 END) as in_progress_nodes,
          COUNT(CASE WHEN ugp.status = 'unlocked' THEN 1 END) as unlocked_nodes,
          (SELECT COALESCE(SUM(mastery_points), 0) FROM user_mastery_stats WHERE user_id = $1) as mastery_points
        FROM grammar_nodes gn
        LEFT JOIN user_grammar_progress ugp ON gn.node_id = ugp.node_id AND ugp.user_id = $1
        WHERE gn.tier != 'Diagnostic'
      `, [req.user.id]);

      // Get mastery stats by region
      const [stats] = await connection.query(`
        SELECT * FROM user_mastery_stats
        WHERE user_id = $1
        ORDER BY region
      `, [req.user.id]);

      // Check if diagnostic is completed
      const [diagnostic] = await connection.query(`
        SELECT status FROM user_grammar_progress
        WHERE user_id = $1 AND node_id = 'node-0-diagnostic'
      `, [req.user.id]);

      const isStaff = ['teacher', 'admin', 'super_admin'].includes(req.user.role);
      res.json({
        overall: progress[0],
        by_region: stats,
        diagnostic_completed: isStaff ? true : (diagnostic.length > 0 && diagnostic[0].status === 'completed')
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching progress:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// POST /api/grammar/submit - Submit mastery check attempt
router.post('/submit', auth, async (req, res) => {
  try {
    const { node_id, activity_type, user_response, mastery_check } = req.body;
    console.log('[DEBUG] Submit received:', { node_id, activity_type, user_response });
    const connection = await pool.getConnection();
    
    try {
      let score = 0;
      let passed = false;
      let feedback = null;
      let results = [];
      let correctAnswers = [];

      // Grade based on activity type
      if (activity_type === 'ai_graded_text_input') {
        // Use AI grading
        const aiResult = await gradeGrammarActivity(
          user_response.text,
          mastery_check.ai_grading_rubric,
          activity_type
        );
        score = aiResult.score;
        passed = aiResult.passed;
        feedback = aiResult.feedback;

      } else if (activity_type === 'multiple_choice') {
        // Grade multiple choice
        const questions = mastery_check.activity_data.questions;
        let correct = 0;
        
        // Validate user_response.answers exists and is an array
        if (!user_response.answers || !Array.isArray(user_response.answers)) {
          throw new Error('Invalid user_response: answers array is missing or invalid');
        }
        
        console.log('[DEBUG] Grading multiple choice:', {
          totalQuestions: questions.length,
          userAnswers: user_response.answers,
          correctAnswers: questions.map(q => q.correct_answer)
        });
        
        // Resolve correct_answer: may be an integer index, a string, or an array of strings
        const resolveAnswer = (q) => {
          if (typeof q.correct_answer === 'number') return [q.options[q.correct_answer]];
          if (Array.isArray(q.correct_answer)) return q.correct_answer;
          if (q.correct_answer) return [q.correct_answer];
          return [];
        };

        for (let i = 0; i < questions.length; i++) {
          const accepted = resolveAnswer(questions[i]).map(a => a.toLowerCase());
          const match = accepted.includes((user_response.answers[i] || '').toLowerCase());
          console.log(`[DEBUG] Q${i}: "${user_response.answers[i]}" in [${accepted.join(', ')}] = ${match}`);
          if (match) {
            correct++;
          }
        }
        
        score = Math.round((correct / questions.length) * 100);
        passed = score >= 80;
        feedback = `You answered ${correct} out of ${questions.length} questions correctly.`;
        
        // Detailed results for MC
        results = questions.map((q, i) => {
          const accepted = resolveAnswer(q).map(a => String(a).toLowerCase());
          return accepted.includes(String(user_response.answers[i] || '').toLowerCase());
        });
        correctAnswers = questions.map(q => {
          const answers = resolveAnswer(q);
          return answers.length > 0 ? answers[0] : '';
        });

        console.log('[DEBUG] Final score:', { correct, total: questions.length, score, passed });

        // Track weaknesses for diagnostic
        if (node_id === 'node-0-diagnostic') {
          const wrongAnswers = [];
          
          for (let i = 0; i < questions.length; i++) {
            const correctAnswer = resolveAnswer(questions[i]);
            if (!correctAnswer.includes((user_response.answers[i] || '').toLowerCase())) {
              wrongAnswers.push({
                question_index: i,
                error_tag: questions[i].error_tag,
                category: questions[i].category
              });
            }
          }
          
          // UPSERT into user_weaknesses table
          for (const wrong of wrongAnswers) {
            if (wrong.error_tag) {
              await connection.query(`
                INSERT INTO user_weaknesses (user_id, category, error_count, last_updated)
                VALUES ($1, $2, 1, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id, category)
                DO UPDATE SET
                  error_count = user_weaknesses.error_count + 1,
                  last_updated = CURRENT_TIMESTAMP
              `, [req.user.id, wrong.error_tag]);
            }
          }
        }

      } else if (activity_type === 'fill_in_the_blank') {
        const questions = mastery_check.activity_data.questions || mastery_check.activity_data.blanks || [];
        let correct = 0;
        
        if (!user_response.answers || !Array.isArray(user_response.answers)) {
          throw new Error('Invalid user_response: answers array is missing or invalid');
        }
        
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          const userAnswer = (user_response.answers[i] || '').trim().toLowerCase();
          
          // Hybrid support for new 'correct_answer' (string or array) and old 'accepted_answers' formats
          let accepted = [];
          if (Array.isArray(q.correct_answer)) {
            accepted = q.correct_answer.map(a => a.toLowerCase());
          } else if (q.correct_answer) {
            accepted = [q.correct_answer.toLowerCase()];
          } else {
            accepted = (q.accepted_answers || []).map(a => a.toLowerCase());
          }
          
          if (accepted.includes(userAnswer)) {
            correct++;
          }
        }
        
        score = Math.round((correct / questions.length) * 100);
        passed = score >= 80;
        feedback = `You filled ${correct} out of ${questions.length} blanks correctly.`;
        
        // Detailed results for Fill in the Blank
        results = questions.map((q, i) => {
          const userAnswer = (user_response.answers[i] || '').trim().toLowerCase();
          let accepted = [];
          if (Array.isArray(q.correct_answer)) {
            accepted = q.correct_answer.map(a => a.toLowerCase());
          } else if (q.correct_answer) {
            accepted = [q.correct_answer.toLowerCase()];
          } else {
            accepted = (q.accepted_answers || []).map(a => a.toLowerCase());
          }
          return accepted.includes(userAnswer);
        });
        const getFirstCorrect = (q) => {
          if (Array.isArray(q.correct_answer)) return q.correct_answer[0];
          return q.correct_answer || (q.accepted_answers && q.accepted_answers[0]) || '';
        };
        correctAnswers = questions.map(getFirstCorrect);

      } else if (activity_type === 'error_correction') {
        const questions = mastery_check.activity_data.questions || mastery_check.activity_data.errors || [];
        let correct = 0;
        
        if (!user_response.corrections || !Array.isArray(user_response.corrections)) {
          throw new Error('Invalid user_response: corrections array is missing or invalid');
        }
        
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          const userAnswer = (user_response.corrections[i] || '').trim().toLowerCase();
          
          // Hybrid support for new 'correct_answer' (string or array) and old 'accepted_corrections' formats
          let accepted = [];
          if (Array.isArray(q.correct_answer)) {
            accepted = q.correct_answer.map(a => a.toLowerCase());
          } else if (q.correct_answer) {
            accepted = [q.correct_answer.toLowerCase()];
          } else {
            accepted = (q.accepted_corrections || []).map(a => a.toLowerCase());
          }
          
          if (accepted.includes(userAnswer)) {
            correct++;
          }
        }
        
        score = Math.round((correct / questions.length) * 100);
        passed = score >= 80;
        feedback = `You corrected ${correct} out of ${questions.length} errors correctly.`;
        
        // Detailed results for Error Correction
        results = questions.map((q, i) => {
          const userAnswer = (user_response.corrections[i] || '').trim().toLowerCase();
          let accepted = [];
          if (Array.isArray(q.correct_answer)) {
            accepted = q.correct_answer.map(a => a.toLowerCase());
          } else if (q.correct_answer) {
            accepted = [q.correct_answer.toLowerCase()];
          } else {
            accepted = (q.accepted_corrections || []).map(a => a.toLowerCase());
          }
          return accepted.includes(userAnswer);
        });
        const getFirstCorrect = (q) => {
          if (Array.isArray(q.correct_answer)) return q.correct_answer[0];
          return q.correct_answer || (q.accepted_corrections && q.accepted_corrections[0]) || '';
        };
        correctAnswers = questions.map(getFirstCorrect);
      } else if (activity_type === 'standard_mixed') {
        const questions = mastery_check.activity_data.questions;
        let correct = 0;
        
        if (!user_response.answers || !Array.isArray(user_response.answers)) {
          throw new Error('Invalid user_response: answers array is missing or invalid');
        }

        const resolveAnswer = (q) => {
          if (typeof q.correct_answer === 'number') return [q.options[q.correct_answer]];
          if (Array.isArray(q.correct_answer)) return q.correct_answer;
          if (q.correct_answer) return [q.correct_answer];
          // Fallbacks for older formats if they appear in mixed
          if (q.accepted_answers) return q.accepted_answers;
          if (q.accepted_corrections) return q.accepted_corrections;
          return [];
        };

        results = [];
        correctAnswers = [];

        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          const userAnswer = (user_response.answers[i] || '').trim().toLowerCase();
          const accepted = resolveAnswer(q).map(a => String(a).toLowerCase());
          const isMatch = accepted.includes(userAnswer);
          
          if (isMatch) correct++;
          results.push(isMatch);
          
          const answers = resolveAnswer(q);
          correctAnswers.push(answers.length > 0 ? answers[0] : '');
        }

        score = Math.round((correct / questions.length) * 100);
        passed = score >= 80;
        feedback = `Final Defense Results: ${correct} out of ${questions.length} successful.`;
      }

      // Save submission
      await connection.query(`
        INSERT INTO grammar_activity_submissions (
          user_id, node_id, activity_type, user_response, ai_feedback, score, passed
        ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7)
      `, [
        req.user.id,
        node_id,
        activity_type,
        JSON.stringify(user_response),
        JSON.stringify({ feedback }),
        score,
        passed
      ]);

      // Update user progress
      const [existing] = await connection.query(`
        SELECT * FROM user_grammar_progress
        WHERE user_id = $1 AND node_id = $2
      `, [req.user.id, node_id]);

      if (existing.length > 0) {
        // Update existing progress
        await connection.query(`
          UPDATE user_grammar_progress
          SET 
            attempts = attempts + 1,
            last_score = $1,
            last_attempt_at = CURRENT_TIMESTAMP,
            status = $2,
            completed_at = CASE WHEN $2::varchar = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END,
            updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $3 AND node_id = $4
        `, [score, (node_id === 'node-0-diagnostic' || passed) ? 'completed' : 'in_progress', req.user.id, node_id]);
      } else {
        // Create new progress record
        await connection.query(`
          INSERT INTO user_grammar_progress (
            user_id, node_id, status, attempts, last_score, last_attempt_at, completed_at
          ) VALUES ($1, $2, $3, 1, $4, CURRENT_TIMESTAMP, $5)
        `, [
          req.user.id,
          node_id,
          (node_id === 'node-0-diagnostic' || passed) ? 'completed' : 'in_progress',
          score,
          (node_id === 'node-0-diagnostic' || passed) ? new Date() : null
        ]);
      }

      // If diagnostic just completed, unlock all entry-level nodes (no prerequisites)
      if (node_id === 'node-0-diagnostic') {
        const [entryNodes] = await connection.query(`
          SELECT node_id FROM grammar_nodes
          WHERE content_json->'prerequisites' = '[]'::jsonb
          AND tier != 'Diagnostic'
        `);
        for (const entryNode of entryNodes) {
          await connection.query(`
            INSERT INTO user_grammar_progress (user_id, node_id, status)
            VALUES ($1, $2, 'unlocked')
            ON CONFLICT (user_id, node_id) DO NOTHING
          `, [req.user.id, entryNode.node_id]);
        }
      }

      // If passed, unlock dependent nodes and update mastery stats
      if (passed) {
        // Get node details
        const [nodeDetails] = await connection.query(`
          SELECT region, tier, content_json FROM grammar_nodes WHERE node_id = $1
        `, [node_id]);

        if (nodeDetails && nodeDetails.length > 0) {
          const { region, tier, content_json } = nodeDetails[0];
          const content = typeof content_json === 'string' ? JSON.parse(content_json) : content_json;
          const pointsAwarded = content.rewards?.mastery_points || 100;
          
          // Update or create mastery stats
          const medalField = tier === 'Bronze' ? 'bronze_medals' 
                           : tier === 'Silver' ? 'silver_medals' 
                           : tier === 'Gold' ? 'gold_medals' : null;

          if (medalField) {
            await connection.query(`
              INSERT INTO user_mastery_stats (
                user_id, region, nodes_completed, ${medalField}, mastery_points, last_activity_at
              ) VALUES ($1, $2, 1, 1, $3, CURRENT_TIMESTAMP)
              ON CONFLICT (user_id, region)
              DO UPDATE SET
                nodes_completed = user_mastery_stats.nodes_completed + 1,
                ${medalField} = user_mastery_stats.${medalField} + 1,
                mastery_points = user_mastery_stats.mastery_points + $3,
                last_activity_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            `, [req.user.id, region, pointsAwarded]);
          }
        }

        // Find and unlock nodes that have this as a prerequisite
        const [dependentNodes] = await connection.query(`
          SELECT node_id, content_json FROM grammar_nodes
          WHERE content_json::jsonb->'prerequisites' @> $1::jsonb
        `, [JSON.stringify([node_id])]);

        for (const depNode of dependentNodes) {
          // Check if all prerequisites are met
          const content = typeof depNode.content_json === 'string' 
            ? JSON.parse(depNode.content_json) 
            : depNode.content_json;
          const prerequisites = content.prerequisites || [];
          
          const [completedPrereqs] = await connection.query(`
            SELECT COUNT(*) as count FROM user_grammar_progress
            WHERE user_id = $1 AND node_id = ANY($2) AND status = 'completed'
          `, [req.user.id, prerequisites]);

          if (parseInt(completedPrereqs[0].count) === prerequisites.length) {
            // Unlock the node
            await connection.query(`
              INSERT INTO user_grammar_progress (user_id, node_id, status)
              VALUES ($1, $2, 'unlocked')
              ON CONFLICT (user_id, node_id) DO NOTHING
            `, [req.user.id, depNode.node_id]);
          }
        }
      }

      // If passed, record a milestone in student_scores for Recent Activity
      if (passed && node_id !== 'node-0-diagnostic') {
        try {
          const nodeLabel = nodeDetails && nodeDetails.length > 0
            ? `${node_id} (${nodeDetails[0].region} – ${nodeDetails[0].tier})`
            : node_id;

          // Find or create grammar-world module
          let gwModuleId;
          const [gwModules] = await connection.query("SELECT id FROM learning_modules WHERE module_type = 'grammar-world' LIMIT 1");
          if (gwModules.length === 0) {
            const [insertRes] = await connection.query(
              "INSERT INTO learning_modules (module_name, module_type, description) VALUES ('Grammar World', 'grammar-world', 'Grammar mastery node completions.') RETURNING id"
            );
            gwModuleId = insertRes[0]?.id ?? insertRes.insertId;
          } else {
            gwModuleId = gwModules[0].id;
          }

          await connection.query(
            `INSERT INTO student_scores (student_id, module_id, submitted_text, word_count, overall_score, ai_feedback, diagnostic_data)
             VALUES ($1, $2, $3, 0, $4, $5, '[]')`,
            [req.user.id, gwModuleId, `Grammar World – ${nodeLabel}`, score, JSON.stringify({ feedback })]
          );
        } catch (milestoneErr) {
          // Non-blocking: don't fail the response if milestone save fails
          console.error('[Grammar] Failed to save milestone to student_scores:', milestoneErr.message);
        }
      }

      res.json({ score, passed, feedback, results, correctAnswers });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error(`[ERROR] Grammar submit failed for user ${req.user?.id}, node ${req.body?.node_id}:`, error);
    console.error('Error stack:', error.stack);
    console.error('Error code:', error.code);
    console.error('Error detail:', error.detail);
    if (error.query) console.error('Failed query:', error.query);
    res.status(500).json({ 
      error: 'Failed to submit mastery check',
      details: error.message
    });
  }
});

// GET /api/grammar/recommendations - Get recommended region based on weaknesses
router.get('/recommendations', auth, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    try {
      // Check if diagnostic is completed
      const [diagnostic] = await connection.query(`
        SELECT status FROM user_grammar_progress
        WHERE user_id = $1 AND node_id = 'node-0-diagnostic'
      `, [req.user.id]);

      if (diagnostic.length === 0 || diagnostic[0].status !== 'completed') {
        return res.json({ 
          recommended_region: null,
          reason: 'diagnostic_required',
          message: 'Please complete the diagnostic assessment first.'
        });
      }

      // Get user's grammar weaknesses from user_weaknesses table
      const [weaknesses] = await connection.query(`
        SELECT category, error_count
        FROM user_weaknesses
        WHERE user_id = $1
        ORDER BY error_count DESC
      `, [req.user.id]);

      if (weaknesses.length === 0) {
        // No weakness data, default to Time Matrix
        return res.json({
          recommended_region: 'The Time Matrix',
          reason: 'default',
          message: 'Start with The Time Matrix to build a strong foundation.'
        });
      }

      // Map error tags to regions and aggregate counts
      const regionTotals = {};
      weaknesses.forEach(w => {
        const region = ERROR_TAG_TO_REGION[w.category];
        if (region) {
          regionTotals[region] = (regionTotals[region] || 0) + parseInt(w.error_count);
        }
      });

      // Find region with highest error count
      let recommendedRegion = 'The Time Matrix';
      let maxCount = 0;
      
      for (const [region, count] of Object.entries(regionTotals)) {
        if (count > maxCount) {
          maxCount = count;
          recommendedRegion = region;
        }
      }

      res.json({
        recommended_region: recommendedRegion,
        reason: 'weakness_based',
        message: `Based on your grammar weaknesses, we recommend starting with ${recommendedRegion}.`,
        weakness_details: weaknesses.slice(0, 5).map(w => ({
          error_tag: w.category,
          error_count: w.error_count,
          region: ERROR_TAG_TO_REGION[w.category] || 'Unknown'
        }))
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error getting recommendations:', error);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

// POST /api/grammar/diagnostic/complete - Mark diagnostic as complete
router.post('/diagnostic/complete', auth, async (req, res) => {
  try {
    const { results } = req.body; // Array of category: score pairs
    const connection = await pool.getConnection();
    
    try {
      // Update diagnostic status
      await connection.query(`
        INSERT INTO user_grammar_progress (user_id, node_id, status, completed_at)
        VALUES ($1, 'node-0-diagnostic', 'completed', CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, node_id)
        DO UPDATE SET status = 'completed', completed_at = CURRENT_TIMESTAMP
      `, [req.user.id]);

      // Optionally populate grammar_progress table with diagnostic results
      if (results && results.length > 0) {
        for (const result of results) {
          await connection.query(`
            INSERT INTO grammar_progress (student_id, error_category, current_level, exercises_completed)
            VALUES ($1, $2, $3, 0)
            ON CONFLICT (student_id, error_category) DO NOTHING
          `, [req.user.id, result.category, result.level || 1]);
        }
      }

      res.json({ success: true, message: 'Diagnostic completed successfully' });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error completing diagnostic:', error);
    res.status(500).json({ error: 'Failed to complete diagnostic' });
  }
});

// ==================== ADMIN/TEACHER ROUTES ====================

// GET /api/grammar/admin/cohort-progress - Aggregate cohort completion data
router.get('/admin/cohort-progress', auth, requireRole('teacher', 'admin', 'super_admin'), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    try {
      const actorInstitutionId = req.user.institution_id;
      const isSuperAdmin = req.user.role === 'super_admin';
      
      // Get total students who have started grammar world (tenant-isolated)
      let totalStudentsQuery, totalStudentsParams;
      if (isSuperAdmin) {
        totalStudentsQuery = `
          SELECT COUNT(DISTINCT ugp.user_id) as total
          FROM user_grammar_progress ugp
        `;
        totalStudentsParams = [];
      } else {
        totalStudentsQuery = `
          SELECT COUNT(DISTINCT ugp.user_id) as total
          FROM user_grammar_progress ugp
          JOIN users u ON ugp.user_id = u.id
          WHERE u.institution_id = $1
        `;
        totalStudentsParams = [actorInstitutionId];
      }
      const [totalStudents] = await connection.query(totalStudentsQuery, totalStudentsParams);

      // Get diagnostic completion count (tenant-isolated)
      let diagnosticQuery, diagnosticParams;
      if (isSuperAdmin) {
        diagnosticQuery = `
          SELECT COUNT(DISTINCT ugp.user_id) as count
          FROM user_grammar_progress ugp
          WHERE ugp.node_id = 'node-0-diagnostic' AND ugp.status = 'completed'
        `;
        diagnosticParams = [];
      } else {
        diagnosticQuery = `
          SELECT COUNT(DISTINCT ugp.user_id) as count
          FROM user_grammar_progress ugp
          JOIN users u ON ugp.user_id = u.id
          WHERE ugp.node_id = 'node-0-diagnostic' AND ugp.status = 'completed'
            AND u.institution_id = $1
        `;
        diagnosticParams = [actorInstitutionId];
      }
      const [diagnosticComplete] = await connection.query(diagnosticQuery, diagnosticParams);

      // Get completion rates by region (tenant-isolated)
      let regionQuery, regionParams;
      if (isSuperAdmin) {
        regionQuery = `
          SELECT 
            gn.region,
            COUNT(DISTINCT gn.node_id) as total_nodes,
            COUNT(DISTINCT ugp.node_id) as completed_nodes,
            ROUND(COUNT(DISTINCT ugp.node_id) * 100.0 / COUNT(DISTINCT gn.node_id), 2) as completion_rate
          FROM grammar_nodes gn
          LEFT JOIN user_grammar_progress ugp ON gn.node_id = ugp.node_id AND ugp.status = 'completed'
          WHERE gn.tier != 'Diagnostic'
          GROUP BY gn.region
          ORDER BY gn.region
        `;
        regionParams = [];
      } else {
        regionQuery = `
          SELECT 
            gn.region,
            COUNT(DISTINCT gn.node_id) as total_nodes,
            COUNT(DISTINCT CASE WHEN u.institution_id = $1 THEN ugp.node_id END) as completed_nodes,
            ROUND(COUNT(DISTINCT CASE WHEN u.institution_id = $1 THEN ugp.node_id END) * 100.0 / COUNT(DISTINCT gn.node_id), 2) as completion_rate
          FROM grammar_nodes gn
          LEFT JOIN user_grammar_progress ugp ON gn.node_id = ugp.node_id AND ugp.status = 'completed'
          LEFT JOIN users u ON ugp.user_id = u.id
          WHERE gn.tier != 'Diagnostic'
          GROUP BY gn.region
          ORDER BY gn.region
        `;
        regionParams = [actorInstitutionId];
      }
      const [regionProgress] = await connection.query(regionQuery, regionParams);

      // Get total mastery points earned (tenant-isolated)
      let masteryQuery, masteryParams;
      if (isSuperAdmin) {
        masteryQuery = `
          SELECT COALESCE(SUM(mastery_points), 0) as total_mastery_points
          FROM user_mastery_stats
        `;
        masteryParams = [];
      } else {
        masteryQuery = `
          SELECT COALESCE(SUM(ums.mastery_points), 0) as total_mastery_points
          FROM user_mastery_stats ums
          JOIN users u ON ums.user_id = u.id
          WHERE u.institution_id = $1
        `;
        masteryParams = [actorInstitutionId];
      }
      const [masteryPoints] = await connection.query(masteryQuery, masteryParams);

      // Get medal distribution (tenant-isolated)
      let medalQuery, medalParams;
      if (isSuperAdmin) {
        medalQuery = `
          SELECT 
            COALESCE(SUM(bronze_medals), 0) as bronze,
            COALESCE(SUM(silver_medals), 0) as silver,
            COALESCE(SUM(gold_medals), 0) as gold
          FROM user_mastery_stats
        `;
        medalParams = [];
      } else {
        medalQuery = `
          SELECT 
            COALESCE(SUM(ums.bronze_medals), 0) as bronze,
            COALESCE(SUM(ums.silver_medals), 0) as silver,
            COALESCE(SUM(ums.gold_medals), 0) as gold
          FROM user_mastery_stats ums
          JOIN users u ON ums.user_id = u.id
          WHERE u.institution_id = $1
        `;
        medalParams = [actorInstitutionId];
      }
      const [medalTotals] = await connection.query(medalQuery, medalParams);

      const medals = [
        { medal_tier: 'Bronze', count: Number(medalTotals[0]?.bronze || 0) },
        { medal_tier: 'Silver', count: Number(medalTotals[0]?.silver || 0) },
        { medal_tier: 'Gold', count: Number(medalTotals[0]?.gold || 0) },
      ];

      // Get top class weaknesses (tenant-isolated)
      let weaknessQuery, weaknessParams;
      if (isSuperAdmin) {
        weaknessQuery = `
          SELECT 
            category as error_tag,
            SUM(error_count) as total_errors,
            COUNT(DISTINCT user_id) as students_affected
          FROM user_weaknesses
          GROUP BY category
          ORDER BY total_errors DESC
          LIMIT 5
        `;
        weaknessParams = [];
      } else {
        weaknessQuery = `
          SELECT 
            uw.category as error_tag,
            SUM(uw.error_count) as total_errors,
            COUNT(DISTINCT uw.user_id) as students_affected
          FROM user_weaknesses uw
          JOIN users u ON uw.user_id = u.id
          WHERE u.institution_id = $1
          GROUP BY uw.category
          ORDER BY total_errors DESC
          LIMIT 5
        `;
        weaknessParams = [actorInstitutionId];
      }
      const [topWeaknesses] = await connection.query(weaknessQuery, weaknessParams);

      res.json({
        total_students: Number(totalStudents[0]?.total || 0),
        diagnostic_completed: Number(diagnosticComplete[0]?.count || 0),
        region_progress: regionProgress,
        total_mastery_points: Number(masteryPoints[0]?.total_mastery_points || 0),
        medals: medals,
        top_class_weaknesses: topWeaknesses
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error getting cohort progress:', error);
    res.status(500).json({ error: 'Failed to get cohort progress' });
  }
});

// GET /api/grammar/admin/heat-map - Find bottleneck nodes
router.get('/admin/heat-map', auth, requireRole('teacher', 'admin', 'super_admin'), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    try {
      // Find nodes with high failure rates or multiple attempts
      const [bottlenecks] = await connection.query(`
        SELECT 
          gn.node_id,
          gn.title,
          gn.region,
          gn.tier,
          COUNT(DISTINCT gas.user_id) as total_attempts,
          COUNT(DISTINCT CASE WHEN gas.passed = false THEN gas.user_id END) as failed_attempts,
          ROUND(COUNT(CASE WHEN gas.passed = false THEN 1 END) * 100.0 / COUNT(*), 2) as failure_rate,
          ROUND(COUNT(*) * 1.0 / COUNT(DISTINCT gas.user_id), 2) as avg_attempts_per_student
        FROM grammar_nodes gn
        LEFT JOIN grammar_activity_submissions gas ON gn.node_id = gas.node_id
        WHERE gn.tier != 'Diagnostic'
        GROUP BY gn.node_id, gn.title, gn.region, gn.tier
        HAVING COUNT(DISTINCT gas.user_id) > 0
        ORDER BY failure_rate DESC, avg_attempts_per_student DESC
        LIMIT 20
      `);

      res.json({ bottlenecks });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error getting heat map:', error);
    res.status(500).json({ error: 'Failed to get heat map data' });
  }
});

// GET /api/grammar/admin/recent-submissions - Get recent AI-graded submissions
router.get('/admin/recent-submissions', auth, requireRole('teacher', 'admin', 'super_admin'), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    try {
      const [submissions] = await connection.query(`
        SELECT 
          gas.id,
          gas.user_id,
          TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) as student_name,
          u.email as student_email,
          gas.node_id,
          gn.title as node_title,
          gn.region,
          gas.user_response,
          COALESCE(gas.ai_feedback->>'feedback', gas.ai_feedback::text) as ai_feedback,
          gas.score,
          gas.passed,
          gas.submitted_at
        FROM grammar_activity_submissions gas
        JOIN users u ON gas.user_id = u.id
        JOIN grammar_nodes gn ON gas.node_id = gn.node_id
        WHERE gas.activity_type = 'ai_graded_text_input'
        ORDER BY gas.submitted_at DESC
        LIMIT 50
      `);

      res.json({ submissions });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error getting recent submissions:', error);
    res.status(500).json({ error: 'Failed to get recent submissions' });
  }
});

module.exports = router;

// GET /api/grammar/review-questions - Get random questions from completed nodes for spaced repetition
router.get('/review-questions', auth, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    try {
      // Find completed nodes for this user
      const [completed] = await connection.query(`
        SELECT gn.content_json
        FROM grammar_nodes gn
        JOIN user_grammar_progress ugp ON gn.node_id = ugp.node_id
        WHERE ugp.user_id = $1 AND ugp.status = 'completed' AND gn.tier != 'Diagnostic'
      `, [req.user.id]);

      if (completed.length === 0) {
        return res.json({ questions: [] });
      }

      // Collect all questions from completed nodes
      let allQuestions = [];
      completed.forEach(node => {
        const content = typeof node.content_json === 'string' 
          ? JSON.parse(node.content_json) 
          : node.content_json;
          
        if (content.mastery_check && content.mastery_check.activity_data && content.mastery_check.activity_data.questions) {
          allQuestions = allQuestions.concat(content.mastery_check.activity_data.questions);
        }
      });

      // Shuffle and take a few
      const shuffled = allQuestions.sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 10); // Return up to 10, frontend will pick 2-3

      res.json({ questions: selected });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching review questions:', error);
    res.status(500).json({ error: 'Failed to fetch review questions' });
  }
});
