let listaJogadoresGlobal = [];

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    if (!user) { window.location.href = 'index.html'; return; }

    const { data: jogadores } = await window.supabaseClient.from('jogadores').select('*');
    if (jogadores) listaJogadoresGlobal = jogadores;
    await carregarPartidasAdmin();
});

async function carregarPartidasAdmin() {
    if (!listaJogadoresGlobal || listaJogadoresGlobal.length === 0) {
        const { data: j } = await window.supabaseClient.from('jogadores').select('*');
        listaJogadoresGlobal = j || [];
    }

    const { data: partidas } = await window.supabaseClient.from('partidas').select('*').order('data_hora', { ascending: true });
    const { data: golsReais } = await window.supabaseClient.from('gols_partida').select('*');

    const container = document.getElementById('admin-jogos-container');
    if (!container || !partidas) return;
    container.innerHTML = '';

    partidas.forEach(partida => {
        const dataJogo = new Date(partida.data_hora);
        const card = document.createElement('div');
        card.className = "card-admin-jogo bg-zinc-900 rounded-xl p-5 border border-zinc-800 flex flex-col gap-4";
        card.dataset.partidaId = partida.id;
        card.dataset.isBrasil = partida.is_brasil;

        let painelGolsReaisAdmin = '';
        if (partida.is_brasil) {
            const golsDessaPartida = golsReais?.filter(g => g.partida_id === partida.id) || [];
            painelGolsReaisAdmin = `
                <div class="bg-zinc-950 p-3 rounded-lg border border-zinc-800 flex flex-col gap-2 w-full">
                    <div class="flex justify-between items-center">
                        <span class="text-[10px] font-bold text-red-400 uppercase tracking-wider">⚽ Gols Oficiais do Brasil na Partida</span>
                        <button type="button" onclick="adicionarGolRealAdmin(${partida.id})" class="text-[10px] bg-zinc-800 hover:bg-zinc-700 px-2 py-0.5 rounded text-white font-semibold">+ Adicionar Gol</button>
                    </div>
                    <div id="admin-lista-gols-${partida.id}" class="space-y-1"></div>
                </div>
            `;
            setTimeout(() => { golsDessaPartida.forEach(g => adicionarGolRealAdmin(partida.id, g.jogador_id)); }, 0);
        }

        card.innerHTML = `
            <div class="flex flex-col md:flex-row items-center justify-between gap-4 w-full">
                <div class="flex-1 min-w-[200px]">
                    <div class="text-xs text-zinc-400 font-mono">${dataJogo.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</div>
                    <div class="text-sm font-bold text-zinc-200 mt-1">${partida.time_casa}</div>
                    <span class="text-zinc-500 text-xs">x</span>
                    <div class="text-sm font-bold text-zinc-200">${partida.time_fora}</div>
                    <div class="text-[10px] text-zinc-500 font-semibold uppercase">${partida.fase}</div>
                </div>
                <div class="flex items-center gap-2">
                    <input type="number" id="admin-gols-casa-${partida.id}" value="${partida.gols_casa !== null ? partida.gols_casa : ''}" class="w-14 h-10 bg-zinc-950 border border-zinc-800 text-center font-bold rounded-lg text-lg text-white">
                    <span class="text-zinc-600 font-bold">X</span>
                    <input type="number" id="admin-gols-fora-${partida.id}" value="${partida.gols_fora !== null ? partida.gols_fora : ''}" class="w-14 h-10 bg-zinc-950 border border-zinc-800 text-center font-bold rounded-lg text-lg text-white">
                </div>
                <div class="flex items-center gap-3">
                    <select id="admin-status-${partida.id}" class="bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-semibold h-10 px-3 text-zinc-300">
                        <option value="agendado" ${partida.status === 'agendado' ? 'selected' : ''}>📅 Agendado</option>
                        <option value="em_andamento" ${partida.status === 'em_andamento' ? 'selected' : ''}>⏳ Em Andamento</option>
                        <option value="encerrado" ${partida.status === 'encerrado' ? 'selected' : ''}>🛑 Encerrado</option>
                    </select>
                </div>
            </div>
            ${painelGolsReaisAdmin}
        `;
        container.appendChild(card);
    });
}

