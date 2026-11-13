(function () {
  'use strict';

  const db = window.__aaSupabaseClient;
  const panelId = 'aa-rhtab-diario-lideranca';
  const route = '#/painel/diario-lideranca';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const currentMonth = () => new Date().toISOString().slice(0, 7);
  const monthDefaultDate = month => { const today = new Date().toISOString().slice(0, 10); return today.startsWith(month) ? today : `${month}-01`; };
  const allowed = () => {
    return typeof window.__aaIsLeadershipDiaryAdmin === 'function' && window.__aaIsLeadershipDiaryAdmin() === true;
  };
  const state = { leaders: [], leaderId: '', month: currentMonth(), busy: false };
  const panel = () => document.getElementById(panelId);
  const value = id => document.getElementById(id)?.value || '';
  const notice = (text, kind = 'info') => {
    const node = document.getElementById('aa-dl-message');
    if (node) { node.textContent = text; node.dataset.kind = kind; node.hidden = !text; }
  };
  const identity = async () => {
    const result = await db.auth.getUser();
    if (result.error) throw result.error;
    if (!result.data?.user?.id) throw new Error('Sua sessão expirou. Entre novamente para continuar.');
    return result.data.user.id;
  };
  const renderLeaders = () => {
    const select = document.getElementById('aa-dl-leader');
    const list = document.getElementById('aa-dl-leader-list');
    if (!select || !list) return;
    if (state.leaderId && !state.leaders.some(item => item.id === state.leaderId)) state.leaderId = '';
    select.innerHTML = '<option value="">Selecione uma liderança</option>' + state.leaders.map(item => `<option value="${esc(item.id)}" ${item.id === state.leaderId ? 'selected' : ''}>${esc(item.name)}</option>`).join('');
    list.innerHTML = state.leaders.length ? state.leaders.map(item => `<button class="aa-dl-leader-chip ${item.id === state.leaderId ? 'selected' : ''}" type="button" data-leader-id="${esc(item.id)}">${esc(item.name)}<span aria-hidden="true">›</span></button>`).join('') : '<p class="aa-dl-empty">Ainda não há subpáginas. Cadastre o nome de uma liderança acima.</p>';
    list.querySelectorAll('[data-leader-id]').forEach(button => button.addEventListener('click', () => { state.leaderId = button.dataset.leaderId; renderLeaders(); loadActivities(); }));
  };
  const loadLeaders = async () => {
    const { data, error } = await db.from('leadership_diary_leaders').select('id,name').order('name', { ascending: true }).limit(500);
    if (error) throw error;
    state.leaders = data || [];
    renderLeaders();
  };
  const statusLabel = status => ({pendente:'Pendente', feito:'Feito', cancelado:'Cancelado'}[status] || 'Pendente');
  const loadActivities = async () => {
    const list = document.getElementById('aa-dl-activities');
    const summary = document.getElementById('aa-dl-summary');
    if (!list || !state.leaderId) { if (list) list.innerHTML = '<p class="aa-dl-empty">Escolha uma liderança para visualizar as atividades do mês.</p>'; if (summary) summary.textContent = ''; return; }
    list.innerHTML = '<p class="aa-dl-empty">Carregando atividades…</p>';
    const start = `${state.month}-01`;
    const [year, month] = state.month.split('-').map(Number);
    const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    const { data, error } = await db.from('leadership_diary_activities').select('id,activity,activity_date,status').eq('leader_id', state.leaderId).gte('activity_date', start).lte('activity_date', end).order('activity_date', { ascending: true }).limit(500);
    if (error) throw error;
    const rows = data || [];
    const counts = rows.reduce((acc, row) => (acc[row.status] = (acc[row.status] || 0) + 1, acc), {});
    if (summary) summary.textContent = `${rows.length} atividade${rows.length === 1 ? '' : 's'} · ${counts.pendente || 0} pendentes · ${counts.feito || 0} feitas · ${counts.cancelado || 0} canceladas`;
    list.innerHTML = rows.length ? rows.map(row => `<article class="aa-dl-activity" data-id="${esc(row.id)}"><div class="aa-dl-activity-copy"><span class="aa-dl-date">${new Date(`${row.activity_date}T12:00:00`).toLocaleDateString('pt-BR')}</span><p>${esc(row.activity)}</p></div><label class="aa-dl-status-label">Status<select class="aa-dl-status" aria-label="Status da atividade">${['pendente','feito','cancelado'].map(s => `<option value="${s}" ${row.status === s ? 'selected' : ''}>${statusLabel(s)}</option>`).join('')}</select></label></article>`).join('') : '<p class="aa-dl-empty">Nenhuma atividade registrada para esta liderança neste mês.</p>';
    list.querySelectorAll('.aa-dl-activity').forEach(card => {
      const id = card.dataset.id;
      card.querySelector('.aa-dl-status').addEventListener('change', async event => {
        try { const updatedBy = await identity(); const { error } = await db.from('leadership_diary_activities').update({status:event.target.value,updated_by:updatedBy}).eq('id',id); if (error) throw error; notice('Status atualizado.', 'success'); await loadActivities(); }
        catch (error) { notice(`Não foi possível atualizar o status: ${error.message}`, 'error'); }
      });

    });
  };
  const initialize = async () => {
    if (!allowed()) { notice('Acesso restrito aos perfis Administrador e Administrador geral.', 'error'); return; }
    if (!db) { notice('Não foi possível conectar ao banco de dados.', 'error'); return; }
    if (!panel()?.dataset.ready) {
      panel().dataset.ready = 'true';
      document.getElementById('aa-dl-month').value = state.month;
      document.getElementById('aa-dl-month').addEventListener('change', async event => { state.month = event.target.value || currentMonth(); document.getElementById('aa-dl-date').value = monthDefaultDate(state.month); try { await loadActivities(); } catch (error) { notice(`Erro ao carregar atividades: ${error.message}`, 'error'); } });
      document.getElementById('aa-dl-leader').addEventListener('change', async event => { state.leaderId = event.target.value; renderLeaders(); try { await loadActivities(); } catch (error) { notice(`Erro ao carregar atividades: ${error.message}`, 'error'); } });
      document.getElementById('aa-dl-add-leader').addEventListener('submit', async event => {
        event.preventDefault(); const name = value('aa-dl-new-leader').trim(); if (!name) return;
        try { const createdBy = await identity(); const { data, error } = await db.from('leadership_diary_leaders').insert({name,created_by:createdBy}).select('id,name').single(); if (error) throw error; state.leaders.push(data); state.leaders.sort((a,b) => a.name.localeCompare(b.name,'pt-BR')); state.leaderId = data.id; event.target.reset(); renderLeaders(); notice('Subpágina criada.', 'success'); await loadActivities(); }
        catch (error) { notice(error.code === '23505' ? 'Já existe uma subpágina com esse nome.' : `Não foi possível criar a subpágina: ${error.message}`, 'error'); }
      });
      document.getElementById('aa-dl-add-activity').addEventListener('submit', async event => {
        event.preventDefault(); if (!state.leaderId) { notice('Selecione uma liderança antes de registrar a atividade.', 'error'); return; }
        const activity = value('aa-dl-activity').trim(), activityDate = value('aa-dl-date'), status = value('aa-dl-new-status');
        if (!activity || !activityDate) return;
        if (activityDate.slice(0, 7) !== state.month) { notice('A data da atividade precisa estar dentro do mês selecionado.', 'error'); return; }
        try { const userId = await identity(); const { error } = await db.from('leadership_diary_activities').insert({leader_id:state.leaderId,activity,activity_date:activityDate,status,created_by:userId,updated_by:userId}); if (error) throw error; event.target.reset(); document.getElementById('aa-dl-date').value = `${state.month}-${new Date(Date.UTC(...state.month.split('-').map(Number),0)).getUTCDate().toString().padStart(2,'0')}`; notice('Atividade registrada.', 'success'); await loadActivities(); }
        catch (error) { notice(`Não foi possível registrar a atividade: ${error.message}`, 'error'); }
      });
      document.getElementById('aa-dl-date').value = monthDefaultDate(state.month);
    }
    try { notice(''); await loadLeaders(); await loadActivities(); }
    catch (error) { notice(`Não foi possível carregar o Diário Liderança: ${error.message}`, 'error'); }
  };
  const show = async () => {
    if (!allowed()) { const first = window.aaFirstAllowedRHTab?.(); if (first) window.aaSwitchRHTab(first); window.alert('Acesso ao Diário Liderança restrito aos perfis Administrador e Administrador geral.'); return; }
    const el = panel(), mount = document.getElementById('aa-rh-page-mount'), cache = document.getElementById('aa-rh-page-cache');
    if (!el || !mount) return;
    document.querySelectorAll('#aa-rh-authed-content .aa-rh-subpanel').forEach(item => { item.hidden = true; item.style.display = 'none'; });
    if (cache && el.parentElement !== cache) cache.appendChild(el);
    mount.appendChild(el); el.hidden = false; el.style.display = 'block';
    document.querySelectorAll('[data-rhtab]').forEach(button => button.classList.toggle('active', button.dataset.rhtab === 'diario-lideranca'));
    if (location.hash !== route) history.replaceState(null, '', route);
    await initialize();
  };
  const navButton = document.querySelector('[data-rhtab="diario-lideranca"]');
  if (navButton) {
    navButton.removeAttribute('onclick');
    navButton.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); show().catch(error => { console.error('Falha ao abrir o Diário Liderança.', error); notice(`Não foi possível abrir a tela: ${error.message}`, 'error'); }); });
  }
  const previousSwitch = window.aaSwitchRHTab;
  window.aaSwitchRHTab = function (tab) {
    if (tab === 'diario-lideranca') { show(); return; }
    const el = panel(); if (el) { el.hidden = true; el.style.display = 'none'; }
    return previousSwitch.apply(this, arguments);
  };
  const previousApply = window.aaApplyRHPermissionsUI;
  window.aaApplyRHPermissionsUI = function () {
    if (typeof previousApply === 'function') previousApply.apply(this, arguments);
    const button = document.querySelector('[data-rhtab="diario-lideranca"]');
    if (button) button.style.display = allowed() ? '' : 'none';
    if (!allowed() && location.hash.toLowerCase() === route) { const first = window.aaFirstAllowedRHTab?.(); if (first) window.aaSwitchRHTab(first); }
  };
  const previousHashApply = window.aaApplyHashRoute;
  if (typeof previousHashApply === 'function') {
    window.addEventListener('hashchange', () => { if (location.hash.toLowerCase() === route) window.aaSwitchRHTab('diario-lideranca'); });
  }
  window.addEventListener('load', () => window.aaApplyRHPermissionsUI?.());
  window.aaLeadershipDiaryShow = show;
})();
