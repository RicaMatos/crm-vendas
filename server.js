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

// Importa rotas do Supabase
const authRoutes = require('./src/routes/auth');
const customersRoutes = require('./src/routes/customers');
const ordersRoutes = require('./src/routes/orders');
const productsRoutes = require('./src/routes/products');
const cropsRoutes = require('./src/routes/crops');
const tasksRoutes = require('./src/routes/tasks');
const webhooksRoutes = require('./src/routes/webhooks');
const usersRoutes = require('./src/routes/users');

const app = express();
const PORT = process.env.PORT || process.env.VERCEL_PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================

// CORS - Permite requisições do frontend
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

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

// Autenticação
app.use('/api/auth', authRoutes);

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

// Debug - variáveis de ambiente
app.get('/api/debug', (req, res) => {
    res.json({
        supabaseUrl: process.env.SUPABASE_URL ? '✅ Configurado' : '❌ Não configurado',
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY ? '✅ Configurado' : '❌ Não configurado',
        supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Configurado' : '❌ Não configurado',
        jwtSecret: process.env.JWT_SECRET ? '✅ Configurado' : '❌ Não configurado',
        nodeEnv: process.env.NODE_ENV || 'development'
    });
});

// Debug - testar RPC admin
app.get('/api/debug/test-products', async (req, res) => {
    const { supabase } = require('./src/config/supabaseClient');
    try {
        const result = await supabase.rpc('admin_get_all_products');
        res.json({ success: true, count: result.data?.length || 0, data: result.data, error: result.error });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
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