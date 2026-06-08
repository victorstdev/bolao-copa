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
    "catar": "qa", "colômbia": "co", "congo": "cg", "coreia do sul": "kr", 
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
    const { data: palpites } = await window.supabaseClient.from('palpites').select('*').eq('user_id', userId);
    const { data: palpitesGols } = await window.supabaseClient.from('palpites_gols_brasil').select('*, palpites!inner(user_id)').eq('palpites.user_id', userId);

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
            separador.className = "col-span-full mt-4 mb-1 border-b border-zinc-800/60 pb-2 flex items-center gap-3";
            separador.innerHTML = `
                <div class="h-1.5 w-1.5 rounded-full bg-zinc-600"></div>
                <h3 class="text-xs font-black text-zinc-400 uppercase tracking-widest">${nomeGrupo}</h3>
            `;
            container.appendChild(separador);
        }

        // Renderiza cada partida compacta desse grupo
        grupos[nomeGrupo].forEach(partida => {
            const palpite = palpitesGlobais?.find(p => p.partida_id === partida.id);
            const dataJogo = new Date(partida.data_hora);
            const mercadoFechado = (new Date() >= new Date(dataJogo.getTime() - 10 * 60 * 1000)) || (partida.status !== 'agendado');
            
            const dataStr = dataJogo.toLocaleString('pt-PT', { 
                weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
            }).replace(',', ' às');

            const card = document.createElement('div');
            card.className = "card-jogo bg-zinc-900 rounded-xl p-3 border border-zinc-800 flex flex-col gap-3 relative overflow-hidden transition-colors hover:bg-zinc-800/40";
            card.dataset.partidaId = partida.id; 
            card.dataset.mercadoFechado = mercadoFechado; 
            card.dataset.isBrasil = partida.is_brasil;
            
            if (partida.is_brasil) card.classList.add('border-l-4', 'border-l-yellow-500');

            let subpainelGols = '';
            if (partida.is_brasil) {
                const golSalvo = palpitesGolsGlobais?.find(g => g.palpite_id === palpite?.id);
                let optionsJogadores = '<option value="">Nenhum (Zero Gol)</option>';
                
                listaJogadores.filter(j => j.selecao === 'Brasil').forEach(j => { 
                    optionsJogadores += `<option value="${j.id}" ${golSalvo?.jogador_id === j.id ? 'selected' : ''}>${j.nome}</option>`; 
                });
                
                subpainelGols = `
                    <div class="bg-zinc-950 p-2 rounded border border-zinc-800/80 space-y-1 mt-[-4px]">
                        <span class="text-[9px] uppercase font-bold text-yellow-500 block">⭐ Artilheiro de Ouro</span>
                        <select id="palpite-artilheiro-${partida.id}" ${mercadoFechado ? 'disabled' : ''} class="w-full h-7 bg-zinc-900 border border-zinc-800 rounded text-[10px] px-2 text-zinc-300 focus:outline-none focus:border-yellow-500">${optionsJogadores}</select>
                    </div>`;
            }

            card.innerHTML = `
                <div class="flex justify-between items-center text-[10px] text-zinc-500">
                    <span class="font-mono uppercase">${dataStr}</span>
                    <span class="px-1.5 py-0.5 rounded font-bold ${mercadoFechado ? 'text-red-400 bg-red-500/10' : 'text-emerald-400 bg-emerald-500/10'}">${mercadoFechado ? 'Fechado' : 'Aberto'}</span>
                </div>
                
                <div class="flex items-center justify-between gap-2">
                    <div class="flex-1 flex items-center gap-1.5 overflow-hidden">
                        ${obterBandeira(partida.time_casa)}
                        <span class="font-bold text-zinc-100 text-xs truncate">${partida.time_casa}</span>
                    </div>
                    
                    <div class="flex items-center gap-1.5 shrink-0">
                        <input type="number" id="gols-casa-${partida.id}" value="${palpite ? palpite.palpite_casa : ''}" ${mercadoFechado ? 'disabled' : ''} class="w-10 h-8 bg-zinc-950 border border-zinc-800 text-center font-bold rounded text-sm text-white focus:border-amber-500">
                        <span class="text-zinc-600 font-bold text-[10px]">X</span>
                        <input type="number" id="gols-fora-${partida.id}" value="${palpite ? palpite.palpite_fora : ''}" ${mercadoFechado ? 'disabled' : ''} class="w-10 h-8 bg-zinc-950 border border-zinc-800 text-center font-bold rounded text-sm text-white focus:border-amber-500">
                    </div>
                    
                    <div class="flex-1 flex items-center justify-end gap-1.5 text-right overflow-hidden">
                        <span class="font-bold text-zinc-100 text-xs truncate">${partida.time_fora}</span>
                        ${obterBandeira(partida.time_fora)}
                    </div>
                </div>
                
                ${subpainelGols}
                
                <div class="flex items-center justify-between pt-2 border-t border-zinc-800/60 mt-1">
                    <label class="flex items-center gap-1.5 text-[10px] text-zinc-400 cursor-pointer font-medium">
                        <input type="checkbox" id="ficha-ouro-${partida.id}" ${palpite?.usa_ficha_ouro ? 'checked' : ''} ${mercadoFechado ? 'disabled' : ''} class="rounded bg-zinc-950 border-zinc-800 text-amber-500 focus:ring-0 w-3 h-3"> 
                        ✨ Ficha de Ouro (2x)
                    </label>
                    ${mercadoFechado ? `<span class="text-[10px] font-bold text-zinc-500">Pts ganhos: <span class="text-white">${palpite?.pontos_ganhos || 0}</span></span>` : ''}
                </div>`;
            
            container.appendChild(card);
        });
    });
}

