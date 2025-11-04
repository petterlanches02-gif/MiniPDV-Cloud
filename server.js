const express = require('express');
// Importamos o Sequelize e o DataTypes para definir os modelos
const { Sequelize, DataTypes, Op } = require('sequelize');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Variável de Ambiente CRÍTICA para Conexão MySQL
// O servidor PRECISA DESSA VARIÁVEL
const MYSQL_URI = process.env.MYSQL_URI;

let sequelize; // Instância global do Sequelize
let Produto;
let Pedido;
let ItemPedido;
let Venda;

// 1. CONEXÃO COM O MYSQL E DEFINIÇÃO DOS MODELOS
async function conectarBanco() {
    // ⚠️ ALTERAÇÃO AQUI: Verifica explicitamente a MYSQL_URI
    if (!MYSQL_URI) {
        // Agora o erro é claro sobre a variável esperada
        console.error('ERRO FATAL: Variável de ambiente MYSQL_URI não definida. Use o formato: mysql://usuario:senha@host:porta/database');
        process.exit(1);
    }
    
    try {
        // O Sequelize pode parsear a URI completa
        sequelize = new Sequelize(MYSQL_URI, {
            dialect: 'mysql',
            logging: false, // Desativa logs SQL no console
            // Adicionado pooling para melhor performance
            pool: {
                max: 5,
                min: 0,
                acquire: 30000,
                idle: 10000
            }
        });

        await sequelize.authenticate();
        console.log('🟢 Conexão com o MySQL estabelecida com sucesso.');

        // Definir e Sincronizar Modelos
        defineModels();
        // Cria as tabelas se não existirem (force: false para evitar perda de dados)
        await sequelize.sync({ force: false }); 
        console.log('✨ Modelos MySQL sincronizados (tabelas criadas/atualizadas).');

    } catch (err) {
        console.error('ERRO FATAL: Falha ao conectar ou sincronizar o MySQL. Verifique a MYSQL_URI ou as credenciais.', err.message || err);
        process.exit(1);
    }
}

// 2. DEFINIÇÃO DOS MODELOS (Esquemas Relacionais)
function defineModels() {
    // Modelo de Produto
    Produto = sequelize.define('Produto', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        nome: { type: DataTypes.STRING, allowNull: false },
        preco: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
        categoria: { type: DataTypes.STRING, allowNull: false },
        ativo: { type: DataTypes.BOOLEAN, defaultValue: true },
    }, {
        tableName: 'Produtos',
        timestamps: false
    });

    // Modelo de Pedido (Mesa/Comanda)
    Pedido = sequelize.define('Pedido', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        numero: { type: DataTypes.INTEGER, allowNull: false, unique: true }, // Número sequencial para exibição
        total: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
        cliente: { type: DataTypes.STRING, defaultValue: 'Mesa/Comanda' },
        status: { type: DataTypes.ENUM('ABERTO', 'FINALIZADO'), defaultValue: 'ABERTO' },
        data_abertura: { type: DataTypes.DATE, defaultValue: Sequelize.NOW },
        data_fechamento: { type: DataTypes.DATE, allowNull: true },
    }, {
        tableName: 'Pedidos',
        timestamps: false
    });

    // Modelo de ItemPedido (Tabela de Relacionamento N:1)
    ItemPedido = sequelize.define('ItemPedido', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        pedidoId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Pedidos', key: 'id' } }, // Chave estrangeira
        produtoId: { type: DataTypes.INTEGER, allowNull: true }, // Referência opcional ao produto original
        nome: { type: DataTypes.STRING, allowNull: false }, // Denormalizado
        preco: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
        quantidade: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
        subtotal: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    }, {
        tableName: 'ItensPedido',
        timestamps: false
    });

    // Modelo de Venda (Histórico)
    Venda = sequelize.define('Venda', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        pedido_id_original: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Pedidos', key: 'id' } }, // Chave estrangeira
        itens_json: { type: DataTypes.JSON, allowNull: false }, // Armazena o array de itens como JSON (denormalizado)
        total_venda: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
        cliente: { type: DataTypes.STRING, defaultValue: 'Não Informado' },
        data_venda: { type: DataTypes.DATE, defaultValue: Sequelize.NOW },
        forma_pagamento: { type: DataTypes.STRING, allowNull: true },
        valor_pago: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
        troco: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
        divisao_conta_pessoas: { type: DataTypes.INTEGER, allowNull: true },
        divisao_conta_valor: { type: DataTypes.DECIMAL(10, 2), allowNull: true }
    }, {
        tableName: 'Vendas',
        timestamps: false
    });
    
    // Associações
    Pedido.hasMany(ItemPedido, { foreignKey: 'pedidoId', as: 'itens' });
    ItemPedido.belongsTo(Pedido, { foreignKey: 'pedidoId' });

    Pedido.hasOne(Venda, { foreignKey: 'pedido_id_original', as: 'registro_venda' });
    Venda.belongsTo(Pedido, { foreignKey: 'pedido_id_original' });
}


