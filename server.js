const express = require('express');
const { Pool } = require('pg'); 
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// URL DEVE SER SUBSTITUÍDA PELO SEU ENDPOINT REAL
const GOOGLE_SHEETS_API_URL = 'SUA_URL_DO_GOOGLE_APPS_SCRIPT_AQUI'; 

// 1. CONFIGURAÇÃO DO BANCO DE DADOS POSTGRES
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } 
});

// ... (início do seu server.js)

async function inicializarBanco() {
    try {
        // --- INÍCIO DO CÓDIGO TEMPORÁRIO PARA CORREÇÃO DE SCHEMA ---
        if (process.env.FORCE_SCHEMA_FIX === 'true') {
            console.log('ATENÇÃO: EXECUTANDO LIMPEZA DE SCHEMA FORÇADA. APAGANDO TABELAS...');
            // Excluímos as duas tabelas para garantir a limpeza completa
            await pool.query('DROP TABLE IF EXISTS vendas CASCADE;');
            await pool.query('DROP TABLE IF EXISTS produtos CASCADE;'); 
            console.log('Tabelas antigas removidas com sucesso.');
        }
        // --- FIM DO CÓDIGO TEMPORÁRIO ---

        await pool.query(`
            CREATE TABLE IF NOT EXISTS produtos (
                id SERIAL PRIMARY KEY,
                nome VARCHAR(255) NOT NULL,
                preco REAL NOT NULL,
                categoria VARCHAR(100) NOT NULL,
                ativo BOOLEAN DEFAULT TRUE
            );
        `);
        // TABELA VENDAS SERÁ RECRIADA CORRETAMENTE
        await pool.query(`
            CREATE TABLE IF NOT EXISTS vendas (
                id SERIAL PRIMARY KEY,
                item_pedido JSONB NOT NULL,
                total_venda REAL NOT NULL, 
                cliente VARCHAR(255),
                data_venda TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                forma_pagamento VARCHAR(100), 
                valor_pago REAL,              
                troco REAL                    
            );
        `);
        console.log('Tabelas verificadas/criadas no Postgres.');
    } catch (err) {
       // ... (restante do seu bloco catch)
    }
}

// 2. MIDDLEWARE E ARQUIVOS ESTÁTICOS
app.use(bodyParser.json());
// Certifique-se de que sua pasta de arquivos estáticos é 'public'
app.use(express.static('public')); 
inicializarBanco();


// 3. ROTAS DE PRODUTOS (GET)
app.get('/api/produtos', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM produtos WHERE ativo = TRUE ORDER BY id ASC');
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Erro ao buscar produtos:', err);
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao buscar produtos.' });
    }
});

// 4. ROTA POST/UPDATE PRODUTO
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
            res.json({ success: true, message: 'Produto cadastrado com sucesso!' });
        }
    } catch (err) {
        console.error('Erro ao salvar produto:', err);
        res.status(500).json({ success: false, message: 'Erro interno ao salvar produto.' });
    }
});

// 5. ROTA DELETE PRODUTO (Inativar/Soft Delete)
app.delete('/api/produtos/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const query = 'UPDATE produtos SET ativo = FALSE WHERE id = $1';
        await pool.query(query, [id]);
        res.json({ success: true, message: `Produto ID ${id} inativado com sucesso.` });
    } catch (err) {
        console.error('Erro ao inativar produto:', err);
        res.status(500).json({ success: false, message: 'Erro interno ao inativar produto.' });
    }
});


// 6. ROTA FINALIZAR VENDA (POST /api/pedido) - COMPLETA
app.post('/api/pedido', async (req, res) => {
    const client = await pool.connect();
    try {
        const { itens, total, cliente, formaPagamento, valorPago, troco } = req.body;

        if (!itens || itens.length === 0) {
            return res.status(400).json({ success: false, message: 'O pedido não pode estar vazio.' });
        }

        await client.query('BEGIN'); 

        const vendaQuery = `
            INSERT INTO vendas (item_pedido, total_venda, cliente, forma_pagamento, valor_pago, troco)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id;
        `;
        const vendaResult = await client.query(vendaQuery, [
            JSON.stringify(itens), 
            total, 
            cliente, 
            formaPagamento, 
            valorPago, 
            troco
        ]);
        
        // Se a inserção no Sheets for implementada, ela viria aqui
        
        await client.query('COMMIT');

        res.json({ success: true, message: `Venda ${vendaResult.rows[0].id} registrada com sucesso!` });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erro ao finalizar venda:', err);
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao registrar a venda.' });
    } finally {
        client.release();
    }
});


// 7. ROTA DE RELATÓRIO: BUSCAR VENDAS DO DIA (/api/vendas/hoje)
app.get('/api/vendas/hoje', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                data_venda, 
                total_venda, 
                forma_pagamento, 
                cliente, 
                item_pedido,
                valor_pago,
                troco
            FROM vendas
            WHERE data_venda >= CURRENT_DATE 
              AND data_venda < CURRENT_DATE + INTERVAL '1 day'
            ORDER BY data_venda DESC;
        `);
        
        const totalGeral = result.rows.reduce((sum, venda) => sum + venda.total_venda, 0);
        const quantidadeVendas = result.rows.length;

        res.json({ 
            success: true, 
            data: result.rows,
            resumo: {
                totalGeral: totalGeral,
                quantidadeVendas: quantidadeVendas
            }
        });
    } catch (err) {
        console.error('Erro ao buscar vendas do dia:', err);
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao buscar relatórios.' });
    }
});


// 8. INICIA O SERVIDOR
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});