const express = require('express');
const mongoose = require('mongoose'); // Usaremos Mongoose para MongoDB
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// URL DEVE SER SUBSTITUÍDA PELA SUA STRING DE CONEXÃO DO MONGODB ATLAS
// Chave: MONGODB_URI (ou DATABASE_URL, se preferir)
const MONGODB_URI = process.env.MONGODB_URI;

// 1. CONEXÃO COM O MONGODB
async function conectarBanco() {
    if (!MONGODB_URI) {
        console.error('ERRO FATAL: Variável de ambiente MONGODB_URI não definida.');
        process.exit(1);
    }
    try {
        await mongoose.connect(MONGODB_URI, {
            // As opções a seguir são geralmente padronizadas e podem não ser necessárias em versões recentes,
            // mas são mantidas para compatibilidade com versões anteriores.
            // useNewUrlParser: true,
            // useUnifiedTopology: true,
        });
        console.log('Conexão com o MongoDB estabelecida com sucesso.');
    } catch (err) {
        console.error('ERRO FATAL: Falha ao conectar ao MongoDB. Verifique a MONGODB_URI.', err);
        process.exit(1);
    }
}

// 2. DEFINIÇÃO DOS MODELOS (Esquemas)
const ProdutoSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    preco: { type: Number, required: true },
    categoria: { type: String, required: true },
    ativo: { type: Boolean, default: true }
});

const VendaSchema = new mongoose.Schema({
    // Utilizamos 'itens' no plural, mais intuitivo
    itens: { type: Array, required: true }, 
    total_venda: { type: Number, required: true },
    cliente: { type: String, default: 'Não Informado' },
    data_venda: { type: Date, default: Date.now },
    forma_pagamento: { type: String },
    valor_pago: { type: Number },
    troco: { type: Number }
});

const Produto = mongoose.model('Produto', ProdutoSchema);
const Venda = mongoose.model('Venda', VendaSchema);

// 3. MIDDLEWARE E ARQUIVOS ESTÁTICOS
app.use(bodyParser.json());
app.use(express.static('public'));
conectarBanco();


// ==========================================================
// 4. ROTAS DE PRODUTOS
// ==========================================================

// GET: Buscar produtos ativos
app.get('/api/produtos', async (req, res) => {
    try {
        // Busca apenas produtos com ativo: true, ordenados por nome
        const produtos = await Produto.find({ ativo: true }).sort({ nome: 1 });
        // MongoDB usa ._id, mas mantemos o nome 'id' no frontend por consistência
        const dataFormatada = produtos.map(p => ({
            id: p._id,
            nome: p.nome,
            preco: p.preco,
            categoria: p.categoria,
            ativo: p.ativo
        }));
        res.json({ success: true, data: dataFormatada });
    } catch (err) {
        console.error('Erro ao buscar produtos:', err);
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao buscar produtos.' });
    }
});

// POST/UPDATE: Salvar ou atualizar produto
app.post('/api/produtos', async (req, res) => {
    const { id, nome, preco, categoria } = req.body;
    if (!nome || !preco || !categoria) {
        return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios.' });
    }
    
    try {
        if (id) {
            // Atualizar
            const produto = await Produto.findByIdAndUpdate(id, { nome, preco: parseFloat(preco), categoria }, { new: true });
            if (!produto) {
                return res.status(404).json({ success: false, message: 'Produto não encontrado para atualização.' });
            }
            res.json({ success: true, message: 'Produto atualizado com sucesso!' });
        } else {
            // Criar Novo
            const novoProduto = new Produto({ nome, preco: parseFloat(preco), categoria });
            await novoProduto.save();
            res.json({ success: true, message: 'Produto cadastrado com sucesso!', id: novoProduto._id });
        }
    } catch (err) {
        console.error('Erro ao salvar produto:', err);
        res.status(500).json({ success: false, message: 'Erro interno ao salvar produto.' });
    }
});

// DELETE: Inativar produto (Soft Delete)
app.delete('/api/produtos/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Simplesmente define 'ativo' como false
        const resultado = await Produto.findByIdAndUpdate(id, { ativo: false });
        
        if (!resultado) {
             return res.status(404).json({ success: false, message: 'Produto não encontrado.' });
        }
        
        res.json({ success: true, message: `Produto inativado com sucesso.` });
    } catch (err) {
        console.error('Erro ao inativar produto:', err);
        res.status(500).json({ success: false, message: 'Erro interno ao inativar produto.' });
    }
});


// ==========================================================
// 5. ROTAS DE VENDAS
// ==========================================================

// POST: Finalizar Venda
app.post('/api/pedido', async (req, res) => {
    try {
        const { itens, total, cliente, formaPagamento, valorPago, troco } = req.body;

        if (!itens || itens.length === 0) {
            return res.status(400).json({ success: false, message: 'O pedido não pode estar vazio.' });
        }
        
        // MongoDB não exige transação manual, apenas salvamos o documento
        const novaVenda = new Venda({
            itens: itens,
            total_venda: total,
            cliente: cliente,
            forma_pagamento: formaPagamento,
            valor_pago: valorPago,
            troco: troco
        });

        await novaVenda.save();

        res.json({ success: true, message: `Venda ${novaVenda._id} registrada com sucesso!` });

    } catch (err) {
        console.error('Erro ao finalizar venda:', err);
        // Agora, se houver um erro, o log será mais detalhado do Mongoose
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao registrar a venda.' });
    }
});

// GET: Buscar Vendas do Dia (Relatório)
app.get('/api/vendas/hoje', async (req, res) => {
    try {
        // Define o início e o fim do dia de hoje
        const inicioDoDia = new Date();
        inicioDoDia.setHours(0, 0, 0, 0);
        
        const fimDoDia = new Date();
        fimDoDia.setHours(23, 59, 59, 999);

        const vendas = await Venda.find({
            data_venda: { $gte: inicioDoDia, $lte: fimDoDia } // Filtra pela data de hoje
        }).sort({ data_venda: -1 }); // Ordena da mais recente para a mais antiga
        
        const totalGeral = vendas.reduce((sum, venda) => sum + venda.total_venda, 0);
        const quantidadeVendas = vendas.length;

        // Formata os dados para o frontend, incluindo o _id como id para consistência
        const vendasFormatadas = vendas.map(v => ({
            id: v._id,
            total_venda: v.total_venda,
            forma_pagamento: v.forma_pagamento,
            cliente: v.cliente,
            item_pedido: v.itens, // Agora é 'itens' no Schema
            data_venda: v.data_venda,
            valor_pago: v.valor_pago,
            troco: v.troco
        }));

        res.json({ 
            success: true, 
            data: vendasFormatadas,
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


// 6. INICIA O SERVIDOR
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});