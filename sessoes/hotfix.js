(() => {
  'use strict';

  const HOTFIX_VERSION = '0.2.1';
  const SESSIONS_SYNC_KEY = 'dataprev_sessoes_sync_config_v1';
  const CARDS_SYNC_KEY = 'dataprev_cards_sync_config_v1';
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
    return {endpoint: '', token: '', deviceId: ''};
  }

  function saveStoredConfig(config) {
    const clean = normalizeConfig(config);
    localStorage.setItem(SESSIONS_SYNC_KEY, JSON.stringify(clean));
    localStorage.setItem(CARDS_SYNC_KEY, JSON.stringify(clean));
    return clean;
  }

  loadSyncConfig = function loadSyncConfigPatched() {
    return readStoredConfig();
  };

  function validEndpoint(value) {
    const url = new URL(String(value || '').trim());
    if (url.protocol !== 'https:' || !url.pathname.endsWith('/exec')) {
      throw new Error('Use a URL HTTPS do Web App terminada em /exec.');
    }
    url.search = '';
    url.hash = '';
    return url.toString();
  }

  function renderConfigPanel() {
    if (document.getElementById('sessionsConfigTransfer')) return;

    const syncStatus = document.getElementById('syncStatus');
    if (!syncStatus) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'sessionsConfigTransfer';
    wrapper.style.marginTop = '12px';
    wrapper.innerHTML = `
      <div class="row">
        <button id="importCardsConfigBtn" class="ghost" type="button">Importar configuração dos Cards</button>
      </div>
      <details class="note" style="margin-top:10px">
        <summary>Configuração manual</summary>
        <div style="margin-top:10px">
          <label class="small" for="sessionsEndpointInput">URL do Web App terminada em /exec</label>
          <input id="sessionsEndpointInput" type="url" autocomplete="off" placeholder="https://script.google.com/macros/s/.../exec">
          <label class="small" for="sessionsTokenInput" style="display:block;margin-top:9px">Chave privada</label>
          <input id="sessionsTokenInput" type="password" autocomplete="off" placeholder="Chave privada de sincronização">
          <label class="small" for="sessionsDeviceInput" style="display:block;margin-top:9px">Identificador do aparelho</label>
          <input id="sessionsDeviceInput" type="text" autocomplete="off" placeholder="iphone-...">
          <button id="saveSessionsConfigBtn" type="button" style="margin-top:10px;width:100%">Salvar configuração</button>
        </div>
      </details>`;

    syncStatus.parentElement.insertBefore(wrapper, syncStatus);

    const existing = readStoredConfig();
    document.getElementById('sessionsEndpointInput').value = existing.endpoint;
    document.getElementById('sessionsTokenInput').value = existing.token;
    document.getElementById('sessionsDeviceInput').value = existing.deviceId;

    document.getElementById('importCardsConfigBtn').onclick = importFromClipboard;
    document.getElementById('saveSessionsConfigBtn').onclick = saveManualConfig;
  }

  async function importFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = JSON.parse(text);
      if (parsed?.type !== 'dataprev-sync-config') {
        throw new Error('O conteúdo copiado não é uma configuração do DATAPREV Cards.');
      }

      const config = saveStoredConfig({
        endpoint: validEndpoint(parsed.endpoint),
        token: parsed.token,
        deviceId: parsed.deviceId
      });

      document.getElementById('sessionsEndpointInput').value = config.endpoint;
      document.getElementById('sessionsTokenInput').value = config.token;
      document.getElementById('sessionsDeviceInput').value = config.deviceId;

      setStatus('syncStatus', 'Configuração importada. Agora toque em “Sincronizar agora”.', 'ok');
      document.getElementById('syncBadge').textContent = 'Configurado';
      document.getElementById('syncBadge').classList.add('ok');

      try { await navigator.clipboard.writeText('DATAPREV Sessões configurado'); } catch {}
    } catch (error) {
      setStatus('syncStatus', `Falha ao importar: ${error.message}`, 'bad');
    }
  }

  function saveManualConfig() {
    try {
      const config = saveStoredConfig({
        endpoint: validEndpoint(document.getElementById('sessionsEndpointInput').value),
        token: document.getElementById('sessionsTokenInput').value,
        deviceId: document.getElementById('sessionsDeviceInput').value
      });

      if (!config.token || !config.deviceId) {
        throw new Error('Informe a chave privada e o identificador do aparelho.');
      }

      setStatus('syncStatus', 'Configuração salva. Agora toque em “Sincronizar agora”.', 'ok');
    } catch (error) {
      setStatus('syncStatus', `Falha ao salvar: ${error.message}`, 'bad');
    }
  }

  async function sha256(text) {
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buffer))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  async function confirmSessionState(config, checksum) {
    for (let attempt = 1; attempt <= 20; attempt++) {
      setStatus('syncStatus', `Envio realizado. Confirmando… tentativa ${attempt}/20.`, '');
      await sleep(attempt === 1 ? 1200 : 1600);

      try {
        const result = await jsonp(config.endpoint, {
          action: 'session_state_meta',
          token: config.token,
          device_id: config.deviceId,
          session_id: session.id
        }, 12000);

        if (result?.ok && result?.found && result?.checksum === checksum) return result;
        if (result?.ok === false) throw new Error(result.error || 'A confirmação foi recusada.');
      } catch (error) {
        console.warn('Confirmação da sessão:', error);
      }
    }

    throw new Error('A planilha demorou a confirmar. Seu progresso local continua salvo.');
  }

  async function syncSessionPatched() {
    const button = document.getElementById('syncBtn');
    const config = readStoredConfig();

    if (!config.endpoint || !config.token || !config.deviceId) {
      setStatus(
        'syncStatus',
        'No DATAPREV Cards, toque em “Copiar configuração para Sessões”; depois volte aqui e importe.',
        'bad'
      );
      return;
    }

    if (button?.disabled) return;
    if (button) button.disabled = true;

    try {
      updateClock();
      saveState();
      setStatus('syncStatus', 'Preparando checkpoint da sessão…', '');

      const stateJson = JSON.stringify(state);
      const checksum = await sha256(stateJson);
      const body = {
        action: 'push_session_state',
        token: config.token,
        device_id: config.deviceId,
        app_version: HOTFIX_VERSION,
        content_version: catalog.contentVersion,
        session_id: session.id,
        checksum,
        state_json: stateJson
      };

      setStatus('syncStatus', 'Enviando checkpoint da sessão…', '');
      void fetch(config.endpoint, {
        method: 'POST',
        mode: 'no-cors',
        cache: 'no-store',
        headers: {'Content-Type': 'text/plain;charset=utf-8'},
        body: JSON.stringify(body)
      }).catch(error => console.warn('POST da sessão:', error));

      const confirmation = await confirmSessionState(config, checksum);
      setStatus(
        'syncStatus',
        `Sessão sincronizada em ${new Date(confirmation.updated_at || Date.now()).toLocaleString('pt-BR')}.`,
        'ok'
      );
      document.getElementById('syncBadge').textContent = 'Sincronizado';
      document.getElementById('syncBadge').classList.add('ok');
    } catch (error) {
      console.error(error);
      setStatus('syncStatus', `Falha: ${error.message}`, 'bad');
    } finally {
      if (button) button.disabled = false;
    }
  }

  function apply() {
    if (!window.__dpSessionsRenderStatsPatched && typeof renderStats === 'function') {
      const originalRenderStats = renderStats;
      renderStats = function renderStatsPatched() {
        originalRenderStats();
        const summary = document.getElementById('contentSummary');
        if (summary) {
          summary.textContent = summary.textContent.replace(/PWA\s+[\d.]+/, `PWA ${HOTFIX_VERSION}`);
        }
      };
      window.__dpSessionsRenderStatsPatched = true;
    }

    renderConfigPanel();

    const syncButton = document.getElementById('syncBtn');
    if (syncButton) syncButton.onclick = syncSessionPatched;

    const config = readStoredConfig();
    if (config.endpoint && config.token && config.deviceId) {
      setStatus('syncStatus', 'Configuração disponível. Toque em “Sincronizar agora”.', 'ok');
      document.getElementById('syncBadge').textContent = 'Configurado';
      document.getElementById('syncBadge').classList.add('ok');
    } else {
      setStatus(
        'syncStatus',
        'Safari e o app instalado podem ter armazenamentos separados. Importe a configuração dos Cards uma única vez.',
        'bad'
      );
    }

    const summary = document.getElementById('contentSummary');
    if (summary) summary.textContent = summary.textContent.replace(/PWA\s+[\d.]+/, `PWA ${HOTFIX_VERSION}`);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, {once: true});
  } else {
    apply();
  }
})();