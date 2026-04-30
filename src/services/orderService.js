/**
 * Serviço de Pedidos - Regras de Negócio
 * @module services/orderService
 */

const { supabase } = require('../config/supabaseClient');
const logService = require('./logService');

/**
 * Lista todos os pedidos do usuário
 * @param {string} userId - ID do usuário
 * @returns {Promise<Array>} Lista de pedidos
 */
async function listarPedidos(userId) {
    try {
        const { data, error } = await supabase
            .from('orders')
            .select(`
                *,
                customers (
                    id,
                    nome,
                    whatsapp,
                    cidade
                )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[orderService] Erro ao listar pedidos:', error);
            throw new Error(`Erro ao listar pedidos: ${error.message}`);
        }

        return data || [];
    } catch (error) {
        console.error('[orderService] Erro em listarPedidos:', error);
        throw error;
    }
}

/**
 * Obtém um pedido específico
 * @param {string} userId - ID do usuário
 * @param {number} pedidoId - ID do pedido
 * @returns {Promise<Object>} Pedido
 */
async function obterPedido(userId, pedidoId) {
    try {
        const { data, error } = await supabase
            .from('orders')
            .select(`
                *,
                customers (
                    id,
                    nome,
                    whatsapp,
                    email,
                    cidade,
                    uf
                )
            `)
            .eq('id', pedidoId)
            .eq('user_id', userId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw new Error(`Erro ao buscar pedido: ${error.message}`);
        }

        return data;
    } catch (error) {
        console.error('[orderService] Erro em obterPedido:', error);
        throw error;
    }
}

/**
 * Cria um novo pedido
 * @param {string} userId - ID do usuário
 * @param {Object} pedidoData - Dados do pedido
 * @returns {Promise<Object>} Pedido criado
 */
async function criarPedido(userId, pedidoData) {
    try {
        // Validações de negócio
        if (!pedidoData.customerId && !pedidoData.customer_id) {
            throw new Error('Cliente é obrigatório');
        }

        if (!pedidoData.items || !Array.isArray(pedidoData.items) || pedidoData.items.length === 0) {
            throw new Error('Pedido deve ter pelo menos um item');
        }

        // Valida cada item
        pedidoData.items.forEach((item, index) => {
            if (!item.nome && !item.productId) {
                throw new Error(`Item ${index + 1}: nome do produto é obrigatório`);
            }
            if (!item.quantidade || item.quantidade <= 0) {
                throw new Error(`Item ${index + 1}: quantidade inválida`);
            }
            if (!item.precoUnitario || item.precoUnitario <= 0) {
                throw new Error(`Item ${index + 1}: preço inválido`);
            }
        });

        // Calcula valor total
        const valorTotal = pedidoData.items.reduce((total, item) => {
            return total + (item.quantidade * (item.valorUnitario || item.precoUnitario || 0));
        }, 0);

        // Gera número do pedido
        const numeroPedido = await gerarNumeroPedido(userId);

        // Processa parcelas
        const parcelasDetalhes = processarParcelas(
            valorTotal,
            pedidoData.parcelas || 1,
            pedidoData.vencimentoPrimeiraParcela
        );

        const customerId = pedidoData.customerId || pedidoData.customer_id;

        const { data, error } = await supabase
            .from('orders')
            .insert([{
                user_id: userId,
                customer_id: customerId,
                numero_pedido: numeroPedido,
                valor_total: valorTotal,
                data: pedidoData.data || new Date().toISOString().split('T')[0],
                status_pagamento: 'pendente',
                tipo_pagamento: pedidoData.tipoPagamento || pedidoData.tipo_pagamento,
                parcelas: pedidoData.parcelas || 1,
                items: pedidoData.items,
                parcelas_detalhes: parcelasDetalhes,
                observacoes: pedidoData.observacoes || pedidoData.observacoes,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) {
            throw new Error(`Erro ao criar pedido: ${error.message}`);
        }

        // Registra interação
        try {
            await logService.registrarInteracao(userId, {
                customerId: customerId,
                orderId: data.id,
                tipo: 'pedido_criado',
                observacao: `Pedido #${numeroPedido} criado - R$ ${valorTotal.toFixed(2)}`,
                acao: 'criar_pedido'
            });
        } catch (logError) {
            console.warn('[orderService] Erro ao registrar interação:', logError);
        }

        return data;
    } catch (error) {
        console.error('[orderService] Erro em criarPedido:', error);
        throw error;
    }
}