// 3. MIDDLEWARE E ARQUIVOS ESTÁTICOS
app.use(bodyParser.json());
app.use(express.static('public'));
conectarBanco();


// ==========================================================
// FUNÇÕES AUXILIARES
// ==========================================================

// Encontra o próximo número sequencial para um novo Pedido
async function getProximoNumeroPedido() {
    // Busca o maior número e adiciona 1. Se não houver, começa em 1.
    const ultimoPedido = await Pedido.findOne({
        order: [['numero', 'DESC']],
    });
    return ultimoPedido ? ultimoPedido.numero + 1 : 1;
}

// ==========================================================
// 4. ROTAS DE PRODUTOS (Adaptadas para Sequelize)
// ==========================================================

// GET: Buscar produtos ativos
app.get('/api/produtos', async (req, res) => {
    try {
        const produtos = await Produto.findAll({ 
            where: { ativo: true }, 
            order: [['nome', 'ASC']] 
        });
        // Renomear id para _id para manter a compatibilidade do front-end
        const dataFormatada = produtos.map(p => ({
            id: p.id,
            nome: p.nome,
            preco: parseFloat(p.preco),
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
            const [linhasAfetadas] = await Produto.update(
                { nome, preco: parseFloat(preco), categoria }, 
                { where: { id: id } }
            );
            
            if (linhasAfetadas === 0) {
                return res.status(404).json({ success: false, message: 'Produto não encontrado para atualização.' });
            }
            res.json({ success: true, message: 'Produto atualizado com sucesso!' });
        } else {
            // Criar Novo
            const novoProduto = await Produto.create({ nome, preco: parseFloat(preco), categoria });
            res.json({ success: true, message: 'Produto cadastrado com sucesso!', id: novoProduto.id });
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
        const [linhasAfetadas] = await Produto.update(
            { ativo: false },
            { where: { id: id, ativo: true } }
        );
        
        if (linhasAfetadas === 0) {
             return res.status(404).json({ success: false, message: 'Produto não encontrado ou já inativado.' });
        }
        
        res.json({ success: true, message: `Produto inativado com sucesso.` });
    } catch (err) {
        console.error('Erro ao inativar produto:', err);
        res.status(500).json({ success: false, message: 'Erro interno ao inativar produto.' });
    }
});


// ==========================================================
// 5. ROTAS DE PEDIDOS (Adaptadas para Sequelize)
// ==========================================================

// POST: Criar um NOVO Pedido ABERTO (Mesa/Comanda)
app.post('/api/pedido/novo', async (req, res) => {
    try {
        const proximoNumero = await getProximoNumeroPedido();
        const { cliente, itens = [] } = req.body;
        
        // Calcular total inicial (embora o total será atualizado na rota /atualizar)
        const totalCalculado = itens.reduce((sum, item) => sum + item.subtotal, 0);

        const novoPedido = await Pedido.create({
            numero: proximoNumero,
            cliente: cliente || `Mesa ${proximoNumero}`,
            total: totalCalculado,
            status: 'ABERTO'
        });

        // Cria os itens relacionados ao novo pedido
        const itensParaCriar = itens.map(item => ({
            pedidoId: novoPedido.id,
            produtoId: item.produtoId,
            nome: item.nome,
            preco: item.preco,
            quantidade: item.quantidade,
            subtotal: item.subtotal
        }));

        await ItemPedido.bulkCreate(itensParaCriar);

        res.status(201).json({ success: true, message: `Novo Pedido #${proximoNumero} criado com sucesso!`, id: novoPedido.id, numero: novoPedido.numero });
    } catch (err) {
        console.error('Erro ao criar novo pedido:', err);
        res.status(500).json({ success: false, message: 'Erro interno ao criar novo pedido.' });
    }
});

// GET: Listar todos os pedidos ABERTOS
app.get('/api/pedidos/abertos', async (req, res) => {
    try {
        const pedidos = await Pedido.findAll({ 
            where: { status: 'ABERTO' }, 
            order: [['numero', 'ASC']] 
        });
        // Não precisamos incluir os itens aqui, apenas a lista de pedidos abertos
        res.json({ success: true, data: pedidos });
    } catch (err) {
        console.error('Erro ao listar pedidos abertos:', err);
        res.status(500).json({ success: false, message: 'Erro interno ao listar pedidos.' });
    }
});

// GET: Buscar um pedido específico (para edição no PDV)
app.get('/api/pedido/:id', async (req, res) => {
    try {
        const pedido = await Pedido.findByPk(req.params.id, {
            include: [{ model: ItemPedido, as: 'itens' }] // Inclui os itens relacionados
        });
        
        if (!pedido) {
            return res.status(404).json({ success: false, message: 'Pedido não encontrado.' });
        }
        
        // Mapeia os dados para o formato esperado pelo frontend
        const pedidoFormatado = {
            id: pedido.id,
            numero: pedido.numero,
            cliente: pedido.cliente,
            total: parseFloat(pedido.total),
            status: pedido.status,
            data_abertura: pedido.data_abertura,
            itens: pedido.itens.map(item => ({
                produtoId: item.produtoId,
                nome: item.nome,
                preco: parseFloat(item.preco),
                quantidade: item.quantidade,
                subtotal: parseFloat(item.subtotal)
            }))
        };
        
        res.json({ success: true, data: pedidoFormatado });
    } catch (err) {
        console.error('Erro ao buscar pedido:', err);
        res.status(500).json({ success: false, message: 'Erro interno ao buscar pedido.' });
    }
});

// POST: Adicionar/Atualizar itens em um pedido ABERTO
app.post('/api/pedido/atualizar/:id', async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { itens, total, cliente } = req.body;
        const pedidoId = req.params.id;

        if (!itens || total === undefined) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Dados de itens e total são obrigatórios.' });
        }

        const pedido = await Pedido.findByPk(pedidoId, { transaction });

        if (!pedido || pedido.status !== 'ABERTO') {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Pedido não encontrado ou não está aberto.' });
        }

        // 1. Atualizar Pedido (Total e Cliente)
        await pedido.update({ total: parseFloat(total), cliente }, { transaction });
        
        // 2. Apagar todos os itens antigos do pedido
        await ItemPedido.destroy({ where: { pedidoId: pedidoId }, transaction });

        // 3. Inserir os novos itens
        const itensParaCriar = itens.map(item => ({
            pedidoId: pedidoId,
            produtoId: item.produtoId,
            nome: item.nome,
            preco: item.preco,
            quantidade: item.quantidade,
            subtotal: item.subtotal
        }));
        await ItemPedido.bulkCreate(itensParaCriar, { transaction });
        
        await transaction.commit();

        res.json({ success: true, message: `Pedido #${pedido.numero} atualizado com sucesso!`, data: { id: pedido.id, numero: pedido.numero, total: pedido.total, cliente: pedido.cliente } });

    } catch (err) {
        await transaction.rollback();
        console.error('Erro ao atualizar pedido:', err);
        res.status(500).json({ success: false, message: 'Erro interno ao atualizar pedido.' });
    }
});

