/**
 * Rotas de Produtos
 * @module routes/products
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabaseClient');
const { authenticate } = require('../middleware/authenticate');

router.use(authenticate);

/**
 * Lista todos os produtos
 * GET /api/products
 * Se admin, retorna todos os produtos
 */
router.get('/', async (req, res) => {
    try {
        const { user_id } = req.query;
        
        const isAdmin = req.user.nivel === 'Admin';
        
        let data, error;
        
        // Se admin e não especificar user_id, retorna TODOS
        if (isAdmin && !user_id) {
            const result = await supabase.rpc('admin_get_all_products');
            data = result.data;
            error = result.error;
        } else {
            const targetUserId = (isAdmin && user_id) ? user_id : req.user.id;
            const { data: products, error: err } = await supabase
                .from('products')
                .select('*')
                .eq('user_id', targetUserId)
                .order('nome', { ascending: true });
            data = products;
            error = err;
        }

        if (error) throw error;

        res.json({ success: true, data: data || [] });
    } catch (error) {
        console.error('[products] Erro ao listar:', error);
        res.status(500).json({ success: false, message: 'Erro ao listar produtos' });
    }
});

/**
 * Obtém um produto específico
 * GET /api/products/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ success: false, message: 'Produto não encontrado' });
            }
            throw error;
        }

        res.json({ success: true, data });
    } catch (error) {
        console.error('[products] Erro ao obter:', error);
        res.status(500).json({ success: false, message: 'Erro ao buscar produto' });
    }
});

/**
 * Cria um novo produto
 * POST /api/products
 */
router.post('/', async (req, res) => {
    try {
        const { nome, quantidade, unidade, custo, comissao, descricao, user_id } = req.body;

        if (!nome) {
            return res.status(400).json({ success: false, message: 'Nome é obrigatório' });
        }

        const isAdmin = req.user.nivel === 'Admin';
        let targetUserId = req.user.id;
        
        if (isAdmin && user_id) {
            targetUserId = user_id;
        }

        const { data, error } = await supabase
            .from('products')
            .insert([{
                user_id: targetUserId,
                nome,
                quantidade: quantidade || 0,
                unidade,
                custo,
                comissao,
                descricao
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({ success: true, message: 'Produto criado!', data });
    } catch (error) {
        console.error('[products] Erro ao criar:', error);
        res.status(400).json({ success: false, message: error.message || 'Erro ao criar produto' });
    }
});

/**
 * Atualiza um produto
 * PUT /api/products/:id
 */
router.put('/:id', async (req, res) => {
    try {
        const { nome, quantidade, unidade, custo, comissao, descricao } = req.body;

        const { data, error } = await supabase
            .from('products')
            .update({
                nome,
                quantidade,
                unidade,
                custo,
                comissao,
                descricao,
                updated_at: new Date().toISOString()
            })
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .select()
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ success: false, message: 'Produto não encontrado' });
            }
            throw error;
        }

        res.json({ success: true, message: 'Produto atualizado!', data });
    } catch (error) {
        console.error('[products] Erro ao atualizar:', error);
        res.status(400).json({ success: false, message: error.message || 'Erro ao atualizar produto' });
    }
});

/**
 * Remove um produto
 * DELETE /api/products/:id
 */
router.delete('/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', req.params.id)
            .eq('user_id', req.user.id);

        if (error) throw error;

        res.json({ success: true, message: 'Produto removido!' });
    } catch (error) {
        console.error('[products] Erro ao remover:', error);
        res.status(400).json({ success: false, message: 'Erro ao remover produto' });
    }
});

module.exports = router;