// =========================================================================
// 5. MOTOR DE GRAVAÇÃO DE PALPITES
// =========================================================================
async function salvarTodosOsPalpites() {
    if (!currentUserId) return;
    
    // Botão muda para estado de carregamento
    const btn = document.querySelector('button[onclick="salvarTodosOsPalpites()"]');
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = 'Processando...';
    btn.disabled = true;

    for (const card of document.querySelectorAll('.card-jogo')) {
        const pId = card.dataset.partidaId;
        if (card.dataset.mercadoFechado === 'true') continue;
        
        const iC = document.getElementById(`gols-casa-${pId}`).value;
        const iF = document.getElementById(`gols-fora-${pId}`).value;
        const usaFicha = document.getElementById(`ficha-ouro-${pId}`).checked;
        
        if (iC !== "" && iF !== "") {
            const { data: res, error } = await window.supabaseClient.from('palpites')
                .upsert({ 
                    user_id: currentUserId, 
                    partida_id: parseInt(pId), 
                    palpite_casa: parseInt(iC), 
                    palpite_fora: parseInt(iF), 
                    usa_ficha_ouro: usaFicha 
                }, { onConflict: 'user_id,partida_id' })
                .select();
                
            if (error) { 
                alert(`Erro ao salvar a partida ${pId}: ${error.message}`); 
                continue; 
            }
            
            if (card.dataset.isBrasil === 'true') {
                let pIdDb = (res && res.length > 0) ? res[0].id : null;
                if (!pIdDb) { 
                    const { data: fb } = await window.supabaseClient.from('palpites')
                        .select('id')
                        .eq('user_id', currentUserId)
                        .eq('partida_id', parseInt(pId))
                        .maybeSingle(); 
                    if (fb) pIdDb = fb.id; 
                }
                
                if (pIdDb) {
                    const sel = document.getElementById(`palpite-artilheiro-${pId}`);
                    await window.supabaseClient.from('palpites_gols_brasil').delete().eq('palpite_id', pIdDb);
                    
                    if (sel && sel.value !== "") {
                        await window.supabaseClient.from('palpites_gols_brasil').insert({ 
                            palpite_id: pIdDb, 
                            jogador_id: parseInt(sel.value) 
                        });
                    }
                }
            }
        }
    }
    
    alert("Todos os palpites foram guardados com sucesso!"); 
    btn.innerHTML = textoOriginal;
    btn.disabled = false;
    
    await carregarDados(currentUserId);
}

// Exposição da função para o botão HTML
window.salvarTodosOsPalpites = salvarTodosOsPalpites;