// POST: Funcionalidade de Dividir Conta (Lógica não muda, apenas a busca)
app.post('/api/pedido/dividir/:id', async (req, res) => {
    try {
        const { pessoas } = req.body;
        if (!pessoas || pessoas <= 0) {
            return res.status(400).json({ success: false, message: 'É necessário informar um número válido de pessoas para a divisão.' });
        }
        
        const pedido = await Pedido.findByPk(req.params.id);

        if (!pedido) {
            return res.status(404).json({ success: false, message: 'Pedido não encontrado.' });
        }

        const total = parseFloat(pedido.total);
        const valorPorPessoa = parseFloat((total / pessoas).toFixed(2));
        
        res.json({
            success: true,
            message: `Conta dividida em ${pessoas} pessoas.`,
            total: total,
            pessoas: pessoas,
            valorPorPessoa: valorPorPessoa,
            aviso: "O valor por pessoa foi arredondado. O troco deve ser ajustado no final."
        });

    } catch (err) {
        console.error('Erro ao dividir conta:', err);
        res.status(500).json({ success: false, message: 'Erro interno ao dividir conta.' });
    }
});

// POST: Finalizar Pedido ABERTO (Registrar Venda)
app.post('/api/pedido/finalizar/:id', async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { formaPagamento, valorPago, troco, divisao_pessoas, divisao_valor_por_pessoa } = req.body;
        const pedidoId = req.params.id;

        // Busca o pedido e seus itens em uma transação
        const pedido = await Pedido.findByPk(pedidoId, { 
            include: [{ model: ItemPedido, as: 'itens' }], 
            transaction 
        });

        if (!pedido || pedido.status !== 'ABERTO') {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Pedido não encontrado ou já finalizado.' });
        }

        const itensFormatados = pedido.itens.map(item => ({
            produtoId: item.produtoId,
            nome: item.nome,
            preco: parseFloat(item.preco),
            quantidade: item.quantidade,
            subtotal: parseFloat(item.subtotal)
        }));

        // 1. Criar o registro de Venda (Histórico)
        const novaVenda = await Venda.create({
            pedido_id_original: pedido.id,
            itens_json: itensFormatados, // Salva o array de itens como JSON na coluna
            total_venda: parseFloat(pedido.total),
            cliente: pedido.cliente,
            forma_pagamento: formaPagamento,
            valor_pago: parseFloat(valorPago),
            troco: parseFloat(troco),
            divisao_conta_pessoas: divisao_pessoas || null,
            divisao_conta_valor: divisao_valor_por_pessoa || null
        }, { transaction });

        // 2. Mudar o status do Pedido para FINALIZADO
        await pedido.update({ status: 'FINALIZADO', data_fechamento: new Date() }, { transaction });

        await transaction.commit();

        res.json({ success: true, message: `Venda #${novaVenda.id} registrada com sucesso. Pedido #${pedido.numero} finalizado.` });

    } catch (err) {
        await transaction.rollback();
        console.error('Erro ao finalizar venda:', err);
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao registrar a venda.' });
    }
});


