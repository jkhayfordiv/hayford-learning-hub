module.exports = function requireRole(...allowedRoles) {
  return function(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ msg: 'Authentication required' });
    }

    const userRole = req.user.role;
    
    console.log('[requireRole Middleware]', {
      allowedRoles,
      userRole,
      user: req.user
    });

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        msg: 'Access denied. Insufficient permissions.',
        required: allowedRoles,
        current: userRole
      });
    }

    next();
  };
};