function adicionarGolRealAdmin(partidaId, jogadorIdSelecionado = null) {
    const container = document.getElementById(`admin-lista-gols-${partidaId}`);
    if (!container) return;

    const wrapper = document.createElement('div');
    wrapper.className = "flex gap-2 items-center row-gol-real";
    let options = '<option value="">Selecione o Autor</option>';
    listaJogadoresGlobal.filter(j => j.selecao === 'Brasil').forEach(j => {
        options += `<option value="${j.id}" ${jogadorIdSelecionado === j.id ? 'selected' : ''}>${j.nome}</option>`;
    });

    wrapper.innerHTML = `
        <select class="select-gol-real flex-1 h-8 bg-zinc-900 border border-zinc-800 rounded text-xs px-2 text-zinc-300">${options}</select>
        <button type="button" onclick="this.parentElement.remove()" class="text-zinc-500 hover:text-red-400 text-xs px-1">✕</button>
    `;
    container.appendChild(wrapper);
}

async function salvarTodasAsPartidas() {
    const cards = document.querySelectorAll('.card-admin-jogo');
    
    for (const card of cards) {
        const partidaId = card.dataset.partidaId;
        const golsCasa = document.getElementById(`admin-gols-casa-${partidaId}`).value;
        const golsFora = document.getElementById(`admin-gols-fora-${partidaId}`).value;
        const status = document.getElementById(`admin-status-${partidaId}`).value;
        const dadosAtualizacao = { status: status };

        if (golsCasa !== "" && golsFora !== "") {
            dadosAtualizacao.gols_casa = parseInt(golsCasa);
            dadosAtualizacao.gols_fora = parseInt(golsFora);
        }

        const { error: errPartida } = await window.supabaseClient.from('partidas').update(dadosAtualizacao).eq('id', partidaId);
        if (errPartida) { alert(`Erro: ${errPartida.message}`); continue; }

        if (card.dataset.isBrasil === 'true') {
            await window.supabaseClient.from('gols_partida').delete().eq('partida_id', parseInt(partidaId));
            const dropdowns = document.getElementById(`admin-lista-gols-${partidaId}`).querySelectorAll('.select-gol-real');
            const dadosGolsReais = [];

            dropdowns.forEach(select => {
                if (select.value) {
                    dadosGolsReais.push({
                        partida_id: parseInt(partidaId),
                        jogador_id: parseInt(select.value),
                        quantidade: 1 // Necessário para a restrição NOT NULL do Admin
                    });
                }
            });

            if (dadosGolsReais.length > 0) {
                const { error: errGols } = await window.supabaseClient.from('gols_partida').insert(dadosGolsReais);
                if (errGols) alert(`Erro nos gols: ${errGols.message}`);
            }
        }
    }
    alert("Dados atualizados com sucesso!");
    await carregarPartidasAdmin();
}

document.getElementById('form-cadastro-partida')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { error } = await window.supabaseClient.from('partidas').insert([{
        time_casa: document.getElementById('new-casa').value,
        time_fora: document.getElementById('new-fora').value,
        fase: document.getElementById('new-fase').value,
        data_hora: new Date(document.getElementById('new-data').value).toISOString(),
        is_brasil: document.getElementById('new-is-brasil').checked
    }]);

    if (error) alert("Erro: " + error.message);
    else { alert("Partida cadastrada!"); document.getElementById('form-cadastro-partida').reset(); await carregarPartidasAdmin(); }
});

window.salvarTodasAsPartidas = salvarTodasAsPartidas;
window.adicionarGolRealAdmin = adicionarGolRealAdmin;