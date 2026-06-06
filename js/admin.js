document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    const statusBadge = document.getElementById('admin-status');
    statusBadge.textContent = `Operando como: ${user.email}`;
    statusBadge.classList.replace('text-zinc-500', 'text-amber-400');

    await carregarPartidasAdmin();
});

// Captura o envio do novo formulário de partidas (Sem o ID manual)
document.getElementById('form-cadastro-partida').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Removida a linha do const id = ...
    const casa = document.getElementById('new-casa').value;
    const fora = document.getElementById('new-fora').value;
    const fase = document.getElementById('new-fase').value;
    const dataHora = document.getElementById('new-data').value;
    const isBrasil = document.getElementById('new-is-brasil').checked;

    const { error } = await window.supabaseClient
        .from('partidas')
        .insert([{
            // O banco gera o ID sozinho agora!
            time_casa: casa,
            time_fora: fora,
            fase: fase,
            data_hora: new Date(dataHora).toISOString(),
            is_brasil: isBrasil
        }]);

    if (error) {
        alert("Erro ao cadastrar partida: " + error.message);
    } else {
        alert("Partida cadastrada com sucesso!");
        document.getElementById('form-cadastro-partida').reset();
        await carregarPartidasAdmin();
    }
});

// RENDERIZA OS CARDS SEM O BOTÃO INDIVIDUAL
async function carregarPartidasAdmin() {
    const { data: partidas, error } = await window.supabaseClient
        .from('partidas')
        .select('*')
        .order('data_hora', { ascending: true });

    const container = document.getElementById('admin-jogos-container');
    if (!container || !partidas) return;

    container.innerHTML = '';

    partidas.forEach(partida => {
        const dataJogo = new Date(partida.data_hora);
        const card = document.createElement('div');
        
        // Armazenamos o ID no card para conseguirmos ler no loop de salvamento
        card.className = "card-admin-jogo bg-zinc-900 rounded-xl p-5 border border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-4";
        card.dataset.partidaId = partida.id;

        card.innerHTML = `
            <div class="flex-1 min-w-[200px]">
                <div class="text-xs text-zinc-400 font-mono">${dataJogo.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</div>
                <div class="text-sm font-bold text-zinc-200 mt-1">${partida.time_casa} x ${partida.time_fora}</div>
                <div class="text-[10px] text-zinc-500 font-semibold mt-0.5 uppercase">${partida.fase}</div>
                ${partida.is_brasil ? '<span class="text-[10px] bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Jogo do Brasil</span>' : ''}
            </div>

            <!-- Inputs de Placar Oficial -->
            <div class="flex items-center gap-2">
                <input type="number" id="admin-gols-casa-${partida.id}" value="${partida.gols_casa !== null ? partida.gols_casa : ''}" 
                    class="w-14 h-10 bg-zinc-950 border border-zinc-800 text-center font-bold rounded-lg text-lg text-white focus:outline-none focus:border-red-500">
                <span class="text-zinc-600 font-bold">X</span>
                <input type="number" id="admin-gols-fora-${partida.id}" value="${partida.gols_fora !== null ? partida.gols_fora : ''}" 
                    class="w-14 h-10 bg-zinc-950 border border-zinc-800 text-center font-bold rounded-lg text-lg text-white focus:outline-none focus:border-red-500">
            </div>

            <!-- Controle de Status -->
            <div class="flex items-center gap-3">
                <select id="admin-status-${partida.id}" 
                    class="bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-semibold h-10 px-3 text-zinc-300 focus:outline-none focus:border-red-500">
                    <option value="agendado" ${partida.status === 'agendado' ? 'selected' : ''}>📅 Agendado</option>
                    <option value="em_andamento" ${partida.status === 'em_andamento' ? 'selected' : ''}>⏳ Em Andamento</option>
                    <option value="encerrado" ${partida.status === 'encerrado' ? 'selected' : ''}>🛑 Encerrado</option>
                </select>
            </div>
        `;
        container.appendChild(card);
    });
}

// NOVA FUNÇÃO: SALVA TODAS AS ALTERAÇÕES EM LOTE
async function salvarTodasAsPartidas() {
    const cards = document.querySelectorAll('.card-admin-jogo');
    const promisesDeAtualizacao = [];

    cards.forEach(card => {
        const partidaId = card.dataset.partidaId;
        const golsCasa = document.getElementById(`admin-gols-casa-${partidaId}`).value;
        const golsFora = document.getElementById(`admin-gols-fora-${partidaId}`).value;
        const status = document.getElementById(`admin-status-${partidaId}`).value;

        // Criamos o payload APENAS com o status primeiro
        const dadosAtualizacao = { status: status };

        // Só injetamos as chaves de gols no JSON se elas REALMENTE tiverem valores digitados
        if (golsCasa !== "" && golsFora !== "") {
            dadosAtualizacao.gols_casa = parseInt(golsCasa);
            dadosAtualizacao.gols_fora = parseInt(golsFora);
        }
        // O bloco 'else' que forçava NULL foi removido! 
        // Se estiver vazio, as colunas de gols não vão no JSON e o banco mantém o que já estava lá.

        // Executa o update cirúrgico apenas nas colunas alteradas
        const request = window.supabaseClient
            .from('partidas')
            .update(dadosAtualizacao)
            .eq('id', partidaId);
        
        promisesDeAtualizacao.push(request);
    });

    if (promisesDeAtualizacao.length === 0) return;

    const resultados = await Promise.all(promisesDeAtualizacao);
    const algumErro = resultados.find(res => res.error !== null);

    if (algumErro) {
        alert("Houve um erro ao atualizar alguma das partidas. Verifique os logs.");
    } else {
        alert("Todas as partidas foram atualizadas com sucesso!");
    }

    await carregarPartidasAdmin();
}

window.salvarTodasAsPartidas = salvarTodasAsPartidas;