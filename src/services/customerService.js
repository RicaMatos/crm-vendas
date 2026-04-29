/**
 * Serviço de Clientes - Regras de Negócio
 * @module services/customerService
 */

const { supabase } = require('../config/supabaseClient');
const logService = require('./logService');

/**
 * Lista todos os clientes do usuário
 * @param {string} userId - ID do usuário no Supabase Auth
 * @returns {Promise<Array>} Lista de clientes
 */
async function listarClientes(userId) {
    try {
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[customerService] Erro ao listar clientes:', error);
            throw new Error(`Erro ao listar clientes: ${error.message}`);
        }

        return data || [];
    } catch (error) {
        console.error('[customerService] Erro em listarClientes:', error);
        throw error;
    }
}

/**
 * Obtém um cliente específico
 * @param {string} userId - ID do usuário
 * @param {number} clienteId - ID do cliente
 * @returns {Promise<Object>} Cliente
 */
async function obterCliente(userId, clienteId) {
    try {
        const { data, error } = await supabase
            .from('customers')
            .select(`
                *,
                crops (
                    id,
                    nome,
                    cor
                )
            `)
            .eq('id', clienteId)
            .eq('user_id', userId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null; // Cliente não encontrado
            }
            throw new Error(`Erro ao buscar cliente: ${error.message}`);
        }

        return data;
    } catch (error) {
        console.error('[customerService] Erro em obterCliente:', error);
        throw error;
    }
}

/**
 * Cria um novo cliente
 * @param {string} userId - ID do usuário
 * @param {Object} clienteData - Dados do cliente
 * @returns {Promise<Object>} Cliente criado
 */
