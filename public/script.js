// VARIÁVEIS GLOBAIS DE ESTADO
let produtosCadastrados = []; // Mantém a lista atualizada para Edição
let pedidoAtual = [];       // O array que representa o Carrinho de Vendas


// =================================================================
//                 FUNÇÕES DE NAVEGAÇÃO E INICIALIZAÇÃO
// =================================================================

function mostrarAba(abaId) {
    document.querySelectorAll('.tab-content').forEach(aba => {
        aba.style.display = 'none';
    });
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });

    const abaSelecionada = document.getElementById(abaId);
    const botaoSelecionado = document.querySelector(`.tab-button[onclick="mostrarAba('${abaId}')"]`);

    if (abaSelecionada) {
        abaSelecionada.style.display = 'block';
    }
    if (botaoSelecionado) {
        botaoSelecionado.classList.add('active');
    }

    if (abaId === 'cadastro' || abaId === 'pdv') {
        carregarProdutos();
    }
    if (abaId === 'pdv') {
        atualizarCarrinhoDisplay(); // Garante que o carrinho aparece se já houver itens
    }
}

// Inicializa mostrando a primeira aba (PDV)
document.addEventListener('DOMContentLoaded', () => {
    mostrarAba('pdv');
});


// Função para carregar produtos do servidor (usando fetch nativo)
async function carregarProdutos() {
    try {
        const response = await fetch('/api/produtos'); 
        const result = await response.json();

        if (result.success) {
            produtosCadastrados = result.data; // ATUALIZA A VARIÁVEL GLOBAL
            
            exibirProdutosNaTabela(produtosCadastrados); 
            exibirProdutosNoCardapio(produtosCadastrados); 
        } else {
            console.error("Erro ao carregar produtos:", result.message);
        }
    } catch (error) {
        console.error("Erro de conexão com o servidor:", error);
    }
}


// =================================================================
//                          FUNÇÕES DE RENDERIZAÇÃO
// =================================================================

