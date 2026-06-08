let currentUserId = null;
let currentGrupoId = null;

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Checando autenticação no Supabase...");
    const { data: { user }, error } = await window.supabaseClient.auth.getUser();
    
    if (error || !user) { 
        console.error("Usuário NÃO está logado ou token expirou.", error);
        window.location.href = 'index.html'; 
        return; 
    }

    currentUserId = user.id;
    // Dispara a carga de dados
    await carregarResumoPerfil(user.id);
    await carregarRanking('Geral'); // <-- Atualizado aqui
    await carregarMedalhasPainel(user.id);
});

async function carregarResumoPerfil(userId) {
    // Fazemos um join simples no Supabase para trazer o nome da liga
    const { data: perfil, error } = await window.supabaseClient
        .from('profiles')
        .select('pontos_totais, fichas_ouro_disponiveis, username, grupo_id, grupos(nome)')
        .eq('id', userId)
        .maybeSingle();

    if (error || !perfil) return;

    currentGrupoId = perfil.grupo_id; // Guarda o ID do grupo na memória

    const elNome = document.getElementById('user-welcome-name');
    const elPontos = document.getElementById('user-total-pontos');
    const elFichas = document.getElementById('user-total-fichas');

    // DICA: Atualiza o HTML para mostrar em que liga a pessoa está (ex: "E aí, João! (Liga do Trabalho)")
    if (elNome) {
        const nomeLiga = perfil.grupos ? perfil.grupos.nome : 'Sem Liga';
        elNome.innerHTML = `${perfil.username} <span class="text-xs text-zinc-500 font-normal">| ${nomeLiga}</span>`;
    }
    
    if (elPontos) elPontos.textContent = `${perfil.pontos_totais || 0} pts`;
    if (elFichas) elFichas.textContent = perfil.fichas_ouro_disponiveis !== null ? perfil.fichas_ouro_disponiveis : 0;
}

// =========================================================================
// 2. RENDERIZA O RANKING (GERAL OU POR FASE ESPECÍFICA)
// =========================================================================
async function carregarRanking(faseFiltro = 'Geral') {
    const container = document.getElementById('ranking-table-body');
    if (!container) return;

    container.innerHTML = `<tr><td colspan="3" class="p-4 text-xs text-zinc-500 text-center animate-pulse">Calculando pontuações...</td></tr>`;

    // 1. Busca a base de todos os usuários do grupo
    const { data: profiles, error: errProf } = await window.supabaseClient
        .from('profiles')
        .select('id, username, pontos_totais')
        .eq('grupo_id', currentGrupoId); // <-- O FILTRO DE ISOLAMENTO

    if (errProf || !profiles) {
        container.innerHTML = `<tr><td colspan="3" class="p-4 text-xs text-red-400 text-center">Erro ao gerar tabela classificatória.</td></tr>`;
        return;
    }

    let rankingData = [];

    // 2. Lógica de Separação: Geral vs Fase Específica
    if (faseFiltro === 'Geral') {
        // Se for geral, pega os pontos totais consolidados na tabela
        rankingData = profiles.map(p => ({
            id: p.id,
            username: p.username,
            pontos: p.pontos_totais || 0
        }));
    } else {
        // Se for fase específica, vamos calcular em tempo real!
        // A. Busca quais jogos pertencem a essa fase e já estão encerrados
        const { data: partidasDaFase } = await window.supabaseClient
            .from('partidas')
            .select('id')
            .eq('fase', faseFiltro)
            .eq('status', 'encerrado');

        const idsPartidas = (partidasDaFase || []).map(p => p.id);

        let palpitesDaFase = [];
        
        // B. Se houver jogos encerrados nessa fase, busca os palpites referentes a eles
        if (idsPartidas.length > 0) {
            const { data: palpites } = await window.supabaseClient
                .from('palpites')
                .select('user_id, pontos_ganhos')
                .in('partida_id', idsPartidas);
            
            palpitesDaFase = palpites || [];
        }

        // C. Soma os pontos exclusivamente desses palpites para cada usuário
        rankingData = profiles.map(p => {
            const palpitesDoUser = palpitesDaFase.filter(palp => palp.user_id === p.id);
            const pontosNaFase = palpitesDoUser.reduce((acc, curr) => acc + (curr.pontos_ganhos || 0), 0);
            
            return {
                id: p.id,
                username: p.username,
                pontos: pontosNaFase
            };
        });
    }

    // 3. Ordena o array de usuários do maior para o menor pontuador
    rankingData.sort((a, b) => b.pontos - a.pontos);

    // 4. Renderiza a tabela HTML
    container.innerHTML = '';

    rankingData.forEach((usuario, index) => {
        const posicao = index + 1;
        const isMe = usuario.id === currentUserId;

        let medalhaPosicao = `<span class="text-zinc-500 font-mono text-xs">${posicao}º</span>`;
        if (posicao === 1) medalhaPosicao = '🥇';
        else if (posicao === 2) medalhaPosicao = '🥈';
        else if (posicao === 3) medalhaPosicao = '🥉';

        const linha = document.createElement('tr');
        linha.className = `border-b border-zinc-800/50 text-sm transition-colors hover:bg-zinc-800/30 ${
            isMe ? 'bg-amber-500/5 font-semibold text-amber-400' : 'text-zinc-300'
        }`;

        linha.innerHTML = `
            <td class="p-4 w-12 text-center select-none">${medalhaPosicao}</td>
            <td class="p-4 truncate max-w-[180px]">
                ${usuario.username || 'Anônimo'} ${isMe ? '<span class="text-[10px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded font-bold ml-1">VOCÊ</span>' : ''}
            </td>
            <td class="p-4 text-right font-mono font-bold">${usuario.pontos}</td>
        `;

        container.appendChild(linha);
    });
}

