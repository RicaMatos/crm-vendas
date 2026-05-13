/**
 * Servidor Principal - CRM Vendas
 * @file server.js
 * 
 * API REST para gestão de clientes e pedidos.
 * Utiliza Supabase como backend (Auth + Database).
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const securityMiddleware = require('./src/middleware/security');
const { generalLimiter, authLimiter } = require('./src/middleware/rateLimiter');
const { securityLogger } = require('./src/middleware/securityLogger');

// Importa rotas do Supabase
const authRoutes = require('./src/routes/auth');
const customersRoutes = require('./src/routes/customers');
const ordersRoutes = require('./src/routes/orders');
const productsRoutes = require('./src/routes/products');
const cropsRoutes = require('./src/routes/crops');
const tasksRoutes = require('./src/routes/tasks');
const webhooksRoutes = require('./src/routes/webhooks');
const usersRoutes = require('./src/routes/users');
const interactionsRoutes = require('./src/routes/interactions');
const importRoutes = require('./src/routes/import');
const notificationsRoutes = require('./src/routes/notifications');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================

app.use(securityMiddleware);
app.use(securityLogger);
app.use(generalLimiter);

// CORS - Configuração segura
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
const corsOptions = {
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};
app.use(cors(corsOptions));

// Parser JSON
app.use(express.json({ limit: '10mb' }));

// Parser URL encoded
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos do frontend (prioridade: public/)
app.use(express.static(path.join(__dirname, 'public')));

// Favicon
app.use('/favicon.ico', express.static(path.join(__dirname, 'public', 'favicon.ico')));

// Log de requisições
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// ============================================
// ROTAS DA API
// ============================================

// Autenticação - com rate limiting específico
app.use('/api/auth', authLimiter, authRoutes);

// CRUD de clientes
app.use('/api/customers', customersRoutes);

// CRUD de pedidos
app.use('/api/orders', ordersRoutes);

// Produtos
app.use('/api/products', productsRoutes);

// Culturas
app.use('/api/crops', cropsRoutes);

// Tarefas
app.use('/api/tasks', tasksRoutes);

// Webhooks (n8n/WhatsApp)
app.use('/api/webhooks', webhooksRoutes);

// Usuários (Admin)
app.use('/api/users', usersRoutes);

// Observações de clientes
app.use('/api/interactions', interactionsRoutes);

// Importação de clientes (arquivos + IA)
app.use('/api/import', importRoutes);

// Notificações do sistema
app.use('/api/notifications', notificationsRoutes);

// ============================================
// ROTAS ESPECIAIS
// ============================================

// Health check simples (sem Supabase)
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'CRM Vendas API está online',
        timestamp: new Date().toISOString(),
        version: '2.0.0'
    });
});

// Debug - variáveis de ambiente (apenas em desenvolvimento)
app.get('/api/debug', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ success: false, message: 'Rota não encontrada' });
    }
    res.json({
        supabaseUrl: process.env.SUPABASE_URL ? '✅ Configurado' : '❌ Não configurado',
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY ? '✅ Configurado' : '❌ Não configurado',
        supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Configurado' : '❌ Não configurado',
        jwtSecret: process.env.JWT_SECRET ? '✅ Configurado' : '❌ Não configurado',
        geminiApiKey: process.env.GEMINI_API_KEY ? '✅ Configurado' : '❌ Não configurado',
        nodeEnv: process.env.NODE_ENV || 'development'
    });
});

// ============================================
// TRATAMENTO DE ERROS
// ============================================

// 404 - Rota não encontrada
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Rota não encontrada'
    });
});

// Erro global
app.use((err, req, res, next) => {
    console.error('[server] Erro não tratado:', err);
    res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
    });
});

// ============================================
// INICIALIZAÇÃO
// ============================================

// Rota fallback para SPA (frontend) - serve index.html para qualquer rota não-API
app.use((req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ success: false, message: 'Rota não encontrada' });
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log('========================================');
    console.log('🚀 CRM Vendas API');
    console.log('========================================');
    console.log(`📡 Servidor rodando na porta ${PORT}`);
    console.log(`🌐 Acesse: http://localhost:${PORT}`);
    console.log(`🔗 Supabase: ${process.env.SUPABASE_URL ? 'Configurado' : 'NÃO CONFIGURADO'}`);
    console.log('========================================');
});

module.exports = app;