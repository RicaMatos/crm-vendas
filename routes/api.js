const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../database');
const { JWT_SECRET } = require('./auth');

// Middleware de Autenticação
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Token não fornecido' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Token inválido ou expirado' });
        req.user = user;
        next();
    });
}

// Proteger todas as rotas da API
router.use(authenticateToken);

// Whitelist de coleções permitidas
const allowedCollections = ['customers', 'products', 'orders', 'crops', 'interactions', 'tasks', 'users'];

// Whitelist de colunas por coleção (evita SQL injection em colunas)
const allowedColumns = {
    customers: ['nome', 'documento', 'whatsapp', 'email', 'uf', 'cidade', 'localizacao', 'status', 'cropId', 'dataAniversario', 'lembreteAniversario', 'createdAt', 'endereco', 'cep', 'complemento'],
    products: ['nome', 'quantidade', 'unidade', 'custo', 'comissao', 'descricao'],
    orders: ['customerId', 'valorTotal', 'data', 'statusPagamento', 'tipoPagamento', 'parcelas', 'items', 'parcelas_detalhes', 'observacoes', 'numeroPedido'],
    crops: ['nome', 'observacoes', 'cor'],
    interactions: ['customerId', 'data', 'tipo', 'observacao'],
    tasks: ['titulo', 'data', 'prioridade', 'status', 'customerId'],
    users: ['nome', 'email', 'senha', 'nivel']
};

// Campos obrigatórios por coleção
const requiredFields = {
    customers: ['nome'],
    products: ['nome'],
    orders: ['customerId', 'valorTotal'],
    crops: ['nome'],
    tasks: ['titulo', 'data'],
    users: ['nome', 'email', 'senha']
};

// Validar colunas permitidas
function getAllowedColumns(collection) {
    return allowedColumns[collection] || [];
}

// Validar campos obrigatórios
function validateRequiredFields(collection, data) {
    const required = requiredFields[collection] || [];
    const missing = required.filter(field => !data[field] && data[field] !== 0);
    if (missing.length > 0) {
        return { valid: false, message: `Campos obrigatórios faltando: ${missing.join(', ')}` };
    }
    return { valid: true };
}

// Obter todos os itens de uma coleção
router.get('/:collection', (req, res) => {
    const { collection } = req.params;
    if (!allowedCollections.includes(collection)) {
        return res.status(400).json({ message: 'Coleção inválida' });
    }

    db.all(`SELECT * FROM ${collection}`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Parsear campos JSON se existirem
        const parsedRows = rows.map(row => {
            if (row.items) row.items = JSON.parse(row.items);
            if (row.parcelas_detalhes) row.parcelas_detalhes = JSON.parse(row.parcelas_detalhes);
            if (row.lembreteAniversario !== undefined) row.lembreteAniversario = row.lembreteAniversario === 1;
            return row;
        });
        
        res.json(parsedRows);
    });
});

// Criar um novo item
router.post('/:collection', (req, res) => {
    const { collection } = req.params;
    if (!allowedCollections.includes(collection)) {
        return res.status(400).json({ message: 'Coleção inválida' });
    }

    const data = { ...req.body };
    
    // Validar campos obrigatórios
    const validation = validateRequiredFields(collection, data);
    if (!validation.valid) {
        return res.status(400).json({ message: validation.message });
    }

    // Filtrar apenas colunas permitidas
    const allowed = getAllowedColumns(collection);
    const filteredData = {};
    for (const key of Object.keys(data)) {
        if (allowed.includes(key)) {
            filteredData[key] = data[key];
        }
    }
    
    // Tratamento de campos JSON
    if (filteredData.items) filteredData.items = JSON.stringify(filteredData.items);
    if (filteredData.parcelas_detalhes) filteredData.parcelas_detalhes = JSON.stringify(filteredData.parcelas_detalhes);
    if (filteredData.lembreteAniversario !== undefined) filteredData.lembreteAniversario = filteredData.lembreteAniversario ? 1 : 0;

    const keys = Object.keys(filteredData);
    const values = Object.values(filteredData);
    const placeholders = keys.map(() => '?').join(',');

    const query = `INSERT INTO ${collection} (${keys.join(',')}) VALUES (${placeholders})`;

    db.run(query, values, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, ...filteredData });
    });
});

// Atualizar um item
router.put('/:collection/:id', (req, res) => {
    const { collection, id } = req.params;
    if (!allowedCollections.includes(collection)) {
        return res.status(400).json({ message: 'Coleção inválida' });
    }

    const data = { ...req.body };
    
    // Filtrar apenas colunas permitidas
    const allowed = getAllowedColumns(collection);
    const filteredData = {};
    for (const key of Object.keys(data)) {
        if (allowed.includes(key)) {
            filteredData[key] = data[key];
        }
    }
    
    // Tratamento de campos JSON
    if (filteredData.items) filteredData.items = JSON.stringify(filteredData.items);
    if (filteredData.parcelas_detalhes) filteredData.parcelas_detalhes = JSON.stringify(filteredData.parcelas_detalhes);
    if (filteredData.lembreteAniversario !== undefined) filteredData.lembreteAniversario = filteredData.lembreteAniversario ? 1 : 0;

    const keys = Object.keys(filteredData);
    const values = Object.values(filteredData);
    const setClause = keys.map(k => `${k} = ?`).join(',');

    const query = `UPDATE ${collection} SET ${setClause} WHERE id = ?`;

    db.run(query, [...values, id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ message: 'Item não encontrado' });
        res.json({ success: true, message: 'Item atualizado' });
    });
});

// Deletar um item
router.delete('/:collection/:id', (req, res) => {
    const { collection, id } = req.params;
    if (!allowedCollections.includes(collection)) {
        return res.status(400).json({ message: 'Coleção inválida' });
    }

    db.run(`DELETE FROM ${collection} WHERE id = ?`, [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ message: 'Item não encontrado' });
        res.json({ success: true, message: 'Item deletado' });
    });
});

module.exports = router;
