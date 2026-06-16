let currentUserId = null;
let listaJogadores = [];
let partidasGlobais = [];
let palpitesGlobais = [];
let palpitesGolsGlobais = [];
let faseAtiva = null; // Guarda a aba de fase que o utilizador está a visualizar

// =========================================================================
// 1. DICIONÁRIO DE BANDEIRAS
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
    if (codigo) {
        return `<img src="https://flagcdn.com/w40/${codigo}.png" alt="${nomeEquipa}" class="w-5 h-3.5 rounded-sm object-cover shadow-sm border border-zinc-800/50">`;
    }
    return `<div class="w-5 h-3.5 rounded-sm bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[8px]" title="Bandeira indisponível">🏳️</div>`;
}

// =========================================================================
// 2. INICIALIZAÇÃO
// =========================================================================
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    if (!user) { window.location.href = 'index.html'; return; }
    currentUserId = user.id;
    
    const { data: jogadores } = await window.supabaseClient.from('jogadores').select('*');
    listaJogadores = jogadores || [];
    
    await carregarDados(user.id);
});

// =========================================================================
// 3. CARREGAMENTO CENTRAL DE DADOS E PAGINAÇÃO EM ABAS
// =========================================================================
async function carregarDados(userId) {
    // Carrega tudo de uma vez para a memória para evitar múltiplas chamadas à base de dados
    const { data: partidas } = await window.supabaseClient.from('partidas').select('*').order('data_hora', { ascending: true });
    const { data: palpitesGols } = await window.supabaseClient.from('palpites_gols_brasil').select('*, palpites!inner(user_id)').eq('palpites.user_id', userId);
    const { data: palpites } = await window.supabaseClient.from('palpites').select('*').eq('user_id', userId);

    partidasGlobais = partidas || [];
    palpitesGlobais = palpites || [];
    palpitesGolsGlobais = palpitesGols || [];

    // Extrai as fases únicas pela ordem cronológica das partidas
    const fasesIniciais = [...new Set(partidasGlobais.map(p => p.fase))];
    
    // Se a fase ativa ainda não existir, seleciona a primeira da lista
    if (fasesIniciais.length > 0 && !faseAtiva) {
        faseAtiva = fasesIniciais[0];
    }

    renderizarAbas(fasesIniciais);
    renderizarJogosDaFaseAtiva();
}

function renderizarAbas(fases) {
    const container = document.getElementById('abas-fases');
    if(!container) return;
    container.innerHTML = '';

    fases.forEach(fase => {
        const btn = document.createElement('button');
        const isActive = fase === faseAtiva;
        
        btn.className = `px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
            isActive 
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' 
                : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:bg-zinc-800'
        }`;
        
        btn.textContent = fase;
        btn.onclick = () => {
            faseAtiva = fase;
            renderizarAbas(fases);
            renderizarJogosDaFaseAtiva();
        };
        
        container.appendChild(btn);
    });
}

