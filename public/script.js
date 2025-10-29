// ... (código existente no script.js, depois da função finalizarVenda e antes de outras funções)

// ...

// 9. Lógica para carregar e exibir o relatório de vendas
async function carregarRelatorio() {
    const resumoDiv = document.getElementById('resumo-vendas');
    const relatorioTbody = document.getElementById('relatorio-vendas-body');

    if (!resumoDiv || !relatorioTbody) return;

    resumoDiv.innerHTML = '<p>Carregando vendas...</p>';
    relatorioTbody.innerHTML = '';

    try {
        const response = await fetch('/api/vendas/hoje');
        const result = await response.json();

        if (result.success) {
            const vendas = result.data;
            const resumo = result.resumo;

            // 1. Exibir o Resumo
            resumoDiv.innerHTML = `
                <p>Total de Vendas Registradas: <strong>${resumo.quantidadeVendas}</strong></p>
                <p>Faturamento Total do Dia: <strong>R$ ${resumo.totalGeral.toFixed(2)}</strong></p>
            `;

            // 2. Preencher a Tabela de Detalhes
            if (vendas.length === 0) {
                 relatorioTbody.innerHTML = '<tr><td colspan="5">Nenhuma venda registrada hoje.</td></tr>';
                 return;
            }

            vendas.forEach(venda => {
                const dataFormatada = new Date(venda.data_venda).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                
                // Formata os itens do pedido para exibição
                const itensDetalhe = venda.item_pedido.map(item => 
                    `${item.quantidade}x ${item.nome}`
                ).join('<br>');


                const row = relatorioTbody.insertRow();
                row.innerHTML = `
                    <td>${dataFormatada}</td>
                    <td>R$ ${venda.total_venda.toFixed(2)}</td>
                    <td>${venda.forma_pagamento}</td>
                    <td>${venda.cliente}</td>
                    <td>${itensDetalhe}</td>
                `;
            });

        } else {
            resumoDiv.innerHTML = `<p style="color: red;">Erro ao carregar relatório: ${result.message}</p>`;
        }
    } catch (error) {
        console.error("Erro de comunicação ao buscar relatórios:", error);
        resumoDiv.innerHTML = '<p style="color: red;">Erro de conexão com o servidor.</p>';
    }
}