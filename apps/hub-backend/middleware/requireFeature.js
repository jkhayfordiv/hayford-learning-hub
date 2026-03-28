/**
 * Feature Flag Enforcement Middleware
 * 
 * Blocks API access if the user's institution doesn't have the required feature enabled.
 * Feature flags are stored in the JWT token payload from the login route.
 * 
 * Usage:
 *   router.get('/grammar/...',
 *     auth,
 *     requireFeature('has_grammar_world'),
 *     async (req, res) => { ... }
 *   );
 */

const requireFeature = (featureName) => {
  return (req, res, next) => {
    // Check if user exists in request (should be set by auth middleware)
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please log in to access this feature'
      });
    }

    // Check if the feature flag exists and is enabled
    const featureEnabled = req.user[featureName];

    if (featureEnabled === undefined) {
      // Feature flag doesn't exist in JWT - log warning and allow access (backwards compatibility)
      console.warn(`[requireFeature] Feature flag '${featureName}' not found in JWT for user ${req.user.id}. Allowing access for backwards compatibility.`);
      return next();
    }

    if (!featureEnabled) {
      // Feature is explicitly disabled for this institution
      const featureDisplayName = featureName
        .replace('has_', '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());

      return res.status(403).json({ 
        error: 'Feature not available',
        message: `${featureDisplayName} is not enabled for your institution. Please contact your administrator or upgrade your subscription.`,
        feature: featureName,
        institution_id: req.user.institution_id
      });
    }

    // Feature is enabled, proceed
    next();
  };
};

module.exports = requireFeature;
