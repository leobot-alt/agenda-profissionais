(function () {
  'use strict';

  const TABLE = 'recibos_recebidos';
  const STATUS = [
    { value: 'enviado', label: 'Enviado' },
    { value: 'coletado', label: 'Coletado' },
    { value: 'nao_enviado', label: 'Não enviado' },
    { value: 'pendente', label: 'Pendente' }
  ];
  const state = { month: '', professionals: [], statuses: new Map(), loading: false, request: 0 };
  const byId = (id) => document.getElementById(id);
  const style = document.createElement('style');
  style.textContent = `
    .aa-received-receipts-card{margin:0;padding:22px;background:linear-gradient(135deg,#fff 0%,#FAF9FD 100%);border:1px solid #D8CFF4;box-shadow:0 10px 28px rgba(75,50,168,.08)}
    .aa-received-receipts-header h2{margin:4px 0;color:var(--primary-dark)}
    .aa-received-receipts-header p{margin:4px 0 0}
    .aa-received-receipts-filters{display:grid;grid-template-columns:minmax(180px,240px) minmax(240px,1fr);gap:12px;margin:18px 0 14px;padding:14px;border:1px solid #E7E3EF;border-radius:12px;background:#FAF9FD}
    .aa-received-receipts-filters .aa-field{margin:0}
    .aa-received-receipts-summary{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px}
    .aa-received-receipts-count{display:inline-flex;align-items:center;gap:5px;padding:7px 10px;border:1px solid #E6E2EF;border-radius:999px;background:#fff;color:var(--ink-soft);font-size:12px}
    .aa-received-receipts-count b{color:var(--primary-dark)}
    .aa-received-receipts-message{margin:10px 0;padding:12px 14px;border:1px solid #E6E2EF;border-radius:10px;background:#fff;color:var(--ink-soft);font-size:13px}
    .aa-received-receipts-message[hidden]{display:none}
    .aa-received-receipts-message[data-kind="error"]{border-color:#EFC3CC;background:#FFF6F7;color:#8D243A}
    .aa-received-receipts-message[data-kind="loading"]{background:#F8F6FC}
    .aa-received-receipts-table-wrap{margin-top:8px}
    .aa-received-receipts-table{width:100%;min-width:420px}
    .aa-received-receipts-table td:first-child{width:65%}
    .aa-received-receipts-status{min-width:170px;padding:8px 10px;border:1px solid #D9D2EE;border-radius:9px;background:#fff;color:var(--ink);font:inherit;font-weight:700}
    .aa-received-receipts-status:disabled{opacity:.75}
    @media(max-width:640px){.aa-received-receipts-card{padding:16px}.aa-received-receipts-filters{grid-template-columns:1fr}.aa-received-receipts-table{min-width:390px}}
  `;
  document.head.appendChild(style);
  const escapeHtml = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const currentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };
  const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
  const db = () => window.__aaSupabaseClient;
  const canManage = () => typeof window.__aaCanPermission === 'function' && window.__aaCanPermission('banco_profissionais_editar');

  function showMessage(message, kind) {
    const box = byId('aa-recebidos-mensagem');
    if (!box) return;
    box.textContent = message;
    box.dataset.kind = kind || 'info';
    box.hidden = !message;
  }

  function render() {
    const tbody = byId('aa-recebidos-lista');
    const search = normalize(byId('aa-recebidos-busca') && byId('aa-recebidos-busca').value);
    const summary = byId('aa-recebidos-resumo');
    if (!tbody) return;

    const rows = state.professionals.filter((professional) => {
      const name = String(professional.nomeCompleto || '').trim();
      return name && normalize(name).includes(search);
    });
    const counts = { enviado: 0, coletado: 0, nao_enviado: 0, pendente: 0 };
    state.professionals.forEach((professional) => {
      const status = state.statuses.get(String(professional.id)) || 'pendente';
      counts[status] = (counts[status] || 0) + 1;
    });
    if (summary) {
      summary.innerHTML = STATUS.map((item) => `<span class="aa-received-receipts-count"><b>${counts[item.value] || 0}</b> ${item.label}</span>`).join('');
    }

    if (state.loading) {
      tbody.innerHTML = '';
      showMessage('Carregando profissionais e status do mês…', 'loading');
      return;
    }
    if (!rows.length) {
      tbody.innerHTML = '';
      showMessage(search ? 'Nenhum profissional corresponde à pesquisa.' : 'Não há profissionais cadastrados para exibir.', 'empty');
      return;
    }

    showMessage('', '');
    const editable = canManage();
    tbody.innerHTML = rows.map((professional) => {
      const id = String(professional.id);
      const name = String(professional.nomeCompleto || '').trim();
      const value = state.statuses.get(id) || 'pendente';
      const options = STATUS.map((item) => `<option value="${item.value}"${item.value === value ? ' selected' : ''}>${item.label}</option>`).join('');
      return `<tr><td><strong>${escapeHtml(name)}</strong></td><td><select class="aa-received-receipts-status" data-professional-id="${escapeHtml(id)}" aria-label="Status do recibo de ${escapeHtml(name)}"${editable ? '' : ' disabled'}>${options}</select></td></tr>`;
    }).join('');
  }

  async function loadMonth() {
    const monthInput = byId('aa-recebidos-mes');
    const month = monthInput && monthInput.value;
    if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return;

    const request = ++state.request;
    state.month = month;
    state.loading = true;
    state.statuses = new Map();
    render();
    try {
      if (!canManage()) throw new Error('A página requer a permissão de edição do Banco de Dados de profissionais.');
      if (typeof window.__aaLoadProfissionais !== 'function' || typeof window.__aaGetProfissionais !== 'function') {
        throw new Error('Não foi possível acessar a lista de profissionais do sistema.');
      }
      await window.__aaLoadProfissionais();
      const professionals = window.__aaGetProfissionais() || [];
      const client = db();
      if (!client) throw new Error('A conexão com o banco de dados não está disponível.');

      const result = await client.from(TABLE)
        .select('profissional_id,competencia,status')
        .eq('competencia', month);
      if (result.error) throw result.error;
      if (request !== state.request) return;

      state.professionals = professionals.filter((item) => item && item.ativo === true && item.id && String(item.nomeCompleto || '').trim());
      state.statuses = new Map((result.data || []).map((row) => [String(row.profissional_id), row.status]));
      state.loading = false;
      render();
    } catch (error) {
      if (request !== state.request) return;
      state.loading = false;
      state.professionals = [];
      state.statuses = new Map();
      render();
      const detail = String(error && error.message || 'Falha ao carregar os dados.');
      const migrationHint = /recibos_recebidos|does not exist|schema cache/i.test(detail)
        ? ' A tabela de status ainda não está disponível no banco; aplique a migração supabase/migrations/20261106114000_create_recibos_recebidos.sql.'
        : '';
      showMessage(detail + migrationHint, 'error');
      console.error('Falha ao carregar Recibos recebidos:', error);
    }
  }

  async function saveStatus(select) {
    const professionalId = String(select.dataset.professionalId || '');
    const professional = state.professionals.find((item) => String(item.id) === professionalId);
    if (!professional || !state.month || !canManage()) return;
    const previous = state.statuses.get(professionalId) || 'pendente';
    const next = select.value;
    if (!STATUS.some((item) => item.value === next)) {
      select.value = previous;
      return;
    }
    if (next === previous) return;

    select.disabled = true;
    try {
      const client = db();
      const auth = await client.auth.getUser();
      if (auth.error || !auth.data || !auth.data.user) throw new Error('Sua sessão expirou. Entre novamente no Painel RH.');
      const result = await client.from(TABLE).upsert({
        profissional_id: professionalId,
        competencia: state.month,
        status: next,
        updated_by: auth.data.user.id,
        updated_at: new Date().toISOString()
      }, { onConflict: 'profissional_id,competencia' });
      if (result.error) throw result.error;
      state.statuses.set(professionalId, next);
      if (typeof window.aaToast === 'function') window.aaToast(`Status de ${professional.nomeCompleto} salvo.`, 'success');
      render();
    } catch (error) {
      select.value = previous;
      select.disabled = false;
      if (typeof window.aaToast === 'function') window.aaToast(error && error.message || 'Não foi possível salvar o status.', 'error');
      console.error('Falha ao salvar status de recibo recebido:', error);
    }
  }

  function initialize() {
    const monthInput = byId('aa-recebidos-mes');
    const searchInput = byId('aa-recebidos-busca');
    const tbody = byId('aa-recebidos-lista');
    if (!monthInput || !searchInput || !tbody) return;

    monthInput.value = currentMonth();
    monthInput.addEventListener('change', loadMonth);
    searchInput.addEventListener('input', render);
    tbody.addEventListener('change', (event) => {
      if (event.target && event.target.matches('.aa-received-receipts-status')) saveStatus(event.target);
    });

    const previousSwitch = window.aaSwitchRHTab;
    if (typeof previousSwitch === 'function') {
      window.aaSwitchRHTab = function (tab) {
        const result = previousSwitch.apply(this, arguments);
        if (tab === 'recibos-recebidos') loadMonth();
        return result;
      };
    }

    const previousApplyHash = window.aaApplyHashRoute;
    if (typeof previousApplyHash === 'function') {
      window.aaApplyHashRoute = function () {
        const result = previousApplyHash.apply(this, arguments);
        if (location.hash.toLowerCase().includes('/recibos-recebidos')) loadMonth();
        return result;
      };
    }

    if (location.hash.toLowerCase().includes('/recibos-recebidos') && window.__aaCanPermission) loadMonth();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
