let currentUserId = null;
let listaJogadores = []; // Armazenamento local dos atletas para os seletores

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    if (!user) { window.location.href = 'index.html'; return; }
    currentUserId = user.id;

    // 1. Carrega os jogadores globais do banco primeiro
    const { data: jogadores } = await window.supabaseClient.from('jogadores').select('*');
    listaJogadores = jogadores || [];

    await carregarLongoPrazo();
    await carregarJogos(user.id);
});

// CARREGA OPÇÕES E DADOS DE LONGO PRAZO
async function carregarLongoPrazo() {
    const selectArtilheiro = document.getElementById('lp-artilheiro');
    if (!selectArtilheiro) return;

    selectArtilheiro.innerHTML = '<option value="">Selecione o Artilheiro</option>';
    listaJogadores.forEach(j => {
        selectArtilheiro.innerHTML += `<option value="${j.id}">${j.nome} (${j.selecao})</option>`;
    });

    const { data } = await window.supabaseClient.from('palpites_longo_prazo').select('*').eq('user_id', currentUserId).single();
    if (data) {
        document.getElementById('lp-campeao').value = data.campeao;
        document.getElementById('lp-vice').value = data.vice;
        document.getElementById('lp-artilheiro').value = data.artilheiro_id || "";
    }
}

// RENDERIZA JOGOS COM ACESSO AOS GOLS DO BRASIL
async function carregarJogos(userId) {
    const { data: partidas } = await window.supabaseClient.from('partidas').select('*').order('data_hora', { ascending: true });
    const { data: palpites } = await window.supabaseClient.from('palpites').select('*').eq('user_id', userId);

    // Puxa também os palpites de gols do Brasil que o usuário já salvou antes
    const { data: palpitesGols } = await window.supabaseClient.from('palpites_gols_brasil').select('*, palpites!inner(user_id)').eq('palpites.user_id', userId);

    const container = document.getElementById('jogos-container');
    if (!container || !partidas) return;
    container.innerHTML = '';

    partidas.forEach(partida => {
        const palpite = palpites?.find(p => p.partida_id === partida.id);
        const dataJogo = new Date(partida.data_hora);
        const agora = new Date();
        const lockoutTime = new Date(dataJogo.getTime() - 10 * 60 * 1000);
        const mercadoFechado = (agora >= lockoutTime) || (partida.status !== 'agendado');

        const card = document.createElement('div');
        card.className = "card-jogo bg-zinc-900 rounded-xl p-5 border border-zinc-800 flex flex-col gap-4 relative overflow-hidden";
        card.dataset.partidaId = partida.id;
        card.dataset.mercadoFechado = mercadoFechado;
        card.dataset.isBrasil = partida.is_brasil;

        if (partida.is_brasil) card.classList.add('border-l-4', 'border-l-yellow-500');

        // GERA O COMPONENTE DE SELEÇÃO DE GOLS SE FOR JOGO DO BRASIL
        let subpainelGolsBrasil = '';
        if (partida.is_brasil) {
            // Tenta achar se o usuário já tinha selecionado alguém para esse palpite específico
            const golSalvo = palpitesGols?.find(g => g.palpite_id === palpite?.id);

            let optionsJogadores = '<option value="">Ninguém (Zero Gols)</option>';
            listaJogadores.filter(j => j.selecao === 'Brasil').forEach(j => {
                optionsJogadores += `<option value="${j.id}" ${golSalvo?.jogador_id === j.id ? 'selected' : ''}>${j.nome}</option>`;
            });

            subpainelGolsBrasil = `
                <div class="bg-zinc-950 p-3 rounded-lg border border-zinc-800/80 mt-1 space-y-2">
                    <span class="text-[10px] uppercase font-bold text-yellow-500 tracking-wider block">⚽ Quem fará gol p/ o Brasil? (+3 pts por gol)</span>
                    <div class="flex gap-2">
                        <select id="gol-jogador-${partida.id}" ${mercadoFechado ? 'disabled' : ''} class="flex-1 h-8 bg-zinc-900 border border-zinc-700 rounded text-xs px-2 text-zinc-300">
                            ${optionsJogadores}
                        </select>
                        <input type="number" id="gol-qtd-${partida.id}" min="1" placeholder="Qtd" value="${golSalvo?.quantidade_gols || 1}" ${mercadoFechado ? 'disabled' : ''} 
                            class="w-14 h-8 bg-zinc-900 border border-zinc-700 text-center font-bold rounded text-xs text-white">
                    </div>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="flex justify-between items-center text-xs text-zinc-400">
                <span class="font-mono">${partida.fase} - ${dataJogo.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</span>
                <span class="px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${mercadoFechado ? 'text-red-400 bg-red-500/10' : 'text-emerald-400 bg-emerald-500/10'}">
                    ${mercadoFechado ? 'Fechado' : 'Aberto'}
                </span>
            </div>
            <div class="flex items-center justify-between gap-2">
                <div class="flex-1 font-bold text-zinc-100 text-sm">${partida.time_casa}</div>
                <div class="flex items-center gap-2">
                    <input type="number" id="gols-casa-${partida.id}" value="${palpite ? palpite.palpite_casa : ''}" ${mercadoFechado ? 'disabled' : ''} class="input-placar w-12 h-10 bg-zinc-950 border border-zinc-800 text-center font-bold rounded-lg text-lg text-white focus:outline-none focus:border-amber-500">
                    <span class="text-zinc-600 font-bold text-xs">X</span>
                    <input type="number" id="gols-fora-${partida.id}" value="${palpite ? palpite.palpite_fora : ''}" ${mercadoFechado ? 'disabled' : ''} class="input-placar w-12 h-10 bg-zinc-950 border border-zinc-800 text-center font-bold rounded-lg text-lg text-white focus:outline-none focus:border-amber-500">
                </div>
                <div class="flex-1 font-bold text-zinc-100 text-sm text-right">${partida.time_fora}</div>
            </div>
            ${subpainelGolsBrasil}
            <div class="flex items-center justify-between mt-1 pt-2 border-t border-zinc-800/60">
                <label class="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
                    <input type="checkbox" id="ficha-ouro-${partida.id}" ${palpite?.usa_ficha_ouro ? 'checked' : ''} ${mercadoFechado ? 'disabled' : ''} class="rounded bg-zinc-950 border-zinc-800 text-amber-500 focus:ring-0">
                    ✨ Ficha de Ouro (2x)
                </label>
                ${mercadoFechado ? `<span class="text-[10px] font-bold text-zinc-500">Pontos: ${palpite?.pontos_ganhos || 0}</span>` : ''}
            </div>
        `;
        container.appendChild(card);
    });
}

// SALVAMENTO GLOBAL REESTRUTURADO
async function salvarTodosOsPalpites() {
    if (!currentUserId) return;

    // 1. PROCESSAR E SALVAR PALPITES DE LONGO PRAZO
    const camp = document.getElementById('lp-campeao').value;
    const vice = document.getElementById('lp-vice').value;
    const artId = document.getElementById('lp-artilheiro').value;

    // Validação amigável: Se preencheu um, tem que preencher os outros
    if (camp || vice || artId) {
        if (!camp || !vice) {
            alert("Para salvar o Longo Prazo, preencha pelo menos o Campeão e o Vice-Campeão!");
            return;
        }

        const dadosLongoPrazo = {
            user_id: currentUserId,
            campeao: camp,
            vice: vice,
            // Correção crucial: se for string vazia, envia NULL puro para o banco
            artilheiro_id: artId !== "" ? parseInt(artId) : null
        };

        const { error: lpError } = await window.supabaseClient
            .from('palpites_longo_prazo')
            .upsert(dadosLongoPrazo, { onConflict: 'user_id' });

        if (lpError) {
            alert("Erro específico ao salvar Longo Prazo: " + lpError.message);
            return; // Trava o fluxo se houver erro de permissão/RLS
        }
    }

    // 2. SALVAR PALPITES DOS JOGOS (O restante do código abaixo permanece exatamente igual)
    const cards = document.querySelectorAll('.card-jogo');

    for (const card of cards) {
        const partidaId = card.dataset.partidaId;
        if (card.dataset.mercadoFechado === 'true') continue;

        const inputCasa = document.getElementById(`gols-casa-${partidaId}`).value;
        const inputFora = document.getElementById(`gols-fora-${partidaId}`).value;
        const usaFicha = document.getElementById(`ficha-ouro-${partidaId}`).checked;

        if (inputCasa !== "" && inputFora !== "") {
            // Salva o palpite principal e pega o registro de retorno para obter o ID gerado
            const { data: palpiteSalvo, error } = await window.supabaseClient
                .from('palpites')
                .upsert({
                    user_id: currentUserId,
                    partida_id: parseInt(partidaId),
                    palpite_casa: parseInt(inputCasa),
                    palpite_fora: parseInt(inputFora),
                    usa_ficha_ouro: usaFicha
                }, { onConflict: 'user_id,partida_id' }).select();

            // Se for jogo do Brasil e salvou o palpite principal com sucesso, salva o marcador de gol
            if (!error && card.dataset.isBrasil === 'true' && palpiteSalvo && palpiteSalvo.length > 0) {
                const jogadorId = document.getElementById(`gol-jogador-${partidaId}`).value;
                const qtdGols = document.getElementById(`gol-qtd-${partidaId}`).value;
                const palpiteId = palpiteSalvo[0].id;

                if (jogadorId) {
                    await window.supabaseClient.from('palpites_gols_brasil').upsert({
                        palpite_id: palpiteId,
                        jogador_id: parseInt(jogadorId),
                        quantidade_gols: parseInt(qtdGols) || 1
                    }, { onConflict: 'palpite_id,jogador_id' });
                } else {
                    // Se o usuário limpou a seleção de jogador, remove o palpite de gol existente
                    await window.supabaseClient.from('palpites_gols_brasil').delete().eq('palpite_id', palpiteId);
                }
            }
        }
    }

    alert("Todos os palpites (Longo Prazo e Jogos) foram salvos com sucesso!");
    await carregarLongoPrazo();
    await carregarJogos(currentUserId);
}

window.salvarTodosOsPalpites = salvarTodosOsPalpites;