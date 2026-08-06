(() => {
  'use strict';

  const VERSION = '0.4';
  const REASONS = {
    symbols: 'Símbolos e nomenclatura',
    intuition: 'Ideia intuitiva',
    calculation: 'Cálculo ou passos',
    connection: 'Conexão com o que já estudei'
  };

  const SUPPORT = {
    'MAT-ALG-C04': {
      classification: 'abstrato_nova_notacao',
      intro: 'Este conceito precisa de uma camada visual e intuitiva antes da propriedade algébrica.',
      sections: {
        symbols: {
          title: 'O que significam i, j e k?',
          html: '<p><b>i = (1,0,0)</b>: aponta na direção do eixo x.</p><p><b>j = (0,1,0)</b>: aponta na direção do eixo y.</p><p><b>k = (0,0,1)</b>: aponta na direção do eixo z.</p><div class="support-axes"><span>i → direita</span><span>j → frente</span><span>k → cima</span></div>'
        },
        intuition: {
          title: 'Qual é a ideia do produto vetorial?',
          html: '<p>Você fornece dois vetores e recebe um terceiro vetor que aponta para uma direção perpendicular aos dois.</p><p>Pense em <b>i</b> como uma direção horizontal e <b>j</b> como outra direção horizontal. O resultado <b>k</b> aponta para fora desse plano.</p><p>Nesta sessão, o essencial é reconhecer a direção e a mudança de sinal ao inverter a ordem.</p>'
        },
        calculation: {
          title: 'O que realmente preciso calcular agora?',
          html: '<p>Neste estágio, não é necessário usar determinante nem decorar a fórmula geral.</p><ol><li>Memorize a relação básica: <b>i × j = k</b>.</li><li>Ao inverter a ordem, inverta o sinal: <b>j × i = −k</b>.</li><li>Logo, se a questão pergunta j × i, a resposta é −k.</li></ol>'
        },
        connection: {
          title: 'Produto escalar x produto vetorial',
          html: '<table class="support-table"><tr><th>Operação</th><th>Resultado</th></tr><tr><td>Produto escalar u·v</td><td>um número</td></tr><tr><td>Produto vetorial u×v</td><td>um vetor</td></tr></table><p>O produto escalar ajuda a medir alinhamento; o vetorial produz uma direção perpendicular.</p>'
        }
      },
      check: {
        prompt: 'Depois do resgate: se i × j = k, então j × i é:',
        options: ['−k', 'k', '0', '1'],
        answer: 0,
        explanation: 'Inverter a ordem do produto vetorial inverte o sinal.'
      }
    }
  };

  function getConcept() {
    try { return session?.concepts?.[state?.conceptIndex] || null; }
    catch { return null; }
  }

  function ensureSupportState(conceptId) {
    state.support = state.support || {};
    state.support[conceptId] = state.support[conceptId] || {
      opened: false,
      reasons: [],
      viewedSections: [],
      autoOpened: false,
      resolved: false,
      check: null
    };
    return state.support[conceptId];
  }

  function genericSupport(concept) {
    return {
      classification: 'sob_demanda',
      intro: 'Abra apenas a parte que está impedindo o avanço. Isso não conta como erro.',
      sections: {
        symbols: {
          title: 'Símbolos e termos usados',
          html: `<p>Releia os símbolos deste conceito isoladamente:</p><pre>${esc(concept.code || concept.what || '')}</pre>`
        },
        intuition: {
          title: 'Ideia em linguagem direta',
          html: `<p>${esc(concept.what || '')}</p><p>${esc(concept.explanation || '')}</p>`
        },
        calculation: {
          title: 'Sequência prática',
          html: `<ol><li>Identifique os dados apresentados.</li><li>Localize a propriedade central.</li><li>Aplique a propriedade a um exemplo pequeno.</li><li>Confira a pegadinha: ${esc(concept.trap || '')}</li></ol>`
        },
        connection: {
          title: 'Ligação com conhecimentos anteriores',
          html: `<p>${esc(concept.connection || 'Este conceito será conectado aos próximos tópicos da sessão.')}</p>`
        }
      },
      check: null
    };
  }

  function supportData(concept) {
    return SUPPORT[concept.id] || genericSupport(concept);
  }

  function saveSupport() {
    try { saveState(); } catch {}
  }

  function injectStyles() {
    if (document.getElementById('adaptiveDepthStyles')) return;
    const style = document.createElement('style');
    style.id = 'adaptiveDepthStyles';
    style.textContent = `
      .adaptive-depth{margin-top:14px;border:1px solid #b7c8f7;border-radius:14px;background:#f5f8ff;overflow:hidden}
      .adaptive-trigger{width:100%;border:0;border-radius:0;background:#eaf0ff;color:#173f91;padding:13px 14px;text-align:left;font-weight:800}
      .adaptive-trigger.auto{background:#fff3d6;color:#664600}
      .adaptive-panel{padding:13px}
      .adaptive-panel.hidden{display:none}
      .adaptive-intro{margin:0 0 10px;color:var(--muted);line-height:1.45}
      .adaptive-reasons{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:10px 0}
      .adaptive-reasons button{min-width:0;padding:9px;font-size:.86rem}
      .adaptive-reasons button.active{background:var(--accent2);border-color:var(--accent);color:#123b8f}
      .adaptive-section{border:1px solid var(--line);border-radius:12px;background:#fff;padding:12px;margin-top:9px;line-height:1.5}
      .adaptive-section h3{margin:0 0 7px}
      .adaptive-section ol{padding-left:21px}
      .support-axes{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:10px 0}
      .support-axes span{background:#f4f6fa;border:1px solid var(--line);border-radius:10px;padding:9px;text-align:center;font-weight:700}
      .support-table{width:100%;border-collapse:collapse;margin:8px 0}
      .support-table th,.support-table td{border:1px solid var(--line);padding:8px;text-align:left}
      .adaptive-check{border-top:1px solid var(--line);margin-top:12px;padding-top:12px}
      .adaptive-check button{display:block;width:100%;text-align:left;margin:6px 0}
      .adaptive-check button.correct{background:var(--okbg);border-color:#78c99f}
      .adaptive-check button.wrong{background:var(--badbg);border-color:#efa59e}
      .adaptive-actions{display:flex;gap:8px;margin-top:12px}
      .adaptive-actions button{flex:1}
      @media(max-width:520px){.adaptive-reasons{grid-template-columns:1fr}.support-axes{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function renderSupport() {
    const concept = getConcept();
    if (!concept || document.getElementById('adaptiveDepth')) return;

    const data = supportData(concept);
    const record = ensureSupportState(concept.id);
    const host = document.createElement('div');
    host.id = 'adaptiveDepth';
    host.className = 'adaptive-depth';

    const reasonButtons = Object.entries(REASONS).map(([key, label]) =>
      `<button type="button" data-support-reason="${key}" class="${record.reasons.includes(key) ? 'active' : ''}">${label}</button>`
    ).join('');

    host.innerHTML = `
      <button type="button" class="adaptive-trigger ${record.autoOpened ? 'auto' : ''}" id="adaptiveTrigger">
        ${record.autoOpened ? '⚠ Resgate recomendado após tentativas' : '▸ Não entendi — destravar conceito'}
      </button>
      <div class="adaptive-panel ${record.opened || record.autoOpened ? '' : 'hidden'}" id="adaptivePanel">
        <p class="adaptive-intro">${data.intro}</p>
        <div class="small">O que está travando?</div>
        <div class="adaptive-reasons">${reasonButtons}</div>
        <div id="adaptiveSections"></div>
        <div id="adaptiveCheck"></div>
        <div class="adaptive-actions">
          <button type="button" id="adaptiveResolved" class="primary">Entendi agora</button>
          <button type="button" id="adaptiveClose">Fechar ajuda</button>
        </div>
      </div>`;

    const note = document.querySelector('.note');
    if (note) note.parentElement.insertBefore(host, note);
    else document.getElementById('studyBody')?.appendChild(host);

    function renderSections() {
      const container = document.getElementById('adaptiveSections');
      const viewed = record.viewedSections.length ? record.viewedSections : record.reasons;
      container.innerHTML = viewed.map(key => {
        const section = data.sections[key];
        if (!section) return '';
        return `<div class="adaptive-section"><h3>${section.title}</h3>${section.html}</div>`;
      }).join('');
      renderCheck();
    }

    function renderCheck() {
      const container = document.getElementById('adaptiveCheck');
      if (!data.check || !record.reasons.length) {
        container.innerHTML = '';
        return;
      }
      const answered = record.check;
      container.innerHTML = `
        <div class="adaptive-check">
          <h3>Microchecagem de resgate</h3>
          <p>${data.check.prompt}</p>
          ${data.check.options.map((opt, idx) => {
            let cls = '';
            if (answered && idx === data.check.answer) cls = 'correct';
            if (answered && answered.selected === idx && !answered.correct) cls = 'wrong';
            return `<button type="button" data-support-check="${idx}" class="${cls}" ${answered ? 'disabled' : ''}>${String.fromCharCode(65+idx)}. ${opt}</button>`;
          }).join('')}
          ${answered ? `<div class="feedback ${answered.correct ? 'ok' : 'bad'}">${answered.correct ? 'Correto.' : 'Ainda não.'} ${data.check.explanation}</div>` : ''}
        </div>`;
      container.querySelectorAll('[data-support-check]').forEach(button => {
        button.onclick = () => {
          const selected = Number(button.dataset.supportCheck);
          record.check = {
            selected,
            correct: selected === data.check.answer,
            answeredAt: new Date().toISOString()
          };
          saveSupport();
          renderCheck();
        };
      });
    }

    document.getElementById('adaptiveTrigger').onclick = () => {
      record.opened = !record.opened;
      if (record.opened && !record.openedAt) record.openedAt = new Date().toISOString();
      saveSupport();
      document.getElementById('adaptivePanel').classList.toggle('hidden', !record.opened);
    };

    host.querySelectorAll('[data-support-reason]').forEach(button => {
      button.onclick = () => {
        const key = button.dataset.supportReason;
        if (!record.reasons.includes(key)) record.reasons.push(key);
        if (!record.viewedSections.includes(key)) record.viewedSections.push(key);
        record.opened = true;
        record.lastReasonAt = new Date().toISOString();
        button.classList.add('active');
        saveSupport();
        renderSections();
      };
    });

    document.getElementById('adaptiveResolved').onclick = () => {
      record.resolved = true;
      record.resolvedAt = new Date().toISOString();
      record.opened = false;
      saveSupport();
      document.getElementById('adaptivePanel').classList.add('hidden');
      document.getElementById('adaptiveTrigger').textContent = '✓ Ajuda usada — abrir novamente';
    };

    document.getElementById('adaptiveClose').onclick = () => {
      record.opened = false;
      saveSupport();
      document.getElementById('adaptivePanel').classList.add('hidden');
    };

    renderSections();
  }

  function patchRenderConcept() {
    if (typeof window.renderConcept !== 'function' || window.renderConcept.__adaptivePatched) return;
    const original = window.renderConcept;
    const patched = function adaptiveRenderConcept() {
      original();
      injectStyles();
      renderSupport();
      const summary = document.getElementById('contentSummary');
      if (summary) summary.textContent = summary.textContent.replace(/PWA\s+[\d.]+/, `PWA ${VERSION}`);
    };
    patched.__adaptivePatched = true;
    window.renderConcept = patched;
    try { renderConcept = patched; } catch {}
  }

  function patchAnswerImmediate() {
    if (typeof window.answerImmediate !== 'function' || window.answerImmediate.__adaptivePatched) return;
    const original = window.answerImmediate;
    const patched = function adaptiveAnswerImmediate(id, idx) {
      original(id, idx);
      try {
        const concept = getConcept();
        const rec = state.immediate?.[id];
        if (concept && rec && !rec.correct && (rec.attempts || []).length >= 2) {
          const support = ensureSupportState(concept.id);
          support.opened = true;
          support.autoOpened = true;
          support.autoOpenedAt = new Date().toISOString();
          saveSupport();
          window.renderConcept();
          setTimeout(() => document.getElementById('adaptiveDepth')?.scrollIntoView({behavior:'smooth', block:'center'}), 50);
        }
      } catch {}
    };
    patched.__adaptivePatched = true;
    window.answerImmediate = patched;
    try { answerImmediate = patched; } catch {}
  }

  function patchReport() {
    if (typeof window.report !== 'function' || window.report.__adaptivePatched) return;
    const original = window.report;
    const patched = function adaptiveReport() {
      let text = original();
      const entries = Object.entries(state.support || {});
      if (!entries.length) return text;
      text += '\n\nAPOIO ADAPTATIVO UTILIZADO';
      for (const [conceptId, rec] of entries) {
        text += `\n${conceptId}: motivos=${(rec.reasons || []).map(r => REASONS[r] || r).join(', ') || 'abertura sem seleção'}; `;
        text += `resolvido=${rec.resolved ? 'sim' : 'não'}; `;
        text += `microchecagem=${rec.check ? (rec.check.correct ? 'acerto' : 'erro') : 'não realizada'}; `;
        text += `abertura automática=${rec.autoOpened ? 'sim' : 'não'}`;
      }
      return text;
    };
    patched.__adaptivePatched = true;
    window.report = patched;
    try { report = patched; } catch {}
  }

  function initialize() {
    injectStyles();
    patchRenderConcept();
    patchAnswerImmediate();
    patchReport();
    if (state?.phase === 'concepts') {
      try { window.renderConcept(); } catch {}
    }
    const summary = document.getElementById('contentSummary');
    if (summary) summary.textContent = summary.textContent.replace(/PWA\s+[\d.]+/, `PWA ${VERSION}`);
  }

  let attempts = 0;
  const timer = setInterval(() => {
    attempts++;
    if (window.state && window.session && typeof window.renderConcept === 'function') {
      clearInterval(timer);
      initialize();
    }
    if (attempts > 200) clearInterval(timer);
  }, 50);
})();