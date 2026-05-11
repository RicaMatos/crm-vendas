/**
 * Rotas de Notificações
 * @module routes/notifications
 * 
 * Gerencia notificações do sistema
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabaseClient');
const { authenticate } = require('../middleware/authenticate');

router.use(authenticate);

/**
 * Lista notificações do usuário
 * GET /api/notifications
 */
router.get('/', async (req, res) => {
    try {
        const { nao_lidas } = req.query;
        
        let query = supabase
            .from('notifications')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (nao_lidas === 'true') {
            query = query.eq('lida', false);
        }

        const { data, error } = await query.limit(50);

        if (error) {
            console.error('[notifications] Erro ao listar:', error);
            return res.status(500).json({ success: false, message: 'Erro ao listar notificações' });
        }

        res.json({
            success: true,
            data: data || []
        });
    } catch (error) {
        console.error('[notifications] Erro:', error);
        res.status(500).json({ success: false, message: 'Erro interno' });
    }
});

/**
 * Marca notificação como lida
 * PATCH /api/notifications/:id/ler
 */
router.patch('/:id/ler', async (req, res) => {
    try {
        const { error } = await supabase
            .from('notifications')
            .update({ lida: true })
            .eq('id', req.params.id)
            .eq('user_id', req.user.id);

        if (error) {
            return res.status(400).json({ success: false, message: 'Erro ao marcar como lida' });
        }

        res.json({ success: true, message: 'Marcado como lida' });
    } catch (error) {
        console.error('[notifications] Erro:', error);
        res.status(500).json({ success: false, message: 'Erro interno' });
    }
});

/**
 * Marca todas como lidas
 * POST /api/notifications/ler-todas
 */
router.post('/ler-todas', async (req, res) => {
    try {
        const { error } = await supabase
            .from('notifications')
            .update({ lida: true })
            .eq('user_id', req.user.id)
            .eq('lida', false);

        if (error) {
            return res.status(400).json({ success: false, message: 'Erro ao marcar como lida' });
        }

        res.json({ success: true, message: 'Todas marcadas como lidas' });
    } catch (error) {
        console.error('[notifications] Erro:', error);
        res.status(500).json({ success: false, message: 'Erro interno' });
    }
});

/**
 * Remove notificação
 * DELETE /api/notifications/:id
 */
router.delete('/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('id', req.params.id)
            .eq('user_id', req.user.id);

        if (error) {
            return res.status(400).json({ success: false, message: 'Erro ao remover' });
        }

        res.json({ success: true, message: 'Removida com sucesso' });
    } catch (error) {
        console.error('[notifications] Erro:', error);
        res.status(500).json({ success: false, message: 'Erro interno' });
    }
});

module.exports = router;