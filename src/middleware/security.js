const helmet = require('helmet');

const securityMiddleware = helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xContentTypeOptions: true,
  xFrameOptions: 'DENY',
  xPermittedCrossDomainPolicies: 'none'
});

const cspMiddleware = (req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-hashes' https://unpkg.com https://cdn.jsdelivr.net https://accounts.google.com https://apis.google.com; " +
    "script-src-attr 'self' 'unsafe-inline' 'unsafe-hashes'; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "style-src-attr 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https: http:; " +
    "connect-src 'self' " + (process.env.SUPABASE_URL || '') + " https://*.supabase.co https://*.googleusercontent.com; " +
    "font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com data:; " +
    "object-src 'none'; " +
    "media-src 'self'; " +
    "frame-src 'none' https://accounts.google.com; " +
    "frame-ancestors 'none';"
  );
  next();
};

module.exports = (req, res, next) => {
  securityMiddleware(req, res, () => {
    cspMiddleware(req, res, next);
  });
};