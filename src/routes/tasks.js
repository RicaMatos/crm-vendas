/**
 * Rotas de Tarefas
 * @module routes/tasks
 */

const express = require('express');
const router = express.Router();
const taskService = require('../services/taskService');
const { authenticate } = require('../middleware/authenticate');

router.use(authenticate);

router.get('/', async (req, res) => {
    try {
        const tarefas = await taskService.listarTarefas(req.user.id);
        res.json({ success: true, data: tarefas });
    } catch (error) {
        console.error('[tasks] Erro ao listar:', error);
        res.status(500).json({ success: false, message: 'Erro ao listar tarefas' });
    }
});

router.post('/', async (req, res) => {
    try {
        const tarefa = await taskService.criarTarefa(req.user.id, req.body);
        res.status(201).json({ success: true, message: 'Tarefa criada!', data: tarefa });
    } catch (error) {
        console.error('[tasks] Erro ao criar:', error);
        res.status(400).json({ success: false, message: error.message || 'Erro ao criar tarefa' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const tarefa = await taskService.atualizarTarefa(req.user.id, parseInt(req.params.id), req.body);
        res.json({ success: true, message: 'Tarefa atualizada!', data: tarefa });
    } catch (error) {
        console.error('[tasks] Erro ao atualizar:', error);
        res.status(400).json({ success: false, message: error.message || 'Erro ao atualizar tarefa' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await taskService.removerTarefa(req.user.id, parseInt(req.params.id));
        res.json({ success: true, message: 'Tarefa removida!' });
    } catch (error) {
        console.error('[tasks] Erro ao remover:', error);
        res.status(400).json({ success: false, message: 'Erro ao remover tarefa' });
    }
});

module.exports = router;