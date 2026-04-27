require('dotenv').config();
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');

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

module.exports = router;
module.exports.JWT_SECRET = JWT_SECRET;
