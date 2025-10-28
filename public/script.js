// O CÓDIGO DEVE COMEÇAR COM FUNÇÕES DE NAVEGADOR, SEM NENHUM 'require'

// Função que o HTML espera para mudar de aba
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
}

// Inicializa mostrando a primeira aba
document.addEventListener('DOMContentLoaded', () => {
    mostrarAba('pdv');
});


// Função para carregar produtos do servidor (usando fetch nativo)
async function carregarProdutos() {
    try {
        const response = await fetch('/api/produtos'); 
        const result = await response.json();

        if (result.success) {
            exibirProdutosNaTabela(result.data); 
            exibirProdutosNoCardapio(result.data); // <--- NOVO: Renderiza no Cardápio PDV
        } else {
            console.error("Erro ao carregar produtos:", result.message);
        }
    } catch (error) {
        console.error("Erro de conexão com o servidor:", error);
    }
}

// --- FUNÇÕES DE RENDERIZAÇÃO ---

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

    cardapioDiv.innerHTML = ''; // Limpa o cardápio

    produtos.forEach(produto => {
        const produtoElement = document.createElement('button');
        
        produtoElement.textContent = `${produto.nome} - R$ ${produto.preco.toFixed(2)}`;
        produtoElement.className = 'produto-card'; 
        
        produtoElement.onclick = () => {
             // Quando esta função estiver pronta, ela adicionará ao carrinho
             // addAoCarrinho(produto);
             alert(`Produto ${produto.nome} (R$ ${produto.preco.toFixed(2)}) adicionado ao carrinho!`);
        };
        
        cardapioDiv.appendChild(produtoElement);
    });
}


// Lógica para registrar um novo produto (Função que o botão Salvar chama)
async function registrarProduto() {
    const nome = document.getElementById('produto-nome').value;
    const preco = document.getElementById('produto-preco').value;
    const categoria = document.getElementById('produto-categoria').value;
    const id = document.getElementById('produto-id').value || null; 

    const produtoData = { id, nome, preco, categoria };

    if (!nome || !preco || !categoria) {
        alert("Por favor, preencha todos os campos do produto.");
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
            carregarProdutos(); 
        } else {
            alert(`Falha no cadastro: ${result.message}. Verifique os logs do servidor.`);
        }

    } catch (error) {
        alert("Erro de comunicação com a API. Verifique a conexão com o servidor.");
        console.error("Erro POST /api/produtos:", error);
    }
}
// OBS: Você precisará definir as funções: editarProduto, inativarProduto, calcularTroco, addAoCarrinho, etc.