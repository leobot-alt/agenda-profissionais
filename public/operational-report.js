(function(){
  'use strict';
  const root=document.getElementById('aa-operational-report-app');
  if(!root)return;
  const db=window.__aaSupabaseClient;
  const $=id=>document.getElementById(id);
  const form=$('aa-report-form'),operatorsEl=$('aa-report-operators'),leadershipEl=$('aa-report-leadership'),preview=$('aa-operational-report-preview');
  const layout=$('aa-report-layout'),readonlyBar=$('aa-report-readonly-bar'),savedToggle=$('aa-report-saved-toggle'),operatorRoster=$('aa-report-operator-roster'),rosterFilter=$('aa-report-roster-filter'),rosterCounts=$('aa-report-roster-counts');
  const savedPanel=$('aa-report-saved-panel'),savedList=$('aa-report-saved-list'),statusEl=$('aa-report-status'),pageTitle=$('aa-report-title'),pageSubtitle=$('aa-report-subtitle');
  const saveDialog=$('aa-report-save-dialog'),openDialog=$('aa-report-open-dialog');
  const KDF_ITERATIONS=310000,MAX_REPORT_BYTES=5*1024*1024,MAX_IMAGE_CHARS=4*1024*1024;
  const blank=()=>({setor:'RH Clínico',operacao:'IAMSPE',cargo:'Sub-líder',sublider:'Fernando Martins',periodo:'',psicologos:'',psiquiatras:'',horas:'',meta:'',contratacoes:'',distratos:'',avaliacao:'',implantacao:'',imagem:'',ops:[],leadershipFeedback:[],conclusao:''});
  let state=blank(),activeCreatorId='',unlockReportId='',usersLoadPromise=null,initializingPromise=null,draftDirty=false,reportUsers=[],usersLoaded=false,savedListMode=false,readOnlyReportView=false;

  function allowed(){return typeof window.__aaOperationalReportAllowed==='function'&&window.__aaOperationalReportAllowed()===true;}
  function text(value,max=10000){return String(value==null?'':value).slice(0,max);}
  function esc(value){return text(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
  function number(value){return value===''||value==null?null:Number(value);}
  function fmt(value){return value==null?'—':Number(value).toLocaleString('pt-BR');}
  function setStatus(message,kind='success'){statusEl.textContent=message||'';statusEl.dataset.kind=kind;}
  function openModal(dialog){if(dialog&&typeof dialog.showModal==='function')dialog.showModal();else if(dialog)dialog.setAttribute('open','');}
  function closeModal(dialog){if(dialog&&typeof dialog.close==='function')dialog.close();else if(dialog)dialog.removeAttribute('open');}
  function setBusy(button,busy,label){if(!button)return;button.disabled=!!busy;if(label)button.textContent=busy?'Processando…':label;}
  function updateHeaderMode(){
    if(pageTitle)pageTitle.textContent=savedListMode?'Meus relatórios':readOnlyReportView?'Relatório operacional — visualização':'Gerador de Relatório Operacional';
    if(pageSubtitle)pageSubtitle.textContent=savedListMode?'Acesse somente os relatórios salvos por esta conta.':readOnlyReportView?'Este relatório está em modo somente leitura. Use “Editar relatório” para voltar ao formulário.':'Preencha os dados e acompanhe a prévia. Relatórios salvos ficam criptografados com a senha definida; a senha não é enviada nem armazenada pelo sistema.';
  }
  function setSavedListMode(show){
    savedListMode=!!show;savedPanel.hidden=!savedListMode;layout.hidden=savedListMode;
    root.classList.toggle('aa-report-list-mode',savedListMode);root.classList.toggle('aa-report-readonly-mode',readOnlyReportView&&!savedListMode);
    readonlyBar.hidden=savedListMode||!readOnlyReportView;savedToggle.textContent=savedListMode?'Voltar ao relatório':'Meus relatórios';updateHeaderMode();
  }
  function setReadOnlyMode(show){
    readOnlyReportView=!!show;layout.hidden=savedListMode;
    root.classList.toggle('aa-report-readonly-mode',readOnlyReportView&&!savedListMode);readonlyBar.hidden=savedListMode||!readOnlyReportView;updateHeaderMode();
  }
  const LEADERSHIP_PROFILES=new Set(['administrador','administrador_geral','gestao']);
  function currentUsers(){return reportUsers;}
  function operatorUsers(){return currentUsers().filter(user=>!LEADERSHIP_PROFILES.has(user.profile));}
  function leadershipUsers(){return currentUsers().filter(user=>LEADERSHIP_PROFILES.has(user.profile));}
  async function ensureUsers(){
    if(usersLoaded)return currentUsers();
    if(!usersLoadPromise)usersLoadPromise=(async()=>{
      if(typeof window.__aaGetOperationalReportUsers!=='function')return [];
      const users=await window.__aaGetOperationalReportUsers();
      return Array.isArray(users)?users:[];
    })().catch(error=>{console.warn('Não foi possível carregar os usuários do feedback.',error);return [];});
    try{reportUsers=await usersLoadPromise;usersLoaded=true;return reportUsers;}
    finally{usersLoadPromise=null;}
  }
  function normalizeState(input){
    if(!input||typeof input!=='object'||!Array.isArray(input.ops))throw new Error('Conteúdo inválido.');
    const clean=blank();
    ['setor','operacao','cargo','sublider','periodo','psicologos','psiquiatras','horas','meta','contratacoes','distratos','avaliacao','implantacao','conclusao'].forEach(key=>{clean[key]=text(input[key],key==='avaliacao'||key==='implantacao'||key==='conclusao'?12000:240);});
    clean.imagem=typeof input.imagem==='string'&&input.imagem.length<=MAX_IMAGE_CHARS&&/^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(input.imagem)?input.imagem:'';
    clean.ops=input.ops.slice(0,50).map(item=>({usuarioId:text(item&&item.usuarioId,160),nome:text(item&&item.nome,240),texto:text(item&&item.texto,12000),nps:item&&item.nps!==''&&item.nps!=null&&Number.isInteger(Number(item.nps))&&Number(item.nps)>=0&&Number(item.nps)<=10?String(Number(item.nps)):'',comentario:text(item&&item.comentario,6000)}));
    clean.leadershipFeedback=Array.isArray(input.leadershipFeedback)?input.leadershipFeedback.slice(0,40).map(item=>({usuarioId:text(item&&item.usuarioId,160),nome:text(item&&item.nome,240),role:item&&item.role==='sublideranca'?'sublideranca':'lideranca',texto:text(item&&item.texto,12000)})):[];
    return clean;
  }
  function npsSummary(){
    const scores=state.ops.map(item=>item.nps).filter(value=>value!==''&&value!=null).map(Number);
    if(!scores.length)return null;
    const promoters=scores.filter(score=>score>=9).length,detractors=scores.filter(score=>score<=6).length,total=scores.length,neutrals=total-promoters-detractors;
    return{total,promoters,detractors,neutrals,score:Math.round((promoters-detractors)/total*100),average:scores.reduce((sum,value)=>sum+value,0)/total};
  }
  function optionMarkup(item,users,showProfile=false){
    const selected=String(item.usuarioId||'');
    let html='<option value="">Selecione um usuário cadastrado</option>';
    if(selected&&!users.some(user=>user.id===selected))html+='<option value="'+esc(selected)+'" selected>'+esc(item.nome||'Usuário salvo')+' (cadastro indisponível)</option>';
    html+=users.map(user=>{const detail=showProfile?user.profileLabel:user.username;return '<option value="'+esc(user.id)+'" '+(user.id===selected?'selected':'')+'>'+esc(user.name)+(detail?' · '+esc(detail):'')+'</option>';}).join('');
    return html;
  }
  function renderOperators(){
    const users=operatorUsers();
    if(!state.ops.length){operatorsEl.innerHTML='<p class="aa-report-hint">'+(users.length?'Nenhum operador adicionado ainda. Use “Adicionar operador”.':'Nenhum usuário ativo elegível encontrado no cadastro.')+'</p>';renderFeedbackRoster();return;}
    operatorsEl.innerHTML=state.ops.map((item,index)=>{
      const scoreButtons=Array.from({length:11},(_,score)=>'<button type="button" data-score="'+score+'" data-index="'+index+'" class="'+(String(item.nps)===String(score)?'is-selected':'')+'" aria-pressed="'+(String(item.nps)===String(score))+'" aria-label="Nota '+score+'">'+score+'</button>').join('');
      return '<div class="aa-report-operator" data-operator-card="'+index+'"><div class="aa-report-operator-head"><div><label for="aa-report-user-'+index+'">Nome do usuário cadastrado</label><select id="aa-report-user-'+index+'" data-operator-index="'+index+'" data-operator-field="usuarioId">'+optionMarkup(item,users)+'</select></div><button type="button" class="aa-report-btn aa-report-btn-danger" data-report-action="remove-operator" data-index="'+index+'">Remover</button></div><label for="aa-report-feedback-'+index+'">Feedback do gestor sobre o operador</label><textarea id="aa-report-feedback-'+index+'" data-operator-index="'+index+'" data-operator-field="texto" placeholder="Pontos fortes, entregas e oportunidades de desenvolvimento…">'+esc(item.texto)+'</textarea><label>Nota NPS sobre este operador (0 a 10)</label><div class="aa-report-nps">'+scoreButtons+'</div><label for="aa-report-comment-'+index+'">Comentário do operador (opcional)</label><textarea id="aa-report-comment-'+index+'" data-operator-index="'+index+'" data-operator-field="comentario" style="min-height:56px" placeholder="Comentário informado pelo operador…">'+esc(item.comentario)+'</textarea></div>';
    }).join('');
    renderFeedbackRoster();
  }
  function operatorFeedbackStatus(user){
    const entries=state.ops.filter(item=>item.usuarioId===user.id);
    if(entries.some(item=>String(item.texto||'').trim()&&String(item.nps==null?'':item.nps)!==''))return 'done';
    return entries.length?'progress':'missing';
  }
  function renderFeedbackRoster(){
    if(!operatorRoster)return;
    const users=operatorUsers(),statuses=users.map(user=>({user,status:operatorFeedbackStatus(user)})),completed=statuses.filter(item=>item.status==='done').length;
    if(rosterCounts)rosterCounts.textContent='Concluídos: '+completed+' de '+users.length+' · Pendentes: '+(users.length-completed);
    if(!users.length){operatorRoster.innerHTML='<p class="aa-report-hint">Nenhum usuário ativo elegível para feedback.</p>';return;}
    const filter=rosterFilter?rosterFilter.value:'all',visible=statuses.filter(item=>filter==='all'||(filter==='done'&&item.status==='done')||(filter==='missing'&&item.status!=='done'));
    if(!visible.length){operatorRoster.innerHTML='<p class="aa-report-hint">Nenhum operador nesta categoria.</p>';return;}
    operatorRoster.innerHTML=visible.map(({user,status})=>'<div class="aa-report-roster-row"><span class="aa-report-roster-name">'+esc(user.name)+'</span><span class="aa-report-roster-status is-'+status+'">'+(status==='done'?'Concluído':status==='progress'?'Em andamento':'Falta feedback')+'</span>'+(status==='done'?'':'<button type="button" class="aa-report-btn aa-report-roster-add" data-report-action="start-operator-feedback" data-user-id="'+esc(user.id)+'">'+(status==='progress'?'Continuar':'Adicionar')+'</button>')+'</div>').join('');
  }
  function renderLeadershipFeedback(){
    const users=leadershipUsers();
    if(!state.leadershipFeedback.length){leadershipEl.innerHTML='<p class="aa-report-hint">Nenhum feedback de liderança adicionado. Esta parte é opcional.</p>';return;}
    leadershipEl.innerHTML=state.leadershipFeedback.map((item,index)=>{
      const role= item.role==='sublideranca'?'sublideranca':'lideranca';
      return '<div class="aa-report-operator aa-report-leadership-card"><div class="aa-report-leadership-head"><div><label for="aa-report-leadership-role-'+index+'">Tipo de feedback</label><select id="aa-report-leadership-role-'+index+'" data-leadership-index="'+index+'" data-leadership-field="role"><option value="lideranca" '+(role==='lideranca'?'selected':'')+'>Liderança</option><option value="sublideranca" '+(role==='sublideranca'?'selected':'')+'>Sub-liderança</option></select></div><div><label for="aa-report-leadership-user-'+index+'">Responsável</label><select id="aa-report-leadership-user-'+index+'" data-leadership-index="'+index+'" data-leadership-field="usuarioId">'+optionMarkup(item,users,true)+'</select></div><button type="button" class="aa-report-btn aa-report-btn-danger" data-report-action="remove-leadership-feedback" data-index="'+index+'">Remover</button></div><label for="aa-report-leadership-text-'+index+'">Feedback (opcional)</label><textarea id="aa-report-leadership-text-'+index+'" data-leadership-index="'+index+'" data-leadership-field="texto" placeholder="Observações da liderança ou sub-liderança…">'+esc(item.texto)+'</textarea></div>';
    }).join('');
  }
  function safeImageSource(value){return typeof value==='string'&&value.length<=MAX_IMAGE_CHARS&&/^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(value)?value:'';}
  function renderPreview(){
    const psychologists=number(state.psicologos),psychiatrists=number(state.psiquiatras),total=(psychologists==null&&psychiatrists==null)?null:(psychologists||0)+(psychiatrists||0);
    const kpis=[];const addKpi=(value,label)=>{if(value!=null)kpis.push('<div class="aa-report-kpi"><b>'+fmt(value)+'</b><span>'+label+'</span></div>');};
    addKpi(total,'profissionais ativos');addKpi(psychologists,'psicólogos');addKpi(psychiatrists,'psiquiatras');addKpi(number(state.horas),'horas / mês');addKpi(number(state.meta),'meta de horas');addKpi(number(state.contratacoes),'contratações');addKpi(number(state.distratos),'distratos');
    const meta=number(state.meta),hours=number(state.horas),percentage=(meta&&hours!=null)?Math.round(hours/meta*100):null,summary=npsSummary();
    let html='<img class="aa-report-logo" alt="Somente" src="assets/operational-report-logo-1.png"><h2>RELATÓRIO OPERACIONAL</h2><div class="aa-report-meta"><div><b>Setor:</b> '+esc(state.setor||'—')+'</div><div><b>'+esc(state.cargo||'Sub-líder')+':</b> '+esc(state.sublider||'—')+'</div><div><b>Operações:</b> '+esc(state.operacao||'—')+'</div><div><b>Período:</b> '+esc(state.periodo||'—')+'</div></div><h3>Avaliação Geral</h3>'+(kpis.length?'<div class="aa-report-kpis aa-report-kpis-compact">'+kpis.join('')+'</div>':'')+(percentage!=null?'<p><i>Carga horária em '+percentage+'% da meta.</i></p>':'')+'<p>'+esc(state.avaliacao||'—')+'</p>';
    const image=safeImageSource(state.imagem);
    if(state.implantacao||image)html+='<h3>Implantação</h3><p>'+esc(state.implantacao||'—')+'</p>'+(image?'<img class="aa-report-impl-image" alt="Imagem da implantação" src="'+image+'">':'');
    html+='<h3>Avaliação de Operadores</h3>';
    if(!state.ops.length)html+='<p><i>Nenhum operador adicionado.</i></p>';
    state.ops.forEach(item=>{
      let chip='';if(item.nps!==''){const value=Number(item.nps),category=value>=9?'promotor':value>=7?'neutro':'detrator',color=value>=9?'#1b8a5a':value>=7?'#a67a00':'#c23b4e';chip='<span class="aa-report-chip" style="background:'+color+'">Nota '+esc(value)+' · '+category+'</span>';}
      html+='<div class="aa-report-op-block"><h4>'+esc(item.nome||'Sem nome')+chip+'</h4><p>'+esc(item.texto||'—')+'</p>'+(item.comentario?'<p><i>Comentário do operador: '+esc(item.comentario)+'</i></p>':'');
    });
    if(summary){
      const promoterPct=summary.promoters/summary.total*100,neutralPct=summary.neutrals/summary.total*100,detractorPct=summary.detractors/summary.total*100,color=summary.score>=50?'#1b8a5a':summary.score>=0?'#a67a00':'#c23b4e';
      html+='<h3>NPS dos operadores</h3><div class="aa-report-nps-box"><div><div class="aa-report-nps-big" style="color:'+color+'">'+(summary.score>0?'+':'')+summary.score+'</div><small class="aa-report-nps-small">NPS ('+summary.total+' respostas)</small></div><div style="flex:1;min-width:190px"><div class="aa-report-bar" role="img" aria-label="Promotores '+Math.round(promoterPct)+'%, neutros '+Math.round(neutralPct)+'%, detratores '+Math.round(detractorPct)+'%"><i style="width:'+promoterPct+'%;background:#1b8a5a"></i><i style="width:'+neutralPct+'%;background:#d9a520"></i><i style="width:'+detractorPct+'%;background:#c23b4e"></i></div><small class="aa-report-nps-small" style="margin-top:6px">Promotores '+summary.promoters+' ('+Math.round(promoterPct)+'%) · Neutros '+summary.neutrals+' ('+Math.round(neutralPct)+'%) · Detratores '+summary.detractors+' ('+Math.round(detractorPct)+'%) · Média '+summary.average.toFixed(1).replace('.',',')+'</small></div></div><div class="aa-report-legend"><b>Como ler:</b> a nota de 0 a 10 avalia cada operador individualmente, não a operação.<div><i style="background:#1b8a5a"></i><span><b>Promotor (9–10):</b> referência para a equipe, entrega com consistência e autonomia.</span></div><div><i style="background:#d9a520"></i><span><b>Neutro (7–8):</b> cumpre o esperado, sem destaque.</span></div><div><i style="background:#c23b4e"></i><span><b>Detrator (0–6):</b> abaixo do esperado, com plano de acompanhamento.</span></div><div>NPS = % de promotores − % de detratores, de −100 a +100.</div></div>';
    }
    const leadershipFeedback=state.leadershipFeedback.filter(item=>(item.texto||'').trim());
    if(leadershipFeedback.length){html+='<h3>Feedback da liderança e sub-liderança</h3>';leadershipFeedback.forEach(item=>{const role=item.role==='sublideranca'?'Sub-liderança':'Liderança';html+='<div class="aa-report-op-block"><h4>'+role+(item.nome?' · '+esc(item.nome):'')+'</h4>'+(item.texto?'<p>'+esc(item.texto)+'</p>':'')+'</div>';});}
    html+='<h3>Conclusão</h3><p>'+esc(state.conclusao||'—')+'</p><div class="aa-report-foot">Av. Brigadeiro Faria Lima, 4055, CJ 401. São Paulo/SP - CEP: 04538-133.<img class="aa-report-footer-logo" alt="www.somente.com.br" src="assets/operational-report-logo-2.png"></div>';
    preview.innerHTML=html;
  }
  function renderAll(){
    form.querySelectorAll('[data-report-field]').forEach(element=>{element.value=state[element.dataset.reportField]==null?'':state[element.dataset.reportField];});
    const imageName=$('aa-report-image-name');if(imageName)imageName.textContent=state.imagem?'Imagem anexada à prévia.':'Nenhuma imagem anexada.';
    renderOperators();renderLeadershipFeedback();renderPreview();
  }
  function defaultTitle(){const parts=['Relatório Operacional',state.operacao,state.periodo].filter(Boolean);return parts.join(' — ').slice(0,160);}
  function bytesToBase64(bytes){let binary='';for(let offset=0;offset<bytes.length;offset+=0x4000)binary+=String.fromCharCode(...bytes.subarray(offset,offset+0x4000));return btoa(binary);}
  function base64ToBytes(value){const binary=atob(value),bytes=new Uint8Array(binary.length);for(let index=0;index<binary.length;index++)bytes[index]=binary.charCodeAt(index);return bytes;}
  async function deriveEncryptionKey(password,salt){
    const cryptoApi=window.crypto&&window.crypto.subtle;if(!cryptoApi)throw new Error('Este navegador não oferece criptografia segura.');
    const material=await cryptoApi.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
    return cryptoApi.deriveKey({name:'PBKDF2',salt,iterations:KDF_ITERATIONS,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  async function encryptState(password){
    const serialized=JSON.stringify(state),plain=new TextEncoder().encode(serialized);if(plain.byteLength>MAX_REPORT_BYTES)throw new Error('O relatório é grande demais para salvar. Reduza ou remova a imagem anexada.');
    const salt=window.crypto.getRandomValues(new Uint8Array(16)),iv=window.crypto.getRandomValues(new Uint8Array(12)),key=await deriveEncryptionKey(password,salt),ciphertext=await window.crypto.subtle.encrypt({name:'AES-GCM',iv},key,plain);
    return{version:1,cipher:'AES-GCM-256',kdf:'PBKDF2-SHA-256',iterations:KDF_ITERATIONS,salt:bytesToBase64(salt),iv:bytesToBase64(iv),ciphertext:bytesToBase64(new Uint8Array(ciphertext))};
  }
  async function decryptState(payload,password){
    if(!payload||payload.version!==1||payload.cipher!=='AES-GCM-256'||payload.kdf!=='PBKDF2-SHA-256'||payload.iterations!==KDF_ITERATIONS||typeof payload.salt!=='string'||typeof payload.iv!=='string'||typeof payload.ciphertext!=='string'||payload.ciphertext.length>Math.ceil(MAX_REPORT_BYTES*1.5))throw new Error('Relatório inválido.');
    const salt=base64ToBytes(payload.salt),iv=base64ToBytes(payload.iv);if(salt.length!==16||iv.length!==12)throw new Error('Relatório inválido.');
    const key=await deriveEncryptionKey(password,salt),plain=await window.crypto.subtle.decrypt({name:'AES-GCM',iv},key,base64ToBytes(payload.ciphertext));
    return normalizeState(JSON.parse(new TextDecoder().decode(plain)));
  }
  async function getSignedInUser(){
    if(!db||!db.auth)throw new Error('Conexão segura indisponível. Atualize a página e tente novamente.');
    const result=await db.auth.getUser();if(result.error)throw result.error;if(!result.data||!result.data.user||!result.data.user.id)throw new Error('Sua sessão expirou. Entre novamente.');
    const user=result.data.user;if(activeCreatorId&&activeCreatorId!==user.id)clearDraft();activeCreatorId=user.id;return user;
  }
  function clearDraft(){state=blank();draftDirty=false;readOnlyReportView=false;setSavedListMode(false);setReadOnlyMode(false);renderAll();unlockReportId='';}
  async function saveReport(event){
    event.preventDefault();const submit=$('aa-report-save-submit'),title=$('aa-report-save-title').value.trim(),password=$('aa-report-save-password').value,confirmation=$('aa-report-save-confirm').value,errorEl=$('aa-report-save-error');errorEl.textContent='';
    if(!allowed()){errorEl.textContent='Acesso não autorizado.';return;}
    if(title.length<1||title.length>160){errorEl.textContent='Informe um título de até 160 caracteres.';return;}
    if(password.length<8||password.length>128){errorEl.textContent='Use uma senha com pelo menos 8 caracteres.';return;}
    if(password!==confirmation){errorEl.textContent='As senhas não conferem.';return;}
    setBusy(submit,true,'Salvar criptografado');
    try{
      const user=await getSignedInUser(),encrypted=await encryptState(password);
      const result=await db.from('operational_reports').insert({creator_id:user.id,title,period:text(state.periodo,240),encrypted_payload:encrypted}).select('id,title,period,created_at').single();
      if(result.error)throw result.error;
      closeModal(saveDialog);$('aa-report-save-form').reset();draftDirty=false;setStatus('Relatório salvo criptografado. Somente esta conta e a senha definida conseguem abri-lo.');
      await loadSavedReports();setSavedListMode(true);
    }catch(error){console.error('Falha ao salvar relatório operacional.',error);errorEl.textContent=error&&error.message&&/grande demais|criptografia segura|sessão expirou/.test(error.message)?error.message:'Não foi possível salvar. Verifique a conexão e tente novamente.';}
    finally{setBusy(submit,false,'Salvar com senha');}
  }
  function renderSavedReports(rows){
    if(!rows.length){savedList.innerHTML='<p class="aa-report-hint">Você ainda não tem relatórios salvos.</p>';return;}
    savedList.innerHTML=rows.map(row=>'<div class="aa-report-saved-row"><div><span class="aa-report-saved-title">'+esc(row.title)+'</span><span class="aa-report-saved-meta">'+(row.period?'Período: '+esc(row.period)+' · ':'')+esc(new Date(row.created_at).toLocaleString('pt-BR'))+'</span></div><div class="aa-report-saved-actions"><button type="button" class="aa-report-btn aa-report-btn-primary" data-report-action="open-saved" data-id="'+esc(row.id)+'" data-title="'+esc(row.title)+'">Abrir</button><button type="button" class="aa-report-btn aa-report-btn-danger" data-report-action="delete-saved" data-id="'+esc(row.id)+'">Excluir</button></div></div>').join('');
  }
  async function loadSavedReports(){
    if(!allowed())return;
    try{
      const user=await getSignedInUser(),result=await db.from('operational_reports').select('id,title,period,created_at').eq('creator_id',user.id).order('created_at',{ascending:false}).limit(100);
      if(result.error)throw result.error;renderSavedReports(result.data||[]);
    }catch(error){console.error('Falha ao carregar relatórios salvos.',error);savedList.innerHTML='<p class="aa-report-hint">Não foi possível carregar seus relatórios. Tente novamente.</p>';}
  }
  async function openSavedReport(event){
    event.preventDefault();const submit=$('aa-report-open-submit'),password=$('aa-report-open-password').value,errorEl=$('aa-report-open-error');errorEl.textContent='';
    if(!allowed()){errorEl.textContent='Acesso não autorizado.';return;}
    if(!password){errorEl.textContent='Digite a senha usada ao salvar.';return;}
    setBusy(submit,true,'Abrir relatório');
    try{
      const user=await getSignedInUser(),result=await db.from('operational_reports').select('id,title,period,encrypted_payload').eq('id',unlockReportId).eq('creator_id',user.id).maybeSingle();
      if(result.error)throw result.error;if(!result.data)throw new Error('Relatório indisponível.');
      const restored=await decryptState(result.data.encrypted_payload,password);state=restored;draftDirty=false;renderAll();closeModal(openDialog);$('aa-report-open-form').reset();setSavedListMode(false);setReadOnlyMode(true);setStatus('Relatório aberto em modo somente leitura.');
    }catch(error){console.error('Falha ao abrir relatório operacional.',error);errorEl.textContent='Não foi possível abrir. Confira a senha e tente novamente.';}
    finally{setBusy(submit,false,'Abrir relatório');}
  }
  async function deleteSavedReport(id){
    if(!allowed()||!id||!window.confirm('Excluir definitivamente este relatório salvo?'))return;
    try{const user=await getSignedInUser(),result=await db.from('operational_reports').delete().eq('id',id).eq('creator_id',user.id);if(result.error)throw result.error;setStatus('Relatório excluído.');await loadSavedReports();}
    catch(error){console.error('Falha ao excluir relatório operacional.',error);setStatus('Não foi possível excluir o relatório.', 'error');}
  }
  function addOperator(){state.ops.push({usuarioId:'',nome:'',texto:'',nps:'',comentario:''});draftDirty=true;renderOperators();renderPreview();const last=operatorsEl.querySelector('select:last-of-type');if(last)last.focus();}
  function startOperatorFeedback(userId){
    const user=operatorUsers().find(candidate=>candidate.id===userId);if(!user)return;let index=state.ops.findIndex(item=>item.usuarioId===user.id);
    if(index<0){if(state.ops.length>=50){setStatus('O relatório já atingiu o limite de 50 operadores.','error');return;}state.ops.push({usuarioId:user.id,nome:user.name,texto:'',nps:'',comentario:''});index=state.ops.length-1;draftDirty=true;renderOperators();renderPreview();}
    const card=operatorsEl.querySelector('[data-operator-card="'+index+'"]');if(card){card.scrollIntoView({behavior:'smooth',block:'center'});const field=card.querySelector('textarea');if(field)field.focus();}
  }
  function addLeadershipFeedback(role){state.leadershipFeedback.push({usuarioId:'',nome:'',role:role==='sublideranca'?'sublideranca':'lideranca',texto:''});draftDirty=true;renderLeadershipFeedback();const selects=leadershipEl.querySelectorAll('[data-leadership-field="usuarioId"]');if(selects.length)selects[selects.length-1].focus();}
  function resetReport(){if(!window.confirm('Começar um novo relatório? Os operadores e responsáveis permanecem selecionados, mas os feedbacks, notas e indicadores serão limpos.'))return;const old=state.ops.map(item=>({usuarioId:item.usuarioId,nome:item.nome,texto:'',nps:'',comentario:''})),oldLeadership=state.leadershipFeedback.map(item=>({...item,texto:''}));state=blank();state.ops=old;state.leadershipFeedback=oldLeadership;draftDirty=false;renderAll();setStatus('Novo relatório iniciado.');}
  async function initialize(){
    if(!allowed())return;
    if(initializingPromise)return initializingPromise;
    initializingPromise=(async()=>{try{await getSignedInUser();await ensureUsers();renderOperators();await loadSavedReports();}catch(error){console.warn('Inicialização do relatório operacional incompleta.',error);}finally{initializingPromise=null;}})();
    return initializingPromise;
  }

  form.addEventListener('input',event=>{
    const field=event.target.closest('[data-report-field]');if(field){state[field.dataset.reportField]=field.value;draftDirty=true;renderPreview();return;}
    const operator=event.target.closest('[data-operator-field]');if(operator){const index=Number(operator.dataset.operatorIndex),item=state.ops[index];if(!item)return;item[operator.dataset.operatorField]=operator.value;draftDirty=true;renderFeedbackRoster();renderPreview();}
    const leadership=event.target.closest('[data-leadership-field="texto"]');if(leadership){const item=state.leadershipFeedback[Number(leadership.dataset.leadershipIndex)];if(!item)return;item.texto=leadership.value;draftDirty=true;renderPreview();}
  });
  form.addEventListener('change',event=>{
    const field=event.target.closest('[data-report-field]');if(field){state[field.dataset.reportField]=field.value;draftDirty=true;renderPreview();return;}
    const select=event.target.closest('[data-operator-field="usuarioId"]');if(select){const item=state.ops[Number(select.dataset.operatorIndex)];if(!item)return;item.usuarioId=select.value;draftDirty=true;const user=operatorUsers().find(candidate=>candidate.id===select.value);item.nome=user?user.name:(select.value?item.nome:'');renderFeedbackRoster();renderPreview();return;}
    const leadership=event.target.closest('[data-leadership-field]');if(!leadership)return;const item=state.leadershipFeedback[Number(leadership.dataset.leadershipIndex)];if(!item)return;
    if(leadership.dataset.leadershipField==='usuarioId'){item.usuarioId=leadership.value;const user=leadershipUsers().find(candidate=>candidate.id===leadership.value);item.nome=user?user.name:(leadership.value?item.nome:'');}
    else if(leadership.dataset.leadershipField==='role')item.role=leadership.value==='sublideranca'?'sublideranca':'lideranca';
    draftDirty=true;renderPreview();
  });
  root.addEventListener('click',event=>{
    const score=event.target.closest('[data-score]');if(score){const item=state.ops[Number(score.dataset.index)];if(!item)return;item.nps=String(item.nps)===score.dataset.score?'':score.dataset.score;draftDirty=true;renderOperators();renderPreview();return;}
    const button=event.target.closest('[data-report-action]');if(!button)return;
    const action=button.dataset.reportAction;
    if(action==='add-operator'){addOperator();return;}
    if(action==='start-operator-feedback'){startOperatorFeedback(button.dataset.userId||'');return;}
    if(action==='add-leadership'){addLeadershipFeedback(button.dataset.role);return;}
    if(action==='remove-leadership-feedback'){const index=Number(button.dataset.index);if(window.confirm('Remover este feedback da liderança?')){state.leadershipFeedback.splice(index,1);draftDirty=true;renderLeadershipFeedback();renderPreview();}return;}
    if(action==='remove-operator'){const index=Number(button.dataset.index);if(window.confirm('Remover este operador do relatório?')){state.ops.splice(index,1);draftDirty=true;renderOperators();renderPreview();}return;}
    if(action==='open-saved'){if(draftDirty&&!window.confirm('Abrir um relatório salvo substituirá as alterações não salvas nesta tela. Deseja continuar?'))return;unlockReportId=button.dataset.id||'';$('aa-report-open-title').textContent=button.dataset.title||'Relatório salvo';$('aa-report-open-error').textContent='';$('aa-report-open-form').reset();openModal(openDialog);setTimeout(()=>$('aa-report-open-password').focus(),0);return;}
    if(action==='delete-saved'){deleteSavedReport(button.dataset.id);return;}
    if(action==='remove-image'){state.imagem='';draftDirty=true;const input=$('aa-report-image');if(input)input.value='';renderAll();return;}
  });
  $('aa-report-image').addEventListener('change',event=>{
    const file=event.target.files&&event.target.files[0];if(!file)return;
    if(!file.type.startsWith('image/')){setStatus('Selecione um arquivo de imagem.','error');event.target.value='';return;}
    if(file.size>2*1024*1024){setStatus('A imagem precisa ter no máximo 2 MB para manter o relatório leve.','error');event.target.value='';return;}
    const reader=new FileReader();reader.onload=()=>{state.imagem=String(reader.result||'');draftDirty=true;renderAll();setStatus('Imagem adicionada à prévia.');};reader.onerror=()=>setStatus('Não foi possível ler a imagem.','error');reader.readAsDataURL(file);
  });
  $('aa-report-save').addEventListener('click',()=>{if(!allowed()){setStatus('Acesso não autorizado.','error');return;}$('aa-report-save-title').value=defaultTitle();$('aa-report-save-error').textContent='';$('aa-report-save-form').reset();$('aa-report-save-title').value=defaultTitle();openModal(saveDialog);setTimeout(()=>$('aa-report-save-password').focus(),0);});
  $('aa-report-save-form').addEventListener('submit',saveReport);
  $('aa-report-open-form').addEventListener('submit',openSavedReport);
  savedToggle.addEventListener('click',async()=>{const showList=!savedListMode;setSavedListMode(showList);if(showList){await loadSavedReports();setSavedListMode(true);}});
  $('aa-report-edit-open').addEventListener('click',()=>{setReadOnlyMode(false);setStatus('Modo de edição. As alterações não serão gravadas até salvar uma nova cópia.');});
  rosterFilter.addEventListener('change',renderFeedbackRoster);
  $('aa-report-pdf').addEventListener('click',()=>{if(!allowed())return;window.print();});
  $('aa-report-new').addEventListener('click',resetReport);
  $('aa-report-close-save').addEventListener('click',()=>closeModal(saveDialog));
  $('aa-report-close-open').addEventListener('click',()=>closeModal(openDialog));
  $('aa-report-save-password').addEventListener('input',()=>$('aa-report-save-error').textContent='');
  $('aa-report-save-confirm').addEventListener('input',()=>$('aa-report-save-error').textContent='');
  $('aa-report-open-password').addEventListener('input',()=>$('aa-report-open-error').textContent='');
  renderAll();
  window.aaOperationalReportInit=initialize;
  window.aaClearOperationalReportDraft=clearDraft;
  if(db&&db.auth&&typeof db.auth.onAuthStateChange==='function')db.auth.onAuthStateChange((event,session)=>{
    const nextId=session&&session.user?session.user.id:'';
    if(event==='SIGNED_OUT'||(activeCreatorId&&nextId&&activeCreatorId!==nextId)){clearDraft();activeCreatorId=nextId||'';reportUsers=[];usersLoaded=false;usersLoadPromise=null;}
  });
})();
