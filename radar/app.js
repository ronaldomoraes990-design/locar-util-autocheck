const SUPABASE_URL='https://qfiunsqjkkxuetmyzmdw.supabase.co';
const SUPABASE_KEY='sb_publishable_dlBACJeZVFwZ7UcGGRfDPA_8n8_ivRW';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
let currentUser=null,currentProfile=null,lastResults=[],crmLeads=[];
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));
const fmtStatus=s=>({novo:'Novo',pesquisando:'Pesquisando',contatar:'Contatar',abordado:'Abordado',follow_up:'Follow-up',proposta:'Proposta',ganho:'Ganho',perdido:'Perdido',descartado:'Descartado'}[s]||s);
const fmtEnrichment=s=>({pendente:'Pendente',investigando:'Investigando',concluido:'Investigado',falhou:'Falhou'}[s]||s||'Pendente');
const fmtWeb=s=>({pendente:'Web pendente',pesquisando:'Pesquisando web',concluido:'Web pesquisada',parcial:'Web parcial',sem_resultados:'Web sem resultados',nao_configurado:'Web aguardando provedor'}[s]||s||'Web pendente');
function toast(msg){const t=$('toast');t.textContent=msg;t.hidden=false;clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>t.hidden=true,4800)}
function setLoginMode(logged){$('loginView').hidden=logged;$('appView').hidden=!logged}
function hrefUrl(v){if(!v)return'';return /^https?:\/\//i.test(v)?v:'https://'+v}
function waNumber(phone){const n=String(phone||'').replace(/\D/g,'');return n.startsWith('55')?n:'55'+n}
function sortCRM(){crmLeads.sort((a,b)=>(Number(Boolean(b.hot_opportunity))-Number(Boolean(a.hot_opportunity)))||(Number(b.intent_score)||0)-(Number(a.intent_score)||0)||(Number(b.score)||0)-(Number(a.score)||0)||String(b.updated_at||'').localeCompare(String(a.updated_at||'')))}

async function init(){const {data:{session}}=await db.auth.getSession();if(!session){setLoginMode(false);return}await acceptSession(session)}
async function acceptSession(session){currentUser=session.user;const {data:profile,error}=await db.from('app_users').select('id,nome,perfil,ativo').eq('id',session.user.id).maybeSingle();if(error||!profile?.ativo){await db.auth.signOut();$('loginMsg').textContent='Usuário não autorizado ou inativo.';setLoginMode(false);return}currentProfile=profile;$('userName').textContent=`${profile.nome} · ${profile.perfil}`;setLoginMode(true);await loadCRM()}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();$('loginMsg').textContent='Entrando...';const {data,error}=await db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error){$('loginMsg').textContent='Não foi possível entrar: '+error.message;return}await acceptSession(data.session)});
$('logoutBtn').addEventListener('click',async()=>{await db.auth.signOut();location.reload()});

$('searchForm').addEventListener('submit',async e=>{e.preventDefault();await runSearch()});
async function runSearch(){
  const btn=$('searchBtn'),location=$('location').value.trim(),segment=$('segment').value,radiusKm=Number($('radius').value),limit=Number($('limit').value);
  if(!location)return;
  btn.disabled=true;btn.textContent='Pesquisando...';$('searchMsg').textContent='Consultando fontes públicas e qualificando as empresas encontradas.';
  try{
    const {data,error}=await db.functions.invoke('radar-search',{body:{location,segment,radiusKm,limit}});
    if(error)throw error;if(data?.error)throw new Error(data.error);
    lastResults=data?.results||[];renderResults(lastResults,data);
    await db.from('radar_searches').insert({location,segment,radius_km:radiusKm,results_count:lastResults.length,query_payload:{limit,source:data?.source||'web'}});
    $('searchMsg').textContent=`${lastResults.length} empresas encontradas. Salve um prospect para investigar e medir intenção de compra.`;
  }catch(err){console.error(err);$('searchMsg').textContent='Falha na pesquisa: '+(err.message||err);toast('Não foi possível concluir a pesquisa.')}
  finally{btn.disabled=false;btn.textContent='🔎 Pesquisar empresas'}
}

