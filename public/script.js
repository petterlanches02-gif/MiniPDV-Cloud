// VARIÁVEIS GLOBAIS
let produtosCadastrados = [];
let pedidoAtual = [];
let categorias = [];

// ==========================================================
// 1. LÓGICAS DE PRODUTOS E CARDÁPIO (PDV)
// ==========================================================

// Função para carregar produtos do servidor
async function carregarProdutos() {
    const cardapioDiv = document.getElementById('cardapio');
    const listaProdutosDiv = document.getElementById('lista-produtos-cadastrados');

    cardapioDiv.innerHTML = '<p>Carregando produtos...</p>';
    listaProdutosDiv.innerHTML = '<p>Carregando lista de produtos...</p>';

    try {
        const response = await fetch('/api/produtos');
        const result = await response.json();

        if (result.success) {
            produtosCadastrados = result.data;
            
            exibirProdutosNoCardapio(produtosCadastrados);
            exibirProdutosNaTabela(produtosCadastrados);
        } else {
            mostrarMensagem("Erro ao carregar produtos: " + result.message, 'error');
            cardapioDiv.innerHTML = '<p style="color: red;">Falha ao carregar cardápio.</p>';
            listaProdutosDiv.innerHTML = '<p style="color: red;">Falha ao carregar lista.</p>';
        }
    } catch (error) {
        console.error("Erro de conexão com o servidor:", error);
        mostrarMensagem("Erro de conexão com o servidor. Verifique o backend.", 'error');
        cardapioDiv.innerHTML = '<p style="color: red;">Erro de conexão.</p>';
        listaProdutosDiv.innerHTML = '<p style="color: red;">Erro de conexão.</p>';
    }
}

// Função para exibir produtos no PDV (Cardápio)
function exibirProdutosNoCardapio(produtos) {
    const cardapioDiv = document.getElementById('cardapio');
    const categoriasNav = document.getElementById('categorias-nav');
    cardapioDiv.innerHTML = '';
    categoriasNav.innerHTML = '';

    if (produtos.length === 0) {
        cardapioDiv.innerHTML = '<p>Nenhum produto cadastrado. Cadastre um produto primeiro.</p>';
        return;
    }

    // 1. Filtra categorias
    categorias = [...new Set(produtos.map(p => p.categoria))];
    
    // 2. Cria botão "Todos"
    const todosBtn = document.createElement('button');
    todosBtn.textContent = 'Todos';
    todosBtn.classList.add('categoria-btn', 'active');
    todosBtn.onclick = () => filtrarCardapio('Todos');
    categoriasNav.appendChild(todosBtn);

    // 3. Cria botões de categoria
    categorias.forEach(cat => {
        const btn = document.createElement('button');
        btn.textContent = cat;
        btn.classList.add('categoria-btn');
        btn.onclick = () => filtrarCardapio(cat);
        categoriasNav.appendChild(btn);
    });

    // 4. Exibe todos os produtos por padrão
    produtos.forEach(produto => {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('cardapio-item', `categoria-${produto.categoria.replace(/\s/g, '-')}`);
        itemDiv.setAttribute('data-categoria', produto.categoria);
        itemDiv.onclick = () => adicionarAoPedido(produto);

        itemDiv.innerHTML = `
            <h3>${produto.nome}</h3>
            <p class="categoria-item">${produto.categoria}</p>
            <p class="preco">R$ ${produto.preco.toFixed(2).replace('.', ',')}</p>
        `;
        cardapioDiv.appendChild(itemDiv);
    });
}

