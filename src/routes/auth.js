/**
 * Rotas de Autenticação
 * @module routes/auth
 * 
 * Gerencia login, cadastro e logout usando Supabase Auth.
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { supabase, supabaseAnon } = require('../config/supabaseClient');

/**
 * Registra um novo usuário
 * POST /api/auth/register
 * Body: { email, password, nome }
 */
router.post('/register', async (req, res) => {
    try {
        const { email, password, nome } = req.body;

        // Validações
        if (!email || !password || !nome) {
            return res.status(400).json({
                success: false,
                message: 'Email, senha e nome são obrigatórios'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Senha deve ter pelo menos 6 caracteres'
            });
        }

        // Cria usuário no Supabase Auth
        const { data: authData, error: authError } = await supabaseAnon.auth.signUp({
            email,
            password,
            options: {
                data: {
                    nome
                }
            }
        });

        if (authError) {
            console.error('[auth] Erro ao registrar usuário:', authError);
            
            // Tratamento de erros específicos
            if (authError.message.includes('already registered')) {
                return res.status(400).json({
                    success: false,
                    message: 'Este email já está cadastrado'
                });
            }
            
            return res.status(400).json({
                success: false,
                message: 'Erro ao criar conta: ' + authError.message
            });
        }

        // Gera token JWT para sessão
        const token = jwt.sign(
            { sub: authData.user.id, email: authData.user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            success: true,
            message: 'Conta criada com sucesso!',
            data: {
                user: {
                    id: authData.user.id,
                    email: authData.user.email,
                    nome: nome
                },
                token
            }
        });
    } catch (error) {
        console.error('[auth] Erro em register:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

/**
 * Login de usuário
 * POST /api/auth/login
 * Body: { email, password }
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email e senha são obrigatórios'
            });
        }

        // Autentica com Supabase Auth
        console.log('[auth] Tentando login com Supabase:', email);
        
        const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({
            email,
            password
        });

        if (authError) {
            console.error('[auth] Erro no login Supabase:', authError);
            console.error('[auth] Error message:', authError.message);
            console.error('[auth] Error status:', authError.status);
            
            if (authError.message.includes('Invalid login') || authError.message.includes('invalid')) {
                return res.status(401).json({
                    success: false,
                    message: 'Usuário não cadastrado ou senha incorreta. Verifique os dados ou crie uma conta.'
                });
            }
            
            if (authError.message.includes('Email not confirmed')) {
                return res.status(401).json({
                    success: false,
                    message: 'Confirme seu email antes de fazer login. Verifique sua caixa de mensagens.'
                });
            }
            
            // Log detalhado do erro
            console.error('[auth] Tipo de erro:', authError.name);
            
            return res.status(401).json({
                success: false,
                message: 'Erro ao fazer login: ' + authError.message
            });
        }

        // Verifica se o usuário existe (email não confirmado retorna user: null)
        if (!authData.user) {
            return res.status(401).json({
                success: false,
                message: 'Confirme seu email antes de fazer login.'
            });
        }
        
        console.log('[auth] Login Supabase OK, user:', authData.user);

        // Gera token JWT para sessão
        const token = jwt.sign(
            { sub: authData.user.id, email: authData.user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Obtém dados adicionais do usuário
        const nome = authData.user.user_metadata?.nome || '';

        res.json({
            success: true,
            message: 'Login realizado com sucesso!',
            data: {
                user: {
                    id: authData.user.id,
                    email: authData.user.email,
                    nome: nome
                },
                token
            }
        });
    } catch (error) {
        console.error('[auth] Erro em login:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

/**
 * Logout de usuário
 * POST /api/auth/logout
 * Headers: Authorization: Bearer <token>
 */
router.post('/logout', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: 'Token não fornecido'
            });
        }

        const token = authHeader.split(' ')[1];

        // Invalida sessão no Supabase
        const { error } = await supabaseAnon.auth.signOut(token);

        if (error) {
            console.warn('[auth] Erro no logout:', error);
        }

        res.json({
            success: true,
            message: 'Logout realizado com sucesso'
        });
    } catch (error) {
        console.error('[auth] Erro em logout:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

/**
 * Verifica se o token é válido
 * GET /api/auth/verify
 * Headers: Authorization: Bearer <token>
 */
router.get('/verify', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({
                success: false,
                valid: false,
                message: 'Token não fornecido'
            });
        }

        const token = authHeader.split(' ')[1];

        // Verifica apenas o token JWT local
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({
                success: false,
                valid: false,
                message: 'Token expirado ou inválido'
            });
        }

        // Retorna sucesso apenas com verificação JWT
        res.json({
            success: true,
            valid: true,
            data: {
                user: {
                    id: decoded.sub,
                    email: decoded.email,
                    nome: decoded.nome || ''
                }
            }
        });
    } catch (error) {
        console.error('[auth] Erro em verify:', error);
        res.status(500).json({
            success: false,
            valid: false,
            message: 'Erro interno do servidor'
        });
    }
});

/**
 * Solicita redefinição de senha
 * POST /api/auth/reset-password
 * Body: { email }
 */
router.post('/reset-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email é obrigatório'
            });
        }

        const { error } = await supabaseAnon.auth.resetPasswordForEmail(email, {
            redirectTo: `${req.protocol}://${req.get('host')}/index.html`
        });

        if (error) {
            console.error('[auth] Erro ao solicitar reset:', error);
            return res.status(400).json({
                success: false,
                message: 'Erro ao solicitar redefinição de senha'
            });
        }

        res.json({
            success: true,
            message: 'Email de redefinição enviado! Verifique sua caixa de mensagens.'
        });
    } catch (error) {
        console.error('[auth] Erro em reset-password:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

module.exports = router;