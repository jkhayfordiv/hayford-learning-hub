/**
 * Premium Access Guard Middleware
 *
 * Blocks API access unless the user has an active premium subscription.
 * "Active" means subscription_tier = 'premium' AND either:
 *   - current_period_end is NULL (institution-level billing, no expiry tracking), OR
 *   - current_period_end is in the future
 *
 * This always queries the DB so stale JWTs cannot grant access after cancellation.
 *
 * Usage:
 *   router.get('/premium-feature', auth, requirePremium, async (req, res) => { ... });
 */

const { pool } = require('../db');

const requirePremium = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const conn = await pool.getConnection();
    let rows;
    try {
      [rows] = await conn.query(
        'SELECT subscription_tier, current_period_end FROM users WHERE id = $1',
        [req.user.id]
      );
    } finally {
      conn.release();
    }

    if (!rows || rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const { subscription_tier, current_period_end } = rows[0];

    const isPremium = subscription_tier === 'premium';

    // current_period_end NULL means institution-level billing (no per-cycle expiry)
    const isActive = !current_period_end || new Date(current_period_end) > new Date();

    if (!isPremium || !isActive) {
      return res.status(403).json({
        error: 'Premium subscription required',
        message: 'This feature requires an active premium subscription.',
        subscription_tier,
        current_period_end: current_period_end || null
      });
    }

    next();
  } catch (err) {
    console.error('[requirePremium] DB error:', err.message);
    return res.status(500).json({ error: 'Could not verify subscription status' });
  }
};

module.exports = requirePremium;
