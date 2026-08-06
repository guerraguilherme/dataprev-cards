(() => {
  'use strict';

  const VERSION = '0.3.1';
  const STATE_MAP_KEY = 'dataprev_sessoes_states_v2';

  function readMap() {
    try {
      return JSON.parse(localStorage.getItem(STATE_MAP_KEY) || '{}') || {};
    } catch {
      return {};
    }
  }

  function persistMap(map) {
    localStorage.setItem(STATE_MAP_KEY, JSON.stringify(map));
  }

  function buildState(sessionId) {
    const map = readMap();
    return {
      ...freshState(),
      ...(map[sessionId] || {}),
      sessionId,
      contentVersion: catalog?.contentVersion || ''
    };
  }

  function preserveCurrentSession() {
    try {
      updateClock();
    } catch {}

    try {
      if (state) {
        state.timerRunning = false;
        saveState();
      }
    } catch {}
  }

  function openSession(sessionId) {
    if (!catalog?.sessions?.length) return;

    const target = catalog.sessions.find(item => item.id === sessionId);
    if (!target) return;

    preserveCurrentSession();

    session = target;
    state = buildState(sessionId);

    const completed = state.phase === 'complete' || Boolean(state.completedAt);

    if (completed) {
      state.phase = 'complete';
      state.timerRunning = false;
      saveState();
    } else {
      if (!state.phase || state.phase === 'home') state.phase = 'concepts';
      startTimer();
    }

    render();
    window.scrollTo({top: 0, behavior: 'smooth'});
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('.session-open-btn');
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    openSession(button.dataset.sessionId);
  }, true);

  function patchVersionLabel() {
    const summary = document.getElementById('contentSummary');
    if (summary) {
      summary.textContent = summary.textContent.replace(/PWA\s+[\d.]+/, `PWA ${VERSION}`);
    }
  }

  function installVersionPatch() {
    try {
      const originalRenderStats = renderStats;
      renderStats = function renderStats031() {
        originalRenderStats();
        patchVersionLabel();
      };
      patchVersionLabel();
    } catch {
      setTimeout(installVersionPatch, 100);
    }
  }

  installVersionPatch();
})();