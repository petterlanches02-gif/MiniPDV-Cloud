const express = require('express');
const mongoose = require('mongoose'); // Módulo Mongoose para MongoDB
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
// Usa a porta fornecida pelo Render (process.env.PORT) ou a 3000 localmente
const PORT = process.env.PORT || 3000; 

// --- 1. CONFIGURAÇÃO DO BANCO DE DADOS MONGODB (Mongoose) ---
// O MONGODB_URI DEVE SER DEFINIDO nas Variáveis de Ambiente do Render
const MONGODB_URI = process.env.MONGODB_URI;

// Garante que a URL está presente
if (!MONGODB_URI) {
    console.error("FATAL ERROR: MONGODB_URI não está definida nas variáveis de ambiente!");
    process.exit(1); 
}

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => {
    console.log('🟢 Conexão com o MongoDB estabelecida com sucesso.');
    // Inicia o servidor somente após a conexão com o banco de dados
    iniciarServidor(); 
})
.catch(err => {
    console.error('🔴 Erro ao conectar ao MongoDB:', err.message);
    // Encerra o processo se a conexão com o DB falhar
    process.exit(1); 
});

// --- 2. DEFINIÇÃO DOS SCHEMAS (Modelos) ---

// Schema para Produtos
const ProdutoSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    preco: { type: Number, required: true },
    categoria: { type: String, required: true },
    ativo: { type: Boolean, default: true },
});
const Produto = mongoose.model('Produto', ProdutoSchema);

// Schema para Vendas
const VendaSchema = new mongoose.Schema({
    itens: { type: Array, required: true }, // Array de itens do pedido
    total_venda: { type: Number, required: true },
    cliente: { type: String, default: 'Cliente Padrão' },
    data_venda: { type: Date, default: Date.now },
    forma_pagamento: { type: String },
    valor_pago: { type: Number },
    troco: { type: Number },
});
const Venda = mongoose.model('Venda', VendaSchema);


// --- 3. MIDDLEWARE E ARQUIVOS ESTÁTICOS ---

app.use(bodyParser.json());
// Servir arquivos estáticos (HTML/CSS/JS) da pasta 'public'
app.use(express.static(path.join(__dirname, 'public'))); 


// 4. ROTAS DE PRODUTOS (GET)
app.get('/api/produtos', async (req, res) => {
    try {
        // Busca apenas produtos ativos
        const produtos = await Produto.find({ ativo: true }).sort({ _id: 1 }); 
        res.json({ success: true, data: produtos });
    } catch (err) {
        console.error('Erro ao buscar produtos:', err);
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao buscar produtos.' });
    }
});

// 5. ROTA POST/UPDATE PRODUTO
app.post('/api/produtos', async (req, res) => {
    const { _id, nome, preco, categoria } = req.body; // Usa _id do MongoDB
    if (!nome || !preco || !categoria) {
        return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios.' });
    }
    const precoFloat = parseFloat(preco);
    try {
        if (_id) {
            // Lógica de ATUALIZAÇÃO (UPDATE)
            await Produto.findByIdAndUpdate(_id, { nome, preco: precoFloat, categoria });
            res.json({ success: true, message: 'Produto atualizado com sucesso!' });
        } else {
            // Lógica de INSERÇÃO (CREATE)
            const novoProduto = new Produto({ nome, preco: precoFloat, categoria });
            await novoProduto.save();
            res.json({ success: true, message: 'Produto cadastrado com sucesso!' });
        }
    } catch (err) {
        console.error('Erro ao salvar produto:', err);
        res.status(500).json({ success: false, message: 'Erro interno ao salvar produto.' });
    }
});

// 6. ROTA DELETE PRODUTO (Inativar/Soft Delete)
app.delete('/api/produtos/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Soft delete: muda o status 'ativo' para FALSE
        await Produto.findByIdAndUpdate(id, { ativo: false });
        res.json({ success: true, message: `Produto ID ${id} inativado com sucesso.` });
    } catch (err) {
        console.error('Erro ao inativar produto:', err);
        res.status(500).json({ success: false, message: 'Erro interno ao inativar produto.' });
    }
});


// 7. ROTA FINALIZAR VENDA (POST /api/pedido) - COMPLETA
app.post('/api/pedido', async (req, res) => {
    // Não precisa de pool.connect() no Mongoose
    try {
        const { itens, total, cliente, formaPagamento, valorPago, troco } = req.body;

        if (!itens || itens.length === 0) {
            return res.status(400).json({ success: false, message: 'O pedido não pode estar vazio.' });
        }

        // Cria e salva o novo documento de Venda
        const novaVenda = new Venda({
            itens: itens, // Os itens são salvos como array
            total_venda: total,
            cliente: cliente,
            forma_pagamento: formaPagamento,
            valor_pago: valorPago,
            troco: troco
        });
        
        const vendaSalva = await novaVenda.save();
        
        // Se a inserção no Sheets for implementada, ela viria aqui
        
        res.json({ success: true, message: `Venda ${vendaSalva._id} registrada com sucesso! ID: ${vendaSalva._id}` });

    } catch (err) {
        console.error('Erro ao finalizar venda:', err);
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao registrar a venda.' });
    }
});


// 8. ROTA DE RELATÓRIO: BUSCAR VENDAS DO DIA (/api/vendas/hoje)
app.get('/api/vendas/hoje', async (req, res) => {
    try {
        // Calcula a data de hoje para buscar vendas a partir da meia-noite
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const vendas = await Venda.find({
            data_venda: { $gte: hoje } 
        }).sort({ data_venda: -1 }); // Ordena da mais nova para a mais antiga
        
        const totalGeral = vendas.reduce((sum, venda) => sum + venda.total_venda, 0);
        const quantidadeVendas = vendas.length;

        res.json({ 
            success: true, 
            data: vendas,
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


// Função que inicia o Express (chamada após a conexão com o MongoDB)
function iniciarServidor() {
    app.listen(PORT, () => {
        console.log(`Servidor rodando na porta ${PORT}`);
    });
}