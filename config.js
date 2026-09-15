window.AUTOCHECK_CONFIG = {
  supabaseUrl: "https://qfiunsqjkkxuetmyzmdw.supabase.co",
  supabaseAnonKey: "sb_publishable_dlBACJeZVFw7ZUcGGRfDPA_8n8_ivRW",
  bucket: "checklists"
};

document.addEventListener('DOMContentLoaded', () => {
  const select = document.getElementById('jobSelect');
  if (!select || document.getElementById('guinchoFields')) return;
  const wrap = document.createElement('div');
  wrap.id = 'guinchoFields';
  wrap.className = 'fields';
  wrap.style.marginTop = '14px';
  wrap.innerHTML = `
    <label>Placa do guincho
      <input id="guinchoPlaca" type="text" maxlength="8" placeholder="Ex.: ABC1D23" autocomplete="off">
    </label>
    <label>Nome do prestador
      <input id="prestadorNome" type="text" maxlength="120" placeholder="Nome completo do prestador" autocomplete="name">
    </label>`;
  select.parentElement.insertAdjacentElement('afterend', wrap);
  const placa = document.getElementById('guinchoPlaca');
  const prestador = document.getElementById('prestadorNome');
  function selectedJob() {
    const list = JSON.parse(localStorage.getItem('locarUtilAutoCheckJobs') || '[]');
    return list.find(j => j.id === select.value);
  }
  function loadFields() {
    const j = selectedJob();
    placa.value = j?.guinchoPlaca || '';
    prestador.value = j?.prestadorNome || '';
  }
  function persistFields() {
    const id = select.value;
    if (!id) return;
    const list = JSON.parse(localStorage.getItem('locarUtilAutoCheckJobs') || '[]');
    const j = list.find(x => x.id === id);
    if (!j) return;
    j.guinchoPlaca = placa.value.trim().toUpperCase();
    j.prestadorNome = prestador.value.trim();
    localStorage.setItem('locarUtilAutoCheckJobs', JSON.stringify(list));
    if (typeof jobs !== 'undefined') {
      const current = jobs.find(x => x.id === id);
      if (current) {
        current.guinchoPlaca = j.guinchoPlaca;
        current.prestadorNome = j.prestadorNome;
      }
    }
  }
  select.addEventListener('change', loadFields);
  placa.addEventListener('input', persistFields);
  prestador.addEventListener('input', persistFields);
  const saveBtn = document.getElementById('saveInspection');
  if (saveBtn) saveBtn.addEventListener('click', persistFields, true);
  loadFields();
});