function contactCell(r){
  const bits=[];
  if(r.phone)bits.push(`<a class="pill" target="_blank" rel="noopener" href="https://wa.me/${waNumber(r.phone)}">WhatsApp</a>`);
  if(r.email)bits.push(`<a class="pill" href="mailto:${esc(r.email)}">E-mail</a>`);
  if(r.website)bits.push(`<a class="pill" target="_blank" rel="noopener" href="${esc(hrefUrl(r.website))}">Site</a>`);
  if(r.source_url)bits.push(`<a class="pill" target="_blank" rel="noopener" href="${esc(r.source_url)}">Fonte</a>`);
  return bits.join('');
}
function renderResults(rows,data){
  $('resultsPanel').hidden=false;
  $('resultMeta').textContent=`${rows.length} resultados · fonte ${data?.source||'pública'} · ordenados por potencial comercial`;
  const body=$('resultsBody');
  body.innerHTML=rows.map((r,i)=>`<tr>
    <td><span class="score grade-${r.grade}">${r.score}</span><span class="sub">Lead ${r.grade}</span></td>
    <td><span class="company">${esc(r.company_name)}</span><span class="sub">${esc(r.city||'')} ${r.distance_km!=null?'· '+r.distance_km+' km':''}</span></td>
    <td>${esc(r.evidence)}<span class="sub">${esc(r.address||'')}</span></td>
    <td>${esc(r.recommended_product||'')}</td>
    <td><div class="contact-links">${contactCell(r)}</div></td>
    <td><button class="mini accent" data-save="${i}">Salvar + investigar</button><button class="mini" data-copy="${i}">Copiar abordagem</button></td>
  </tr>`).join('')||`<tr><td colspan="6">Nenhuma empresa foi encontrada com os filtros atuais.</td></tr>`;
  body.querySelectorAll('[data-save]').forEach(b=>b.onclick=async()=>{b.disabled=true;b.textContent='Investigando...';await saveLead(lastResults[Number(b.dataset.save)],false,true);b.textContent='Salvar + investigar';b.disabled=false});
  body.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>copyText(lastResults[Number(b.dataset.copy)]?.approach_message||''));
}
function leadPayload(r){return {company_name:r.company_name,city:r.city||null,state:r.state||null,address:r.address||null,segment:r.segment||$('segment').value,website:r.website||null,phone:r.phone||null,email:r.email||null,source_type:r.source_type||'web',source_id:r.source_id||null,source_url:r.source_url||null,evidence:r.evidence||null,score:r.score||0,initial_score:r.score||0,grade:r.grade||'C',recommended_product:r.recommended_product||null,approach_message:r.approach_message||null,status:'novo',enrichment_status:'pendente',web_search_status:'pendente',latitude:r.latitude||null,longitude:r.longitude||null,raw_data:r.raw_data||{}}}
async function findExistingLead(r){try{let q=db.from('radar_leads').select('*');if(r.source_id)q=q.eq('source_type',r.source_type||'web').eq('source_id',r.source_id);else{q=q.eq('company_name',r.company_name);if(r.city)q=q.eq('city',r.city)}const {data}=await q.limit(1).maybeSingle();return data||null}catch{return null}}
async function saveLead(r,silent=false,autoEnrich=true){
  if(!r)return null;let saved=null;
  const {data,error}=await db.from('radar_leads').insert(leadPayload(r)).select('*').single();
  if(error){if(error.code==='23505'){saved=await findExistingLead(r);if(!silent)toast(saved?'Prospect já estava no CRM. Vou atualizar a investigação.':'Esse prospect já está salvo no CRM.')}else{if(!silent)toast('Erro ao salvar: '+error.message);return null}}else saved=data;
  if(!saved)return null;
  const idx=crmLeads.findIndex(x=>x.id===saved.id);if(idx>=0)crmLeads[idx]=saved;else crmLeads.push(saved);sortCRM();renderCRM();updateKpis();
  if(autoEnrich){if(!silent)toast('Prospect salvo. Investigação + radar de intenção iniciados...');await enrichLead(saved.id,silent)}else if(!silent)toast('Prospect salvo no CRM.');
  return saved;
}

