/**
 * Rotas de Culturas Agrícolas
 * @module routes/crops
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabaseClient');
const { authenticate } = require('../middleware/authenticate');

router.use(authenticate);

/**
 * Lista todas as culturas
 * GET /api/crops
 */
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('crops')
            .select('*')
            .eq('user_id', req.user.id)
            .order('nome', { ascending: true });

        if (error) throw error;

        res.json({ success: true, data: data || [] });
    } catch (error) {
        console.error('[crops] Erro ao listar:', error);
        res.status(500).json({ success: false, message: 'Erro ao listar culturas' });
    }
});

/**
 * Cria uma nova cultura
 * POST /api/crops
 */
router.post('/', async (req, res) => {
    try {
        const { nome, observacoes, cor } = req.body;

        if (!nome) {
            return res.status(400).json({ success: false, message: 'Nome é obrigatório' });
        }

        const { data, error } = await supabase
            .from('crops')
            .insert([{ user_id: req.user.id, nome, observacoes, cor }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({ success: true, message: 'Cultura criada!', data });
    } catch (error) {
        console.error('[crops] Erro ao criar:', error);
        res.status(400).json({ success: false, message: error.message || 'Erro ao criar cultura' });
    }
});

/**
 * Atualiza uma cultura
 * PUT /api/crops/:id
 */
router.put('/:id', async (req, res) => {
    try {
        const { nome, observacoes, cor } = req.body;

        const { data, error } = await supabase
            .from('crops')
            .update({ nome, observacoes, cor })
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, message: 'Cultura atualizada!', data });
    } catch (error) {
        console.error('[crops] Erro ao atualizar:', error);
        res.status(400).json({ success: false, message: 'Erro ao atualizar cultura' });
    }
});

/**
 * Remove uma cultura
 * DELETE /api/crops/:id
 */
router.delete('/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('crops')
            .delete()
            .eq('id', req.params.id)
            .eq('user_id', req.user.id);

        if (error) throw error;

        res.json({ success: true, message: 'Cultura removida!' });
    } catch (error) {
        console.error('[crops] Erro ao remover:', error);
        res.status(400).json({ success: false, message: 'Erro ao remover cultura' });
    }
});

module.exports = router;