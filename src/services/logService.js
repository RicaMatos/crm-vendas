/**
 * Serviço de Logs - Registro Estruturado para IA
 * @module services/logService
 * 
 * Armazena interações em formato JSON estruturado,
 * permitindo que agentes de IA futuramente processem
 * o histórico de clientes.
 */

const { supabase } = require('../config/supabaseClient');

/**
 * Tipos de interação suportados
 */
const TIPOS_INTERACAO = {
    WHATSAPP: 'whatsapp',
    LIGACAO: 'ligacao',
    EMAIL: 'email',
    VISITA: 'visita',
    PEDIDO_CRIADO: 'pedido_criado',
    PEDIDO_ATUALIZADO: 'pedido_atualizado',
    PAGAMENTO_RECEBIDO: 'pagamento_recebido',
    OBSERVACAO: 'observacao',
    WEBHOOK: 'webhook',
    SISTEMA: 'sistema'
};

/**
 * Registra uma interação no banco de dados
 * @param {string} userId - ID do usuário
 * @param {Object} dados - Dados da interação
 * @returns {Promise<Object>} Interação criada
 */
async function registrarInteracao(userId, dados) {
    try {
        if (!dados.customerId && !dados.customer_id) {
            throw new Error('customerId é obrigatório para registrar interação');
        }

        const interacao = {
            user_id: userId,
            customer_id: dados.customerId || dados.customer_id,
            order_id: dados.orderId || dados.order_id || null,
            tipo: dados.tipo || TIPOS_INTERACAO.OBSERVACAO,
            observacao: dados.observacao || '',
            data: dados.data || new Date().toISOString(),
            metadata_ia: {
                // Estrutura JSON para agentes de IA
                origem: dados.origem || 'sistema_web',
                ip_address: dados.ip || null,
                user_agent: dados.userAgent || null,
                acao: dados.acao || dados.tipo,
                timestamp: new Date().toISOString(),
                // Informações contextuais extras
                contexto: dados.contexto || {},
                // Histórico estruturado para IA
                resumo_ia: dados.resumoIa || gerarResumo(dados),
                entidades: dados.entidades || extrairEntidades(dados.observacao)
            }
        };

        const { data, error } = await supabase
            .from('interactions')
            .insert([interacao])
            .select()
            .single();

        if (error) {
            console.error('[logService] Erro ao registrar interação:', error);
            throw new Error(`Erro ao registrar interação: ${error.message}`);
        }

        console.log(`[logService] Interação registrada: ${data.tipo} para cliente ${data.customer_id}`);
        return data;
    } catch (error) {
        console.error('[logService] Erro em registrarInteracao:', error);
        throw error;
    }
}

/**
 * Lista interações de um cliente
 * @param {string} userId - ID do usuário
 * @param {number} customerId - ID do cliente
 * @returns {Promise<Array>} Lista de interações
 */
async function listarInteracoes(userId, customerId) {
    try {
        const { data, error } = await supabase
            .from('interactions')
            .select('*')
            .eq('customer_id', customerId)
            .eq('user_id', userId)
            .order('data', { ascending: false });

        if (error) {
            throw new Error(`Erro ao listar interações: ${error.message}`);
        }

        return data || [];
    } catch (error) {
        console.error('[logService] Erro em listarInteracoes:', error);
        throw error;
    }
}

/**
 * Lista interações recentes do usuário
 * @param {string} userId - ID do usuário
 * @param {number} limite - Número máximo de registros
 * @returns {Promise<Array>} Lista de interações
 */
async function listarInteracoesRecentes(userId, limite = 50) {
    try {
        const { data, error } = await supabase
            .from('interactions')
            .select(`
                *,
                customers (
                    id,
                    nome
                )
            `)
            .eq('user_id', userId)
            .order('data', { ascending: false })
            .limit(limite);

        if (error) {
            throw new Error(`Erro ao listar interações: ${error.message}`);
        }

        return data || [];
    } catch (error) {
        console.error('[logService] Erro em listarInteracoesRecentes:', error);
        throw error;
    }
}

/**
 * Gera um resumo da interação para IA
 * @private
 */
function gerarResumo(dados) {
    const tipo = dados.tipo || 'interacao';
    const obs = dados.observacao || '';
    
    // Gera resumo automático baseado no tipo
    switch (tipo) {
        case TIPOS_INTERACAO.PEDIDO_CRIADO:
            return `Novo pedido criado: ${obs}`;
        case TIPOS_INTERACAO.PAGAMENTO_RECEBIDO:
            return `Pagamento recebido: ${obs}`;
        case TIPOS_INTERACAO.WHATSAPP:
            return `Contato via WhatsApp`;
        case TIPOS_INTERACAO.LIGACAO:
            return `Contato via ligação`;
        default:
            return obs.substring(0, 100);
    }
}

/**
 * Extrai entidades do texto para processamento de IA
 * @private
 */
function extrairEntidades(texto) {
    if (!texto) return {};
    
    const entidades = {
        menciona_pedido: false,
        menciona_pagamento: false,
        menciona_produto: false,
        palavras_chave: []
    };

    const textoLower = texto.toLowerCase();
    
    // Detecta menções
    if (textoLower.includes('pedido') || textoLower.includes('compra')) {
        entidades.menciona_pedido = true;
        entidades.palavras_chave.push('pedido');
    }
    if (textoLower.includes('pagamento') || textoLower.includes('pago') || textoLower.includes('receber')) {
        entidades.menciona_pagamento = true;
        entidades.palavras_chave.push('pagamento');
    }
    if (textoLower.includes('produto') || textoLower.includes('item')) {
        entidades.menciona_produto = true;
        entidades.palavras_chave.push('produto');
    }

    return entidades;
}

/**
 * Registra interação via webhook (n8n)
 * @param {Object} payload - Dados recebidos do webhook
 * @returns {Promise<Object>} Interação criada
 */
async function registrarWebhook(payload) {
    try {
        // Valida payload mínimo
        if (!payload.user_id || !payload.customer_id) {
            throw new Error('Payload inválido: user_id e customer_id são obrigatórios');
        }

        const dados = {
            customerId: payload.customer_id,
            orderId: payload.order_id,
            tipo: TIPOS_INTERACAO.WEBHOOK,
            observacao: payload.mensagem || payload.observacao || 'Mensagem recebida via webhook',
            origem: 'webhook_n8n',
            contexto: {
                webhook_type: payload.type || 'unknown',
                source: payload.source || 'n8n',
                raw_data: payload
            },
            resumoIa: `Mensagem automática recebida: ${payload.mensagem || 'sem conteúdo'}`
        };

        return await registrarInteracao(payload.user_id, dados);
    } catch (error) {
        console.error('[logService] Erro em registrarWebhook:', error);
        throw error;
    }
}

module.exports = {
    TIPOS_INTERACAO,
    registrarInteracao,
    listarInteracoes,
    listarInteracoesRecentes,
    registrarWebhook
};