/**
 * Atualiza um pedido existente
 * @param {string} userId - ID do usuário
 * @param {number} pedidoId - ID do pedido
 * @param {Object} pedidoData - Novos dados
 * @returns {Promise<Object>} Pedido atualizado
 */
async function atualizarPedido(userId, pedidoId, pedidoData) {
    try {
        let valorTotal = 0;
        
        if (pedidoData.valorTotal && typeof pedidoData.valorTotal === 'number') {
            valorTotal = pedidoData.valorTotal;
        } else if (pedidoData.items && Array.isArray(pedidoData.items)) {
            valorTotal = pedidoData.items.reduce((sum, item) => {
                return sum + ((item.quantidade || 0) * (item.valorUnitario || item.precoUnitario || 0));
            }, 0);
        }
        
        const updateData = {
            tipo_pagamento: pedidoData.tipoPagamento || pedidoData.tipo_pagamento,
            parcelas: pedidoData.parcelas,
            items: pedidoData.items,
            valor_total: valorTotal,
            parcelas_detalhes: pedidoData.parcelas_detalhes,
            observacoes: pedidoData.observacoes || pedidoData.observacoes,
            updated_at: new Date().toISOString()
        };
        
        if (pedidoData.data) {
            updateData.data = pedidoData.data;
        }
        
        const { data, error } = await supabase
            .from('orders')
            .update(updateData)
            .eq('id', pedidoId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                throw new Error('Pedido não encontrado');
            }
            throw new Error(`Erro ao atualizar pedido: ${error.message}`);
        }

        // Registra interação
        try {
            await logService.registrarInteracao(userId, {
                customerId: data.customer_id,
                orderId: data.id,
                tipo: 'pedido_atualizado',
                observacao: `Pedido #${data.numero_pedido} atualizado`,
                acao: 'atualizar_pedido'
            });
        } catch (logError) {
            console.warn('[orderService] Erro ao registrar interação:', logError);
        }

        return data;
    } catch (error) {
        console.error('[orderService] Erro em atualizarPedido:', error);
        throw error;
    }
}

/**
 * Atualiza status de pagamento do pedido
 * @param {string} userId - ID do usuário
 * @param {number} pedidoId - ID do pedido
 * @param {string} novoStatus - Novo status
 * @returns {Promise<Object>} Pedido atualizado
 */
async function atualizarStatusPagamento(userId, pedidoId, novoStatus) {
    try {
        const statusValidos = ['pendente', 'pago', 'atrasado', 'cancelado'];
        if (!statusValidos.includes(novoStatus)) {
            throw new Error(`Status inválido. Valores permitidos: ${statusValidos.join(', ')}`);
        }

        const { data, error } = await supabase
            .from('orders')
            .update({
                status_pagamento: novoStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', pedidoId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                throw new Error('Pedido não encontrado');
            }
            throw new Error(`Erro ao atualizar status: ${error.message}`);
        }

        // Registra interação
        try {
            await logService.registrarInteracao(userId, {
                customerId: data.customer_id,
                orderId: data.id,
                tipo: novoStatus === 'pago' ? 'pagamento_recebido' : 'pedido_atualizado',
                observacao: `Status de pagamento alterado para: ${novoStatus}`,
                acao: 'atualizar_status_pagamento'
            });
        } catch (logError) {
            console.warn('[orderService] Erro ao registrar interação:', logError);
        }

        return data;
    } catch (error) {
        console.error('[orderService] Erro em atualizarStatusPagamento:', error);
        throw error;
    }
}

/**
 * Cancela um pedido
 * @param {string} userId - ID do usuário
 * @param {number} pedidoId - ID do pedido
 * @returns {Promise<void>}
 */
