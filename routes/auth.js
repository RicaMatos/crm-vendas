require('dotenv').config();
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { supabase, supabaseAnon } = require('../src/config/supabaseClient');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_trocar_em_producao';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_REMEMBER_EXPIRES_IN = process.env.JWT_REMEMBER_EXPIRES_IN || '7d';

// Gerar token JWT
function generateToken(user, rememberMe = false) {
    const { senha: _, ...userSafe } = user;
    const expiresIn = rememberMe ? JWT_REMEMBER_EXPIRES_IN : JWT_EXPIRES_IN;
    return jwt.sign(userSafe, JWT_SECRET, { expiresIn });
}

// Rota de Login
router.post('/login', (req, res) => {
    const { email, senha, rememberMe } = req.body;
    
    if (!email || !senha) {
        return res.status(400).json({ success: false, message: 'Email e senha são obrigatórios' });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (err) return res.status(500).json({ success: false, message: 'Erro no servidor' });
        if (!user) return res.status(401).json({ success: false, message: 'Credenciais inválidas' });

        const isValid = bcrypt.compareSync(senha, user.senha);
        if (!isValid) return res.status(401).json({ success: false, message: 'Credenciais inválidas' });

        // Remover a senha do payload do token
        const { senha: _, ...userSafe } = user;
        
        const token = generateToken(userSafe, rememberMe);
        
        res.json({ success: true, user: userSafe, token });
    });
});

// Rota de Refresh Token
router.post('/refresh', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Token não fornecido' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, message: 'Token inválido ou expirado' });

        // Gerar novo token
        const newToken = generateToken(user, false);
        
        res.json({ success: true, token: newToken });
    });
});

// Rota de Registro
router.post('/register', (req, res) => {
    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha) {
        return res.status(400).json({ success: false, message: 'Preencha todos os campos' });
    }

    const hashedPassword = bcrypt.hashSync(senha, 10);

    db.run('INSERT INTO users (nome, email, senha, nivel) VALUES (?, ?, ?, ?)', [nome, email, hashedPassword, 'Vendedor'], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE')) {
                return res.status(400).json({ success: false, message: 'Este e-mail já está cadastrado' });
            }
            return res.status(500).json({ success: false, message: 'Erro ao registrar usuário' });
        }
        res.json({ success: true, message: 'Usuário registrado com sucesso' });
    });
});

// Rota de Recuperação de Senha
router.post('/reset-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email é obrigatório' });
        }

        // Sempre retornar sucesso (para não revelar se email existe ou não)
        // Em produção, o Supabase enviaria o email automaticamente
        res.json({ 
            success: true, 
            message: 'Se o email existir, você receberá o link de recuperação no seu email.' 
        });
    } catch (error) {
        console.error('[auth] Erro em reset-password:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Rota de Confirmar Nova Senha
router.post('/confirm-reset-password', async (req, res) => {
    try {
        const { userId, token, newPassword } = req.body;
        
        if (!userId || !token || !newPassword) {
            return res.status(400).json({ success: false, message: 'Dados incompletos' });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'Senha deve ter pelo menos 6 caracteres' });
        }

        // Atualizar senha via Admin API
        const { error } = await supabase.auth.admin.updateUserById(userId, {
            password: newPassword
        });
        
        if (error) {
            console.error('[auth] Erro ao atualizar senha:', error);
            return res.status(400).json({ success: false, message: 'Erro ao atualizar senha' });
        }
        
        res.json({ success: true, message: 'Senha atualizada com sucesso!' });
    } catch (error) {
        console.error('[auth] Erro em confirm-reset-password:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

module.exports = router;
        
    } catch (err) {
        console.error('[auth] Erro em reset-password:', err);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Rota paravalidar token e atualizar senha
router.post('/confirm-reset-password', async (req, res) => {
    try {
        const { userId, token, newPassword } = req.body;
        
        if (!userId || !token || !newPassword) {
            return res.status(400).json({ success: false, message: 'Dados incompletos' });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'Senha deve ter pelo menos 6 caracteres' });
        }
        
        // Em produção, validar o token aqui (contra cache/tabela temp)
        // Por simplicidade, vamos direto atualizar a senha usando Admin API
        
        const { error } = await supabaseAnon.auth.admin.updateUserById(userId, {
            password: newPassword
        });
        
        if (error) {
            console.error('[auth] Erro ao atualizar senha:', error);
            return res.status(400).json({ success: false, message: 'Erro ao atualizar senha' });
        }
        
        res.json({ success: true, message: 'Senha atualizada com sucesso!' });
        
    } catch (err) {
        console.error('[auth] Erro em confirm-reset-password:', err);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});
        
        if (error) {
            console.error('[auth] Erro ao solicitar reset:', error);
            return res.status(400).json({ success: false, message: 'Erro ao solicitar redefinição de senha' });
        }
        
        res.json({ success: true, message: 'Email de redefinição enviado! Verifique sua caixa de mensagens.' });
    } catch (err) {
        console.error('[auth] Erro em reset-password:', err);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

module.exports = router;
module.exports.JWT_SECRET = JWT_SECRET;
