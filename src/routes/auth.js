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
const JWT_SECRET = process.env.JWT_SECRET || 'crm_vendas_2026_chave_jwt_producao_segura_aleatoria';

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
            JWT_SECRET,
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

        const nome = authData.user.user_metadata?.nome || '';
        const isPrimeiroAdmin = authData.user.email?.toLowerCase() === 'admin@crm.com';
        const nivel = isPrimeiroAdmin ? 'Admin' : (authData.user.user_metadata?.nivel || 'Vendedor');

        const token = jwt.sign(
            { sub: authData.user.id, email: authData.user.email, nivel: nivel },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            message: 'Login realizado com sucesso!',
            data: {
                user: {
                    id: authData.user.id,
                    email: authData.user.email,
                    nome: nome,
                    nivel: nivel
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
 * Login com Google (OAuth) - via token JWT do Google
 * POST /api/auth/google
 * Body: { credential } (JWT token from Google)
 */
router.post('/google', async (req, res) => {
    try {
        const { credential, email, nome, googleId, avatar } = req.body;

        let payload;
        let userEmail = email;
        let userName = nome;
        let userGoogleId = googleId;
        let userAvatar = avatar;

        // Se enviou o credential (JWT), decodifica para obter os dados
        if (credential) {
            try {
                const base64Url = credential.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));
                payload = JSON.parse(jsonPayload);
                userEmail = payload.email;
                userName = payload.name;
                userGoogleId = payload.sub;
                userAvatar = payload.picture;
            } catch (e) {
                console.error('[auth] Erro ao decodificar credential:', e);
            }
        }

        if (!userEmail || !userGoogleId) {
            return res.status(400).json({
                success: false,
                message: 'Email e Google ID são obrigatório'
            });
        }

        console.log('[auth] Login com Google:', userEmail);

        // Busca usuário no Supabase Auth
        let { data: usersList, error: listError } = await supabase.auth.admin.listUsers();
        
        if (listError) {
            console.error('[auth] Erro ao listar usuários:', listError);
        }

        const existingAuthUser = usersList?.users?.find(u => u.email === userEmail);
        const nivel = existingAuthUser?.user_metadata?.nivel || 'Vendedor';

        // Gera token JWT不论 usuário auth existe ou não
        const token = jwt.sign(
            { 
                sub: existingAuthUser?.id || userGoogleId, 
                email: userEmail, 
                nome: userName,
                nivel: nivel,
                provider: 'google',
                avatar: userAvatar
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            message: 'Login com Google realizado com sucesso!',
            data: {
                user: {
                    id: existingAuthUser?.id || userGoogleId,
                    email: userEmail,
                    nome: userName || userEmail.split('@')[0],
                    nivel: nivel,
                    avatar: userAvatar
                },
                token
            }
        });
    } catch (error) {
        console.error('[auth] Erro em google login:', error);
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
            decoded = jwt.verify(token, JWT_SECRET);
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
                    nome: decoded.nome || '',
                    nivel: decoded.nivel || 'Vendedor'
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
 * Solicita redefinição de senha - Gera token temporário
 * POST /api/auth/reset-password
 * Body: { email }
 */
const resetTokens = new Map();

router.post('/reset-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email é obrigatório'
            });
        }

        // Verificar se usuário existe
        const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
        
        if (userError) {
            console.error('[auth] Erro ao buscar usuários:', userError);
            return res.status(500).json({ success: false, message: 'Erro interno' });
        }

        const user = userData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'Email não encontrado' });
        }

        // Gerar token de 6 dígitos
        const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 35000; // 35 segundos

        // Armazenar token temporariamente
        resetTokens.set(email.toLowerCase(), {
            token: resetToken,
            userId: user.id,
            expiresAt
        });

        // Limpar tokens expirados
        for (const [key, value] of resetTokens) {
            if (value.expiresAt < Date.now()) {
                resetTokens.delete(key);
            }
        }

        res.json({ 
            success: true, 
            message: 'Token gerado. Você tem 35 segundos.',
            resetToken: resetToken,
            userId: user.id,
            expiresIn: 35
        });
    } catch (error) {
        console.error('[auth] Erro em reset-password:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

/**
 * Confirma redefinição de senha com token
 * POST /api/auth/confirm-reset-password
 * Body: { userId, token, newPassword }
 */
router.post('/confirm-reset-password', async (req, res) => {
    try {
        const { userId, token, newPassword } = req.body;
        
        if (!userId || !token || !newPassword) {
            return res.status(400).json({ success: false, message: 'Dados incompletos' });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'Senha deve ter pelo menos 6 caracteres' });
        }

        // Buscar token válido
        let validToken = null;
        for (const [email, data] of resetTokens) {
            if (data.userId === userId && data.token === token) {
                if (data.expiresAt > Date.now()) {
                    validToken = data;
                }
                break;
            }
        }

        if (!validToken) {
            return res.status(400).json({ success: false, message: 'Token expirado ou inválido' });
        }

        // Atualizar senha via Admin API
        const { error } = await supabase.auth.admin.updateUserById(userId, {
            password: newPassword
        });
        
        if (error) {
            console.error('[auth] Erro ao atualizar senha:', error);
            return res.status(400).json({ success: false, message: 'Erro ao atualizar senha' });
        }

        // Remover token usado
        for (const [email, data] of resetTokens) {
            if (data.userId === userId) {
                resetTokens.delete(email);
            }
        }
        
        res.json({ success: true, message: 'Senha atualizada com sucesso!' });
    } catch (error) {
        console.error('[auth] Erro em confirm-reset-password:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

module.exports = router;