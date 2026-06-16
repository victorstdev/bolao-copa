let listaJogadoresGlobal = [];

// =========================================================================
// DICIONÁRIO DE BANDEIRAS
// =========================================================================
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
    if (codigo) return `<img src="https://flagcdn.com/w40/${codigo}.png" alt="${nomeEquipa}" class="w-5 h-3.5 rounded-sm object-cover shadow-sm border border-zinc-800/50">`;
    return `<div class="w-5 h-3.5 rounded-sm bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[8px]">🏳️</div>`;
}

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

    const ordemFases = [];
    const partidasPorFase = {};

    partidas.forEach(partida => {
        const agrupador = (partida.fase.includes('Fase de Grupos') && partida.grupo) 
            ? `GRUPO ${partida.grupo.replace('Grupo', '').trim()}` 
            : partida.fase;
            
        if (!ordemFases.includes(agrupador)) {
            ordemFases.push(agrupador);
            partidasPorFase[agrupador] = [];
        }
        partidasPorFase[agrupador].push(partida);
    });

    ordemFases.forEach(fase => {
        // Cabeçalho da Seção/Grupo
        const separador = document.createElement('div');
        separador.className = "bg-zinc-950 border-b border-zinc-800 px-4 py-2.5 flex items-center gap-2 sticky top-0 z-10";
        separador.innerHTML = `<div class="h-1.5 w-1.5 rounded-full bg-red-500"></div><h3 class="text-[10px] font-black text-zinc-400 uppercase tracking-widest">${fase}</h3>`;
        container.appendChild(separador);

        // Renderiza as Linhas
        partidasPorFase[fase].forEach(partida => {
            const dataJogo = new Date(partida.data_hora);
            const dataStr = dataJogo.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');

            const card = document.createElement('div');
            card.className = "card-admin-jogo border-b border-zinc-800/50 p-3 flex flex-col gap-2 transition-colors hover:bg-zinc-800/40 bg-zinc-900";
            card.id = `card-partida-${partida.id}`;
            card.dataset.partidaId = partida.id; 
            card.dataset.isBrasil = partida.is_brasil;

            if (partida.is_brasil) card.classList.add('border-l-2', 'border-l-yellow-500');

            // Painel Compacto de Gols Reais
            let painelGolsReais = '';
            if (partida.is_brasil) {
                const gols = golsReais?.filter(g => g.partida_id === partida.id) || [];
                painelGolsReais = `
                <div class="mt-1 bg-zinc-950/50 rounded border border-zinc-800/50 p-2 flex flex-col gap-1.5">
                    <div class="flex justify-between items-center">
                        <span class="text-[9px] font-bold text-red-400 uppercase tracking-wider">⚽ Gols Oficiais do Brasil</span>
                        <button type="button" onclick="adicionarGolRealAdmin(${partida.id})" class="text-[9px] bg-zinc-800 hover:bg-zinc-700 px-2 py-0.5 rounded text-white font-semibold transition-colors">+ Gol</button>
                    </div>
                    <div id="admin-lista-gols-${partida.id}" class="flex flex-col gap-1"></div>
                </div>`;
                setTimeout(() => { gols.forEach(g => adicionarGolRealAdmin(partida.id, g.jogador_id)); }, 0);
            }

            card.innerHTML = `
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 relative">
                    <!-- Coluna 1: Data -->
                    <div class="flex items-center justify-between md:flex-col md:items-start md:w-20 shrink-0 gap-1">
                        <span class="font-mono text-[10px] text-zinc-500">${dataStr}</span>
                    </div>

                    <!-- Coluna 2: Times e Placar -->
                    <div class="flex-1 flex flex-col justify-center">
                        <div class="flex items-center justify-center gap-2">
                            <div class="flex-1 flex items-center justify-end gap-2">
                                <span class="font-bold text-zinc-100 text-xs truncate md:text-sm text-right">${partida.time_casa}</span>
                                ${obterBandeira(partida.time_casa)}
                            </div>

                            <div class="flex items-center gap-1 shrink-0">
                                <input type="number" id="admin-gols-casa-${partida.id}" value="${partida.gols_casa !== null ? partida.gols_casa : ''}" class="w-10 h-8 bg-zinc-950 border border-zinc-800 text-center font-bold rounded text-xs text-white focus:outline-none focus:border-red-500">
                                <span class="text-zinc-600 font-bold text-[10px] mx-0.5">X</span>
                                <input type="number" id="admin-gols-fora-${partida.id}" value="${partida.gols_fora !== null ? partida.gols_fora : ''}" class="w-10 h-8 bg-zinc-950 border border-zinc-800 text-center font-bold rounded text-xs text-white focus:outline-none focus:border-red-500">
                            </div>

                            <div class="flex-1 flex items-center justify-start gap-2">
                                ${obterBandeira(partida.time_fora)}
                                <span class="font-bold text-zinc-100 text-xs truncate md:text-sm text-left">${partida.time_fora}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Coluna 3: Status e Salvar -->
                    <div class="flex items-center justify-between md:justify-end md:w-48 shrink-0 gap-2 border-t border-zinc-800/60 md:border-t-0 md:border-l md:pl-3 pt-2 md:pt-0 mt-1 md:mt-0">
                        <select id="admin-status-${partida.id}" class="w-full md:w-28 h-8 bg-zinc-950 border border-zinc-800 rounded text-[10px] font-semibold px-2 text-zinc-300 focus:outline-none focus:border-red-500 cursor-pointer">
                            <option value="agendado" ${partida.status === 'agendado' ? 'selected' : ''}>📅 Agendado</option>
                            <option value="em_andamento" ${partida.status === 'em_andamento' ? 'selected' : ''}>⏳ Andamento</option>
                            <option value="encerrado" ${partida.status === 'encerrado' ? 'selected' : ''}>🛑 Fechado</option>
                        </select>
                        <button type="button" onclick="salvarPartidaIndividual(${partida.id})" class="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white text-[10px] font-bold h-8 px-3 rounded transition-colors whitespace-nowrap">
                            Salvar
                        </button>
                    </div>
                </div>
                ${painelGolsReais}`;
                
            container.appendChild(card);
        });
    });
}

