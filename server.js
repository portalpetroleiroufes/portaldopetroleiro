const express = require('express');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs');
const db = require('./database.js'); // Seu banco de notícias

const app = express();
const PORT = process.env.PORT || 5555;

// Middlewares básicos
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());

// --- GARANTIA DE PASTAS ---
const publicDir = path.join(__dirname, 'public');
const articlesDir = path.join(publicDir, 'uploads', 'articles');

if (!fs.existsSync(articlesDir)) {
    fs.mkdirSync(articlesDir, { recursive: true });
}

app.use(express.static(publicDir));

// --- API DE NOTÍCIAS (PORTAL) ---

// Listar todas as notícias para o Index
app.get('/api/noticias', (req, res) => {
    db.all('SELECT * FROM products ORDER BY id DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json(rows || []);
    });
});

// Pegar uma notícia específica (para a página de artigo)
app.get('/api/noticia/:id', (req, res) => {
    db.get('SELECT * FROM products WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json(row);
    });
});
// Rota correta para deletar notícia no SQLite do Portal
app.delete('/api/admin/deletar-produto/:id', (req, res) => {
    const id = req.params.id;
    const query = `DELETE FROM products WHERE id = ?`;

    db.run(query, [id], function(err) {
        if (err) {
            console.error('Erro ao deletar:', err.message);
            return res.status(500).json({ error: err.message });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ message: 'Notícia não encontrada.' });
        }

        res.status(200).json({ message: 'Excluído com sucesso!' });
    });
});
// --- ROTA DO PAINEL ADM (POSTAR NOTÍCIA) ---
app.post('/api/admin/postar-noticia', (req, res) => {
    const { name, description, category } = req.body;
    let imagesString = "";

    if (req.files && req.files.productImages) {
        let files = Array.isArray(req.files.productImages) ? req.files.productImages : [req.files.productImages];
        let savedImages = [];

        files.forEach(file => {
            const imageName = `${Date.now()}-${file.name.replace(/\s/g, '_')}`;
            file.mv(path.join(articlesDir, imageName));
            savedImages.push(`uploads/articles/${imageName}`);
        });
        imagesString = savedImages.join(',');
    }

    const query = `INSERT INTO products (name, description, images, category) VALUES (?, ?, ?, ?)`;
    db.run(query, [name, description, imagesString, category], (err) => {
        if (err) return res.send("Erro ao publicar notícia: " + err.message);
        res.redirect('/admin.html'); // Volta para o painel
    });
});

// --- INICIALIZAÇÃO ---
app.listen(PORT, () => {
    console.log(`
    =========================================
    🚀 PORTAL DO PETROLEIRO ONLINE (SÓ NOTÍCIAS)
    📍 ACESSE: http://localhost:${PORT}
    🛠️ ADMIN: http://localhost:${PORT}/admin.html
    =========================================
    `);
});
