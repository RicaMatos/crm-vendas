/**
 * Serviço de Tarefas
 * @module services/taskService
 */

const { supabase } = require('../config/supabaseClient');

async function listarTarefas(userId) {
    const { data, error } = await supabase
        .from('tasks')
        .select('*, customers(nome)')
        .eq('user_id', userId)
        .order('data', { ascending: true });

    if (error) throw error;
    return data || [];
}

async function criarTarefa(userId, tarefaData) {
    const { data, error } = await supabase
        .from('tasks')
        .insert([{
            user_id: userId,
            customer_id: tarefaData.customer_id || null,
            titulo: tarefaData.titulo,
            data: tarefaData.data || null,
            prioridade: tarefaData.prioridade || 'media',
            status: tarefaData.status || 'pendente'
        }])
        .select()
        .single();

    if (error) throw error;
    return data;
}

async function atualizarTarefa(userId, tarefaId, tarefaData) {
    const { data, error } = await supabase
        .from('tasks')
        .update({
            titulo: tarefaData.titulo,
            data: tarefaData.data,
            prioridade: tarefaData.prioridade,
            status: tarefaData.status,
            customer_id: tarefaData.customer_id,
            updated_at: new Date().toISOString()
        })
        .eq('id', tarefaId)
        .eq('user_id', userId)
        .select()
        .single();

    if (error) {
        if (error.code === 'PGRST116') throw new Error('Tarefa não encontrada');
        throw error;
    }
    return data;
}

async function removerTarefa(userId, tarefaId) {
    const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', tarefaId)
        .eq('user_id', userId);

    if (error) throw error;
}

module.exports = {
    listarTarefas,
    criarTarefa,
    atualizarTarefa,
    removerTarefa
};