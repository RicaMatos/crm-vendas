/**
 * Rotas de Webhooks - Integração com n8n/WhatsApp
 * @module routes/webhooks
 * 
 * Recebe dados externos (mensagens de WhatsApp via n8n)
 * e registra automaticamente no CRM.
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabaseClient');
const logService = require('../services/logService');
const { optionalAuth } = require('../middleware/authenticate');

/**
 * Webhook para receber mensagens do n8n/WhatsApp
 * POST /api/webhooks/n8n
 * 
 * Body esperado:
 * {
 *   "user_id": "uuid-do-usuario",
 *   "customer_id": "numero-telefone-ou-id",
 *   "customer_whatsapp": "+5585999999999",
 *   "customer_nome": "Nome do Cliente",
 *   "mensagem": "Conteúdo da mensagem",
 *   "tipo": "whatsapp|ligacao|email",
 *   "timestamp": "2024-01-01T10:00:00Z"
 * }
 */
router.post('/n8n', async (req, res) => {
    try {
        const payload = req.body;

        console.log('[webhooks] Recebido webhook do n8n:', payload);

        // Validações básicas
        if (!payload.mensagem) {
            return res.status(400).json({
                success: false,
                message: 'Mensagem é obrigatória'
            });
        }

        // Se não veio user_id, retorna erro
        if (!payload.user_id) {
            return res.status(400).json({
                success: false,
                message: 'user_id é obrigatório'
            });
        }

        // Busca ou cria cliente pelo WhatsApp
        let customerId = payload.customer_id;

        if (payload.customer_whatsapp && !customerId) {
            // Normaliza o número
            const whatsapp = normalizarWhatsApp(payload.customer_whatsapp);
            
            // Busca cliente existente
            const { data: clienteExistente } = await supabase
                .from('customers')
                .select('id')
                .eq('user_id', payload.user_id)
                .eq('whatsapp', whatsapp)
                .single();

            if (clienteExistente) {
                customerId = clienteExistente.id;
            } else {
                // Cria novo cliente automaticamente
                const { data: novoCliente, error: erroCriacao } = await supabase
                    .from('customers')
                    .insert([{
                        user_id: payload.user_id,
                        nome: payload.customer_nome || 'Cliente via WhatsApp',
                        whatsapp: whatsapp,
                        status: 'Lead',
                        created_at: new Date().toISOString()
                    }])
                    .select('id')
                    .single();

                if (erroCriacao) {
                    console.error('[webhooks] Erro ao criar cliente:', erroCriacao);
                    // Continua mesmo se falhar - registra interação sem cliente
                } else {
                    customerId = novoCliente.id;
                }
            }
        }

        // Registra a interação
        const interacao = await logService.registrarWebhook({
            user_id: payload.user_id,
            customer_id: customerId,
            mensagem: payload.mensagem,
            tipo: payload.tipo || 'whatsapp',
            source: 'n8n',
            timestamp: payload.timestamp
        });

        console.log('[webhooks] Interação registrada:', interacao.id);

        res.json({
            success: true,
            message: 'Webhook processado com sucesso',
            data: {
                interacao_id: interacao?.id,
                customer_id: customerId
            }
        });
    } catch (error) {
        console.error('[webhooks] Erro ao processar webhook:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao processar webhook'
        });
    }
});

/**
 * Webhook para confirmar recebimento (health check)
 * GET /api/webhooks/n8n
 */
router.get('/n8n', (req, res) => {
    res.json({
        success: true,
        message: 'Webhook endpoint ativo',
        timestamp: new Date().toISOString()
    });
});

/**
 * Webhook genérico para outras integrações
 * POST /api/webhooks/generic
 */
router.post('/generic', optionalAuth, async (req, res) => {
    try {
        const payload = req.body;

        console.log('[webhooks] Recebido webhook genérico:', payload);

        // Valida presença de dados mínimos
        if (!payload.tipo || !payload.observacao) {
            return res.status(400).json({
                success: false,
                message: 'tipo e observacao são obrigatórios'
            });
        }

        // Se não houver usuário autenticado, requer user_id explícito
        const userId = req.user?.id || payload.user_id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'user_id é obrigatório ou faça login'
            });
        }

        const interacao = await logService.registrarInteracao(userId, {
            customerId: payload.customer_id,
            tipo: payload.tipo,
            observacao: payload.observacao,
            origem: 'webhook_generic',
            contexto: {
                fonte: payload.fonte || 'external',
                dados_originais: payload
            }
        });

        res.json({
            success: true,
            message: 'Interação registrada',
            data: { interacao_id: interacao?.id }
        });
    } catch (error) {
        console.error('[webhooks] Erro no webhook genérico:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao processar webhook'
        });
    }
});

/**
 * Normaliza número de WhatsApp
 * @private
 */
function normalizarWhatsApp(whatsapp) {
    if (!whatsapp) return null;
    
    let numero = whatsapp.replace(/[^\d+]/g, '');
    
    if (!numero.startsWith('+')) {
        if (numero.startsWith('55')) {
            numero = '+' + numero;
        } else {
            numero = '+55' + numero;
        }
    }
    
    return numero;
}

module.exports = router;