const express = require('express');
const { Pool } = require('pg'); 
const fetch = require('node-fetch');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

const GOOGLE_SHEETS_API_URL = 'SUA_URL_DO_GOOGLE_APPS_SCRIPT_AQUI'; 

// 1. CONFIGURAÇÃO DO BANCO DE DADOS POSTGRES
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } 
});

async function inicializarBanco() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS produtos (
                id SERIAL PRIMARY KEY,
                nome VARCHAR(255) NOT NULL,
                preco REAL NOT NULL,
                categoria VARCHAR(100) NOT NULL,
                ativo BOOLEAN DEFAULT TRUE
            );
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS vendas (
                id SERIAL PRIMARY KEY,
                produto_id INTEGER,
                nome_produto VARCHAR(255) NOT NULL,
                preco_unitario REAL NOT NULL,
                quantidade INTEGER NOT NULL,
                total_item REAL NOT NULL,
                cliente VARCHAR(255),
                data_venda TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Tabelas verificadas/criadas no Postgres.');
    } catch (err) {
        console.error('ERRO FATAL: Falha ao conectar ou inicializar o Postgres. Verifique a DATABASE_URL.', err);
        process.exit(1); 
    }
}

// 2. MIDDLEWARE E ARQUIVOS ESTÁTICOS
app.use(bodyParser.json());
app.use(express.static('public'));
inicializarBanco();


// 3. ROTAS DE PRODUTOS
app.post('/api/produtos', async (req, res) => {
    const { id, nome, preco, categoria } = req.body;

    if (!nome || !preco || !categoria) {
        return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios.' });
    }

    const precoFloat = parseFloat(preco);
    
    try {
        if (id) {
            const query = 'UPDATE produtos SET nome = $1, preco = $2, categoria = $3 WHERE id = $4';
            await pool.query(query, [nome, precoFloat, categoria, id]);
            res.json({ success: true, message: 'Produto atualizado com sucesso!' });
        } else {
            const query = 'INSERT INTO produtos (nome, preco, categoria) VALUES ($1, $2, $3)';
            await pool.query(query, [nome, precoFloat, categoria]);
            res.json({ success: true, message: 'Produto salvo com sucesso!' });
        }
    } catch (err) {
        console.error('Erro no cadastro/edicao de produto:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/produtos', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM produtos WHERE ativo = TRUE ORDER BY id ASC');
        res.json({ success: true, data: result.rows }); 
    } catch (err) {
        console.error('Erro ao listar produtos:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/produtos/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('UPDATE produtos SET ativo = FALSE WHERE id = $1', [id]);
        res.json({ success: true, message: 'Produto inativado (deletado) com sucesso!' });
    } catch (err) {
        console.error('Erro ao inativar produto:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4. ROTA DE VENDAS 
app.post('/api/pedido', async (req, res) => {
    const { itens, total, cliente, formaPagamento, troco } = req.body;

    if (!itens || itens.length === 0 || !total) {
        return res.status(400).json({ success: false, message: 'O pedido não pode estar vazio.' });
    }

    try {
        // ... Lógica de inserção e Google Sheets

        res.json({ success: true, message: 'Venda finalizada com sucesso (Local e Sheets)!' });

    } catch (error) {
        console.error('Erro fatal ao processar o pedido:', error);
        res.status(500).json({ success: false, message: 'Erro interno ao processar a venda.' });
    }
});


// 5. INICIALIZAÇÃO DO SERVIDOR
app.listen(PORT, () => {
    console.log(`PDV está pronto para rodar na porta ${PORT}`);
});