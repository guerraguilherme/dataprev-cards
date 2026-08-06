(() => {
  'use strict';

  document.addEventListener('click', event => {
    const button = event.target.closest('#syncBtn');
    if (!button) return;

    try {
      if (window.state?.completedAt && window.state.phase !== 'complete') {
        const originalPhase = window.state.phase;
        window.state.phase = 'complete';
        saveState();
        setTimeout(() => {
          try {
            window.state.phase = originalPhase;
            saveState();
          } catch {}
        }, 250);
      }
    } catch (error) {
      console.warn('Falha ao normalizar status concluído:', error);
    }
  }, true);
})();