// GET: Buscar Vendas do Dia (Relatório - Adaptado para Sequelize)
app.get('/api/vendas/hoje', async (req, res) => {
    try {
        const inicioDoDia = new Date();
        inicioDoDia.setHours(0, 0, 0, 0);
        
        const fimDoDia = new Date();
        fimDoDia.setHours(23, 59, 59, 999);

        const vendas = await Venda.findAll({
            where: {
                data_venda: { [Op.between]: [inicioDoDia, fimDoDia] }
            },
            order: [['data_venda', 'DESC']]
        });
        
        const totalGeral = vendas.reduce((sum, venda) => sum + parseFloat(venda.total_venda), 0);
        const quantidadeVendas = vendas.length;

        const vendasFormatadas = vendas.map(v => ({
            id: v.id,
            total_venda: parseFloat(v.total_venda),
            forma_pagamento: v.forma_pagamento,
            cliente: v.cliente,
            itens: v.itens_json, // O array de itens é recuperado da coluna JSON
            data_venda: v.data_venda,
            valor_pago: parseFloat(v.valor_pago || 0),
            troco: parseFloat(v.troco || 0),
            divisao: v.divisao_conta_pessoas ? {
                quantidade_pessoas: v.divisao_conta_pessoas,
                valor_por_pessoa: parseFloat(v.divisao_conta_valor)
            } : null
        }));

        res.json({ 
            success: true, 
            data: vendasFormatadas,
            resumo: {
                totalGeral: parseFloat(totalGeral.toFixed(2)),
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
