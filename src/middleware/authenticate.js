/**
 * Middleware de Autenticação
 * @module middleware/authenticate
 * 
 * Verifica se o usuário está autenticado através do token JWT apenas.
 * Não faz chamada externa ao Supabase para evitar falhas.
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'crm_vendas_2026_chave_jwt_producao_segura_aleatoria';

// Extrai o token JWT do header Authorization
/**
 * Extrai o token JWT do header Authorization
 * @param {Object} req - Objeto de requisição do Express
 * @returns {string|null} Token JWT ou null
 */
function extractToken(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;
    
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
    
    return parts[1];
}

/**
 * Middleware principal de autenticação
 * Verifica apenas o token JWT (sem chamadas externas)
 */
function authenticate(req, res, next) {
    const token = extractToken(req);
    
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Token de autenticação não fornecido'
        });
    }

    // Decodifica o token JWT para obter o user_id
    let decoded;
    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return res.status(401).json({
            success: false,
            message: 'Token inválido ou expirado. Faça login novamente.'
        });
    }

    const userId = decoded.sub || decoded.user_id;
    const email = decoded.email;

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: 'Token inválido. Faça login novamente.'
        });
    }

    req.user = {
        id: userId,
        email: email,
        nivel: decoded.nivel || 'Vendedor',
        token: token
    };

    next();
}

/**
 * Middleware opcional - continua mesmo sem autenticação
 * Útil para rotas públicas
 */
function optionalAuth(req, res, next) {
    const token = extractToken(req);
    
    if (!token) {
        req.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.sub || decoded.user_id;
        
        if (userId) {
            req.user = {
                id: userId,
                email: decoded.email,
                token: token
            };
        } else {
            req.user = null;
        }
    } catch (err) {
        // Token inválido, mas continuamos sem autenticação
        req.user = null;
    }

    next();
}

module.exports = {
    authenticate,
    optionalAuth,
    extractToken
};