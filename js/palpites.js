let currentUserId = null;
let listaJogadores = [];

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    if (!user) { window.location.href = 'index.html'; return; }
    currentUserId = user.id;

    const { data: jogadores } = await window.supabaseClient.from('jogadores').select('*');
    listaJogadores = jogadores || [];
    await carregarJogos(user.id);
});

async function carregarJogos(userId) {
    const { data: partidas } = await window.supabaseClient.from('partidas').select('*').order('data_hora', { ascending: true });
    const { data: palpites } = await window.supabaseClient.from('palpites').select('*').eq('user_id', userId);
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

        let subpainelGolsBrasil = '';
        if (partida.is_brasil) {
            const golSalvo = palpitesGols?.find(g => g.palpite_id === palpite?.id);
            let optionsJogadores = '<option value="">Nenhum (Zero Gols)</option>';
            listaJogadores.filter(j => j.selecao === 'Brasil').forEach(j => {
                optionsJogadores += `<option value="${j.id}" ${golSalvo?.jogador_id === j.id ? 'selected' : ''}>${j.nome}</option>`;
            });
            subpainelGolsBrasil = `
                <div class="bg-zinc-950 p-3 rounded-lg border border-zinc-800/80 mt-1 space-y-2">
                    <span class="text-[10px] uppercase font-bold text-yellow-500 tracking-wider block">⭐ Seu Artilheiro de Ouro (+3 pts/gol)</span>
                    <select id="palpite-artilheiro-${partida.id}" ${mercadoFechado ? 'disabled' : ''} class="w-full h-8 bg-zinc-900 border border-zinc-800 rounded text-xs px-2 text-zinc-300 focus:outline-none focus:border-yellow-500">${optionsJogadores}</select>
                </div>`;
        }

        card.innerHTML = `
            <div class="flex justify-between items-center text-xs text-zinc-400">
                <span class="font-mono">${partida.fase} - ${dataJogo.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</span>
                <span class="px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${mercadoFechado ? 'text-red-400 bg-red-500/10' : 'text-emerald-400 bg-emerald-500/10'}">${mercadoFechado ? 'Fechado' : 'Aberto'}</span>
            </div>
            <div class="flex items-center justify-between gap-2">
                <div class="flex-1 font-bold text-zinc-100 text-sm">${partida.time_casa}</div>
                <div class="flex items-center gap-2">
                    <input type="number" id="gols-casa-${partida.id}" value="${palpite ? palpite.palpite_casa : ''}" ${mercadoFechado ? 'disabled' : ''} class="w-12 h-10 bg-zinc-950 border border-zinc-800 text-center font-bold rounded-lg text-lg text-white focus:border-amber-500">
                    <span class="text-zinc-600 font-bold text-xs">X</span>
                    <input type="number" id="gols-fora-${partida.id}" value="${palpite ? palpite.palpite_fora : ''}" ${mercadoFechado ? 'disabled' : ''} class="w-12 h-10 bg-zinc-950 border border-zinc-800 text-center font-bold rounded-lg text-lg text-white focus:border-amber-500">
                </div>
                <div class="flex-1 font-bold text-zinc-100 text-sm text-right">${partida.time_fora}</div>
            </div>
            ${subpainelGolsBrasil}
            <div class="flex items-center justify-between mt-1 pt-2 border-t border-zinc-800/60">
                <label class="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
                    <input type="checkbox" id="ficha-ouro-${partida.id}" ${palpite?.usa_ficha_ouro ? 'checked' : ''} ${mercadoFechado ? 'disabled' : ''} class="rounded bg-zinc-950 border-zinc-800 text-amber-500 focus:ring-0">
                    ✨ Ficha de Ouro (2x)
                </label>
                ${mercadoFechado ? `<span class="text-[10px] font-bold text-zinc-500">Pontos Ganhos: ${palpite?.pontos_ganhos || 0}</span>` : ''}
            </div>
        `;
        container.appendChild(card);
    });
}

async function salvarTodosOsPalpites() {
    if (!currentUserId) return;
    const cards = document.querySelectorAll('.card-jogo');
    
    for (const card of cards) {
        const partidaId = card.dataset.partidaId;
        if (card.dataset.mercadoFechado === 'true') continue;

        const inputCasa = document.getElementById(`gols-casa-${partidaId}`).value;
        const inputFora = document.getElementById(`gols-fora-${partidaId}`).value;
        const usaFicha = document.getElementById(`ficha-ouro-${partidaId}`).checked;

        if (inputCasa !== "" && inputFora !== "") {
            const { data: resultData, error: errorPalpite } = await window.supabaseClient
                .from('palpites')
                .upsert({ user_id: currentUserId, partida_id: parseInt(partidaId), palpite_casa: parseInt(inputCasa), palpite_fora: parseInt(inputFora), usa_ficha_ouro: usaFicha }, { onConflict: 'user_id,partida_id' }).select();

            if (errorPalpite) { alert(`Erro: ${errorPalpite.message}`); continue; }

            if (card.dataset.isBrasil === 'true') {
                let palpiteId = (resultData && resultData.length > 0) ? resultData[0].id : (resultData?.id || null);

                if (!palpiteId) {
                    const { data: fallback } = await window.supabaseClient.from('palpites').select('id').eq('user_id', currentUserId).eq('partida_id', parseInt(partidaId)).maybeSingle();
                    if (fallback) palpiteId = fallback.id;
                }

                if (palpiteId) {
                    const selectArtilheiro = document.getElementById(`palpite-artilheiro-${partidaId}`);
                    await window.supabaseClient.from('palpites_gols_brasil').delete().eq('palpite_id', palpiteId);
                    
                    if (selectArtilheiro && selectArtilheiro.value !== "") {
                        // Inserção sem a coluna "quantidade" para não gerar erros
                        await window.supabaseClient.from('palpites_gols_brasil').insert({ palpite_id: palpiteId, jogador_id: parseInt(selectArtilheiro.value) });
                    }
                }
            }
        }
    }
    alert("Palpites processados com sucesso!");
    await carregarJogos(currentUserId);
}

window.salvarTodosOsPalpites = salvarTodosOsPalpites;