async function carregarMedalhasPainel(userId) {
    const container = document.getElementById('medalhas-container');
    if (!container) return;

    const { data: todasMedalhas } = await window.supabaseClient.from('badges').select('*');
    const { data: medalhasDoUsuario } = await window.supabaseClient.from('badges_usuario').select('badge_id').eq('user_id', userId);

    if (!todasMedalhas) return;
    container.innerHTML = '';

    const contagemMedalhas = {};
    if (medalhasDoUsuario) {
        medalhasDoUsuario.forEach(reg => { contagemMedalhas[reg.badge_id] = (contagemMedalhas[reg.badge_id] || 0) + 1; });
    }

    todasMedalhas.forEach(medalha => {
        const vezesAdquirida = contagemMedalhas[medalha.id] || 0;
        const jaPossui = vezesAdquirida > 0;

        const cardMedalha = document.createElement('div');
        cardMedalha.className = `flex flex-col items-center text-center p-4 bg-zinc-950 rounded-xl border border-zinc-800/60 relative group transition-all duration-300 ${jaPossui ? 'border-amber-500/20 shadow-md shadow-amber-500/5' : 'grayscale opacity-30 hover:opacity-50'}`;
        const badgeContador = jaPossui ? `<span class="absolute -top-1.5 -right-1.5 bg-amber-500 text-black text-[10px] font-black px-1.5 py-0.5 rounded-md min-w-5 h-5 flex items-center justify-center border border-zinc-950 shadow animate-pulse">${vezesAdquirida}x</span>` : '';

        cardMedalha.innerHTML = `
            ${badgeContador}
            <div class="text-2xl mb-2 select-none">${medalha.icone || '🏅'}</div>
            <div class="text-xs font-bold tracking-wide ${jaPossui ? 'text-amber-400' : 'text-zinc-500'}">${medalha.nome}</div>
            <div class="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-300 rounded p-2 w-44 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 text-center shadow-2xl leading-relaxed">${medalha.descricao}</div>
        `;
        container.appendChild(cardMedalha);
    });
}

window.carregarRanking = carregarRanking;