async function criarCliente(userId, clienteData) {
    try {
        // Validações de negócio
        if (!clienteData.nome || clienteData.nome.trim() === '') {
            throw new Error('Nome do cliente é obrigatório');
        }

        // Normaliza WhatsApp
        if (clienteData.whatsapp) {
            clienteData.whatsapp = normalizarWhatsApp(clienteData.whatsapp);
        }

        // Normaliza documento (CPF/CNPJ)
        if (clienteData.documento) {
            clienteData.documento = clienteData.documento.replace(/[^\d]/g, '');
        }

        const { data, error } = await supabase
            .from('customers')
            .insert([{
                user_id: userId,
                nome: clienteData.nome.trim(),
                documento: clienteData.documento || null,
                whatsapp: clienteData.whatsapp || null,
                email: clienteData.email || null,
                uf: clienteData.uf || null,
                cidade: clienteData.cidade || null,
                localizacao: clienteData.localizacao || null,
                status: clienteData.status || 'Lead',
                crop_id: clienteData.cropId || clienteData.crop_id || null,
                data_aniversario: clienteData.dataAniversario || clienteData.data_aniversario || null,
                lembrete_aniversario: Boolean(clienteData.lembreteAniversario),
                endereco: clienteData.endereco || null,
                cep: clienteData.cep || null,
                complemento: clienteData.complemento || null,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) {
            throw new Error(`Erro ao criar cliente: ${error.message}`);
        }

        // Registra interação inicial (sem throw se falhar)
        try {
            await logService.registrarInteracao(userId, {
                customerId: data.id,
                tipo: 'sistema',
                observacao: 'Cliente cadastrado no sistema',
                acao: 'cadastro_cliente'
            });
        } catch (logError) {
            console.warn('[customerService] Erro ao registrar interação inicial:', logError);
        }

        return data;
    } catch (error) {
        console.error('[customerService] Erro em criarCliente:', error);
        throw error;
    }
}

/**
 * Atualiza um cliente existente
 * @param {string} userId - ID do usuário
 * @param {number} clienteId - ID do cliente
 * @param {Object} clienteData - Novos dados
 * @returns {Promise<Object>} Cliente atualizado
 */
async function atualizarCliente(userId, clienteId, clienteData) {
    try {
        // Normaliza WhatsApp se fornecido
        if (clienteData.whatsapp) {
            clienteData.whatsapp = normalizarWhatsApp(clienteData.whatsapp);
        }

        // Normaliza documento se fornecido
        if (clienteData.documento) {
            clienteData.documento = clienteData.documento.replace(/[^\d]/g, '');
        }

        const { data, error } = await supabase
            .from('customers')
            .update({
                nome: clienteData.nome?.trim(),
                documento: clienteData.documento,
                whatsapp: clienteData.whatsapp,
                email: clienteData.email,
                uf: clienteData.uf,
                cidade: clienteData.cidade,
                localizacao: clienteData.localizacao,
                status: clienteData.status,
                crop_id: clienteData.cropId || clienteData.crop_id,
                data_aniversario: clienteData.dataAniversario || clienteData.data_aniversario,
                lembrete_aniversario: clienteData.lembreteAniversario !== undefined 
                    ? Boolean(clienteData.lembreteAniversario) 
                    : undefined,
                endereco: clienteData.endereco,
                cep: clienteData.cep,
                complemento: clienteData.complemento,
                updated_at: new Date().toISOString()
            })
            .eq('id', clienteId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                throw new Error('Cliente não encontrado');
            }
            throw new Error(`Erro ao atualizar cliente: ${error.message}`);
        }

        return data;
    } catch (error) {
        console.error('[customerService] Erro em atualizarCliente:', error);
        throw error;
    }
}

/**
 * Remove um cliente
 * @param {string} userId - ID do usuário
 * @param {number} clienteId - ID do cliente
 */
async function removerCliente(userId, clienteId) {
    try {
        const { error } = await supabase
            .from('customers')
            .delete()
            .eq('id', clienteId)
            .eq('user_id', userId);

        if (error) {
            if (error.code === 'PGRST116') {
                throw new Error('Cliente não encontrado');
            }
            throw new Error(`Erro ao remover cliente: ${error.message}`);
        }
    } catch (error) {
        console.error('[customerService] Erro em removerCliente:', error);
        throw error;
    }
}

/**
 * Busca clientes por termo
 * @param {string} userId - ID do usuário
 * @param {string} termo - Termo de busca
 * @returns {Promise<Array>} Lista de clientes
 */
async function buscarClientes(userId, termo) {
    try {
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .eq('user_id', userId)
            .or(`nome.ilike.%${termo}%,whatsapp.ilike.%${termo}%,email.ilike.%${termo}%,cidade.ilike.%${termo}%`)
            .order('nome', { ascending: true })
            .limit(50);

        if (error) {
            throw new Error(`Erro ao buscar clientes: ${error.message}`);
        }

        return data || [];
    } catch (error) {
        console.error('[customerService] Erro em buscarClientes:', error);
        throw error;
    }
}

/**
 * Lista clientes com aniversário próximos
 * @param {string} userId - ID do usuário
 * @param {number} dias - Dias à frente para buscar
 * @returns {Promise<Array>} Lista de clientes
 */
async function listarAniversariantes(userId, dias = 30) {
    try {
        const hoje = new Date();
        const dataLimite = new Date();
        dataLimite.setDate(hoje.getDate() + dias);

        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .eq('user_id', userId)
            .eq('lembrete_aniversario', true)
            .not('data_aniversario', 'is', null)
            .order('data_aniversario', { ascending: true });

        if (error) {
            throw new Error(`Erro ao buscar aniversariantes: ${error.message}`);
        }

        // Filtra apenas os próximos (lógica em JS por ser mais simples)
        const resultado = (data || []).filter(c => {
            const aniv = new Date(c.data_aniversario);
            const anoAtual = new Date(hoje.getFullYear(), aniv.getMonth(), aniv.getDate());
            return anoAtual >= hoje && anoAtual <= dataLimite;
        });

        return resultado;
    } catch (error) {
        console.error('[customerService] Erro em listarAniversariantes:', error);
        throw error;
    }
}

/**
 * Normaliza número de WhatsApp
 * @private
 * @param {string} whatsapp - Número original
 * @returns {string} Número normalizado
 */
function normalizarWhatsApp(whatsapp) {
    if (!whatsapp) return null;
    
    // Remove caracteres não numéricos exceto +
    let numero = whatsapp.replace(/[^\d+]/g, '');
    
    // Adiciona código do país se não tiver
    if (!numero.startsWith('+')) {
        if (numero.startsWith('55')) {
            numero = '+' + numero;
        } else {
            numero = '+55' + numero;
        }
    }
    
    return numero;
}

/**
 * Obtém estatísticas dos clientes
 * @param {string} userId - ID do usuário
 * @returns {Promise<Object>} Estatísticas
 */
async function obterEstatisticas(userId) {
    try {
        const { data, error } = await supabase
            .from('customers')
            .select('status')
            .eq('user_id', userId);

        if (error) {
            throw new Error(`Erro ao obter estatísticas: ${error.message}`);
        }

        const total = data.length;
        const porStatus = {};
        
        data.forEach(c => {
            porStatus[c.status] = (porStatus[c.status] || 0) + 1;
        });

        return {
            total,
            porStatus
        };
    } catch (error) {
        console.error('[customerService] Erro em obterEstatisticas:', error);
        throw error;
    }
}

module.exports = {
    listarClientes,
    obterCliente,
    criarCliente,
    atualizarCliente,
    removerCliente,
    buscarClientes,
    listarAniversariantes,
    obterEstatisticas
};