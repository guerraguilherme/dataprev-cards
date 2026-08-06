(() => {
  'use strict';

  const HOTFIX_VERSION = '1.5.2';
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function confirmStateRobust(checksum) {
    let lastResult = null;

    for (let attempt = 1; attempt <= 20; attempt++) {
      setSyncStatus(`Envio realizado. Confirmando na planilha… tentativa ${attempt}/20.`, 'wait');
      await sleep(attempt === 1 ? 1200 : 1600);

      try {
        lastResult = await jsonpRequest(syncConfig.endpoint, {
          action: 'state_meta',
          token: syncConfig.token,
          device_id: syncConfig.deviceId
        }, 12000);
      } catch (error) {
        console.warn('Confirmação temporariamente indisponível:', error);
        continue;
      }

      if (lastResult?.ok && lastResult?.found && lastResult?.checksum === checksum) {
        return lastResult;
      }

      if (lastResult?.ok === false) {
        throw new Error(lastResult.error || 'A confirmação da gravação falhou.');
      }
    }

    throw new Error(
      'O envio pode ter chegado à planilha, mas a confirmação demorou. Feche e reabra o app; seu progresso local continua salvo.'
    );
  }

  async function syncNowPatched() {
    if (syncInProgress) return;

    const button = document.getElementById('syncNowBtn');

    try {
      syncInProgress = true;
      if (button) button.disabled = true;

      readSyncInputs();
      tickActiveTime();
      save();

      setSyncStatus('Preparando checkpoint…', 'wait');

      const stateJson = JSON.stringify(state);
      const checksum = await checksumText(stateJson);
      const body = {
        action: 'push_state',
        token: syncConfig.token,
        device_id: syncConfig.deviceId,
        app_version: APP_VERSION,
        content_version: CONTENT_VERSION,
        checksum,
        state_json: stateJson
      };

      setSyncStatus('Enviando checkpoint para o Google Sheets…', 'wait');

      void fetch(syncConfig.endpoint, {
        method: 'POST',
        mode: 'no-cors',
        cache: 'no-store',
        headers: {'Content-Type': 'text/plain;charset=utf-8'},
        body: JSON.stringify(body)
      }).catch(error => console.warn('POST de sincronização:', error));

      const confirmation = await confirmStateRobust(checksum);

      syncConfig.lastSyncAt = confirmation.updated_at || new Date().toISOString();
      syncConfig.lastChecksum = checksum;
      saveSyncConfig();

      setSyncStatus(
        `Sincronização confirmada: ${confirmation.chunks_found} bloco(s), ` +
        `${new Date(syncConfig.lastSyncAt).toLocaleString('pt-BR')}.`,
        'ok'
      );

      if (typeof checkForNewCards === 'function') {
        void checkForNewCards({silent: true}).catch(console.warn);
      }
      if (typeof maybeRequestGeneration === 'function') {
        void maybeRequestGeneration({triggerType: 'after_sync'}).catch(console.warn);
      }
    } catch (error) {
      console.error(error);
      setSyncStatus(error.message || String(error), 'bad');
    } finally {
      syncInProgress = false;
      if (button) button.disabled = false;
    }
  }

  async function copySessionsConfig() {
    try {
      readSyncInputs();
      const payload = {
        type: 'dataprev-sync-config',
        version: 1,
        endpoint: syncConfig.endpoint,
        token: syncConfig.token,
        deviceId: syncConfig.deviceId,
        copiedAt: new Date().toISOString()
      };

      await navigator.clipboard.writeText(JSON.stringify(payload));
      setSyncStatus(
        'Configuração copiada. Abra o DATAPREV Sessões e toque em “Importar configuração dos Cards”.',
        'ok'
      );
    } catch (error) {
      setSyncStatus(`Não foi possível copiar: ${error.message}`, 'bad');
    }
  }

  function installConfigTransferButton() {
    if (document.getElementById('copySessionsConfigBtn')) return;

    const syncButton = document.getElementById('syncNowBtn');
    const actions = syncButton?.parentElement;
    if (!actions) return;

    const button = document.createElement('button');
    button.id = 'copySessionsConfigBtn';
    button.type = 'button';
    button.textContent = 'Copiar configuração para Sessões';
    button.onclick = copySessionsConfig;
    actions.appendChild(button);
  }

  function apply() {
    const syncButton = document.getElementById('syncNowBtn');
    if (syncButton) syncButton.onclick = syncNowPatched;

    installConfigTransferButton();

    const summary = document.getElementById('contentSummary');
    if (summary && !summary.textContent.includes(`PWA ${HOTFIX_VERSION}`)) {
      summary.textContent = summary.textContent.replace(/PWA\s+[\d.]+/, `PWA ${HOTFIX_VERSION}`);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, {once: true});
  } else {
    apply();
  }
})();