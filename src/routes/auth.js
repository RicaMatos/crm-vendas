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
const { authenticate } = require('../middleware/authenticate');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error('[auth] ERRO: Variável de ambiente JWT_SECRET é obrigatória');
    process.exit(1);
}

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
        const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({
            email,
            password
        });

        if (authError) {
            return res.status(401).json({
                success: false,
                message: 'Usuário não cadastrado ou senha incorreta. Verifique os dados ou crie uma conta.'
            });
        }

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

        // Verifica o token JWT local
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

        // Valida existência do usuário no Supabase
        try {
            const { data: userData, error: userError } = await supabase.auth.getUser(decoded.sub);
            if (userError || !userData.user) {
                return res.status(401).json({
                    success: false,
                    valid: false,
                    message: 'Usuário não encontrado ou sessão expirada'
                });
            }
        } catch (supabaseErr) {
            console.warn('[auth] Erro ao validar usuário no Supabase:', supabaseErr);
            return res.status(401).json({
                success: false,
                valid: false,
                message: 'Erro ao validar sessão'
            });
        }

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

// Cleanup automático de tokens expirados (a cada 60 segundos)
setInterval(() => {
    const now = Date.now();
    for (const [email, data] of resetTokens) {
        if (data.expiresAt < now) {
            resetTokens.delete(email);
        }
    }
}, 60000);

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

        res.json({ 
            success: true, 
            message: 'Token gerado. Você tem 35 segundos.',
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

// Rota para atualizar perfil do usuário logado
router.put('/profile', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        let { nome, telefone, email } = req.body;

        // Tratar valores undefined ou vazios
        if (nome === undefined || nome === null) nome = '';
        if (telefone === undefined || telefone === null) telefone = '';
        if (email === undefined || email === null) email = '';

        if (!nome && !telefone && !email) {
            return res.status(400).json({
                success: false,
                message: 'Informe pelo menos um campo para atualizar'
            });
        }

        // Preparar dados para atualização
        const updateData = {
            user_metadata: {}
        };
        
        if (nome) updateData.user_metadata.nome = nome;
        if (telefone) updateData.user_metadata.telefone = telefone;

        console.log('[profile] updateData:', JSON.stringify(updateData));

        // Atualizar usuário via Supabase Admin API
        const { data, error } = await supabase.auth.admin.updateUserById(userId, updateData);

        if (error) {
            console.error('[auth] Erro ao atualizar perfil:', error);
            return res.status(400).json({
                success: false,
                message: error.message || 'Erro ao atualizar perfil'
            });
        }

        console.log('[profile]Sucesso:', data.user.id);

        res.json({
            success: true,
            message: 'Perfil atualizado com sucesso!',
            data: {
                id: data.user.id,
                email: data.user.email,
                nome: data.user.user_metadata?.nome || '',
                telefone: data.user.user_metadata?.telefone || ''
            }
        });
    } catch (error) {
        console.error('[auth] Erro em PUT /profile:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Rota para buscar dados do usuário logado
router.get('/me', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Buscar usuário no Supabase
        const { data: userList, error: listError } = await supabase.auth.admin.listUsers();
        
        if (listError) {
            console.error('[auth] Erro ao listar usuários:', listError);
            return res.status(400).json({ success: false, message: 'Erro ao buscar usuário' });
        }

        const currentUser = userList.users.find(u => u.id === userId);
        
        console.log('[me] userId:', userId);
        console.log('[me] currentUser:', JSON.stringify(currentUser));
        
        if (!currentUser) {
            return res.status(400).json({
                success: false,
                message: 'Usuário não encontrado'
            });
        }

        res.json({
            success: true,
            data: {
                id: currentUser.id,
                email: currentUser.email,
                nome: currentUser.user_metadata?.nome || '',
                telefone: currentUser.user_metadata?.telefone || ''
            }
        });
    } catch (error) {
        console.error('[auth] Erro em GET /me:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

module.exports = router;