let currentUserId = null;
let ligaAtivaId = null; 
let modalCodigoAtual = '';
let modalNomeLigaAtual = '';

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user }, error } = await window.supabaseClient.auth.getUser();
    if (error || !user) { window.location.href = 'index.html'; return; }
    currentUserId = user.id;

    await carregarResumoPerfil(user.id);
    await carregarLigasDoUsuario(); 
    await carregarMedalhasPainel(user.id);
});

async function carregarResumoPerfil(userId) {
    const { data: perfil } = await window.supabaseClient.from('profiles').select('pontos_totais, fichas_ouro_disponiveis, username').eq('id', userId).maybeSingle();
    if (!perfil) return;
    
    document.getElementById('user-welcome-name').innerHTML = `${perfil.username || 'Participante'}`;
    document.getElementById('user-total-pontos').textContent = `${perfil.pontos_totais || 0} pts`;
    document.getElementById('user-total-fichas').textContent = perfil.fichas_ouro_disponiveis !== null ? perfil.fichas_ouro_disponiveis : 0;
}

async function carregarLigasDoUsuario() {
    const { data: vinculos } = await window.supabaseClient.from('ligas_usuarios').select('grupo_id, grupos(nome)').eq('user_id', currentUserId);
    const seletor = document.getElementById('seletor-liga-ativa');
    if (!seletor) return;
    seletor.innerHTML = '';

    if (!vinculos || vinculos.length === 0) {
        seletor.innerHTML = '<option value="">Não pertence a nenhuma liga</option>';
        return;
    }

    vinculos.forEach((v, index) => {
        const option = document.createElement('option');
        option.value = v.grupo_id;
        option.textContent = v.grupos.nome;
        if (index === 0) ligaAtivaId = v.grupo_id;
        seletor.appendChild(option);
    });

    const { data: partidasUnicas } = await window.supabaseClient.from('partidas').select('fase');
    const seletorFase = document.getElementById('filtro-fase-ranking');
    if (seletorFase && partidasUnicas) {
        const fasesExistentes = [...new Set(partidasUnicas.map(p => p.fase))];
        seletorFase.innerHTML = '<option value="Geral">Ranking Geral (Acumulado)</option>';
        fasesExistentes.forEach(f => {
            seletorFase.innerHTML += `<option value="${f}">${f}</option>`;
        });
    }

    await carregarRanking('Geral');
}

async function mudarLigaAtiva(novoGrupoId) {
    if (!novoGrupoId) return;
    ligaAtivaId = parseInt(novoGrupoId);
    const filtroFase = document.getElementById('filtro-fase-ranking');
    if(filtroFase) filtroFase.value = 'Geral';
    await carregarRanking('Geral');
}

async function entrarNovaLiga() {
    const input = document.getElementById('novo-codigo-liga');
    const codigo = input.value.toUpperCase().trim();
    if (!codigo) return;

    const { data: grupo } = await window.supabaseClient.from('grupos').select('id, nome').eq('codigo_convite', codigo).maybeSingle();
    if (!grupo) { alert("Código inválido ou liga não encontrada."); return; }

    const { error } = await window.supabaseClient.from('ligas_usuarios').insert({ user_id: currentUserId, grupo_id: grupo.id });
    if (error) { alert("Já pertence a esta liga ou ocorreu um erro."); } 
    else { alert(`Bem-vindo(a) à ${grupo.nome}!`); input.value = ''; await carregarLigasDoUsuario(); }
}

async function criarNovaLiga() {
    const nomeLiga = prompt("Qual será o nome da sua nova Liga Privada?");
    if (!nomeLiga || nomeLiga.trim() === "") return;
    const codigoConvite = Math.random().toString(36).substring(2, 8).toUpperCase();

    const { data: novaLiga, error: errLiga } = await window.supabaseClient.from('grupos').insert([{ nome: nomeLiga.trim(), codigo_convite: codigoConvite }]).select().single();
    if (errLiga) { alert("Ocorreu um erro ao criar a liga."); return; }

    const { error: errVinculo } = await window.supabaseClient.from('ligas_usuarios').insert([{ user_id: currentUserId, grupo_id: novaLiga.id }]);
    if (errVinculo) { alert("Ocorreu um erro ao vincular a liga."); } 
    else {
        abrirModalLiga(nomeLiga.trim(), codigoConvite);
        await carregarLigasDoUsuario();
        const seletor = document.getElementById('seletor-liga-ativa');
        if (seletor) { seletor.value = novaLiga.id; mudarLigaAtiva(novaLiga.id); }
    }
}

function abrirModalLiga(nome, codigo) {
    modalCodigoAtual = codigo; modalNomeLigaAtual = nome;
    document.getElementById('modal-liga-nome').textContent = nome;
    document.getElementById('modal-liga-codigo').textContent = codigo;
    const modal = document.getElementById('modal-nova-liga');
    modal.classList.remove('hidden'); modal.classList.add('flex');
}

