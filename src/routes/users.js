/**
 * Rotas de Gerenciamento de Usuários (Admin)
 * @module routes/users
 * 
 * CRUD de usuários e estatísticas para administradores.
 */

const express = require('express');
const router = express.Router();
const { supabase, supabaseAnon } = require('../config/supabaseClient');
const { authenticate } = require('../middleware/authenticate');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@crm.com';

function isPrimeiroAdmin(email) {
    return email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

function isAdmin(req) {
    return req.user?.nivel === 'Admin';
}

router.use(authenticate);

router.get('/', async (req, res) => {
    try {
        if (!isAdmin(req)) {
            return res.status(403).json({
                success: false,
                message: 'Acesso restrito a administradores'
            });
        }

        const { data: usersList, error } = await supabase.auth.admin.listUsers();

        if (error) {
            console.error('[users] Erro ao listar usuários:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro ao listar usuários'
            });
        }

        const users = usersList.users.map(user => ({
            id: user.id,
            email: user.email,
            nome: user.user_metadata?.nome || user.email.split('@')[0],
            nivel: user.user_metadata?.nivel || 'Vendedor',
            created_at: user.created_at
        }));

        res.json({
            success: true,
            data: users
        });
    } catch (error) {
        console.error('[users] Erro em GET /:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

router.get('/:id/stats', async (req, res) => {
    try {
        if (!isAdmin(req)) {
            return res.status(403).json({
                success: false,
                message: 'Acesso restrito a administradores'
            });
        }

        const targetUserId = req.params.id;

        const [customersCount, productsCount, cropsCount] = await Promise.all([
            supabase.from('customers').select('id', { count: 'exact', head: true }).eq('user_id', targetUserId),
            supabase.from('products').select('id', { count: 'exact', head: true }).eq('user_id', targetUserId),
            supabase.from('crops').select('id', { count: 'exact', head: true }).eq('user_id', targetUserId)
        ]);

        const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select('valor_total')
            .eq('user_id', targetUserId);

        if (ordersError) throw ordersError;

        const qtdVendas = orders?.length || 0;
        const valorVendas = orders?.reduce((sum, o) => sum + (parseFloat(o.valor_total) || 0), 0) || 0;

        res.json({
            success: true,
            data: {
                qtd_vendas: qtdVendas,
                valor_vendas: valorVendas,
                produtos_cadastrados: productsCount.count || 0,
                culturas_cadastradas: cropsCount.count || 0,
                clientes_cadastrados: customersCount.count || 0
            }
        });
    } catch (error) {
        console.error('[users] Erro em GET /:id/stats:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao obter estatísticas'
        });
    }
});

router.post('/', async (req, res) => {
    try {
        if (!isAdmin(req)) {
            return res.status(403).json({
                success: false,
                message: 'Acesso restrito a administradores'
            });
        }

        const { email, password, nome, nivel } = req.body;

        if (!email || !password || !nome) {
            return res.status(400).json({
                success: false,
                message: 'Email, senha e nome são obrigatórios'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Senha deve ter pelo menos 6 caracteres'
            });
        }

        const nivelFinal = nivel || 'Vendedor';

        if (nivelFinal === 'Admin' && !isPrimeiroAdmin(req.user.email)) {
            return res.status(403).json({
                success: false,
                message: 'Apenas o administrador principal pode criar outros administradores'
            });
        }

        const { data: authData, error: authError } = await supabaseAnon.auth.signUp({
            email,
            password,
            options: {
                data: {
                    nome,
                    nivel: nivelFinal
                }
            }
        });

        if (authError) {
            if (authError.message.includes('already registered')) {
                return res.status(400).json({
                    success: false,
                    message: 'Este email já está cadastrado'
                });
            }
            console.error('[users] Erro ao criar usuário:', authError);
            return res.status(400).json({
                success: false,
                message: 'Erro ao criar usuário: ' + authError.message
            });
        }

        res.status(201).json({
            success: true,
            message: 'Usuário criado com sucesso',
            data: {
                id: authData.user.id,
                email,
                nome,
                nivel: nivelFinal
            }
        });
    } catch (error) {
        console.error('[users] Erro em POST /:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

router.put('/:id', async (req, res) => {
    try {
        if (!isAdmin(req)) {
            return res.status(403).json({
                success: false,
                message: 'Acesso restrito a administradores'
            });
        }

        const targetUserId = req.params.id;
        const { nome, nivel } = req.body;

        if (!nome && !nivel) {
            return res.status(400).json({
                success: false,
                message: 'Informe nome ou nivel para atualizar'
            });
        }

        const updateData = {};
        if (nome) updateData.data = { nome };
        if (nivel) {
            if (nivel === 'Admin' && !isPrimeiroAdmin(req.user.email)) {
                return res.status(403).json({
                    success: false,
                    message: 'Apenas o administrador principal pode atribuir nível Admin'
                });
            }
            updateData.data = { ...updateData.data, nivel };
        }

        const { error: updateError } = await supabase.auth.admin.updateUserById(
            targetUserId,
            updateData
        );

        if (updateError) {
            console.error('[users] Erro ao atualizar usuário:', updateError);
            return res.status(400).json({
                success: false,
                message: 'Erro ao atualizar usuário'
            });
        }

        res.json({
            success: true,
            message: 'Usuário atualizado com sucesso'
        });
    } catch (error) {
        console.error('[users] Erro em PUT /:id:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        if (!isAdmin(req)) {
            return res.status(403).json({
                success: false,
                message: 'Acesso restrito a administradores'
            });
        }

        const targetUserId = req.params.id;

        if (targetUserId === req.user.id) {
            return res.status(400).json({
                success: false,
                message: 'Não é possível excluir seu próprio usuário'
            });
        }

        const { error: deleteError } = await supabase.auth.admin.deleteUser(targetUserId);

        if (deleteError) {
            console.error('[users] Erro ao excluir usuário:', deleteError);
            return res.status(400).json({
                success: false,
                message: 'Erro ao excluir usuário'
            });
        }

        res.json({
            success: true,
            message: 'Usuário excluído com sucesso'
        });
    } catch (error) {
        console.error('[users] Erro em DELETE /:id:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

module.exports = router;

// Rota especial para deletar usuário por email
router.post('/delete-by-email', async (req, res) => {
    try {
        if (!isAdmin(req)) {
            return res.status(403).json({
                success: false,
                message: 'Acesso restrito a administradores'
            });
        }

        const { email } = req.body;
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email é obrigatório'
            });
        }

        // Buscar usuário pelo email
        const { data: usersList, error: listError } = await supabase.auth.admin.listUsers();
        
        if (listError) {
            return res.status(500).json({
                success: false,
                message: 'Erro ao buscar usuários'
            });
        }

        const user = usersList.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Usuário não encontrado'
            });
        }

        // Não pode excluir o admin principal
        if (isPrimeiroAdmin(user.email)) {
            return res.status(403).json({
                success: false,
                message: 'Não é possível excluir o administrador principal'
            });
        }

        const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);

        if (deleteError) {
            return res.status(400).json({
                success: false,
                message: 'Erro ao excluir usuário'
            });
        }

        res.json({
            success: true,
            message: `Usuário ${email} excluído com sucesso`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Erro interno'
        });
    }
});