// =========================================================================
// 4. RENDERIZAÇÃO DOS CARTÕES DE JOGOS
// =========================================================================
function renderizarJogosDaFaseAtiva() {
    const container = document.getElementById('jogos-container');
    container.innerHTML = '';

    // Filtra as partidas globais apenas para a aba selecionada
    const partidasDaFase = partidasGlobais.filter(p => p.fase === faseAtiva);
    
    // Agrupa as partidas dentro dessa fase pelo "Grupo" (Ex: Grupo A)
    const grupos = {};
    partidasDaFase.forEach(partida => {
        // Formata o nome do grupo para ficar elegante (Ex: transforma "GrupoA" ou "Grupo A" em "GRUPO A")
        const agrupador = partida.grupo ? `GRUPO ${partida.grupo.replace('Grupo', '').trim()}` : null;
        const key = agrupador || 'Jogos';
        
        if (!grupos[key]) grupos[key] = [];
        grupos[key].push(partida);
    });

    Object.keys(grupos).forEach(nomeGrupo => {
        // Se houver um nome de grupo definido, cria o título separador visual
        if (nomeGrupo !== 'Jogos') {
            const separador = document.createElement('div');
            separador.className = "bg-zinc-950 border-b border-zinc-800 px-4 py-2.5 flex items-center gap-2 sticky top-0 z-10";
            separador.innerHTML = `
                <div class="h-1.5 w-1.5 rounded-full bg-zinc-600"></div><h3 class="text-[10px] font-black text-zinc-400 uppercase tracking-widest">${nomeGrupo}</h3>
            `;
            container.appendChild(separador);
        }

        // Renderiza cada partida compacta desse grupo
        grupos[nomeGrupo].forEach(partida => {
            const palpite = palpitesGlobais?.find(p => p.partida_id === partida.id);
            const dataJogo = new Date(partida.data_hora);
            const mercadoFechado = (new Date() >= new Date(dataJogo.getTime() - 10 * 60 * 1000)) || (partida.status !== 'agendado');
            
            const dataStr = dataJogo.toLocaleString('pt-BR', { 
                weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
            }).replace(',', ' às');

            const card = document.createElement('div');
            card.className = "card-jogo border-b border-zinc-800/50 p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 relative transition-colors hover:bg-zinc-800/40 bg-zinc-900 group";
            card.id = `card-palpite-${partida.id}`;
            card.dataset.partidaId = partida.id; 
            card.dataset.mercadoFechado = mercadoFechado; 
            card.dataset.isBrasil = partida.is_brasil;
            
            if (partida.is_brasil) card.classList.add('border-l-2', 'border-l-yellow-500');

            let subpainelGols = '';
            if (partida.is_brasil) {
                const golSalvo = palpitesGolsGlobais?.find(g => g.palpite_id === palpite?.id);
                let optionsJogadores = '<option value="">Nenhum (Zero Gol)</option>';
                
                listaJogadores.filter(j => j.selecao === 'Brasil').forEach(j => { 
                    optionsJogadores += `<option value="${j.id}" ${golSalvo?.jogador_id === j.id ? 'selected' : ''}>${j.nome}</option>`; 
                });
                
                subpainelGols = `
                    <div class="mt-2 flex justify-center w-full opacity-90 group-hover:opacity-100 transition-opacity">
                        <div class="flex items-center gap-1.5 bg-zinc-950 px-2 py-1 rounded border border-zinc-800 text-[10px]">
                            <span class="uppercase font-bold text-yellow-500">⭐ Artilheiro:</span>
                            <select id="palpite-artilheiro-${partida.id}" ${mercadoFechado ? 'disabled' : ''} class="bg-transparent text-zinc-300 font-semibold outline-none cursor-pointer text-center w-auto max-w-[120px] truncate appearance-none">${optionsJogadores}</select>
                        </div>
                    </div>`;
            }

            card.innerHTML = `
                <!-- Coluna 1: Data e Status -->
                <div class="flex items-center justify-between md:flex-col md:items-start md:w-20 shrink-0 gap-1">
                    <span class="font-mono text-[10px] text-zinc-500">${dataStr}</span>
                    <span class="px-1.5 py-0.5 rounded text-[8px] uppercase font-black tracking-wider ${mercadoFechado ? 'text-red-400 bg-red-500/10' : 'text-emerald-400 bg-emerald-500/10'}">${mercadoFechado ? 'Fechado' : 'Aberto'}</span>
                </div>
                
                <!-- Coluna 2: A Partida (Centro) -->
                <div class="flex-1 flex flex-col justify-center py-1">
                    <div class="flex items-center justify-center gap-2">
                        <div class="flex-1 flex items-center justify-end gap-2">
                            <span class="font-bold text-zinc-100 text-xs truncate md:text-sm text-right">${partida.time_casa}</span>
                            ${obterBandeira(partida.time_casa)}
                        </div>
                        
                        <div class="flex items-center gap-1 shrink-0">
                            <input type="number" id="gols-casa-${partida.id}" value="${palpite ? palpite.palpite_casa : ''}" ${mercadoFechado ? 'disabled' : ''} class="w-9 h-8 bg-zinc-950 border border-zinc-800 text-center font-bold rounded text-xs text-white focus:outline-none focus:border-amber-500">
                            <span class="text-zinc-600 font-bold text-[10px] mx-0.5">X</span>
                            <input type="number" id="gols-fora-${partida.id}" value="${palpite ? palpite.palpite_fora : ''}" ${mercadoFechado ? 'disabled' : ''} class="w-9 h-8 bg-zinc-950 border border-zinc-800 text-center font-bold rounded text-xs text-white focus:outline-none focus:border-amber-500">
                        </div>
                        
                        <div class="flex-1 flex items-center justify-start gap-2">
                            ${obterBandeira(partida.time_fora)}
                            <span class="font-bold text-zinc-100 text-xs truncate md:text-sm text-left">${partida.time_fora}</span>
                        </div>
                    </div>
                    ${subpainelGols}
                </div>
                
                <!-- Coluna 3: Ações e Pontos -->
                <div class="flex items-center justify-between md:flex-col md:items-end md:justify-center md:w-28 shrink-0 gap-2 border-t border-zinc-800/60 md:border-t-0 md:border-l md:pl-3 pt-2 md:pt-0 mt-1 md:mt-0">
                    <label class="flex items-center gap-1.5 text-[10px] text-zinc-400 cursor-pointer font-medium hover:text-white transition-colors">
                        <input type="checkbox" id="ficha-ouro-${partida.id}" ${palpite?.usa_ficha_ouro ? 'checked' : ''} ${mercadoFechado ? 'disabled' : ''} class="rounded bg-zinc-950 border-zinc-800 text-amber-500 focus:ring-0 w-3.5 h-3.5"> 
                        ✨ Usar ficha
                    </label>
                    ${mercadoFechado 
                        ? `<span class="text-[10px] font-bold text-zinc-500 bg-zinc-950 px-2 py-1 rounded border border-zinc-800">Pts: <span class="text-white">${palpite?.pontos_ganhos || 0}</span></span>` 
                        : `<button type="button" onclick="salvarPalpiteIndividual(${partida.id})" class="bg-amber-500 hover:bg-amber-600 text-black text-[10px] font-bold px-4 py-1.5 rounded transition-colors whitespace-nowrap shadow-md shadow-amber-500/10 w-full md:w-auto">Salvar</button>`}
                </div>`;
            
            container.appendChild(card);
        });
    });
}

