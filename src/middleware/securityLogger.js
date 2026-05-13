const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../../security.log');

function logSecurityEvent(event) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] SECURITY: ${event}\n`;

  if (process.env.NODE_ENV === 'production') {
    try {
      fs.appendFileSync(LOG_FILE, logEntry);
    } catch (err) {
      console.error('[securityLogger] Erro ao salvar log:', err.message);
    }
  }

  console.log(logEntry.trim());
}

function securityLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;

    if (status === 401 || status === 403) {
      logSecurityEvent(`${req.method} ${req.path} - Status: ${status} - IP: ${req.ip} - UA: ${req.get('user-agent')?.substring(0, 50)}`);
    }

    if (duration > 5000 && process.env.NODE_ENV === 'production') {
      logSecurityEvent(`Slow request: ${req.method} ${req.path} - ${duration}ms`);
    }
  });

  next();
}

function logAuthFailure(email, ip, reason = 'invalid_credentials') {
  logSecurityEvent(`LOGIN_FAILED - Email: ${email} - IP: ${ip} - Reason: ${reason}`);
}

function logAuthSuccess(email, ip) {
  logSecurityEvent(`LOGIN_SUCCESS - Email: ${email} - IP: ${ip}`);
}

function logAccessDenied(userId, resource, action) {
  logSecurityEvent(`ACCESS_DENIED - User: ${userId} - Resource: ${resource} - Action: ${action}`);
}

module.exports = {
  securityLogger,
  logAuthFailure,
  logAuthSuccess,
  logAccessDenied
};