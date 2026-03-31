const express = require('express');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs');
const db = require('./database.js');
const nodemailer = require('nodemailer'); 
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = process.env.PORT || 5555;

// ==========================================
// 📧 CONFIGURAÇÃO DO E-MAIL
// ==========================================
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { 
        user: 'portalpetroleiroufes@gmail.com', 
        pass: 'wxog akhc kmfb zzaq' 
    }
});

// ==========================================
// 🤖 IA CONFIG (PETROLINHO)
// ==========================================
const genAI = new GoogleGenerativeAI("AIzaSyAojHjUFlb03jNyjEzop1xMFAE0_9nXgKY");

// Garantir que as pastas de upload existam na raiz (sem o 'public')
const dirArticles = path.join(__dirname, 'uploads', 'articles');
const dirLoja = path.join(__dirname, 'uploads');

if (!fs.existsSync(dirArticles)){ fs.mkdirSync(dirArticles, { recursive: true }); }
if (!fs.existsSync(dirLoja)){ fs.mkdirSync(dirLoja, { recursive: true }); }

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(fileUpload());

// LIBERA O ACESSO À RAIZ (Onde estão seus HTMLs) E UPLOADS
app.use(express.static(__dirname)); 
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- ROTA DA IA (PETROLINHO) ---
app.post('/api/petrolinho', async (req, res) => {
    const { pergunta } = req.body;
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(`Você é o Petrolinho do curso de Engenharia de Petróleo do CEUNES. Responda curto e técnico: ${pergunta}`);
        const response = await result.response;
        res.json({ resposta: response.text() });
    } catch (error) { 
        console.error("\n❌ ERRO NO PETROLINHO:", error.message);
        res.json({ resposta: "Tive um probleminha técnico. Tente de novo!" }); 
    }
});

// ==========================================
// 📰 SISTEMA DE NOTÍCIAS E ARTIGOS (SQLITE)
// ==========================================
app.get('/api/produtos', (req, res) => { 
    db.all('SELECT * FROM products ORDER BY id DESC', [], (err, rows) => res.json(rows || [])); 
});

app.get('/api/produto/:id', (req, res) => { 
    db.get("SELECT * FROM products WHERE id = ?", [req.params.id], (err, row) => res.json(row || {})); 
});

app.post('/cadastrar-produto', (req, res) => {
    let { name, price, description, category, category_custom } = req.body;
    const categoriaFinal = category === 'Outros' ? category_custom : category;
    let imagesString = "";
    if (req.files && req.files.productImages) {
        let files = Array.isArray(req.files.productImages) ? req.files.productImages : [req.files.productImages];
        let savedImages = [];
        files.forEach(file => {
            const imageName = Date.now() + '-' + file.name.replace(/[^a-zA-Z0-9.]/g, '_');
            file.mv(path.join(dirArticles, imageName));
            savedImages.push(`uploads/articles/${imageName}`);
        });
        imagesString = savedImages.join(',');
    }
    db.run(`INSERT INTO products (name, price, description, images, category) VALUES (?, ?, ?, ?, ?)`, 
    [name, price, description, imagesString, categoriaFinal], () => {
        res.send('<script>alert("Notícia Publicada!"); window.location.href="/admin.html";</script>');
    });
});

app.post('/editar-produto/:id', (req, res) => {
    const { id } = req.params; 
    let { name, price, description, category, category_custom } = req.body;
    const categoriaFinal = category === 'Outros' ? category_custom : category;
    db.get("SELECT images FROM products WHERE id = ?", [id], (err, row) => {
        let currentImages = row ? row.images : "";
        if (req.files && req.files.productImages) {
            let files = Array.isArray(req.files.productImages) ? req.files.productImages : [req.files.productImages];
            let newImages = [];
            files.forEach(file => {
                const imageName = Date.now() + '-' + file.name.replace(/[^a-zA-Z0-9.]/g, '_');
                file.mv(path.join(dirArticles, imageName));
                newImages.push(`uploads/articles/${imageName}`);
            });
            currentImages = currentImages ? currentImages + ',' + newImages.join(',') : newImages.join(',');
        }
        db.run(`UPDATE products SET name=?, price=?, description=?, images=?, category=? WHERE id=?`,
        [name, price, description, currentImages, categoriaFinal, id], () => {
            res.send('<script>alert("Notícia Atualizada!"); window.location.href="/admin.html";</script>');
        });
    });
});

app.delete('/api/produto/:id', (req, res) => { 
    db.run("DELETE FROM products WHERE id = ?", [req.params.id], () => res.send("OK")); 
});

// ==========================================
// 🛒 SISTEMA DE VENDAS (RIFAS / LOJA - JSON)
// ==========================================
const arquivoLoja = path.join(__dirname, 'loja_produtos.json');
const arquivoVendas = path.join(__dirname, 'loja_vendas_registradas.json');

if (!fs.existsSync(arquivoLoja)) fs.writeFileSync(arquivoLoja, JSON.stringify([])); 
if (!fs.existsSync(arquivoVendas)) fs.writeFileSync(arquivoVendas, JSON.stringify([])); 

app.get('/api/loja', (req, res) => { 
    const produtos = JSON.parse(fs.readFileSync(arquivoLoja));
    const agora = new Date();
    const ativos = produtos.filter(p => {
        const dataLimite = p.dataLimite ? new Date(p.dataLimite) : null;
        return p.ativo !== false && (!dataLimite || dataLimite > agora);
    });
    res.json(ativos); 
});

