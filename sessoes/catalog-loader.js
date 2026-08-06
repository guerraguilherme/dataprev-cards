(() => {
  'use strict';

  const CONTENT_VERSION = '2026.08.06-sessoes-02';
  const NEW_SESSION_FILES = [
    'PY-COND-R01.json',
    'MAT-ALG-002.json',
    'BD-NORM-002.json'
  ];

  async function fetchJson(path) {
    const response = await fetch(`./${path}?v=${encodeURIComponent(CONTENT_VERSION)}`, {
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`Falha ao carregar ${path}.`);
    return response.json();
  }

  fetchRemoteCatalog = async function fetchPublishedSessionsCatalog() {
    const bundled = await fetchJson('sessions.json');
    const newSessions = await Promise.all(NEW_SESSION_FILES.map(fetchJson));

    const byId = new Map();
    for (const item of [...(bundled.sessions || []), ...newSessions]) {
      if (!item?.id) throw new Error('Sessão sem ID no catálogo.');
      byId.set(item.id, item);
    }

    const sessions = Array.from(byId.values());
    return {
      schemaVersion: 1,
      contentVersion: CONTENT_VERSION,
      totalSessions: sessions.length,
      sessions
    };
  };
})();