document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    if (!user) { window.location.href = 'index.html'; return; }

    await carregarDadosUsuario(user.id);
    await carregarClassificacaoGeral();
    await carregarJogosDashboard();

    // Sincronismo em Tempo Real
    window.supabaseClient
        .channel('dashboard-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
            carregarClassificacaoGeral();
            carregarDadosUsuario(user.id);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'partidas' }, () => {
            carregarJogosDashboard();
        })
        .subscribe();
});

async function carregarDadosUsuario(userId) {
    const { data } = await window.supabaseClient.from('profiles').select('*').eq('id', userId).single();
    if (data) {
        document.getElementById('user-points').textContent = data.pontos_totais || 0;
        document.getElementById('user-fichas').textContent = data.fichas_ouro_disponiveis || 0;
        document.getElementById('welcome-user').textContent = data.username;
    }
}

async function carregarClassificacaoGeral() {
    const { data } = await window.supabaseClient.from('profiles').select('username, pontos_totais').order('pontos_totais', { ascending: false });
    const tbody = document.getElementById('ranking-body');
    if (tbody && data) {
        tbody.innerHTML = '';
        data.forEach((player, index) => {
            const row = document.createElement('tr');
            row.className = "border-b border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 transition-colors";
            row.innerHTML = `
                <td class="px-4 py-3 text-center font-bold ${index < 3 ? 'text-amber-500' : 'text-zinc-400'}">${index + 1}º</td>
                <td class="px-4 py-3 text-zinc-200 font-medium">${player.username}</td>
                <td class="px-4 py-3 text-right font-bold text-emerald-400">${player.pontos_totais} pts</td>
            `;
            tbody.appendChild(row);
        });
    }
}

// CARREGA E SEPARA OS JOGOS POR FASE ESTILO GLOBOESPORTE
async function carregarJogosDashboard() {
    const { data: partidas } = await window.supabaseClient.from('partidas').select('*').order('data_hora', { ascending: true });
    if (!partidas) return;

    const containerGrupos = document.getElementById('container-jogos-grupos');
    const containerMataMata = document.getElementById('container-jogos-matamata');
    
    containerGrupos.innerHTML = '';
    containerMataMata.innerHTML = '';

    partidas.forEach(partida => {
        const dataJogo = new Date(partida.data_hora);
        const card = document.createElement('div');
        card.className = `bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex flex-col gap-2 relative overflow-hidden ${partida.is_brasil ? 'border-l-4 border-l-yellow-500' : ''}`;
        
        // Estrutura interna visual do placar oficial
        const placarCasa = partida.gols_casa !== null ? partida.gols_casa : '-';
        const placarFora = partida.gols_fora !== null ? partida.gols_fora : '-';
        
        let statusBadge = `<span class="text-zinc-500">📅 Agendado</span>`;
        if (partida.status === 'em_andamento') statusBadge = `<span class="text-yellow-400 animate-pulse">⏳ Em Andamento</span>`;
        if (partida.status === 'encerrado') statusBadge = `<span class="text-zinc-400 font-semibold">🛑 Encerrado</span>`;

        card.innerHTML = `
            <div class="flex justify-between items-center text-[10px] text-zinc-400 uppercase font-mono">
                <span>${partida.fase}</span>
                <span>${statusBadge}</span>
            </div>
            <div class="flex items-center justify-between mt-1">
                <div class="flex-1 font-bold text-zinc-200 text-sm">${partida.time_casa}</div>
                <div class="flex items-center gap-3 bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-800 font-black text-base text-white">
                    <span>${placarCasa}</span>
                    <span class="text-zinc-600 text-xs">x</span>
                    <span>${placarFora}</span>
                </div>
                <div class="flex-1 text-right font-bold text-zinc-200 text-sm">${partida.time_fora}</div>
            </div>
            <div class="text-[10px] text-zinc-500 text-center mt-1">
                ${dataJogo.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
            </div>
        `;

        // Divisão lógica de contêineres
        if (partida.fase.startsWith('Grupo')) {
            containerGrupos.appendChild(card);
        } else {
            containerMataMata.appendChild(card);
        }
    });
}

// CONTROLADOR INTERATIVO DE ABAS
function alternarAba(abaNome) {
    // Esconde todos os conteúdos
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    
    // Desativa todos os botões colocando o estilo padrão desmarcado
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('bg-zinc-800', 'text-white');
        btn.classList.add('text-zinc-400', 'hover:bg-zinc-800/50');
    });

    // Ativa o conteúdo clicado e altera o visual do botão selecionado
    document.getElementById(`conteudo-tab-${abaNome}`).classList.remove('hidden');
    
    const btnAtivo = document.getElementById(`btn-tab-${abaNome}`);
    btnAtivo.classList.remove('text-zinc-400', 'hover:bg-zinc-800/50');
    btnAtivo.classList.add('bg-zinc-800', 'text-white');
}

async function logout() {
    await window.supabaseClient.auth.signOut();
    window.location.href = 'index.html';
}

window.alternarAba = alternarAba;
window.logout = logout;