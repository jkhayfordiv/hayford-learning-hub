const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) { console.error('FATAL: JWT_SECRET is not defined'); process.exit(1); }

module.exports = function(req, res, next) {
  // Get token from header
  const authHeader = req.header('Authorization');

  // Check if no token
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  const token = authHeader.split(' ')[1];

  // Verify token
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded.user;
    
    // Check role - SuperAdmin has god-mode (inherits all permissions)
    if (req.user.role !== 'teacher' && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ msg: 'Access denied: Requires teacher, admin, or super_admin role' });
    }
    
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};
