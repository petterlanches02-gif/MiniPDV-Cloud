const express = require('express');
const bodyParser = require('body-parser');
const { Sequelize, DataTypes } = require('sequelize');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.json());

// Variável de Ambiente CRÍTICA para Conexão na Nuvem (Render)
// Preferimos DATABASE_URL, mas mantemos MYSQL_URI como fallback local
const DATABASE_URI = process.env.DATABASE_URL || process.env.MYSQL_URI;

// 🚨 NOVO LOG DE DEBUG (Adicionado para verificar se a variável está sendo lida no Render)
console.log(`[DEBUG] Tentando conectar com DATABASE_URI: ${DATABASE_URI ? 'Definida' : 'NÃO Definida'}`);

// ⚠️ Verifica a variável de conexão
if (!DATABASE_URI) {
    console.error('ERRO FATAL: Variável de ambiente DATABASE_URL ou MYSQL_URI não definida. O servidor não pode iniciar sem conexão com o BD.');
    process.exit(1);
}

// Configuração do Sequelize para PostgreSQL (Render) ou MySQL/Local
let sequelize;
let config;
let dialect;

if (DATABASE_URI.startsWith('postgres://')) {
    dialect = 'postgres';
    // Configuração obrigatória para o Render (conexão segura SSL)
    config = {
        dialect: dialect,
        logging: false,
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false // Permite conexões do Render
            }
        },
    };
} else if (DATABASE_URI.startsWith('mysql://')) {
    dialect = 'mysql';
    config = {
        dialect: dialect,
        logging: false,
    };
} else {
    console.error('ERRO FATAL: Formato de URI de Banco de Dados desconhecido. Deve ser postgres:// ou mysql://');
    process.exit(1);
}

// Inicializa o Sequelize
try {
    sequelize = new Sequelize(DATABASE_URI, config);
    console.log(`🟢 Configuração do Sequelize para o dialeto ${dialect} OK.`);
} catch (error) {
    console.error('ERRO FATAL: Falha na inicialização do Sequelize:', error.message);
    process.exit(1);
}

// Definição dos Modelos (Produtos, Pedidos, ItensPedido, Vendas)
const Produto = sequelize.define('Produto', {
    nome: { type: DataTypes.STRING, allowNull: false },
    preco: { type: DataTypes.FLOAT, allowNull: false },
    estoque: { type: DataTypes.INTEGER, defaultValue: 0 },
});

const Pedido = sequelize.define('Pedido', {
    dataHora: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    status: { type: DataTypes.STRING, defaultValue: 'aberto' },
    total: { type: DataTypes.FLOAT, defaultValue: 0 },
});

const ItemPedido = sequelize.define('ItemPedido', {
    quantidade: { type: DataTypes.INTEGER, allowNull: false },
    precoUnitario: { type: DataTypes.FLOAT, allowNull: false },
});

const Venda = sequelize.define('Venda', {
    dataHora: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    valorTotal: { type: DataTypes.FLOAT, allowNull: false },
    metodoPagamento: { type: DataTypes.STRING, allowNull: false },
});

// Relacionamentos
Pedido.hasMany(ItemPedido, { foreignKey: 'pedidoId' });
ItemPedido.belongsTo(Pedido, { foreignKey: 'pedidoId' });

Produto.hasMany(ItemPedido, { foreignKey: 'produtoId' });
ItemPedido.belongsTo(Produto, { foreignKey: 'produtoId' });

// Rotas da API (CRUD Básico)

// Rota de Teste/Status
app.get('/', (req, res) => {
    res.status(200).json({ 
        message: "Mini PDV API está rodando!", 
        status: "OK", 
        databaseDialect: dialect 
    });
});

// Rotas para Produtos
app.get('/produtos', async (req, res) => {
    try {
        const produtos = await Produto.findAll();
        res.json(produtos);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/produtos', async (req, res) => {
    try {
        const produto = await Produto.create(req.body);
        res.status(201).json(produto);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// Rotas para Pedidos
app.post('/pedidos', async (req, res) => {
    // Lógica para criar pedido e itens (simplificada)
    // NOTE: Em uma app real, a lógica de estoque e cálculo de total estaria aqui.
    try {
        const { itens } = req.body;
        
        // Inicia uma transação para garantir a integridade
        const result = await sequelize.transaction(async (t) => {
            const novoPedido = await Pedido.create({ status: 'aberto', total: 0 }, { transaction: t });
            let total = 0;
            
            for (const item of itens) {
                const produto = await Produto.findByPk(item.produtoId, { transaction: t });
                if (!produto) throw new Error(`Produto com ID ${item.produtoId} não encontrado.`);
                
                const precoUnitario = produto.preco;
                const subtotal = item.quantidade * precoUnitario;
                total += subtotal;
                
                await ItemPedido.create({
                    pedidoId: novoPedido.id,
                    produtoId: item.produtoId,
                    quantidade: item.quantidade,
                    precoUnitario: precoUnitario,
                }, { transaction: t });
            }
            
            await novoPedido.update({ total: total, status: 'finalizado' }, { transaction: t });
            return novoPedido;
        });

        res.status(201).json(result);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// Rotas para Vendas (Registro após o fechamento do pedido)
app.post('/vendas', async (req, res) => {
    try {
        const venda = await Venda.create(req.body);
        res.status(201).json(venda);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});


// Sincroniza o Sequelize e Inicia o Servidor
async function startServer() {
    try {
        // Sincroniza os modelos com o banco de dados (cria as tabelas se não existirem)
        await sequelize.sync({ force: false }); // 'force: true' apagaria as tabelas em cada start
        console.log('✨ Modelos de banco de dados sincronizados (tabelas criadas/atualizadas).');

        app.listen(PORT, () => {
            console.log(`🟢 Conexão com o banco de dados estabelecida com sucesso. Servidor rodando na porta ${PORT}`);
        });

    } catch (error) {
        console.error('ERRO FATAL: Falha ao conectar ou sincronizar o banco de dados. Verifique a DATABASE_URL e o dialeto:', error.message);
        process.exit(1);
    }
}

startServer();