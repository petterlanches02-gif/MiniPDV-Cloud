// O CÓDIGO DEVE COMEÇAR COM FUNÇÕES DE NAVEGADOR, SEM NENHUM 'require'

// Função que o HTML espera para mudar de aba (Corrige o ReferenceError: mostrarAba)
function mostrarAba(abaId) {
    // Esconda todas as abas
    document.querySelectorAll('.aba-conteudo').forEach(aba => {
        aba.style.display = 'none';
    });

    // Mostre a aba selecionada
    const abaSelecionada = document.getElementById(abaId);
    if (abaSelecionada) {
        abaSelecionada.style.display = 'block';
    }

    // Se for a aba de produtos, carregue-os
    if (abaId === 'aba-produtos') {
        carregarProdutos();
    }
}

// Inicializa mostrando a primeira aba (ex: PDV)
document.addEventListener('DOMContentLoaded', () => {
    mostrarAba('aba-pdv');
});


// Função para carregar produtos do servidor (usando fetch nativo)
async function carregarProdutos() {
    try {
        // A API está no mesmo host, então usamos um caminho relativo
        const response = await fetch('/api/produtos'); 
        const result = await response.json();

        if (result.success) {
            exibirProdutosNaTabela(result.data);
        } else {
            console.error("Erro ao carregar produtos:", result.message);
        }
    } catch (error) {
        console.error("Erro de conexão com o servidor:", error);
    }
}

// Função para exibir os produtos (ADAPTE PARA SEUS ELEMENTOS HTML)
function exibirProdutosNaTabela(produtos) {
    const tabelaCorpo = document.getElementById('lista-produtos'); // Supondo que você tem este ID

    if (tabelaCorpo) {
        tabelaCorpo.innerHTML = ''; // Limpa a lista
        produtos.forEach(produto => {
            const linha = tabelaCorpo.insertRow();
            linha.insertCell(0).textContent = produto.id;
            linha.insertCell(1).textContent = produto.nome;
            linha.insertCell(2).textContent = `R$ ${produto.preco.toFixed(2)}`;
            linha.insertCell(3).textContent = produto.categoria;

            // Adicione a lógica de edição/exclusão aqui
        });
    }
}

// Lógica para registrar um novo produto (Função principal que estava falhando)
async function registrarProduto() {
    const nome = document.getElementById('produto-nome').value;
    const preco = document.getElementById('produto-preco').value;
    const categoria = document.getElementById('produto-categoria').value;
    
    // Supondo que você tem um campo oculto para edição
    const id = document.getElementById('produto-id').value || null; 

    const produtoData = { id, nome, preco, categoria };

    try {
        const response = await fetch('/api/produtos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(produtoData)
        });

        const result = await response.json();
        
        if (result.success) {
            alert(result.message);
            // Recarrega a lista ou limpa o formulário
            carregarProdutos(); 
        } else {
            alert(`Falha no cadastro: ${result.message}`);
        }

    } catch (error) {
        alert("Erro de comunicação com a API.");
        console.error("Erro POST /api/produtos:", error);
    }
}

// Supondo que você tenha um botão de salvar que chama esta função no seu HTML
// Ex: <button onclick="registrarProduto()">Salvar</button>

// *******************************************************************
// ADICIONE AQUI TODAS AS OUTRAS FUNÇÕES DO SEU PDV (venda, impressão, etc.)
// *******************************************************************