$('saveQualifiedBtn').onclick=async()=>{
  const btn=$('saveQualifiedBtn'),items=lastResults.filter(r=>r.grade==='A'||r.grade==='B').sort((a,b)=>b.score-a.score);
  if(!items.length){toast('Não há leads A/B nesta pesquisa.');return}
  btn.disabled=true;btn.textContent='Salvando leads...';
  const saved=[];let n=0;for(const r of items){const x=await saveLead(r,true,false);if(x){saved.push(x);n++}}
  const top=[...new Map(saved.map(x=>[x.id,x])).values()].sort((a,b)=>b.score-a.score).slice(0,5);
  btn.textContent='Investigando melhores...';for(let i=0;i<top.length;i+=2)await Promise.allSettled(top.slice(i,i+2).map(x=>enrichLead(x.id,true)));
  btn.disabled=false;btn.textContent='Salvar A/B + investigar melhores';await loadCRM();toast(`${n} leads A/B salvos. ${top.length} melhores passaram pelo radar de intenção.`);
};
async function copyText(t){if(!t)return;try{await navigator.clipboard.writeText(t);toast('Conteúdo copiado.')}catch{prompt('Copie o conteúdo:',t)}}

async function enrichLead(id,silent=false){
  const local=crmLeads.find(x=>x.id===id);if(local){local.enrichment_status='investigando';local.web_search_status='pesquisando';local.investigation_error=null;renderCRM()}
  let siteError=null,webError=null,siteData=null,intentData=null,updated=null;
  try{
    const {data,error}=await db.functions.invoke('radar-enrich',{body:{leadId:id}});
    if(error)throw error;if(data?.error)throw new Error(data.detail||data.error);siteData=data;updated=data?.lead||updated;
  }catch(err){console.error('radar-enrich',err);siteError=err?.message||String(err)}
  try{
    const {data,error}=await db.functions.invoke('radar-web-intent',{body:{leadId:id}});
    if(error)throw error;if(data?.error)throw new Error(data.detail||data.error);intentData=data;updated=data?.lead||updated;
  }catch(err){console.error('radar-web-intent',err);webError=err?.message||String(err)}
  if(updated){const i=crmLeads.findIndex(x=>x.id===id);if(i>=0)crmLeads[i]=updated;else crmLeads.push(updated);sortCRM();renderCRM();updateKpis()}
  if(siteError&&webError){await db.from('radar_leads').update({enrichment_status:'falhou',investigation_error:`Site: ${siteError} | Web: ${webError}`,updated_at:new Date().toISOString()}).eq('id',id);if(!silent)toast('A investigação não pôde ser concluída.');return null}
  if(!silent){
    const intent=intentData?.intent;
    if(intent?.hot_opportunity)toast(`🔥 Oportunidade Quente · intenção ${intent.score}/100 · score comercial ${updated?.score??''}`);
    else if(intentData?.setup_required)toast(`Investigação concluída · intenção ${intent?.score??0}/100. Busca geral da web aguarda configuração do provedor.`);
    else if(intent)toast(`Investigação concluída · intenção de compra ${intent.score}/100${intent.commercial_delta?` · score +${intent.commercial_delta}`:''}.`);
    else toast(`Investigação concluída${siteData?.investigation?.delta>0?` · score +${siteData.investigation.delta}`:''}.`);
  }
  return updated||null;
}

