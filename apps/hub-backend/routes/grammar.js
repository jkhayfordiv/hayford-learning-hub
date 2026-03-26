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
        WHERE gn.region = $2
        ORDER BY gn.display_order, gn.node_id
      `, [req.user.id, regionName]);

      // Parse prerequisites and determine unlocked status
      const nodesWithStatus = nodes.map(node => ({
        ...node,
        prerequisites: node.prerequisites ? JSON.parse(node.prerequisites) : [],
        attempts: parseInt(node.attempts) || 0,
        last_score: parseInt(node.last_score) || null
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
        user_status: node.user_status,
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
      // Get overall progress
      const [progress] = await connection.query(`
        SELECT 
          COUNT(*) as total_nodes,
          COUNT(CASE WHEN ugp.status = 'completed' THEN 1 END) as completed_nodes,
          COUNT(CASE WHEN ugp.status = 'in_progress' THEN 1 END) as in_progress_nodes,
          COUNT(CASE WHEN ugp.status = 'unlocked' THEN 1 END) as unlocked_nodes
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

      res.json({
        overall: progress[0],
        by_region: stats,
        diagnostic_completed: diagnostic.length > 0 && diagnostic[0].status === 'completed'
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
    const connection = await pool.getConnection();
    
    try {
      let score = 0;
      let passed = false;
      let feedback = null;

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
        
        for (let i = 0; i < questions.length; i++) {
          if (user_response.answers[i] === questions[i].correct_answer) {
            correct++;
          }
        }
        
        score = Math.round((correct / questions.length) * 100);
        passed = score >= 80;
        feedback = `You answered ${correct} out of ${questions.length} questions correctly.`;

      } else if (activity_type === 'fill_in_the_blank') {
        // Grade fill in the blank with flexible validation
        const blanks = mastery_check.activity_data.blanks;
        let correct = 0;
        
        for (let i = 0; i < blanks.length; i++) {
          const userAnswer = (user_response.answers[i] || '').trim().toLowerCase();
          const acceptedAnswers = blanks[i].accepted_answers.map(a => a.toLowerCase());
          
          if (acceptedAnswers.includes(userAnswer)) {
            correct++;
          }
        }
        
        score = Math.round((correct / blanks.length) * 100);
        passed = score >= 80;
        feedback = `You filled ${correct} out of ${blanks.length} blanks correctly.`;

      } else if (activity_type === 'error_correction') {
        // Grade error correction with flexible validation
        const errors = mastery_check.activity_data.errors;
        let correct = 0;
        
        for (let i = 0; i < errors.length; i++) {
          const userAnswer = (user_response.corrections[i] || '').trim().toLowerCase();
          const acceptedAnswers = errors[i].accepted_corrections.map(a => a.toLowerCase());
          
          if (acceptedAnswers.includes(userAnswer)) {
            correct++;
          }
        }
        
        score = Math.round((correct / errors.length) * 100);
        passed = score >= 80;
        feedback = `You corrected ${correct} out of ${errors.length} errors correctly.`;
      }

      // Save submission
      await connection.query(`
        INSERT INTO grammar_activity_submissions (
          user_id, node_id, activity_type, user_response, ai_feedback, score, passed
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
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
            completed_at = CASE WHEN $2 = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END,
            updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $3 AND node_id = $4
        `, [score, passed ? 'completed' : 'in_progress', req.user.id, node_id]);
      } else {
        // Create new progress record
        await connection.query(`
          INSERT INTO user_grammar_progress (
            user_id, node_id, status, attempts, last_score, last_attempt_at, completed_at
          ) VALUES ($1, $2, $3, 1, $4, CURRENT_TIMESTAMP, $5)
        `, [
          req.user.id,
          node_id,
          passed ? 'completed' : 'in_progress',
          score,
          passed ? new Date() : null
        ]);
      }

      // If passed, unlock dependent nodes and update mastery stats
      if (passed) {
        // Get node details
        const [nodeDetails] = await connection.query(`
          SELECT region, tier FROM grammar_nodes WHERE node_id = $1
        `, [node_id]);

        if (nodeDetails.length > 0) {
          const { region, tier } = nodeDetails[0];
          
          // Update or create mastery stats
          const medalField = tier === 'Bronze' ? 'bronze_medals' 
                           : tier === 'Silver' ? 'silver_medals' 
                           : tier === 'Gold' ? 'gold_medals' : null;

          if (medalField) {
            await connection.query(`
              INSERT INTO user_mastery_stats (
                user_id, region, nodes_completed, ${medalField}, mastery_points, last_activity_at
              ) VALUES ($1, $2, 1, 1, 100, CURRENT_TIMESTAMP)
              ON CONFLICT (user_id, region)
              DO UPDATE SET
                nodes_completed = user_mastery_stats.nodes_completed + 1,
                ${medalField} = user_mastery_stats.${medalField} + 1,
                mastery_points = user_mastery_stats.mastery_points + 100,
                last_activity_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            `, [req.user.id, region]);
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

      res.json({ score, passed, feedback });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error submitting mastery check:', error);
    res.status(500).json({ error: 'Failed to submit mastery check' });
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

      // Get user's grammar weaknesses from grammar_progress table
      const [weaknesses] = await connection.query(`
        SELECT 
          error_category,
          current_level,
          exercises_completed
        FROM grammar_progress
        WHERE student_id = $1
        ORDER BY current_level ASC, exercises_completed ASC
        LIMIT 5
      `, [req.user.id]);

      if (weaknesses.length === 0) {
        // No weakness data, default to Time Matrix
        return res.json({
          recommended_region: 'The Time Matrix',
          reason: 'default',
          message: 'Start with The Time Matrix to build a strong foundation.'
        });
      }

      // Map weaknesses to pathways and count
      const pathwayCounts = {};
      weaknesses.forEach(weakness => {
        const pathway = ERROR_CATEGORY_TO_PATHWAY[weakness.error_category];
        if (pathway) {
          pathwayCounts[pathway] = (pathwayCounts[pathway] || 0) + 1;
        }
      });

      // Find pathway with most weaknesses
      let recommendedRegion = 'The Time Matrix';
      let maxCount = 0;
      
      for (const [pathway, count] of Object.entries(pathwayCounts)) {
        if (count > maxCount) {
          maxCount = count;
          recommendedRegion = pathway;
        }
      }

      res.json({
        recommended_region: recommendedRegion,
        reason: 'weakness_based',
        message: `Based on your grammar weaknesses, we recommend starting with ${recommendedRegion}.`,
        weakness_details: weaknesses.map(w => ({
          category: w.error_category,
          level: w.current_level
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
      // Get total students who have started grammar world
      const [totalStudents] = await connection.query(`
        SELECT COUNT(DISTINCT user_id) as total
        FROM user_grammar_progress
      `);

      // Get diagnostic completion count
      const [diagnosticComplete] = await connection.query(`
        SELECT COUNT(DISTINCT user_id) as count
        FROM user_grammar_progress
        WHERE node_id = 'node-0-diagnostic' AND status = 'completed'
      `);

      // Get completion rates by region
      const [regionProgress] = await connection.query(`
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
      `);

      // Get total mastery points earned globally
      const [masteryPoints] = await connection.query(`
        SELECT COALESCE(SUM(mastery_points), 0) as total_mastery_points
        FROM user_mastery_stats
      `);

      // Get medal distribution
      const [medalTotals] = await connection.query(`
        SELECT 
          COALESCE(SUM(bronze_medals), 0) as bronze,
          COALESCE(SUM(silver_medals), 0) as silver,
          COALESCE(SUM(gold_medals), 0) as gold
        FROM user_mastery_stats
      `);

      const medals = [
        { medal_tier: 'Bronze', count: Number(medalTotals[0]?.bronze || 0) },
        { medal_tier: 'Silver', count: Number(medalTotals[0]?.silver || 0) },
        { medal_tier: 'Gold', count: Number(medalTotals[0]?.gold || 0) },
      ];

      res.json({
        total_students: Number(totalStudents[0]?.total || 0),
        diagnostic_completed: Number(diagnosticComplete[0]?.count || 0),
        region_progress: regionProgress,
        total_mastery_points: Number(masteryPoints[0]?.total_mastery_points || 0),
        medals: medals
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
