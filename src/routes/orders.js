/**
 * Rotas de Pedidos
 * @module routes/orders
 * 
 * CRUD de pedidos com validações e tratamento de erros.
 */

const express = require('express');
const router = express.Router();
const orderService = require('../services/orderService');
const logService = require('../services/logService');
const { authenticate } = require('../middleware/authenticate');

// Aplica autenticação em todas as rotas
router.use(authenticate);

/**
 * Lista todos os pedidos
 * GET /api/orders
 */
router.get('/', async (req, res) => {
    try {
        const { status, customerId, user_id } = req.query;
        
        const isAdmin = req.user.nivel === 'Admin';
        let targetUserId = req.user.id;
        
        if (isAdmin && user_id) {
            targetUserId = user_id;
        }
        
        let pedidos = await orderService.listarPedidos(targetUserId);

        // Filtra por status se fornecido
        if (status) {
            pedidos = pedidos.filter(p => p.status_pagamento === status);
        }

        // Filtra por cliente se fornecido
        if (customerId) {
            pedidos = pedidos.filter(p => p.customer_id === parseInt(customerId));
        }

        res.json({
            success: true,
            data: pedidos
        });
    } catch (error) {
        console.error('[orders] Erro ao listar:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao listar pedidos'
        });
    }
});

/**
 * Obtém estatísticas dos pedidos
 * GET /api/orders/stats
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await orderService.obterEstatisticas(req.user.id);
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('[orders] Erro ao obter stats:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao obter estatísticas'
        });
    }
});

/**
 * Obtém um pedido específico
 * GET /api/orders/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const pedido = await orderService.obterPedido(req.user.id, parseInt(req.params.id));
        
        if (!pedido) {
            return res.status(404).json({
                success: false,
                message: 'Pedido não encontrado'
            });
        }

        res.json({
            success: true,
            data: pedido
        });
    } catch (error) {
        console.error('[orders] Erro ao obter pedido:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar pedido'
        });
    }
});

/**
 * Cria um novo pedido
 * POST /api/orders
 */
router.post('/', async (req, res) => {
    try {
        const isAdmin = req.user.nivel === 'Admin';
        let targetUserId = req.user.id;
        
        if (isAdmin && req.body.user_id) {
            targetUserId = req.body.user_id;
        }
        
        const pedido = await orderService.criarPedido(targetUserId, req.body);
        
        res.status(201).json({
            success: true,
            message: 'Pedido criado com sucesso!',
            data: pedido
        });
    } catch (error) {
        console.error('[orders] Erro ao criar:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Erro ao criar pedido'
        });
    }
});

/**
 * Atualiza um pedido
 * PUT /api/orders/:id
 */
router.put('/:id', async (req, res) => {
    try {
        const pedido = await orderService.atualizarPedido(
            req.user.id, 
            parseInt(req.params.id), 
            req.body
        );
        
        res.json({
            success: true,
            message: 'Pedido atualizado com sucesso!',
            data: pedido
        });
    } catch (error) {
        console.error('[orders] Erro ao atualizar:', error);
        
        if (error.message.includes('não encontrado')) {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }
        
        res.status(400).json({
            success: false,
            message: error.message || 'Erro ao atualizar pedido'
        });
    }
});

/**
 * Atualiza status de pagamento
 * PATCH /api/orders/:id/status
 */
router.patch('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        
        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'Status é obrigatório'
            });
        }

        const pedido = await orderService.atualizarStatusPagamento(
            req.user.id, 
            parseInt(req.params.id), 
            status
        );
        
        res.json({
            success: true,
            message: 'Status atualizado com sucesso!',
            data: pedido
        });
    } catch (error) {
        console.error('[orders] Erro ao atualizar status:', error);
        
        if (error.message.includes('não encontrado')) {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }
        
        res.status(400).json({
            success: false,
            message: error.message || 'Erro ao atualizar status'
        });
    }
});

/**
 * Cancela um pedido
 * POST /api/orders/:id/cancel
 */
router.post('/:id/cancel', async (req, res) => {
    try {
        await orderService.cancelarPedido(req.user.id, parseInt(req.params.id));
        
        res.json({
            success: true,
            message: 'Pedido cancelado com sucesso!'
        });
    } catch (error) {
        console.error('[orders] Erro ao cancelar:', error);
        
        if (error.message.includes('não encontrado')) {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }
        
        res.status(400).json({
            success: false,
            message: error.message || 'Erro ao cancelar pedido'
        });
    }
});

/**
 * Remove um pedido
 * DELETE /api/orders/:id
 */
router.delete('/:id', async (req, res) => {
    try {
        await orderService.removerPedido(req.user.id, parseInt(req.params.id));
        
        res.json({
            success: true,
            message: 'Pedido removido com sucesso!'
        });
    } catch (error) {
        console.error('[orders] Erro ao remover:', error);
        
        if (error.message.includes('não encontrado')) {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }
        
        res.status(400).json({
            success: false,
            message: error.message || 'Erro ao remover pedido'
        });
    }
});

module.exports = router;