app.post('/api/loja/cadastrar', (req, res) => {
    let produtos = JSON.parse(fs.readFileSync(arquivoLoja));
    const novoProduto = {
        id: Date.now(), 
        ativo: req.body.ativo === 'on',
        tipo: req.body.tipo || 'Rifa', 
        titulo: req.body.titulo,
        descricao: req.body.descricao,
        preco: req.body.preco,
        promoQtd: req.body.promoQtd,
        promoPreco: req.body.promoPreco,
        maxVendas: req.body.maxVendas, 
        limitePorUsuario: parseInt(req.body.limitePorUsuario) || 0,
        dataLimite: req.body.dataLimite,
        pix: req.body.pix,
        imagem: ""
    };
    if (req.files && req.files.imagemProduto) {
        const file = req.files.imagemProduto;
        const nomeImagem = 'prod-' + Date.now() + path.extname(file.name);
        file.mv(path.join(__dirname, 'uploads', nomeImagem));
        novoProduto.imagem = 'uploads/' + nomeImagem;
    }
    produtos.push(novoProduto);
    fs.writeFileSync(arquivoLoja, JSON.stringify(produtos, null, 2));
    res.send('<script>alert("Anúncio Criado!"); window.location.href="/admin.html";</script>');
});

app.post('/api/loja/editar/:id', (req, res) => {
    const { id } = req.params;
    let produtos = JSON.parse(fs.readFileSync(arquivoLoja));
    const idx = produtos.findIndex(p => p.id == id);
    if (idx !== -1) {
        produtos[idx].titulo = req.body.titulo;
        produtos[idx].descricao = req.body.descricao;
        produtos[idx].preco = req.body.preco;
        produtos[idx].maxVendas = req.body.maxVendas;
        produtos[idx].promoQtd = req.body.promoQtd;
        produtos[idx].promoPreco = req.body.promoPreco;
        produtos[idx].dataLimite = req.body.dataLimite;
        produtos[idx].pix = req.body.pix;
        produtos[idx].tipo = req.body.tipo;
        produtos[idx].ativo = req.body.ativo === 'on';

        if (req.files && req.files.imagemProduto) {
            const file = req.files.imagemProduto;
            const nomeImagem = 'prod-edit-' + Date.now() + path.extname(file.name);
            file.mv(path.join(__dirname, 'uploads', nomeImagem));
            produtos[idx].imagem = 'uploads/' + nomeImagem;
        }
        fs.writeFileSync(arquivoLoja, JSON.stringify(produtos, null, 2));
    }
    res.send('<script>alert("Anúncio Atualizado!"); window.location.href="/admin.html";</script>');
});

app.delete('/api/loja/:id', (req, res) => {
    let produtos = JSON.parse(fs.readFileSync(arquivoLoja));
    const novaLista = produtos.filter(p => p.id !== parseInt(req.params.id));
    fs.writeFileSync(arquivoLoja, JSON.stringify(novaLista, null, 2));
    res.send("OK");
});

// ==========================================
// 💸 CHECKOUT AUTOMÁTICO E REGISTRO CSV
// ==========================================
app.post('/api/checkout-automatico', async (req, res) => {
    const { idProduto, nome, email, qtd, telefone } = req.body;
    const produtos = JSON.parse(fs.readFileSync(arquivoLoja));
    let vendas = JSON.parse(fs.readFileSync(arquivoVendas));
    const produto = produtos.find(p => p.id === parseInt(idProduto));
    
    if(!produto) return res.status(404).json({ erro: "Anúncio não encontrado!" });

    let valorFinal = parseFloat(produto.preco) * qtd;
    if(produto.promoQtd && qtd >= parseInt(produto.promoQtd)) {
        valorFinal = qtd * (parseFloat(produto.promoPreco) / parseInt(produto.promoQtd));
    }

    const idReserva = "RES-" + Date.now().toString().slice(-6);

    const novaVenda = {
        idVenda: idReserva,
        idProduto: produto.id,
        nome, email, telefone, qtd,
        valorTotal: valorFinal.toFixed(2),
        status: "Pendente",
        data: new Date().toLocaleString('pt-BR')
    };
    
    vendas.push(novaVenda);
    fs.writeFileSync(arquivoVendas, JSON.stringify(vendas, null, 2));

    const arquivoCSV = 'vendas_portal.csv';
    if (!fs.existsSync(arquivoCSV)) {
        fs.writeFileSync(arquivoCSV, 'Data;ID Reserva;Nome;WhatsApp;Email;Qtd;Valor Total\n');
    }
    const linhaCSV = `${novaVenda.data};${idReserva};${nome};${telefone};${email};${qtd};${valorFinal.toFixed(2)}\n`;
    fs.appendFileSync(arquivoCSV, linhaCSV);

    try {
        await transporter.sendMail({
            from: '"Portal do Petroleiro UFES" <portalpetroleiroufes@gmail.com>',
            to: email,
            subject: `⏳ Reserva: ${idReserva} - ${produto.titulo}`,
            html: `<div style="font-family: Arial; border-top: 10px solid #002d5b; padding: 20px;">
                    <h2>Olá, ${nome}!</h2>
                    <p>Reserva para <strong>${produto.titulo}</strong> recebida.</p>
                    <p><strong>Valor Total:</strong> R$ ${valorFinal.toFixed(2)}</p>
                    <p><strong>Chave PIX:</strong> ${produto.pix}</p>
                   </div>`
        });
    } catch (error) {
        console.error("❌ Erro e-mail:", error.message);
    }

    res.json({ sucesso: true, recibo: idReserva, valor: valorFinal.toFixed(2) });
});

// LIGA O MOTOR
app.listen(PORT, () => { 
    console.log(`\n🚀 MOTOR COMPLETO LIGADO NA PORTA ${PORT}!`); 
});