async function cancelarPedido(userId, pedidoId) {
    try {
        const { data, error } = await supabase
            .from('orders')
            .update({
                status_pagamento: 'cancelado',
                updated_at: new Date().toISOString()
            })
            .eq('id', pedidoId)
            .eq('user_id', userId)
            .select('*, customers(nome)')
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                throw new Error('Pedido não encontrado');
            }
            throw new Error(`Erro ao cancelar pedido: ${error.message}`);
        }

        // Registra interação
        try {
            await logService.registrarInteracao(userId, {
                customerId: data.customer_id,
                orderId: data.id,
                tipo: 'pedido_atualizado',
                observacao: `Pedido #${data.numero_pedido} cancelado`,
                acao: 'cancelar_pedido'
            });
        } catch (logError) {
            console.warn('[orderService] Erro ao registrar interação:', logError);
        }
    } catch (error) {
        console.error('[orderService] Erro em cancelarPedido:', error);
        throw error;
    }
}

/**
 * Remove um pedido
 * @param {string} userId - ID do usuário
 * @param {number} pedidoId - ID do pedido
 */
async function removerPedido(userId, pedidoId) {
    try {
        const { error } = await supabase
            .from('orders')
            .delete()
            .eq('id', pedidoId)
            .eq('user_id', userId);

        if (error) {
            if (error.code === 'PGRST116') {
                throw new Error('Pedido não encontrado');
            }
            throw new Error(`Erro ao remover pedido: ${error.message}`);
        }
    } catch (error) {
        console.error('[orderService] Erro em removerPedido:', error);
        throw error;
    }
}

/**
 * Gera número sequencial de pedido
 * @private
 * @param {string} userId - ID do usuário
 * @returns {Promise<string>} Número do pedido
 */
async function gerarNumeroPedido(userId) {
    // Usa a função do PostgreSQL
    const { data, error } = await supabase.rpc('generate_order_number');
    
    if (error) {
        // Fallback: geração local
        const prefixo = 'PED';
        const dataAtual = new Date();
        const ano = dataAtual.getFullYear().toString().slice(-2);
        const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
        const dia = String(dataAtual.getDate()).padStart(2, '0');
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return `${prefixo}${ano}${mes}${dia}${random}`;
    }
    
    return data;
}

/**
 * Processa informações das parcelas
 * @private
 * @param {number} valorTotal - Valor total do pedido
 * @param {number} numParcelas - Número de parcelas
 * @param {string} dataVencimento - Data do primeiro vencimento
 * @returns {Array} Array de parcelas
 */
function processarParcelas(valorTotal, numParcelas, dataVencimento) {
    if (numParcelas <= 1) {
        return [{
            numero: 1,
            valor: parseFloat(valorTotal.toFixed(2)),
            vencimento: dataVencimento || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: 'pendente'
        }];
    }

    const valorParcela = valorTotal / numParcelas;
    const parcelas = [];
    const dataBase = dataVencimento 
        ? new Date(dataVencimento) 
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    for (let i = 1; i <= numParcelas; i++) {
        const vencimento = new Date(dataBase);
        vencimento.setMonth(vencimento.getMonth() + (i - 1));
        
        parcelas.push({
            numero: i,
            valor: parseFloat(valorParcela.toFixed(2)),
            vencimento: vencimento.toISOString().split('T')[0],
            status: 'pendente'
        });
    }

    return parcelas;
}

/**
 * Obtém estatísticas dos pedidos
 * @param {string} userId - ID do usuário
 * @returns {Promise<Object>} Estatísticas
 */
async function obterEstatisticas(userId) {
    try {
        const { data, error } = await supabase
            .from('orders')
            .select('status_pagamento, valor_total')
            .eq('user_id', userId);

        if (error) {
            throw new Error(`Erro ao obter estatísticas: ${error.message}`);
        }

        const total = data.length;
        const valorTotal = data.reduce((sum, o) => sum + parseFloat(o.valor_total || 0), 0);
        const porStatus = {};
        
        data.forEach(o => {
            porStatus[o.status_pagamento] = (porStatus[o.status_pagamento] || 0) + 1;
        });

        return {
            total,
            valorTotal,
            porStatus
        };
    } catch (error) {
        console.error('[orderService] Erro em obterEstatisticas:', error);
        throw error;
    }
}

module.exports = {
    listarPedidos,
    obterPedido,
    criarPedido,
    atualizarPedido,
    atualizarStatusPagamento,
    cancelarPedido,
    removerPedido,
    obterEstatisticas
};