// Função para filtrar o cardápio por categoria
function filtrarCardapio(categoria) {
    const todosItens = document.querySelectorAll('.cardapio-item');
    const todosBotoes = document.querySelectorAll('.categoria-btn');

    // Remove 'active' de todos os botões
    todosBotoes.forEach(btn => btn.classList.remove('active'));

    // Ativa o botão selecionado
    const botaoSelecionado = Array.from(todosBotoes).find(btn => btn.textContent === categoria);
    if (botaoSelecionado) {
        botaoSelecionado.classList.add('active');
    }

    // Exibe/Oculta itens
    todosItens.forEach(item => {
        const itemCategoria = item.getAttribute('data-categoria');
        if (categoria === 'Todos' || itemCategoria === categoria) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}


// ==========================================================
// 2. LÓGICAS DE PEDIDO (CARRINHO)
// ==========================================================

// Adiciona um produto ao carrinho
function adicionarAoPedido(produto) {
    const itemExistente = pedidoAtual.find(item => item.id === produto.id);

    if (itemExistente) {
        itemExistente.quantidade++;
        itemExistente.total = itemExistente.quantidade * itemExistente.preco;
    } else {
        pedidoAtual.push({
            id: produto.id,
            nome: produto.nome,
            preco: produto.preco,
            quantidade: 1,
            total: produto.preco
        });
    }
    atualizarPedidoLista();
}

// Remove ou diminui a quantidade de um item no carrinho
function manipularItem(itemId, acao) {
    const index = pedidoAtual.findIndex(item => item.id === itemId);

    if (index !== -1) {
        const item = pedidoAtual[index];
        if (acao === 'adicionar') {
            item.quantidade++;
        } else if (acao === 'remover' && item.quantidade > 1) {
            item.quantidade--;
        } else if (acao === 'deletar' || item.quantidade === 1) {
            pedidoAtual.splice(index, 1); // Remove o item
        }
    }
    atualizarPedidoLista();
}

// Renderiza a lista do carrinho e calcula o total
function atualizarPedidoLista() {
    const listaDiv = document.getElementById('pedido-lista');
    const totalSpan = document.getElementById('total-valor');
    const btnImprimir = document.getElementById('btn-imprimir');
    
    listaDiv.innerHTML = '';
    let totalGeral = 0;

    if (pedidoAtual.length === 0) {
        listaDiv.innerHTML = '<p>O carrinho está vazio.</p>';
        btnImprimir.disabled = true;
    } else {
        btnImprimir.disabled = false;
        pedidoAtual.forEach(item => {
            item.total = item.quantidade * item.preco;
            totalGeral += item.total;

            const itemDiv = document.createElement('div');
            itemDiv.classList.add('pedido-item');
            itemDiv.innerHTML = `
                <span>${item.quantidade}x ${item.nome}</span>
                <span class="pedido-valor">R$ ${item.total.toFixed(2).replace('.', ',')}</span>
                <div class="pedido-actions">
                    <button onclick="manipularItem(${item.id}, 'adicionar')">+</button>
                    <button onclick="manipularItem(${item.id}, 'remover')">-</button>
                    <button class="remover-item" onclick="manipularItem(${item.id}, 'deletar')">X</button>
                </div>
            `;
            listaDiv.appendChild(itemDiv);
        });
    }

    totalSpan.textContent = totalGeral.toFixed(2).replace('.', ',');
    // Atualiza o cálculo do troco sempre que o total mudar
    calcularTroco(); 
}

// Calcula e exibe o troco
function calcularTroco() {
    const totalValor = parseFloat(document.getElementById('total-valor').textContent.replace(',', '.'));
    const valorPagoInput = document.getElementById('valor-pago');
    const trocoSpan = document.getElementById('troco-valor');
    
    const valorPago = parseFloat(valorPagoInput.value) || 0;
    
    let troco = valorPago - totalValor;
    
    if (troco < 0) {
        troco = 0; // Se o valor pago for menor que o total, o troco é 0
    }

    trocoSpan.textContent = troco.toFixed(2).replace('.', ',');
}

// Finaliza a venda e envia para o backend
async function finalizarVenda() {
    if (pedidoAtual.length === 0) {
        mostrarMensagem("O pedido está vazio.", 'info');
        return;
    }

    const total = parseFloat(document.getElementById('total-valor').textContent.replace(',', '.'));
    const cliente = document.getElementById('nome-cliente').value || 'Não Informado';
    const formaPagamento = document.getElementById('forma-pagamento').value;
    const valorPago = parseFloat(document.getElementById('valor-pago').value) || total;
    const troco = parseFloat(document.getElementById('troco-valor').textContent.replace(',', '.'));

    const vendaData = {
        itens: pedidoAtual.map(item => ({
            id: item.id,
            nome: item.nome,
            preco: item.preco,
            quantidade: item.quantidade
        })),
        total: total,
        cliente: cliente,
        formaPagamento: formaPagamento,
        valorPago: valorPago,
        troco: troco
    };

    try {
        const response = await fetch('/api/pedido', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(vendaData)
        });
        const result = await response.json();

        if (result.success) {
            mostrarMensagem("Venda finalizada! " + result.message, 'success');
            // Limpar o PDV
            pedidoAtual = [];
            document.getElementById('nome-cliente').value = '';
            document.getElementById('valor-pago').value = '0.00';
            document.getElementById('troco-valor').textContent = '0.00';
            atualizarPedidoLista();
            carregarRelatorio(); // Recarrega o relatório para mostrar a nova venda
        } else {
            mostrarMensagem("Erro ao finalizar a venda: " + result.message, 'error');
        }
    } catch (error) {
        console.error("Erro de rede ao finalizar a venda:", error);
        mostrarMensagem("Erro de conexão ao finalizar a venda. Tente novamente.", 'error');
    }
}


// ==========================================================
// 3. LÓGICAS DE CADASTRO
// ==========================================================

// Função para exibir produtos na tabela da aba Cadastro
function exibirProdutosNaTabela(produtos) {
    const listaDiv = document.getElementById('lista-produtos-cadastrados');
    listaDiv.innerHTML = '';

    if (produtos.length === 0) {
        listaDiv.innerHTML = '<p>Nenhum produto cadastrado.</p>';
        return;
    }

    const table = document.createElement('table');
    table.innerHTML = `
        <thead>
            <tr>
                <th>ID</th>
                <th>Nome</th>
                <th>Categoria</th>
                <th>Preço</th>
                <th>Ações</th>
            </tr>
        </thead>
        <tbody id="produtos-tabela-body">
        </tbody>
    `;
    listaDiv.appendChild(table);
    const tbody = document.getElementById('produtos-tabela-body');

    produtos.forEach(produto => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${produto.id}</td>
            <td>${produto.nome}</td>
            <td>${produto.categoria}</td>
            <td>R$ ${produto.preco.toFixed(2).replace('.', ',')}</td>
            <td>
                <button class="btn-editar" onclick="editarProduto(${produto.id})">Editar</button>
                <button class="btn-deletar" onclick="deletarProduto(${produto.id})">Deletar</button>
            </td>
        `;
    });
}

// Preenche o formulário para edição
function editarProduto(id) {
    const produto = produtosCadastrados.find(p => p.id === id);
    if (!produto) return;

    document.getElementById('produto-id').value = produto.id;
    document.getElementById('produto-nome').value = produto.nome;
    document.getElementById('produto-categoria').value = produto.categoria;
    document.getElementById('produto-preco').value = produto.preco;

    document.getElementById('btn-salvar-produto').textContent = 'Atualizar Produto';
    document.getElementById('btn-cancelar-edicao').style.display = 'inline-block';
    mostrarMensagem(`Editando: ${produto.nome}.`, 'info');
}

// Limpa o formulário de cadastro/edição
function limparFormularioCadastro() {
    document.getElementById('produto-id').value = '';
    document.getElementById('produto-nome').value = '';
    document.getElementById('produto-categoria').value = '';
    document.getElementById('produto-preco').value = '';
    document.getElementById('btn-salvar-produto').textContent = 'Salvar Novo Produto';
    document.getElementById('btn-cancelar-edicao').style.display = 'none';
    mostrarMensagem('', 'none');
}

// Envia dados do formulário para o backend (Cadastro/Edição)
async function registrarProduto() {
    const id = document.getElementById('produto-id').value;
    const nome = document.getElementById('produto-nome').value;
    const categoria = document.getElementById('produto-categoria').value;
    const preco = document.getElementById('produto-preco').value;

    if (!nome || !categoria || !preco) {
        mostrarMensagem('Preencha todos os campos do produto.', 'error');
        return;
    }

    const produtoData = {
        id: id || null,
        nome: nome,
        categoria: categoria,
        preco: parseFloat(preco)
    };

    try {
        const response = await fetch('/api/produtos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(produtoData)
        });
        const result = await response.json();

        if (result.success) {
            mostrarMensagem(result.message, 'success');
            limparFormularioCadastro();
            carregarProdutos(); // Recarrega as listas
        } else {
            mostrarMensagem("Erro ao salvar produto: " + result.message, 'error');
        }
    } catch (error) {
        console.error("Erro de rede ao salvar produto:", error);
        mostrarMensagem("Erro de conexão com o servidor ao salvar o produto.", 'error');
    }
}

// Deleta (Inativa) um produto
async function deletarProduto(id) {
    if (!confirm("Tem certeza que deseja DELETAR (inativar) este produto?")) return;

    try {
        const response = await fetch(`/api/produtos/${id}`, {
            method: 'DELETE'
        });
        const result = await response.json();

        if (result.success) {
            mostrarMensagem(result.message, 'success');
            carregarProdutos(); // Recarrega as listas
        } else {
            mostrarMensagem("Erro ao deletar produto: " + result.message, 'error');
        }
    } catch (error) {
        console.error("Erro de rede ao deletar produto:", error);
        mostrarMensagem("Erro de conexão com o servidor ao deletar o produto.", 'error');
    }
}


// ==========================================================
// 4. LÓGICAS DE RELATÓRIO
// ==========================================================

async function carregarRelatorio() {
    const vendasDiv = document.getElementById('vendas-do-dia');
    vendasDiv.innerHTML = '<p>Carregando vendas...</p>';

    try {
        const response = await fetch('/api/vendas/hoje');
        const result = await response.json();

        if (result.success) {
            const vendas = result.data;
            const resumo = result.resumo;

            if (vendas.length === 0) {
                vendasDiv.innerHTML = `
                    <h3>Resumo do Dia: R$ ${resumo.totalGeral.toFixed(2).replace('.', ',')}</h3>
                    <p>Nenhuma venda registrada hoje.</p>
                `;
                return;
            }

            // Cria o HTML para exibir o resumo e a tabela
            let htmlContent = `
                <div id="resumo-vendas" style="margin-bottom: 20px; border: 1px solid #ddd; padding: 15px; border-radius: 4px; background-color: #f9f9f9;">
                    <p>Total de Vendas Registradas: <strong>${resumo.quantidadeVendas}</strong></p>
                    <p>Faturamento Total do Dia: <strong>R$ ${resumo.totalGeral.toFixed(2).replace('.', ',')}</strong></p>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Hora</th>
                            <th>Total (R$)</th>
                            <th>Pagamento</th>
                            <th>Troco</th>
                            <th>Itens</th>
                            <th>Cliente</th>
                        </tr>
                    </thead>
                    <tbody id="relatorio-vendas-body">
            `;

            // Preenche a Tabela de Detalhes
            vendas.forEach(venda => {
                const dataFormatada = new Date(venda.data_venda).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                
                // Formata os itens do pedido para exibição
                const itensDetalhe = venda.item_pedido.map(item => 
                    `${item.quantidade}x ${item.nome}`
                ).join('<br>');

                htmlContent += `
                    <tr>
                        <td>${dataFormatada}</td>
                        <td>R$ ${venda.total_venda.toFixed(2).replace('.', ',')}</td>
                        <td>${venda.forma_pagamento}</td>
                        <td>R$ ${venda.troco.toFixed(2).replace('.', ',')}</td>
                        <td>${itensDetalhe}</td>
                        <td>${venda.cliente}</td>
                    </tr>
                `;
            });

            htmlContent += `
                    </tbody>
                </table>
            `;
            vendasDiv.innerHTML = htmlContent;

        } else {
            vendasDiv.innerHTML = `<p style="color: red;">Erro ao carregar relatório: ${result.message}</p>`;
        }
    } catch (error) {
        console.error("Erro de comunicação ao buscar relatórios:", error);
        vendasDiv.innerHTML = '<p style="color: red;">Erro de conexão com o servidor.</p>';
    }
}


// ==========================================================
// 5. FUNÇÕES GERAIS E INICIALIZAÇÃO
// ==========================================================

// Função para exibir mensagens
function mostrarMensagem(texto, tipo) {
    const msg = document.getElementById('mensagem');
    msg.className = 'mensagem';
    msg.textContent = texto;

    if (tipo === 'success') {
        msg.classList.add('success');
    } else if (tipo === 'error') {
        msg.classList.add('error');
    } else if (tipo === 'info') {
        msg.classList.add('info');
    } else {
        // Se tipo for 'none' ou outro, apenas limpa a mensagem
        msg.style.display = 'none';
        return;
    }
    msg.style.display = 'block';
}

// Função para controlar a troca de abas
function mostrarAba(abaId) {
    // 1. Esconder todos os conteúdos e desativar botões
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });

    // 2. Mostrar o conteúdo e ativar o botão correto
    document.getElementById(abaId).classList.add('active');
    document.querySelector(`.tab-button[onclick="mostrarAba('${abaId}')"]`).classList.add('active');

    // 3. Executar ações específicas da aba
    if (abaId === 'pdv') {
        carregarProdutos();
        atualizarPedidoLista();
    } else if (abaId === 'cadastro') {
        carregarProdutos();
        limparFormularioCadastro();
    } else if (abaId === 'relatorios') {
        carregarRelatorio();
    }
}

// Inicialização: Garante que o PDV é carregado ao iniciar
document.addEventListener('DOMContentLoaded', () => {
    // Adiciona listener ao botão de finalizar pedido
    document.getElementById('btn-imprimir').addEventListener('click', finalizarVenda);
    
    // Inicializa a primeira aba
    mostrarAba('pdv'); 
    
    // Inicializa a lista de pedido
    atualizarPedidoLista();
});