// =========================================================================
// 5. MOTOR DE GRAVAÇÃO DE PALPITES
// =========================================================================
async function salvarPalpiteIndividual(partidaId) {
    if (!currentUserId) return;

    const card = document.getElementById(`card-palpite-${partidaId}`);
    if (!card || card.dataset.mercadoFechado === 'true') return;

    const btn = card.querySelector('button[onclick^="salvarPalpiteIndividual"]');
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '⏳...';
    btn.disabled = true;

    const inputCasa = document.getElementById(`gols-casa-${partidaId}`).value;
    const inputFora = document.getElementById(`gols-fora-${partidaId}`).value;
    const usaFicha = document.getElementById(`ficha-ouro-${partidaId}`).checked;

    // Bloqueia tentativas de guardar palpites em branco
    if (inputCasa === "" || inputFora === "") {
        alert("Preencha o placar das duas seleções antes de salvar.");
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
        return;
    }

    // 1. Grava o palpite de placar na base de dados
    const { data: res, error } = await window.supabaseClient.from('palpites')
        .upsert({ 
            user_id: currentUserId, 
            partida_id: parseInt(partidaId), 
            palpite_casa: parseInt(inputCasa), 
            palpite_fora: parseInt(inputFora), 
            usa_ficha_ouro: usaFicha 
        }, { onConflict: 'user_id,partida_id' })
        .select();
        
    if (error) { 
        alert(`Erro ao salvar: ${error.message}`); 
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
        return; 
    }
    
    // 2. Grava o artilheiro se for um jogo do Brasil
    if (card.dataset.isBrasil === 'true') {
        let pIdDb = (res && res.length > 0) ? res[0].id : null;
        if (!pIdDb) { 
            const { data: fb } = await window.supabaseClient.from('palpites')
                .select('id')
                .eq('user_id', currentUserId)
                .eq('partida_id', parseInt(partidaId))
                .maybeSingle(); 
            if (fb) pIdDb = fb.id; 
        }
        
        if (pIdDb) {
            const sel = document.getElementById(`palpite-artilheiro-${partidaId}`);
            await window.supabaseClient.from('palpites_gols_brasil').delete().eq('palpite_id', pIdDb);
            
            if (sel && sel.value !== "") {
                await window.supabaseClient.from('palpites_gols_brasil').insert({ 
                    palpite_id: pIdDb, 
                    jogador_id: parseInt(sel.value) 
                });
            }
        }
    }
    
    // Feedback visual elegante de sucesso
    btn.className = "bg-emerald-500 text-white text-[10px] font-bold px-3 py-1.5 rounded transition-colors whitespace-nowrap";
    btn.innerHTML = "✓ Salvo";
    
    // Repõe o botão e recarrega os dados em background para manter a memória atualizada
    setTimeout(async () => {
        btn.className = "bg-amber-500 hover:bg-amber-600 text-black text-[10px] font-bold px-3 py-1.5 rounded transition-colors whitespace-nowrap shadow-md shadow-amber-500/10";
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
        await carregarDados(currentUserId);
    }, 1500);
}

// Exposição da função para o botão HTML
window.salvarPalpiteIndividual = salvarPalpiteIndividual;
