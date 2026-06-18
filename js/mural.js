let currentUserId = null;
let ligaAtivaId = null;
let partidasGlobais = [];
let palpitesLiga = [];
let perfisLiga = [];
let faseAtiva = null;

const mapaBandeiras = { 
    "áfrica do sul": "za", "alemanha": "de", "arábia saudita": "sa", "argentina": "ar", 
    "argélia": "dz", "austrália": "au", "áustria": "at", "bélgica": "be", 
    "bósnia": "ba", "brasil": "br", "cabo verde": "cv", "canadá": "ca", 
    "catar": "qa", "colômbia": "co", "congo": "cd", "coreia do sul": "kr", 
    "costa do marfim": "ci", "croácia": "hr", "curaçao": "cw", "egito": "eg", 
    "equador": "ec", "escócia": "gb-sct", "espanha": "es", "estados unidos": "us", 
    "frança": "fr", "gana": "gh", "haiti": "ht", "holanda": "nl", 
    "inglaterra": "gb-eng", "irã": "ir", "iraque": "iq", "japão": "jp", 
    "jordânia": "jo", "marrocos": "ma", "méxico": "mx", "noruega": "no", 
    "nova zelândia": "nz", "panamá": "pa", "paraguai": "py", "portugal": "pt", 
    "república tcheca": "cz", "senegal": "sn", "suécia": "se", "suíça": "ch", 
    "tunísia": "tn", "turquia": "tr", "uruguai": "uy", "uzbequistão": "uz" 
};

function obterBandeira(nomeEquipa) {
    const codigo = mapaBandeiras[nomeEquipa.toLowerCase().trim()];
    if (codigo) return `<img src="https://flagcdn.com/w40/${codigo}.png" alt="${nomeEquipa}" class="w-4 h-3 rounded-sm object-cover shadow-sm border border-zinc-800/50">`;
    return `<div class="w-4 h-3 rounded-sm bg-zinc-800 flex items-center justify-center text-[6px]">🏳️</div>`;
}

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user }, error } = await window.supabaseClient.auth.getUser();
    if (error || !user) { window.location.href = 'index.html'; return; }
    currentUserId = user.id;

    await carregarLigasDoUsuario();
});

async function carregarLigasDoUsuario() {
    const { data: vinculos } = await window.supabaseClient.from('ligas_usuarios').select('grupo_id, grupos(nome)').eq('user_id', currentUserId);
    const seletor = document.getElementById('seletor-liga-ativa');
    if (!seletor) return;
    seletor.innerHTML = '';

    if (!vinculos || vinculos.length === 0) {
        seletor.innerHTML = '<option value="">Não pertence a nenhuma liga</option>';
        document.getElementById('container-jogos-mural').innerHTML = '<p class="text-center text-zinc-500">Entre numa liga para ver os palpites.</p>';
        return;
    }

    vinculos.forEach((v, index) => {
        const option = document.createElement('option');
        option.value = v.grupo_id;
        option.textContent = v.grupos.nome;
        if (index === 0) ligaAtivaId = v.grupo_id;
        seletor.appendChild(option);
    });

    await carregarDadosLiga();
}

async function mudarLigaAtiva(novoGrupoId) {
    if (!novoGrupoId) return;
    ligaAtivaId = parseInt(novoGrupoId);
    await carregarDadosLiga();
}

async function carregarDadosLiga() {
    const container = document.getElementById('container-jogos-mural');
    container.innerHTML = '<p class="text-sm text-zinc-500 p-6 text-center animate-pulse">Carregando palpites...</p>';

    const { data: partidas } = await window.supabaseClient.from('partidas').select('*').order('data_hora', { ascending: true });
    partidasGlobais = partidas || [];

    const { data: vinculosLiga } = await window.supabaseClient.from('ligas_usuarios').select('user_id').eq('grupo_id', ligaAtivaId);
    const idsNaLiga = vinculosLiga ? vinculosLiga.map(v => v.user_id) : [];

    if (idsNaLiga.length === 0) {
        container.innerHTML = '<p class="text-center text-zinc-500">A liga está vazia.</p>';
        return;
    }

    const { data: perfis } = await window.supabaseClient.from('profiles').select('id, username').in('id', idsNaLiga).order('username');
    const { data: palpites } = await window.supabaseClient.from('palpites').select('*').in('user_id', idsNaLiga);

    perfisLiga = perfis || [];
    palpitesLiga = palpites || [];

    const fasesIniciais = [...new Set(partidasGlobais.map(p => p.fase))];
    if (fasesIniciais.length > 0 && !fasesIniciais.includes(faseAtiva)) {
        faseAtiva = fasesIniciais[0];
    }

    renderizarAbas(fasesIniciais);
    renderizarMuralDaFase();
}

function renderizarAbas(fases) {
    const container = document.getElementById('abas-fases');
    if(!container) return;
    container.innerHTML = '';

    fases.forEach(fase => {
        const btn = document.createElement('button');
        const isActive = fase === faseAtiva;
        btn.className = `px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${isActive ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:bg-zinc-800'}`;
        btn.textContent = fase;
        btn.onclick = () => { faseAtiva = fase; renderizarAbas(fases); renderizarMuralDaFase(); };
        container.appendChild(btn);
    });
}

