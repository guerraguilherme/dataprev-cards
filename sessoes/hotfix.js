(() => {
  'use strict';

  const HOTFIX_VERSION = '0.3';
  const SESSIONS_SYNC_KEY = 'dataprev_sessoes_sync_config_v1';
  const CARDS_SYNC_KEY = 'dataprev_cards_sync_config_v1';
  const STATE_MAP_KEY = 'dataprev_sessoes_states_v2';
  const LEGACY_STATE_KEY = 'dataprev_sessoes_state_v1';
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function normalizeConfig(raw = {}) {
    return {
      endpoint: String(raw.endpoint || '').trim(),
      token: String(raw.token || '').trim(),
      deviceId: String(raw.deviceId || '').trim()
    };
  }

  function readStoredConfig() {
    for (const key of [SESSIONS_SYNC_KEY, CARDS_SYNC_KEY]) {
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || 'null');
        const config = normalizeConfig(parsed || {});
        if (config.endpoint && config.token && config.deviceId) return config;
      } catch {}
    }
    return {endpoint:'',token:'',deviceId:''};
  }

  function saveStoredConfig(config) {
    const clean = normalizeConfig(config);
    localStorage.setItem(SESSIONS_SYNC_KEY, JSON.stringify(clean));
    localStorage.setItem(CARDS_SYNC_KEY, JSON.stringify(clean));
    return clean;
  }

  function readStateMap() {
    try { return JSON.parse(localStorage.getItem(STATE_MAP_KEY) || '{}') || {}; }
    catch { return {}; }
  }

  function writeStateMap(map) {
    localStorage.setItem(STATE_MAP_KEY, JSON.stringify(map));
  }

  function migrateCurrentState() {
    if (!window.state || !state.sessionId) return;
    const map = readStateMap();
    map[state.sessionId] = JSON.parse(JSON.stringify(state));
    writeStateMap(map);
  }

  function stateFor(sessionId) {
    const map = readStateMap();
    if (map[sessionId]) return {...freshState(), ...map[sessionId], sessionId};
    const s = freshState();
    s.sessionId = sessionId;
    s.contentVersion = catalog?.contentVersion || '';
    return s;
  }

  saveState = function patchedSaveState() {
    state.lastTick = Date.now();
    localStorage.setItem(LEGACY_STATE_KEY, JSON.stringify(state));
    const map = readStateMap();
    if (state.sessionId) map[state.sessionId] = JSON.parse(JSON.stringify(state));
    writeStateMap(map);
  };

  loadSyncConfig = () => readStoredConfig();

  function statusOf(sessionId) {
    const s = readStateMap()[sessionId];
    if (!s || !s.startedAt) return 'Não iniciada';
    if (s.phase === 'complete' || s.completedAt) return 'Concluída';
    return 'Em andamento';
  }

  function selectSession(sessionId, {start=false}={}) {
    if (!catalog?.sessions?.length) return;
    try { updateClock(); } catch {}
    if (state) {
      state.timerRunning = false;
      saveState();
    }
    const target = catalog.sessions.find(item => item.id === sessionId);
    if (!target) return;
    session = target;
    state = stateFor(sessionId);
    state.contentVersion = catalog.contentVersion;
    if (start && state.phase === 'home') state.phase = 'concepts';
    if (start) startTimer();
    else { state.timerRunning = false; saveState(); render(); }
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function nextIncompleteSessionId() {
    if (!catalog?.sessions?.length) return '';
    const map = readStateMap();
    const pending = catalog.sessions.find(s => {
      const st = map[s.id];
      return !(st?.phase === 'complete' || st?.completedAt);
    });
    return pending?.id || catalog.sessions[0].id;
  }

  function renderCatalogHome() {
    showOnly('homePanel');
    const map = readStateMap();
    const cards = catalog.sessions.map((item, index) => {
      const saved = map[item.id];
      const status = statusOf(item.id);
      const action = status === 'Concluída' ? 'Ver resultado' : saved?.startedAt ? 'Retomar' : 'Iniciar';
      return `
        <div class="session-option">
          <div class="kicker">${index+1} · ${esc(item.discipline)} · ${esc(item.topic)}</div>
          <h2>${esc(item.title)}</h2>
          <p>${esc(item.objective)}</p>
          <div class="session-meta">
            <span class="pill">${item.estimatedMinutes} min</span>
            <span class="pill">Prioridade ${esc(item.priority)}</span>
            <span class="pill">${esc(status)}</span>
          </div>
          <button class="${status==='Em andamento'?'primary':'ghost'} session-open-btn" data-session-id="${esc(item.id)}">${action}</button>
        </div>`;
    }).join('');

    document.getElementById('sessionCard').innerHTML = `
      <div class="kicker">Trilha do Controle Geral</div>
      <h1>Sessões disponíveis</h1>
      <p>Ordem definida pelo Plano Mestre, com revisão adaptativa sem substituir a cobertura do edital.</p>
      <div class="catalog-list">${cards}</div>`;

    document.querySelectorAll('.session-open-btn').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.sessionId;
        const st = readStateMap()[id];
        selectSession(id, {start: !(st?.phase === 'complete' || st?.completedAt)});
      };
    });
  }

  renderHome = function renderHomePatched() {
    renderCatalogHome();
  };

  const originalRenderComplete = window.renderComplete;
  renderComplete = function renderCompletePatched() {
    originalRenderComplete();
    const body = document.getElementById('studyBody');
    if (!body || document.getElementById('nextSessionBtn')) return;
    const nextId = (() => {
      const i = catalog.sessions.findIndex(s => s.id === session.id);
      for (let step=1; step<=catalog.sessions.length; step++) {
        const candidate = catalog.sessions[(i+step)%catalog.sessions.length];
        const st = readStateMap()[candidate.id];
        if (!(st?.phase === 'complete' || st?.completedAt)) return candidate.id;
      }
      return '';
    })();
    const row = document.createElement('div');
    row.className='row';
    row.style.marginTop='12px';
    row.innerHTML = nextId
      ? `<button id="nextSessionBtn" class="primary">Abrir próxima sessão</button><button id="catalogHomeBtn">Ver catálogo</button>`
      : `<button id="catalogHomeBtn" class="primary">Ver catálogo</button>`;
    body.appendChild(row);
    if (nextId) document.getElementById('nextSessionBtn').onclick=()=>selectSession(nextId,{start:false});
    document.getElementById('catalogHomeBtn').onclick=()=>{state.phase='home';saveState();render();};
  };

  async function refreshSessionsPatched() {
    setStatus('syncStatus','Consultando novas sessões…','');
    try {
      migrateCurrentState();
      const remote = await fetchRemoteCatalog();
      if (!remote?.sessions?.length) throw new Error('Nenhuma sessão publicada.');
      catalog = remote;
      const currentExists = catalog.sessions.some(s => s.id === state?.sessionId);
      const chosen = currentExists ? state.sessionId : nextIncompleteSessionId();
      session = catalog.sessions.find(s => s.id === chosen) || catalog.sessions[0];
      state = stateFor(session.id);
      state.contentVersion = catalog.contentVersion;
      state.phase = 'home';
      state.timerRunning = false;
      saveState();
      render();
      setStatus('syncStatus',`Catálogo atualizado: ${catalog.sessions.length} sessões disponíveis.`, 'ok');
    } catch (error) {
      setStatus('syncStatus',`Falha: ${error.message}`,'bad');
    }
  }

  function validEndpoint(value) {
    const url = new URL(String(value || '').trim());
    if (url.protocol !== 'https:' || !url.pathname.endsWith('/exec')) throw new Error('Use uma URL HTTPS terminada em /exec.');
    url.search=''; url.hash='';
    return url.toString();
  }

  function renderConfigPanel() {
    if (document.getElementById('sessionsConfigTransfer')) return;
    const syncStatus=document.getElementById('syncStatus');
    if (!syncStatus) return;
    const wrapper=document.createElement('div');
    wrapper.id='sessionsConfigTransfer';
    wrapper.style.marginTop='12px';
    wrapper.innerHTML=`
      <div class="row"><button id="importCardsConfigBtn" class="ghost" type="button">Importar configuração dos Cards</button></div>
      <details class="note" style="margin-top:10px"><summary>Configuração manual</summary>
      <div style="margin-top:10px">
      <label class="small">URL do Web App</label><input id="sessionsEndpointInput" type="url">
      <label class="small" style="display:block;margin-top:9px">Chave privada</label><input id="sessionsTokenInput" type="password">
      <label class="small" style="display:block;margin-top:9px">Identificador do aparelho</label><input id="sessionsDeviceInput" type="text">
      <button id="saveSessionsConfigBtn" style="margin-top:10px;width:100%">Salvar configuração</button>
      </div></details>`;
    syncStatus.parentElement.insertBefore(wrapper,syncStatus);
    const cfg=readStoredConfig();
    sessionsEndpointInput.value=cfg.endpoint; sessionsTokenInput.value=cfg.token; sessionsDeviceInput.value=cfg.deviceId;
    importCardsConfigBtn.onclick=async()=>{
      try{
        const parsed=JSON.parse(await navigator.clipboard.readText());
        if(parsed?.type!=='dataprev-sync-config')throw new Error('Conteúdo inválido.');
        const c=saveStoredConfig({endpoint:validEndpoint(parsed.endpoint),token:parsed.token,deviceId:parsed.deviceId});
        sessionsEndpointInput.value=c.endpoint;sessionsTokenInput.value=c.token;sessionsDeviceInput.value=c.deviceId;
        setStatus('syncStatus','Configuração importada.','ok');
      }catch(e){setStatus('syncStatus',`Falha ao importar: ${e.message}`,'bad');}
    };
    saveSessionsConfigBtn.onclick=()=>{
      try{
        const c=saveStoredConfig({endpoint:validEndpoint(sessionsEndpointInput.value),token:sessionsTokenInput.value,deviceId:sessionsDeviceInput.value});
        if(!c.token||!c.deviceId)throw new Error('Preencha todos os campos.');
        setStatus('syncStatus','Configuração salva.','ok');
      }catch(e){setStatus('syncStatus',`Falha ao salvar: ${e.message}`,'bad');}
    };
  }

  async function sha256(text) {
    const buffer=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buffer)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  async function confirmState(config, checksum) {
    for(let attempt=1;attempt<=20;attempt++){
      setStatus('syncStatus',`Envio realizado. Confirmando… ${attempt}/20.`,'');
      await sleep(attempt===1?1200:1600);
      try{
        const result=await jsonp(config.endpoint,{action:'session_state_meta',token:config.token,device_id:config.deviceId,session_id:session.id},12000);
        if(result?.ok&&result?.found&&result?.checksum===checksum)return result;
      }catch{}
    }
    throw new Error('A planilha não confirmou a tempo; o progresso local está salvo.');
  }

  async function syncSessionPatched() {
    const button=document.getElementById('syncBtn');
    const config=readStoredConfig();
    if(!config.endpoint||!config.token||!config.deviceId){
      setStatus('syncStatus','Importe ou salve a configuração de sincronização.','bad'); return;
    }
    if(button?.disabled)return;
    if(button)button.disabled=true;
    try{
      updateClock();saveState();
      const stateJson=JSON.stringify(state);
      const checksum=await sha256(stateJson);
      const body={action:'push_session_state',token:config.token,device_id:config.deviceId,app_version:HOTFIX_VERSION,content_version:catalog.contentVersion,session_id:session.id,checksum,state_json:stateJson};
      setStatus('syncStatus','Enviando checkpoint da sessão…','');
      void fetch(config.endpoint,{method:'POST',mode:'no-cors',cache:'no-store',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body)}).catch(()=>{});
      const confirmation=await confirmState(config,checksum);
      setStatus('syncStatus',`Sessão sincronizada em ${new Date(confirmation.updated_at||Date.now()).toLocaleString('pt-BR')}.`,'ok');
      syncBadge.textContent='Sincronizado';syncBadge.classList.add('ok');
    }catch(e){setStatus('syncStatus',`Falha: ${e.message}`,'bad');}
    finally{if(button)button.disabled=false;}
  }

  function injectStyles() {
    const style=document.createElement('style');
    style.textContent=`
      .catalog-list{display:grid;gap:12px;margin-top:12px}
      .session-option{border:1px solid var(--line);border-radius:15px;padding:13px;background:#f8fafc}
      .session-option h2{margin:6px 0}
      .session-option button{width:100%;margin-top:8px}
    `;
    document.head.appendChild(style);
  }

  async function initialize() {
    for(let i=0;i<100;i++){
      if(window.catalog&&window.session&&window.state&&typeof render==='function')break;
      await sleep(100);
    }
    injectStyles();
    renderConfigPanel();
    migrateCurrentState();
    syncBtn.onclick=syncSessionPatched;
    refreshContentBtn.onclick=refreshSessionsPatched;
    const summary=document.getElementById('contentSummary');
    if(summary)summary.textContent=summary.textContent.replace(/PWA\s+[\d.]+/,`PWA ${HOTFIX_VERSION}`);
    await refreshSessionsPatched();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});
  else initialize();
})();