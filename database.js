const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'crm.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados:', err.message);
    } else {
        console.log('Conectado ao banco de dados SQLite.');
        initializeDB();
    }
});

function initializeDB() {
    db.serialize(() => {
        // Criar Tabelas
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            senha TEXT NOT NULL,
            nivel TEXT DEFAULT 'Vendedor'
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            documento TEXT,
            whatsapp TEXT,
            email TEXT,
            uf TEXT,
            cidade TEXT,
            localizacao TEXT,
            status TEXT DEFAULT 'Lead',
            cropId INTEGER,
            dataAniversario TEXT,
            lembreteAniversario INTEGER,
            createdAt TEXT,
            endereco TEXT,
            cep TEXT,
            complemento TEXT
        )`);

        // Migration: adicionar colunas de endereço se não existirem
        db.all("PRAGMA table_info(customers)", (err, columns) => {
            if (!err && columns) {
                const colNames = columns.map(c => c.name);
                if (!colNames.includes('endereco')) db.run(`ALTER TABLE customers ADD COLUMN endereco TEXT`);
                if (!colNames.includes('cep')) db.run(`ALTER TABLE customers ADD COLUMN cep TEXT`);
                if (!colNames.includes('complemento')) db.run(`ALTER TABLE customers ADD COLUMN complemento TEXT`);
            }
        });

        db.run(`CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            quantidade INTEGER,
            unidade TEXT,
            custo REAL,
            comissao REAL,
            descricao TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS crops (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            observacoes TEXT,
            cor TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customerId INTEGER,
            valorTotal REAL,
            data TEXT,
            statusPagamento TEXT,
            tipoPagamento TEXT,
            parcelas INTEGER,
            items TEXT, -- Armazenado como JSON
            parcelas_detalhes TEXT, -- Armazenado como JSON
            observacoes TEXT,
            numeroPedido TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS interactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customerId INTEGER,
            data TEXT,
            tipo TEXT,
            observacao TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            titulo TEXT,
            data TEXT,
            prioridade TEXT,
            status TEXT,
            customerId INTEGER
        )`);

        // Popular com os dados iniciais caso a tabela users esteja vazia
        db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
            if (!err && row && row.count === 0) {
                console.log('Populando banco de dados com dados iniciais...');
                seedData();
            }
        });
    });
}

function seedData() {
    const adminPass = bcrypt.hashSync('admin123', 10);
    const vendedorPass = bcrypt.hashSync('vendedor123', 10);

    db.run(`INSERT INTO users (nome, email, senha, nivel) VALUES 
        ('Administrador', 'admin@crm.com', ?, 'Admin'),
        ('Vendedor João', 'joao@crm.com', ?, 'Vendedor')`, [adminPass, vendedorPass]);

    db.run(`INSERT INTO customers (nome, documento, whatsapp, email, uf, cidade, status, cropId, dataAniversario, lembreteAniversario, createdAt) VALUES 
        ('Carlos da Soja', '000.000.000-00', '+550419874545', 'sojacarlos@gmail.com', 'PR', 'Londrina', 'Lead', 2, '1970-03-02', 1, '2026-04-22T10:00:00Z')`);

    db.run(`INSERT INTO products (nome, quantidade, unidade, custo, comissao, descricao) VALUES 
        ('Óleo de Coco', 100, 'L', 45.00, 5, 'Óleo de coco extra virgem'),
        ('Semente de Soja', 500, 'KG', 120.00, 8, 'Semente de soja premium')`);

    db.run(`INSERT INTO crops (nome, observacoes, cor) VALUES 
        ('Batata', 'Cultivo principal da região serrana', '#2563eb'),
        ('Soja', 'Grão para exportação', '#16a34a'),
        ('Café', 'Variedade arábica', '#ea580c')`);
        
    db.run(`INSERT INTO interactions (customerId, data, tipo, observacao) VALUES 
        (1, '2026-04-22T10:00:00Z', 'WhatsApp', 'Cliente interessado em novas sementes para a próxima safra.')`);
}

module.exports = db;
