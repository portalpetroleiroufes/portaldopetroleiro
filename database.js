const sqlite3 = require('sqlite3').verbose();

// Cria e conecta ao arquivo de banco de dados
const db = new sqlite3.Database('./meusAnexos.db', (err) => {
    if (err) {
        console.error('Erro ao abrir o banco de dados', err.message);
    } else {
        console.log('✅ Conectado ao banco de dados SQLite.');

        // 1. TABELA DE USUÁRIOS (Para administradores/colaboradores)
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            email TEXT UNIQUE,
            password TEXT,
            resetPasswordToken TEXT,
            resetPasswordExpires INTEGER,
            fullName TEXT,
            address TEXT,
            phone TEXT,
            bio TEXT,
            profilePicturePath TEXT
        )`, (err) => {
            if (err) console.error('Erro na tabela de usuários:', err.message);
            else console.log('👤 Tabela de usuários pronta.');
        });

        // 2. TABELA DE NOTÍCIAS/CONTEÚDO (Antiga products)
        // Mantemos os nomes 'name', 'price' etc para não quebrar seu server.js
        db.run(`CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,           -- Título da Notícia
            price REAL,          -- Data ou Ano
            description TEXT,    -- Conteúdo da Matéria
            images TEXT,         -- Caminho das Fotos
            category TEXT,       -- Categoria (Acadêmico, Mercado, etc)
            stock_quantity INTEGER DEFAULT 0 -- Visualizações
        )`, (err) => {
            if (err) console.error('Erro na tabela de notícias:', err.message);
            else console.log('📰 Tabela de notícias pronta para o Portal!');
        });
    }
});

module.exports = db;