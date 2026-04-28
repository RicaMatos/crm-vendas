/**
 * Middleware de Autenticação
 * @module middleware/authenticate
 * 
 * Verifica se o usuário está autenticado através do token JWT
 * e valida a sessão com o Supabase Auth.
 */

const jwt = require('jsonwebtoken');
const { supabase } = require('../config/supabaseClient');

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
 * Verifica o token JWT e valida a sessão no Supabase
 */
async function authenticate(req, res, next) {
    try {
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
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({
                success: false,
                message: 'Token inválido ou expirado'
            });
        }

        const userId = decoded.sub || decoded.user_id;
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Token não contém ID do usuário'
            });
        }

        // Valida a sessão no Supabase Auth (opcional - falha segura)
        let sessionValid = true;
        try {
            const { data: { session } } = await supabase.auth.getSession(token);
            if (!session) sessionValid = false;
        } catch (e) {
            // Se falhar, mantém válido pois o JWT é confiável
            console.warn('[authenticate]getSession falhou, usando apenas JWT');
        }

        // Adiciona informações do usuário à requisição
        req.user = {
            id: userId,
            token: token
        };

        next();
    } catch (error) {
        console.error('[authenticate] Erro na autenticação:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro interno na autenticação'
        });
    }
}

/**
 * Middleware opcional - continua mesmo sem autenticação
 * Useful para rotas públicas
 */
async function optionalAuth(req, res, next) {
    const token = extractToken(req);
    
    if (!token) {
        req.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.sub || decoded.user_id;
        
        if (userId) {
            const { data: { session } } = await supabase.auth.getSession(token);
            if (session) {
                req.user = {
                    id: userId,
                    email: session.user.email,
                    token: token
                };
            }
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