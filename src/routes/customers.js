/**
 * Rotas de Clientes
 * @module routes/customers
 * 
 * CRUD de clientes com validações e tratamento de erros.
 */

const express = require('express');
const router = express.Router();
const customerService = require('../services/customerService');
const logService = require('../services/logService');
const { authenticate } = require('../middleware/authenticate');

// Aplica autenticação em todas as rotas
router.use(authenticate);

/**
 * Lista todos os clientes
 * GET /api/customers
 */
router.get('/', async (req, res) => {
    try {
        const { busca, status } = req.query;
        
        let clientes;
        if (busca) {
            clientes = await customerService.buscarClientes(req.user.id, busca);
        } else {
            clientes = await customerService.listarClientes(req.user.id);
        }

        // Filtra por status se fornecido
        if (status) {
            clientes = clientes.filter(c => c.status === status);
        }

        res.json({
            success: true,
            data: clientes
        });
    } catch (error) {
        console.error('[customers] Erro ao listar:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao listar clientes'
        });
    }
});

/**
 * Obtém estatísticas dos clientes
 * GET /api/customers/stats
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await customerService.obterEstatisticas(req.user.id);
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('[customers] Erro ao obter stats:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao obter estatísticas'
        });
    }
});

/**
 * Lista aniversariantes
 * GET /api/customers/aniversariantes
 */
router.get('/aniversariantes', async (req, res) => {
    try {
        const dias = parseInt(req.query.dias) || 30;
        const clientes = await customerService.listarAniversariantes(req.user.id, dias);
        
        res.json({
            success: true,
            data: clientes
        });
    } catch (error) {
        console.error('[customers] Erro ao listar aniversariantes:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao listar aniversariantes'
        });
    }
});

/**
 * Obtém um cliente específico
 * GET /api/customers/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const cliente = await customerService.obterCliente(req.user.id, parseInt(req.params.id));
        
        if (!cliente) {
            return res.status(404).json({
                success: false,
                message: 'Cliente não encontrado'
            });
        }

        // Obtém histórico de interações
        const interacoes = await logService.listarInteracoes(req.user.id, cliente.id);

        res.json({
            success: true,
            data: {
                ...cliente,
                interacoes
            }
        });
    } catch (error) {
        console.error('[customers] Erro ao obter cliente:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar cliente'
        });
    }
});

/**
 * Cria um novo cliente
 * POST /api/customers
 */
router.post('/', async (req, res) => {
    try {
        const cliente = await customerService.criarCliente(req.user.id, req.body);
        
        res.status(201).json({
            success: true,
            message: 'Cliente criado com sucesso!',
            data: cliente
        });
    } catch (error) {
        console.error('[customers] Erro ao criar:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Erro ao criar cliente'
        });
    }
});

/**
 * Atualiza um cliente
 * PUT /api/customers/:id
 */
router.put('/:id', async (req, res) => {
    try {
        const cliente = await customerService.atualizarCliente(
            req.user.id, 
            parseInt(req.params.id), 
            req.body
        );
        
        res.json({
            success: true,
            message: 'Cliente atualizado com sucesso!',
            data: cliente
        });
    } catch (error) {
        console.error('[customers] Erro ao atualizar:', error);
        
        if (error.message.includes('não encontrado')) {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }
        
        res.status(400).json({
            success: false,
            message: error.message || 'Erro ao atualizar cliente'
        });
    }
});

/**
 * Remove um cliente
 * DELETE /api/customers/:id
 */
router.delete('/:id', async (req, res) => {
    try {
        await customerService.removerCliente(req.user.id, parseInt(req.params.id));
        
        res.json({
            success: true,
            message: 'Cliente removido com sucesso!'
        });
    } catch (error) {
        console.error('[customers] Erro ao remover:', error);
        
        if (error.message.includes('não encontrado')) {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }
        
        res.status(400).json({
            success: false,
            message: error.message || 'Erro ao remover cliente'
        });
    }
});

module.exports = router;