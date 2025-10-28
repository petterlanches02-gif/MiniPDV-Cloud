const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const fetch = require('node-fetch');
const path = require('path'); // MÓDULO NECESSÁRIO PARA CORRIGIR O PATH DO EXE
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

// Configuração do Banco de Dados
// ==========================================================
// CORREÇÃO FINAL: Usa path.resolve para garantir que o executável encontre o pdv.db
// process.cwd() retorna o diretório onde o .exe está sendo executado.
const dbPath = path.resolve(process.cwd(), 'pdv.db');

// Flags para abrir ou criar o arquivo
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        // Loga o erro, mas o processo continua para que o terminal não feche.
        console.error('Erro fatal ao abrir o banco de dados. Verifique permissões:', err.message);
    } else {
        console.log('Conectado ao banco de dados SQLite.');
        
        // Criação da tabela de PRODUTOS
        db.run(`
            CREATE TABLE IF NOT EXISTS produtos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                preco REAL NOT NULL,
                categoria TEXT NOT NULL,
                ativo INTEGER DEFAULT 1
            )
        `);
        
        // Criação da tabela de VENDAS (Registro Detalhado)
        db.run(`
            CREATE TABLE IF NOT EXISTS vendas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                produto_id INTEGER,
                nome_produto TEXT NOT NULL,
                preco_unitario REAL NOT NULL,
                quantidade INTEGER NOT NULL,
                total_item REAL NOT NULL,
                cliente TEXT,
                data_venda DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }
});
// ==========================================================

// ** IMPORTANTE: COLOQUE SUA URL AQUI **
const GOOGLE_SHEETS_API_URL = 'SUA_URL_DO_GOOGLE_APPS_SCRIPT_AQUI'; 

// Middleware
app.use(bodyParser.json());
// Servir arquivos estáticos da pasta 'public' (HTML, CSS, JS)
app.use(express.static('public'));

// ------------------------------------------------------------------
// --- ROTAS DE PRODUTOS (CRUD) ---
// ------------------------------------------------------------------
app.post('/api/produtos', (req, res) => {
    const { id, nome, preco, categoria } = req.body;

    if (!nome || !preco || !categoria) {
        return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios.' });
    }

    const precoFloat = parseFloat(preco);
    if (id) {
        // Edição
        db.run('UPDATE produtos SET nome = ?, preco = ?, categoria = ? WHERE id = ?',
            [nome, precoFloat, categoria, id],
            function(err) {
                if (err) return res.status(500).json({ success: false, message: err.message });
                res.json({ success: true, message: 'Produto atualizado com sucesso!' });
            }
        );
    } else {
        // Novo Produto
        db.run('INSERT INTO produtos (nome, preco, categoria) VALUES (?, ?, ?)',
            [nome, precoFloat, categoria],
            function(err) {
                if (err) return res.status(500).json({ success: false, message: err.message });
                res.json({ success: true, message: 'Produto salvo com sucesso!' });
            }
        );
    }
});

app.get('/api/produtos', (req, res) => {
    db.all('SELECT * FROM produtos WHERE ativo = 1', [], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, data: rows });
    });
});

app.delete('/api/produtos/:id', (req, res) => {
    const id = req.params.id;
    // Inativar (ativo = 0) em vez de deletar para manter o histórico
    db.run('UPDATE produtos SET ativo = 0 WHERE id = ?', id, function(err) {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: 'Produto inativado (deletado) com sucesso!' });
    });
});


// ------------------------------------------------------------------
// --- ROTA DE VENDAS (PDV) ---
// ------------------------------------------------------------------
app.post('/api/pedido', async (req, res) => {
    const { itens, total, cliente, formaPagamento, troco } = req.body;

    if (!itens || itens.length === 0 || !total) {
        return res.status(400).json({ success: false, message: 'O pedido não pode estar vazio.' });
    }

    // 1. Registro Local (SQLite - Detalhado, item por item)
    const dbPromises = itens.map(item => {
        const totalItem = item.qtd * item.preco;
        return new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO vendas (produto_id, nome_produto, preco_unitario, quantidade, total_item, cliente) VALUES (?, ?, ?, ?, ?, ?)',
                [item.id, item.nome, item.preco, item.qtd, totalItem, cliente],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                }
            );
        });
    });

    try {
        await Promise.all(dbPromises);
        
        // 2. Envio para o Google Sheets (Registro Consolidado)
        const sheetsPayload = {
            itens: itens,
            total: total,
            nomeCliente: cliente,
            formaPagamento: formaPagamento,
            troco: troco
        };

        const sheetResponse = await fetch(GOOGLE_SHEETS_API_URL, {
            method: 'POST',
            body: JSON.stringify(sheetsPayload),
            headers: { 'Content-Type': 'application/json' }
        });

        const sheetResult = await sheetResponse.json();

        if (sheetResult.result === 'error') {
            console.error('Erro ao enviar para Google Sheets:', sheetResult.message);
            // Retorna sucesso LOCAL, mas alerta o usuário sobre o erro remoto
            return res.json({ 
                success: true, 
                message: 'Venda registrada localmente! (ATENÇÃO: Erro no Google Sheets: ' + sheetResult.message + ')' 
            });
        }

        res.json({ success: true, message: 'Venda finalizada com sucesso (Local e Sheets)!' });

    } catch (error) {
        console.error('Erro fatal ao processar o pedido:', error);
        res.status(500).json({ success: false, message: 'Erro interno ao processar a venda.' });
    }
});


// ------------------------------------------------------------------
// --- ROTA DE RELATÓRIOS ---
// ------------------------------------------------------------------
app.get('/api/relatorios/vendas', (req, res) => {
    const { start_date, end_date } = req.query;
    
    let query = 'SELECT * FROM vendas ORDER BY data_venda DESC';
    const params = [];

    // Filtro de data
    if (start_date && end_date) {
        query = 'SELECT * FROM vendas WHERE data_venda BETWEEN ? AND ? ORDER BY data_venda DESC';
        params.push(start_date + ' 00:00:00');
        params.push(end_date + ' 23:59:59');
    }

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, data: rows });
    });
});


// ------------------------------------------------------------------
// --- INICIALIZAÇÃO DO SERVIDOR ---
// ------------------------------------------------------------------
app.listen(PORT, () => {
    console.log(`PDV rodando em http://localhost:${PORT}`);
    // Exibe IP local para acesso em outros dispositivos
    require('dns').lookup(require('os').hostname(), (err, add, fam) => {
        if (add) {
            console.log(`Acesse também em: http://${add}:${PORT} (pela rede local)`);
        }
    });
});