function adicionarGolRealAdmin(partidaId, jogadorIdSel = null) {
    const container = document.getElementById(`admin-lista-gols-${partidaId}`);
    if (!container) return;
    
    const wrapper = document.createElement('div'); 
    wrapper.className = "flex gap-2 items-center row-gol-real";
    
    let options = '<option value="">Selecione o Autor</option>';
    listaJogadoresGlobal.filter(j => j.selecao === 'Brasil').forEach(j => { 
        options += `<option value="${j.id}" ${jogadorIdSel === j.id ? 'selected' : ''}>${j.nome}</option>`; 
    });
    
    wrapper.innerHTML = `
        <select class="select-gol-real flex-1 h-7 bg-zinc-900 border border-zinc-800 rounded text-[10px] px-2 text-zinc-300 focus:outline-none focus:border-red-500">${options}</select>
        <button type="button" onclick="this.parentElement.remove()" class="text-zinc-500 hover:text-red-400 text-[10px] px-2 cursor-pointer transition-colors">✕</button>
    `;
    container.appendChild(wrapper);
}

async function salvarPartidaIndividual(partidaId) {
    const card = document.getElementById(`card-partida-${partidaId}`);
    const btn = card.querySelector('button[onclick^="salvarPartidaIndividual"]');
    
    const originalText = btn.textContent;
    btn.textContent = "⏳ ...";
    btn.disabled = true;

    const gC = document.getElementById(`admin-gols-casa-${partidaId}`).value;
    const gF = document.getElementById(`admin-gols-fora-${partidaId}`).value;
    const status = document.getElementById(`admin-status-${partidaId}`).value;
    
    const dataUpt = { status: status };
    if (gC !== "" && gF !== "") { dataUpt.gols_casa = parseInt(gC); dataUpt.gols_fora = parseInt(gF); }

    // 1. Atualiza a partida individualmente no Supabase
    const { error: err } = await window.supabaseClient.from('partidas').update(dataUpt).eq('id', partidaId);
    
    if (err) {
        alert(`Erro ao salvar: ${err.message}`);
        btn.textContent = originalText;
        btn.disabled = false;
        return;
    }

    // 2. Se for partida do Brasil, gerencia os golos reais
    if (card.dataset.isBrasil === 'true') {
        await window.supabaseClient.from('gols_partida').delete().eq('partida_id', partidaId);
        const dadosGols = [];
        document.getElementById(`admin-lista-gols-${partidaId}`).querySelectorAll('.select-gol-real').forEach(sel => {
            if (sel.value) dadosGols.push({ partida_id: partidaId, jogador_id: parseInt(sel.value), quantidade: 1 });
        });
        if (dadosGols.length > 0) await window.supabaseClient.from('gols_partida').insert(dadosGols);
    }

    // Feedback visual rápido de sucesso na linha
    btn.className = "bg-emerald-600 text-white border border-emerald-500 text-[10px] font-bold h-8 px-3 rounded transition-colors whitespace-nowrap";
    btn.textContent = "✓ Salvo";
    
    setTimeout(async () => {
        await carregarPartidasAdmin();
    }, 1000);
}

document.getElementById('form-cadastro-partida')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    let valorGrupo = document.getElementById('new-grupo').value.trim();
    if (valorGrupo === "") valorGrupo = null;

    const { error } = await window.supabaseClient.from('partidas').insert([{
        time_casa: document.getElementById('new-casa').value,
        time_fora: document.getElementById('new-fora').value,
        fase: document.getElementById('new-fase').value,
        grupo: valorGrupo,
        data_hora: new Date(document.getElementById('new-data').value).toISOString(),
        is_brasil: document.getElementById('new-is-brasil').checked
    }]);
    if (error) alert("Erro: " + error.message);
    else { alert("Partida cadastrada!"); document.getElementById('form-cadastro-partida').reset(); await carregarPartidasAdmin(); }
});

window.adicionarGolRealAdmin = adicionarGolRealAdmin;
window.salvarPartidaIndividual = salvarPartidaIndividual;