function fecharModalLiga() {
    const modal = document.getElementById('modal-nova-liga');
    modal.classList.add('hidden'); modal.classList.remove('flex');
}

function copiarCodigoLiga() {
    navigator.clipboard.writeText(modalCodigoAtual).then(() => {
        const btnIcon = document.querySelector('#modal-liga-codigo + button');
        const htmlOriginal = btnIcon.innerHTML;
        btnIcon.innerHTML = `<svg class="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
        setTimeout(() => { btnIcon.innerHTML = htmlOriginal; }, 2000);
    });
}

function compartilharWhatsApp() {
    const texto = `E aí! Criei a liga *${modalNomeLigaAtual}* no nosso bolão da Copa.\nSe cadastre/Faça login e use o código de convite: *${modalCodigoAtual}* para entrar na disputa!\n⚽🏆\nhttps://victorstdev.github.io/bolao-copa/`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`, '_blank');
}

async function carregarRanking(faseFiltro = 'Geral') {
    const container = document.getElementById('ranking-table-body');
    if (!container || !ligaAtivaId) return;
    container.innerHTML = `<tr><td colspan="3" class="p-4 text-xs text-zinc-500 text-center animate-pulse">Calculando pontuações...</td></tr>`;

    const { data: vinculos } = await window.supabaseClient.from('ligas_usuarios').select('user_id').eq('grupo_id', ligaAtivaId);
    if (!vinculos || vinculos.length === 0) { container.innerHTML = `<tr><td colspan="3" class="p-4 text-xs text-zinc-500 text-center">Nenhum participante.</td></tr>`; return; }
    
    const idsNaLiga = vinculos.map(v => v.user_id);
    const { data: profiles } = await window.supabaseClient.from('profiles').select('id, username, pontos_totais').in('id', idsNaLiga);

    let rankingData = [];
    if (faseFiltro === 'Geral') {
        rankingData = profiles.map(p => ({ id: p.id, username: p.username, pontos: p.pontos_totais || 0 }));
    } else {
        const { data: partidas } = await window.supabaseClient.from('partidas').select('id').eq('fase', faseFiltro).eq('status', 'encerrado');
        const idsPartidas = (partidas || []).map(p => p.id);
        let palpites = [];
        if (idsPartidas.length > 0) {
            const { data: p } = await window.supabaseClient.from('palpites').select('user_id, pontos_ganhos').in('partida_id', idsPartidas).in('user_id', idsNaLiga);
            palpites = p || [];
        }
        rankingData = profiles.map(p => {
            const pts = palpites.filter(palp => palp.user_id === p.id).reduce((acc, curr) => acc + (curr.pontos_ganhos || 0), 0);
            return { id: p.id, username: p.username, pontos: pts };
        });
    }

    rankingData.sort((a, b) => b.pontos - a.pontos);
    container.innerHTML = '';
    rankingData.forEach((u, i) => {
        const isMe = u.id === currentUserId;
        const pos = i + 1;
        let icon = `<span class="text-zinc-500 font-mono text-xs">${pos}º</span>`;
        if (pos === 1) icon = '🥇'; else if (pos === 2) icon = '🥈'; else if (pos === 3) icon = '🥉';

        container.innerHTML += `
            <tr class="border-b border-zinc-800/50 text-sm hover:bg-zinc-800/30 transition-colors ${isMe ? 'bg-amber-500/5 font-semibold text-amber-400' : 'text-zinc-300'}">
                <td class="p-4 w-12 text-center select-none">${icon}</td>
                <td class="p-4 truncate max-w-[180px]">${u.username || 'Anónimo'} ${isMe ? '<span class="text-[10px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded ml-1 font-bold">VOCÊ</span>' : ''}</td>
                <td class="p-4 text-right font-mono font-bold">${u.pontos}</td>
            </tr>`;
    });
}

async function carregarMedalhasPainel(userId) {
    const container = document.getElementById('medalhas-container');
    if (!container) return;
    const { data: todasMedalhas } = await window.supabaseClient.from('badges').select('*');
    const { data: medalhasDoUsuario } = await window.supabaseClient.from('badges_usuario').select('badge_id').eq('user_id', userId);
    if (!todasMedalhas) return;
    
    const contagemMedalhas = {};
    if (medalhasDoUsuario) { medalhasDoUsuario.forEach(r => contagemMedalhas[r.badge_id] = (contagemMedalhas[r.badge_id] || 0) + 1); }
    
    container.innerHTML = '';
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

window.carregarRanking = carregarRanking; window.mudarLigaAtiva = mudarLigaAtiva;
window.entrarNovaLiga = entrarNovaLiga; window.criarNovaLiga = criarNovaLiga;
window.fecharModalLiga = fecharModalLiga; window.copiarCodigoLiga = copiarCodigoLiga;
window.compartilharWhatsApp = compartilharWhatsApp;