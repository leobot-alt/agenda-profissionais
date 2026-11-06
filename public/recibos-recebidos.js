(function () {
  'use strict';

  const TABLE = 'recibos_recebidos';
  const STATUS = [
    { value: 'enviado', label: 'Enviado' },
    { value: 'coletado', label: 'Coletado' },
    { value: 'nao_enviado', label: 'Não enviado' },
    { value: 'pendente', label: 'Pendente' }
  ];
  const state = { month: '', professionals: [], statuses: new Map(), updatedBy: new Map(), updatedAt: new Map(), loading: false, request: 0 };
  const byId = (id) => document.getElementById(id);
  const style = document.createElement('style');
  style.textContent = `
    .aa-received-receipts-card{margin:0;padding:22px;background:linear-gradient(135deg,#fff 0%,#FAF9FD 100%);border:1px solid #D8CFF4;box-shadow:0 10px 28px rgba(75,50,168,.08)}
    .aa-received-receipts-header h2{margin:4px 0;color:var(--primary-dark)}
    .aa-received-receipts-header p{margin:4px 0 0}
    .aa-received-receipts-filters{display:grid;grid-template-columns:minmax(180px,240px) minmax(240px,1fr) minmax(180px,240px);gap:12px;margin:18px 0 14px;padding:14px;border:1px solid #E7E3EF;border-radius:12px;background:#FAF9FD}
    .aa-received-receipts-filters .aa-field{margin:0}
    .aa-received-receipts-actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:0 0 15px}
    .aa-received-receipts-actions span{color:var(--ink-soft);font-size:12px}
    .aa-received-receipts-summary{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px}
    .aa-received-receipts-count{display:inline-flex;align-items:center;gap:5px;padding:7px 10px;border:1px solid #E6E2EF;border-radius:999px;background:#fff;color:var(--ink-soft);font-size:12px}
    .aa-received-receipts-count b{color:var(--primary-dark)}
    .aa-received-receipts-message{margin:10px 0;padding:12px 14px;border:1px solid #E6E2EF;border-radius:10px;background:#fff;color:var(--ink-soft);font-size:13px}
    .aa-received-receipts-message[hidden]{display:none}
    .aa-received-receipts-message[data-kind="error"]{border-color:#EFC3CC;background:#FFF6F7;color:#8D243A}
    .aa-received-receipts-message[data-kind="loading"]{background:#F8F6FC}
    .aa-received-receipts-table-wrap{margin-top:8px}
    .aa-received-receipts-table{width:100%;min-width:650px}
    .aa-received-receipts-table td:first-child{width:48%}
    .aa-received-receipts-table td:nth-child(2){width:24%}
    .aa-received-receipts-table td:nth-child(3){width:28%;color:var(--ink-soft);font-size:13px}
    .aa-received-receipts-audit{display:flex;flex-direction:column;gap:3px}
    .aa-received-receipts-audit strong{color:var(--ink);font-size:13px}
    .aa-received-receipts-audit small{font-size:11px;line-height:1.4}
    .aa-received-receipts-status{min-width:170px;padding:8px 10px;border:1px solid #D9D2EE;border-radius:9px;background:#fff;color:var(--ink);font:inherit;font-weight:700}
    .aa-received-receipts-status:disabled{opacity:.75}
    @media(max-width:640px){.aa-received-receipts-card{padding:16px}.aa-received-receipts-filters{grid-template-columns:1fr}.aa-received-receipts-table{min-width:650px}}
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
  const formatDateTime = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      hourCycle: 'h23', timeZone: 'America/Sao_Paulo'
    }).format(date).replace(',', ' às');
  };
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
    const statusFilter = byId('aa-recebidos-filtro-status') && byId('aa-recebidos-filtro-status').value;
    const summary = byId('aa-recebidos-resumo');
    if (!tbody) return;

    const rows = visibleProfessionals();
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
      const hasFilters = search || statusFilter;
      showMessage(hasFilters ? 'Nenhum profissional corresponde aos filtros selecionados.' : 'Não há profissionais cadastrados para exibir.', 'empty');
      return;
    }

    showMessage('', '');
    const editable = canManage();
    tbody.innerHTML = rows.map((professional) => {
      const id = String(professional.id);
      const name = String(professional.nomeCompleto || '').trim();
      const value = state.statuses.get(id) || 'pendente';
      const updater = state.updatedBy.get(id) || '';
      const updatedAt = formatDateTime(state.updatedAt.get(id));
      const audit = updater || updatedAt
        ? `<div class="aa-received-receipts-audit"><strong>${escapeHtml(updater || 'Usuário não identificado')}</strong>${updatedAt ? `<small>${escapeHtml(updatedAt)}</small>` : ''}</div>`
        : '—';
      const options = STATUS.map((item) => `<option value="${item.value}"${item.value === value ? ' selected' : ''}>${item.label}</option>`).join('');
      return `<tr><td><strong>${escapeHtml(name)}</strong></td><td><select class="aa-received-receipts-status" data-professional-id="${escapeHtml(id)}" aria-label="Status do recibo de ${escapeHtml(name)}"${editable ? '' : ' disabled'}>${options}</select></td><td>${audit}</td></tr>`;
    }).join('');
  }

  function visibleProfessionals() {
    const search = normalize(byId('aa-recebidos-busca') && byId('aa-recebidos-busca').value);
    const statusFilter = byId('aa-recebidos-filtro-status') && byId('aa-recebidos-filtro-status').value;
    return state.professionals.filter((professional) => {
      const name = String(professional.nomeCompleto || '').trim();
      const status = state.statuses.get(String(professional.id)) || 'pendente';
      return name && normalize(name).includes(search) && (!statusFilter || status === statusFilter);
    });
  }

  async function loadMonth() {
    const monthInput = byId('aa-recebidos-mes');
    const month = monthInput && monthInput.value;
    if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return;

    const request = ++state.request;
    state.month = month;
    state.loading = true;
    state.statuses = new Map();
    state.updatedBy = new Map();
    state.updatedAt = new Map();
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
        .select('profissional_id,competencia,status,updated_by_name,updated_at')
        .eq('competencia', month);
      if (result.error) throw result.error;
      if (request !== state.request) return;

      state.professionals = professionals.filter((item) => item && item.ativo === true && item.id && String(item.nomeCompleto || '').trim());
      state.statuses = new Map((result.data || []).map((row) => [String(row.profissional_id), row.status]));
      state.updatedBy = new Map((result.data || []).filter((row) => row.updated_by_name).map((row) => [String(row.profissional_id), row.updated_by_name]));
      state.updatedAt = new Map((result.data || []).filter((row) => row.updated_at).map((row) => [String(row.profissional_id), row.updated_at]));
      state.loading = false;
      render();
    } catch (error) {
      if (request !== state.request) return;
      state.loading = false;
      state.professionals = [];
      state.statuses = new Map();
      state.updatedBy = new Map();
      state.updatedAt = new Map();
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
      }, { onConflict: 'profissional_id,competencia' }).select('profissional_id,status,updated_by_name,updated_at');
      if (result.error) throw result.error;
      const saved = result.data && result.data[0];
      state.statuses.set(professionalId, saved && saved.status || next);
      const updater = saved && saved.updated_by_name || (byId('aa-rh-session-name') && byId('aa-rh-session-name').textContent.trim()) || auth.data.user.email || '';
      if (updater) state.updatedBy.set(professionalId, updater);
      if (saved && saved.updated_at) state.updatedAt.set(professionalId, saved.updated_at);
      if (typeof window.aaToast === 'function') window.aaToast(`Status de ${professional.nomeCompleto} salvo.`, 'success');
      render();
    } catch (error) {
      select.value = previous;
      select.disabled = false;
      if (typeof window.aaToast === 'function') window.aaToast(error && error.message || 'Não foi possível salvar o status.', 'error');
      console.error('Falha ao salvar status de recibo recebido:', error);
    }
  }

  function statusFromSpreadsheet(value) {
    const key = normalize(value).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
    return ({ enviado: 'enviado', coletado: 'coletado', 'nao enviado': 'nao_enviado', pendente: 'pendente' })[key] || '';
  }

  function exportWorkbook() {
    const xlsx = window.XLSX;
    if (!xlsx) return window.alert('A biblioteca Excel ainda não está disponível. Atualize a página e tente novamente.');
    const professionals = visibleProfessionals();
    if (!professionals.length) return window.alert('Não há profissionais na lista atual para exportar.');
    const rows = [['ID profissional', 'Profissional', 'Competência', 'Status', 'Última atualização por', 'Data e horário']];
    professionals.forEach((professional) => {
      const status = state.statuses.get(String(professional.id)) || 'pendente';
      const label = STATUS.find((item) => item.value === status)?.label || 'Pendente';
      const id = String(professional.id);
      rows.push([id, String(professional.nomeCompleto || ''), state.month, label, state.updatedBy.get(id) || '', formatDateTime(state.updatedAt.get(id))]);
    });
    const sheet = xlsx.utils.aoa_to_sheet(rows);
    sheet['!cols'] = [{ wch: 20 }, { wch: 42 }, { wch: 16 }, { wch: 20 }, { wch: 30 }, { wch: 24 }];
    sheet['!autofilter'] = { ref: `A1:F${rows.length}` };
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, sheet, 'Recibos recebidos');
    xlsx.writeFile(workbook, `recibos-recebidos-${state.month}.xlsx`);
  }

  async function importWorkbook(file) {
    if (!file) return;
    if (!canManage()) throw new Error('Você não tem permissão para importar status.');
    if (!state.month || !state.professionals.length) throw new Error('Carregue a lista do mês antes de importar.');
    const xlsx = window.XLSX;
    if (!xlsx) throw new Error('A biblioteca Excel ainda não está disponível. Atualize a página e tente novamente.');

    const workbook = xlsx.read(await file.arrayBuffer(), { type: 'array', raw: false });
    const sheetName = workbook.SheetNames && workbook.SheetNames[0];
    if (!sheetName) throw new Error('A planilha não contém uma aba para importar.');
    const sheet = workbook.Sheets[sheetName];
    const records = xlsx.utils.sheet_to_json(sheet, { defval: '', raw: false })
      .filter((row) => Object.values(row).some((value) => String(value == null ? '' : value).trim()));
    if (!records.length) throw new Error('A planilha está vazia.');

    const headers = Object.keys(records[0]);
    const headerMap = new Map(headers.map((header) => [normalize(header).replace(/\s+/g, ' '), header]));
    const findHeader = (aliases) => aliases.map((alias) => headerMap.get(alias)).find(Boolean) || '';
    const idColumn = findHeader(['id profissional', 'id do profissional', 'id']);
    const nameColumn = findHeader(['profissional', 'nome do profissional', 'nome']);
    const statusColumn = findHeader(['status']);
    const monthColumn = findHeader(['competencia', 'mes', 'mes de referencia']);
    if ((!idColumn && !nameColumn) || !statusColumn) {
      throw new Error('A planilha deve ter uma coluna Profissional ou ID profissional e uma coluna Status.');
    }

    const byId = new Map(state.professionals.map((professional) => [String(professional.id), professional]));
    const rowsToSave = [];
    const errors = [];
    const seen = new Set();
    records.forEach((record, index) => {
      const line = index + 2;
      const id = idColumn ? String(record[idColumn] || '').trim() : '';
      const name = nameColumn ? String(record[nameColumn] || '').trim() : '';
      const rawStatus = String(record[statusColumn] || '').trim();
      const status = statusFromSpreadsheet(rawStatus);
      const rowMonth = monthColumn ? String(record[monthColumn] || '').trim() : '';
      let professional = id ? byId.get(id) : null;
      if (id && !professional) errors.push(`Linha ${line}: ID de profissional não encontrado ou inativo (${id}).`);
      if (!id && name) {
        const matches = state.professionals.filter((item) => normalize(item.nomeCompleto) === normalize(name));
        if (matches.length === 1) professional = matches[0];
        else if (!matches.length) errors.push(`Linha ${line}: profissional não encontrado ou inativo (${name}).`);
        else errors.push(`Linha ${line}: nome duplicado; use o ID do profissional (${name}).`);
      }
      if (!professional && !id && !name) errors.push(`Linha ${line}: informe o ID ou nome do profissional.`);
      if (!status) errors.push(`Linha ${line}: status inválido (${rawStatus || 'vazio'}).`);
      if (rowMonth && rowMonth !== state.month) errors.push(`Linha ${line}: competência ${rowMonth} difere do mês selecionado (${state.month}).`);
      if (professional && status) {
        const professionalId = String(professional.id);
        if (seen.has(professionalId)) errors.push(`Linha ${line}: profissional repetido na planilha (${professional.nomeCompleto}).`);
        else {
          seen.add(professionalId);
          rowsToSave.push({ professionalId, status });
        }
      }
    });
    if (errors.length) {
      const details = errors.slice(0, 10).join('\n') + (errors.length > 10 ? `\n… e mais ${errors.length - 10} erro(s).` : '');
      throw new Error(`A planilha não foi importada; corrija os problemas antes de salvar:\n${details}`);
    }
    if (!rowsToSave.length) throw new Error('A planilha não contém status válidos para importar.');
    if (!window.confirm(`Importar ${rowsToSave.length} status para ${state.month}?\n\nOs status desses profissionais nesse mês serão substituídos pelos valores da planilha.`)) return;

    const client = db();
    const auth = await client.auth.getUser();
    if (auth.error || !auth.data || !auth.data.user) throw new Error('Sua sessão expirou. Entre novamente no Painel RH.');
    const updatedAt = new Date().toISOString();
    const payload = rowsToSave.map((row) => ({
      profissional_id: row.professionalId,
      competencia: state.month,
      status: row.status,
      updated_by: auth.data.user.id,
      updated_at: updatedAt
    }));
    const result = await client.from(TABLE).upsert(payload, { onConflict: 'profissional_id,competencia' }).select('profissional_id,status,updated_by_name,updated_at');
    if (result.error) throw result.error;
    const savedRows = new Map((result.data || []).map((row) => [String(row.profissional_id), row]));
    const fallbackUpdater = (byId('aa-rh-session-name') && byId('aa-rh-session-name').textContent.trim()) || auth.data.user.email || '';
    rowsToSave.forEach((row) => {
      const saved = savedRows.get(row.professionalId);
      state.statuses.set(row.professionalId, saved && saved.status || row.status);
      const updater = saved && saved.updated_by_name || fallbackUpdater;
      if (updater) state.updatedBy.set(row.professionalId, updater);
      if (saved && saved.updated_at) state.updatedAt.set(row.professionalId, saved.updated_at);
    });
    render();
    if (typeof window.aaToast === 'function') window.aaToast(`${rowsToSave.length} status importados para ${state.month}.`, 'success');
  }

  function initialize() {
    const monthInput = byId('aa-recebidos-mes');
    const searchInput = byId('aa-recebidos-busca');
    const statusInput = byId('aa-recebidos-filtro-status');
    const importButton = byId('aa-recebidos-importar');
    const exportButton = byId('aa-recebidos-exportar');
    const fileInput = byId('aa-recebidos-arquivo');
    const tbody = byId('aa-recebidos-lista');
    if (!monthInput || !searchInput || !statusInput || !importButton || !exportButton || !fileInput || !tbody) return;

    monthInput.value = currentMonth();
    monthInput.addEventListener('change', loadMonth);
    searchInput.addEventListener('input', render);
    statusInput.addEventListener('change', render);
    exportButton.addEventListener('click', exportWorkbook);
    importButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      importButton.disabled = true;
      try {
        await importWorkbook(file);
      } catch (error) {
        window.alert(error && error.message || 'Não foi possível importar a planilha.');
        console.error('Falha ao importar planilha de Recibos recebidos:', error);
      } finally {
        fileInput.value = '';
        importButton.disabled = false;
      }
    });
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