// Função 1: Exibir os produtos na tabela da ABA CADASTRO
function exibirProdutosNaTabela(produtos) {
    const listaProdutosCadastrados = document.getElementById('lista-produtos-cadastrados');

    if (listaProdutosCadastrados) {
        let html = '<table><thead><tr><th>ID</th><th>Nome</th><th>Preço</th><th>Categoria</th><th>Ações</th></tr></thead><tbody>';
        
        produtos.forEach(produto => {
            html += `
                <tr>
                    <td>${produto.id}</td>
                    <td>${produto.nome}</td>
                    <td>R$ ${produto.preco.toFixed(2)}</td>
                    <td>${produto.categoria}</td>
                    <td>
                        <button onclick="editarProduto(${produto.id})">Editar</button>
                        <button onclick="inativarProduto(${produto.id})" style="background-color: #dc3545;">Inativar</button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        listaProdutosCadastrados.innerHTML = html;
    }
}

// Função 2: Exibir os produtos no Cardápio da ABA PDV (VENDAS)
function exibirProdutosNoCardapio(produtos) {
    const cardapioDiv = document.getElementById('cardapio');
    if (!cardapioDiv) return;

    cardapioDiv.innerHTML = ''; 

    produtos.forEach(produto => {
        const produtoElement = document.createElement('button');
        
        produtoElement.textContent = `${produto.nome} - R$ ${produto.preco.toFixed(2)}`;
        produtoElement.className = 'produto-card'; 
        
        // CHAMA A FUNÇÃO DE ADIÇÃO AO CARRINHO
        produtoElement.onclick = () => {
             addAoCarrinho(produto);
        };
        
        cardapioDiv.appendChild(produtoElement);
    });
}

// Função 3: Renderizar e somar o Carrinho
function atualizarCarrinhoDisplay() {
    // No HTML, você tem #pedido-lista, mas o código usa #carrinho-lista. Vamos usar #pedido-lista.
    const listaElement = document.getElementById('pedido-lista'); 
    const totalElement = document.getElementById('total-valor');
    let totalVenda = 0;

    if (!listaElement) return;

    if (pedidoAtual.length === 0) {
        listaElement.innerHTML = '<p>O carrinho está vazio.</p>';
    } else {
        listaElement.innerHTML = '';
    }

    pedidoAtual.forEach((item, index) => {
        const subtotal = item.preco * item.quantidade;
        totalVenda += subtotal;

        const listItem = document.createElement('li');
        listItem.className = 'item-pedido';
        
        // Qtd x Nome (Preço unit) = Subtotal
        listItem.textContent = `${item.quantidade}x ${item.nome} (R$ ${item.preco.toFixed(2)}) = R$ ${subtotal.toFixed(2)}`;
        
        const removeButton = document.createElement('button');
        removeButton.textContent = 'X';
        removeButton.className = 'btn-remover-item';
        removeButton.onclick = () => removerItemDoCarrinho(index); 

        listItem.appendChild(removeButton);
        listaElement.appendChild(listItem);
    });

    // Atualiza o total
    if (totalElement) {
        totalElement.textContent = totalVenda.toFixed(2);
    }
    
    // Atualiza o valor pago para calcular o troco (se o input estiver preenchido)
    calcularTroco();
}


// =================================================================
//                     FUNÇÕES DE AÇÃO E LÓGICA
// =================================================================

// 1. Adiciona ou incrementa o produto ao carrinho
function addAoCarrinho(produto) {
    const itemIndex = pedidoAtual.findIndex(item => item.id === produto.id);

    if (itemIndex > -1) {
        // Incrementa a quantidade
        pedidoAtual[itemIndex].quantidade += 1;
    } else {
        // Adiciona novo
        pedidoAtual.push({
            id: produto.id,
            nome: produto.nome,
            preco: produto.preco,
            quantidade: 1
        });
    }

    atualizarCarrinhoDisplay();
}

// 2. Remove ou decrementa um item do carrinho
function removerItemDoCarrinho(index) {
    if (pedidoAtual[index].quantidade > 1) {
        // Decrementa
        pedidoAtual[index].quantidade -= 1;
    } else {
        // Remove o item inteiro
        pedidoAtual.splice(index, 1);
    }
    atualizarCarrinhoDisplay();
}

// 3. Calcula e exibe o troco (chamada pelo input 'valor-pago')
function calcularTroco() {
    const totalValorSpan = document.getElementById('total-valor');
    const valorPagoInput = document.getElementById('valor-pago');
    const trocoValorSpan = document.getElementById('troco-valor');

    const total = parseFloat(totalValorSpan.textContent) || 0;
    const pago = parseFloat(valorPagoInput.value) || 0;

    const troco = pago - total;

    if (trocoValorSpan) {
        trocoValorSpan.textContent = Math.max(0, troco).toFixed(2);
        trocoValorSpan.style.color = troco >= 0 ? '#28a745' : '#dc3545';
    }
}


// 4. Limpa o formulário de cadastro e reseta o botão
function limparFormularioCadastro() {
    document.getElementById('produto-id').value = '';
    document.getElementById('produto-nome').value = '';
    document.getElementById('produto-preco').value = '';
    document.getElementById('produto-categoria').value = '';

    document.getElementById('btn-salvar-produto').textContent = 'Salvar Novo Produto';
    document.getElementById('btn-cancelar-edicao').style.display = 'none';
}


// 5. Lógica para editar um produto (preenche o formulário)
function editarProduto(id) {
    const produto = produtosCadastrados.find(p => p.id === id);

    if (!produto) {
        alert("Erro: Produto não encontrado na lista atual.");
        return;
    }

    document.getElementById('produto-id').value = produto.id;
    document.getElementById('produto-nome').value = produto.nome;
    document.getElementById('produto-preco').value = produto.preco;
    document.getElementById('produto-categoria').value = produto.categoria;

    document.getElementById('btn-salvar-produto').textContent = 'Atualizar Produto';
    document.getElementById('btn-cancelar-edicao').style.display = 'inline-block';

    document.getElementById('cadastro-form').scrollIntoView({ behavior: 'smooth' });
}


// 6. Lógica para inativar (deletar soft delete) um produto
async function inativarProduto(id) {
    if (!confirm(`Tem certeza que deseja INATIVAR o produto ID ${id}? Ele será removido da lista de vendas.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/produtos/${id}`, {
            method: 'DELETE'
        });
        const result = await response.json();

        if (result.success) {
            alert(result.message);
            carregarProdutos(); 
        } else {
            alert(`Falha ao inativar: ${result.message}`);
        }
    } catch (error) {
        console.error("Erro ao tentar inativar produto:", error);
        alert("Erro de comunicação ao inativar o produto.");
    }
}


// 7. Lógica para registrar/atualizar um produto (POST/UPDATE)
async function registrarProduto() {
    const nome = document.getElementById('produto-nome').value;
    const preco = parseFloat(document.getElementById('produto-preco').value.replace(',', '.')) || 0;
    const categoria = document.getElementById('produto-categoria').value;
    const id = document.getElementById('produto-id').value || null; 

    const produtoData = { id, nome, preco, categoria };

    if (!nome || preco <= 0 || !categoria) {
        alert("Por favor, preencha todos os campos corretamente (Preço deve ser maior que zero).");
        return; 
    }

    try {
        const response = await fetch('/api/produtos', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(produtoData)
        });

        const result = await response.json();
        
        if (result.success) {
            alert(result.message);
            limparFormularioCadastro(); 
            carregarProdutos(); 
        } else {
            alert(`Falha no cadastro/atualização: ${result.message}. Verifique os logs do servidor.`);
        }

    } catch (error) {
        alert("Erro de comunicação com a API. Verifique a conexão com o servidor.");
        console.error("Erro POST /api/produtos:", error);
    }
}