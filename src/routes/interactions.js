/**
 * Rotas de Interações/Observações
 * @module routes/interactions
 * 
 * Gerencia observações dos clientes.
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabaseClient');
const { authenticate } = require('../middleware/authenticate');

// Aplicar autenticação em todas as rotas
router.use(authenticate);

/**
 * Lista observações de um cliente
 * GET /api/interactions?customer_id=123
 */
router.get('/', async (req, res) => {
    try {
        const { customer_id } = req.query;
        
        if (!customer_id) {
            return res.status(400).json({
                success: false,
                message: 'customer_id é obrigatório'
            });
        }

        const { data, error } = await supabase
            .from('interactions')
            .select('*')
            .eq('customer_id', customer_id)
            .eq('tipo', 'observacao')
            .order('data', { ascending: false });

        if (error) throw error;

        res.json({ success: true, data: data || [] });
    } catch (error) {
        console.error('[interactions] Erro ao listar:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao listar observações'
        });
    }
});

/**
 * Cria uma nova observação
 * POST /api/interactions
 * Body: { customer_id, observacao }
 */
router.post('/', async (req, res) => {
    try {
        const { customer_id, observacao } = req.body;

        if (!customer_id) {
            return res.status(400).json({
                success: false,
                message: 'customer_id é obrigatório'
            });
        }

        if (!observacao || observacao.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'observacao é obrigatória'
            });
        }

        const { data, error } = await supabase
            .from('interactions')
            .insert([{
                user_id: req.user.id,
                customer_id: customer_id,
                tipo: 'observacao',
                observacao: observacao.trim(),
                data: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            success: true,
            message: 'Observação salva!',
            data
        });
    } catch (error) {
        console.error('[interactions] Erro ao criar:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao salvar observação'
        });
    }
});

module.exports = router;