function renderizarMuralDaFase() {
    const container = document.getElementById('container-jogos-mural');
    container.innerHTML = '';

    const partidasDaFase = partidasGlobais.filter(p => p.fase === faseAtiva);
    
    const grupos = {};
    partidasDaFase.forEach(partida => {
        const agrupador = partida.grupo ? `GRUPO ${partida.grupo.replace('Grupo', '').trim()}` : null;
        const key = agrupador || 'Jogos';
        if (!grupos[key]) grupos[key] = [];
        grupos[key].push(partida);
    });

    Object.keys(grupos).forEach(nomeGrupo => {
        if (nomeGrupo !== 'Jogos') {
            const separador = document.createElement('div');
            separador.className = "mt-4 mb-1 border-b border-zinc-800/60 pb-2 flex items-center gap-3";
            separador.innerHTML = `<div class="h-1.5 w-1.5 rounded-full bg-zinc-600"></div><h3 class="text-xs font-black text-zinc-400 uppercase tracking-widest">${nomeGrupo}</h3>`;
            container.appendChild(separador);
        }

        grupos[nomeGrupo].forEach(partida => {
            const dataJogo = new Date(partida.data_hora);
            const mercadoFechado = (new Date() >= new Date(dataJogo.getTime() - 10 * 60 * 1000)) || (partida.status !== 'agendado');
            const dataStr = dataJogo.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');

            // Define o placar central do cabeçalho
            let placarCentro = `<span class="text-zinc-600 font-bold text-[10px] mx-1">vs</span>`;
            if (partida.gols_casa !== null && partida.gols_fora !== null) {
                placarCentro = `
                    <div class="flex items-center gap-1.5 mx-2">
                        <span class="bg-zinc-800 border border-zinc-700 text-white font-mono font-bold px-2 py-0.5 rounded text-xs">${partida.gols_casa}</span>
                        <span class="text-zinc-500 font-bold text-[10px]">X</span>
                        <span class="bg-zinc-800 border border-zinc-700 text-white font-mono font-bold px-2 py-0.5 rounded text-xs">${partida.gols_fora}</span>
                    </div>
                `;
            }

            let linhasTabela = '';
            perfisLiga.forEach(perfil => {
                const palpiteUser = palpitesLiga.find(p => p.user_id === perfil.id && p.partida_id === partida.id);
                const isMe = perfil.id === currentUserId;
                const trClass = isMe ? 'bg-amber-500/5' : '';
                const nameClass = isMe ? 'text-amber-500 font-bold' : 'text-zinc-300';
                
                let conteudoPalpite = '';
                
                if (!mercadoFechado) {
                    conteudoPalpite = `<span class="text-zinc-600 font-medium">🔒 Oculto</span>`;
                } else if (palpiteUser) {
                    // Se o jogo encerrou, mostra os pontos faturados por cada utilizador
                    const ptsHtml = partida.status === 'encerrado' 
                        ? `<span class="ml-2 text-[10px] font-bold ${palpiteUser.pontos_ganhos > 0 ? 'text-emerald-400' : 'text-zinc-600'}">(${palpiteUser.pontos_ganhos} pts)</span>` 
                        : '';

                    conteudoPalpite = `
                        <span class="font-mono font-bold text-white">${palpiteUser.palpite_casa} x ${palpiteUser.palpite_fora}</span>
                        ${palpiteUser.usa_ficha_ouro ? '<span class="ml-1 text-[10px] bg-amber-500/20 text-amber-500 px-1 rounded" title="Ficha de Ouro Ativa">✨</span>' : ''}
                        ${ptsHtml}
                    `;
                } else {
                    conteudoPalpite = `<span class="text-red-400/80 font-medium text-[10px] uppercase tracking-wider">❌ Não palpitou</span>`;
                }

                linhasTabela += `
                    <tr class="border-b border-zinc-800/50 last:border-0 ${trClass}">
                        <td class="p-3 text-xs truncate max-w-[150px] ${nameClass}">${perfil.username} ${isMe ? '(Você)' : ''}</td>
                        <td class="p-3 text-right text-xs">${conteudoPalpite}</td>
                    </tr>
                `;
            });

            const accordion = document.createElement('details');
            accordion.className = "group bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden transition-all";
            
            accordion.innerHTML = `
                <summary class="p-4 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-zinc-800/50 transition-colors select-none">
                    <div class="flex items-center gap-3">
                        <div class="flex flex-col items-center justify-center bg-zinc-950 rounded py-1 px-2 border border-zinc-800 w-12 shrink-0">
                            <span class="text-[9px] text-zinc-500 uppercase font-black">${mercadoFechado ? 'FECHADO' : 'ABERTO'}</span>
                        </div>
                        <div class="flex items-center gap-1">
                            ${obterBandeira(partida.time_casa)}
                            <span class="font-bold text-zinc-100 text-sm truncate ml-1">${partida.time_casa}</span>
                            
                            ${placarCentro}
                            
                            <span class="font-bold text-zinc-100 text-sm truncate mr-1">${partida.time_fora}</span>
                            ${obterBandeira(partida.time_fora)}
                        </div>
                    </div>
                    <div class="flex items-center justify-between md:justify-end w-full md:w-auto gap-4">
                        <span class="text-[10px] text-zinc-500 font-mono">${dataStr}</span>
                        <svg class="w-4 h-4 text-zinc-500 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                </summary>
                
                <div class="border-t border-zinc-800 bg-zinc-950/50 p-0">
                    <table class="w-full text-left border-collapse">
                        <tbody class="divide-y divide-zinc-800">
                            ${linhasTabela}
                        </tbody>
                    </table>
                </div>
            `;
            container.appendChild(accordion);
        });
    });
}

window.mudarLigaAtiva = mudarLigaAtiva;