async function loadCRM(){const {data,error}=await db.from('radar_leads').select('*').order('hot_opportunity',{ascending:false}).order('intent_score',{ascending:false}).order('score',{ascending:false}).order('updated_at',{ascending:false}).limit(500);if(error){console.error(error);toast('Não foi possível carregar o CRM.');return}crmLeads=data||[];sortCRM();renderCRM();updateKpis()}
function updateKpis(){$('kpiTotal').textContent=crmLeads.length;$('kpiHot').textContent=crmLeads.filter(x=>x.hot_opportunity).length;$('kpiA').textContent=crmLeads.filter(x=>x.grade==='A').length;$('kpiB').textContent=crmLeads.filter(x=>x.grade==='B').length;$('kpiEnriched').textContent=crmLeads.filter(x=>x.enrichment_status==='concluido').length;$('kpiFollow').textContent=crmLeads.filter(x=>x.status==='follow_up').length}
$('statusFilter').onchange=renderCRM;$('intentFilter').onchange=renderCRM;
function intentBadge(r){
  const score=Number(r.intent_score||0),level=r.intent_level||'frio';
  if(r.hot_opportunity)return `<span class="intent-badge hot">🔥 Oportunidade Quente · ${score}/100</span>`;
  if(level==='aquecendo')return `<span class="intent-badge warm">Intenção aquecendo · ${score}/100</span>`;
  return `<span class="intent-badge cold">Intenção ${score}/100</span>`;
}
function enrichmentCell(r){
  const status=r.enrichment_status||'pendente',delta=Number(r.enrichment_score_delta||0),statusClass=status==='concluido'?'ok':status==='investigando'?'working':status==='falhou'?'fail':'pending';
  const badge=`<span class="research-badge ${statusClass}">${esc(fmtEnrichment(status))}${status==='concluido'&&delta>0?` · +${delta} pts`:''}</span>`;
  const web=`<span class="web-badge ${r.web_search_status==='concluido'?'ok':r.web_search_status==='pesquisando'?'working':r.web_search_status==='nao_configurado'?'pending':'neutral'}">${esc(fmtWeb(r.web_search_status))}</span>`;
  const purchasing=r.purchasing_contact&&typeof r.purchasing_contact==='object'?r.purchasing_contact:{},contact=purchasing.email?`<span class="research-contact">🛒 ${esc(purchasing.email)}</span>`:'';
  const summary=r.research_summary?`<span class="research-summary">${esc(r.research_summary)}</span>`:status==='falhou'?`<span class="research-summary error-text">${esc(r.investigation_error||'Falha na investigação')}</span>`:'<span class="research-summary muted">Aguardando investigação.</span>';
  const counts=[];if(Array.isArray(r.operation_signals)&&r.operation_signals.length)counts.push(`${r.operation_signals.length} operacionais`);if(Array.isArray(r.expansion_signals)&&r.expansion_signals.length)counts.push(`${r.expansion_signals.length} expansão`);if(Array.isArray(r.job_signals)&&r.job_signals.length)counts.push(`${r.job_signals.length} vagas`);if(Array.isArray(r.web_search_sources)&&r.web_search_sources.length)counts.push(`${r.web_search_sources.length} web`);
  const meta=counts.length?`<span class="sub">${esc(counts.join(' · '))}</span>`:'';
  return `<div class="research-cell">${intentBadge(r)}<div class="research-badges">${badge}${web}</div>${contact}${summary}${meta}</div>`;
}
function renderCRM(){
  const status=$('statusFilter').value,intent=$('intentFilter').value;let rows=[...crmLeads];if(status)rows=rows.filter(x=>x.status===status);if(intent)rows=rows.filter(x=>intent==='quente'?x.hot_opportunity:x.intent_level===intent);
  $('crmEmpty').hidden=rows.length>0;
  $('crmBody').innerHTML=rows.map(r=>`<tr class="${r.hot_opportunity?'hot-row':''}">
    <td><span class="score grade-${r.grade}">${r.score}</span><span class="sub">Lead ${r.grade}${r.initial_score!=null&&Number(r.score)!==Number(r.initial_score)?` · inicial ${r.initial_score}`:''}</span></td>
    <td><span class="company">${r.hot_opportunity?'🔥 ':''}${esc(r.company_name)}</span><span class="sub">${esc(r.recommended_product||'')}</span>${r.website?`<a class="sub" target="_blank" rel="noopener" href="${esc(hrefUrl(r.website))}">site oficial ↗</a>`:''}</td>
    <td>${esc(r.city||'')}${r.state?' / '+esc(r.state):''}<span class="sub">${esc(r.segment||'')}</span></td>
    <td>${enrichmentCell(r)}</td>
    <td><select class="status-select" data-status="${r.id}">${['novo','contatar','abordado','follow_up','proposta','ganho','perdido','descartado'].map(s=>`<option value="${s}" ${s===r.status?'selected':''}>${fmtStatus(s)}</option>`).join('')}</select></td>
    <td><div class="contact-links"><button class="mini accent" data-enrich="${r.id}" ${r.enrichment_status==='investigando'||r.web_search_status==='pesquisando'?'disabled':''}>${r.enrichment_status==='concluido'?'Reinvestigar':'🔎 Investigar'}</button>${r.phone?`<a class="pill" target="_blank" rel="noopener" href="https://wa.me/${waNumber(r.phone)}">WhatsApp</a>`:''}${r.email?`<a class="pill" href="mailto:${esc(r.email)}">E-mail</a>`:''}<button class="mini" data-crmcopy="${r.id}">Abordagem</button>${Array.isArray(r.research_sources)&&r.research_sources.length?`<button class="mini" data-sources="${r.id}">Fontes (${r.research_sources.length})</button>`:''}</div></td>
  </tr>`).join('')
}
$('crmBody').addEventListener('change',async e=>{const el=e.target;if(!el.matches('[data-status]'))return;const {error}=await db.from('radar_leads').update({status:el.value,updated_at:new Date().toISOString()}).eq('id',el.dataset.status);if(error)toast('Erro ao atualizar status.');else{const x=crmLeads.find(v=>v.id===el.dataset.status);if(x)x.status=el.value;updateKpis();toast('Status atualizado.')}});
$('crmBody').addEventListener('click',async e=>{
  const enrich=e.target.closest('[data-enrich]');if(enrich){enrich.disabled=true;enrich.textContent='Investigando...';await enrichLead(enrich.dataset.enrich,false);return}
  const copy=e.target.closest('[data-crmcopy]');if(copy){const r=crmLeads.find(x=>x.id===copy.dataset.crmcopy);await copyText(r?.approach_message||'');return}
  const src=e.target.closest('[data-sources]');if(src){const r=crmLeads.find(x=>x.id===src.dataset.sources);const text=(r?.research_sources||[]).map((s,i)=>`${i+1}. ${s.title||s.type||'Fonte'}\n${s.url||''}`).join('\n\n');await copyText(text);toast('Lista de fontes copiada.')}
});

$('exportBtn').onclick=()=>{
  if(!crmLeads.length){toast('Não há leads para exportar.');return}
  const cols=['hot_opportunity','intent_score','intent_level','score','initial_score','enrichment_score_delta','grade','company_name','city','state','segment','research_summary','operation_size','evidence','recommended_product','phone','email','website','status','enrichment_status','web_search_status','web_search_provider','enriched_at','web_searched_at','source_url'];
  const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"',header=[...cols,'compras_suprimentos','sinais_intencao','fontes_pesquisa'];
  const lines=crmLeads.map(r=>[...cols.map(c=>q(r[c])),q(r.purchasing_contact?.email||''),q((r.intent_signals||[]).map(s=>s.label).filter(Boolean).join(' | ')),q((r.research_sources||[]).map(s=>s.url).filter(Boolean).join(' | '))].join(';'));
  const csv='\ufeff'+[header.join(';'),...lines].join('\n'),blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`radar-locar-util-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url)
};
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}))}
init();