(() => {
  const safe = s => String(s || '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const stamp = () => new Date().toISOString();
  function responsible() {
    const u = window.currentUser || {};
    return { responsavelId:u.id||'', responsavelNome:u.nome||'', responsavelEmail:u.email||'', responsavelPerfil:u.perfil||'', responsavelEm:stamp() };
  }
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('jobForm');
    if (form) {
      const original = form.onsubmit;
      form.onsubmit = async e => {
        if (original) await original(e);
        try {
          const key='locarUtilAutoCheckJobs', list=JSON.parse(localStorage.getItem(key)||'[]');
          if (!list.length) return;
          Object.assign(list[list.length-1], responsible());
          localStorage.setItem(key,JSON.stringify(list));
          if (window.onlineStore?.configured) await window.onlineStore.save(list);
        } catch (_) {}
      };
    }
    const saveBtn = document.getElementById('saveInspection');
    if (saveBtn) {
      const original = saveBtn.onclick;
      saveBtn.onclick = async e => {
        if (original) await original(e);
        try {
          const id=document.getElementById('jobSelect')?.value;
          const key='locarUtilAutoCheckJobs', list=JSON.parse(localStorage.getItem(key)||'[]'), j=list.find(x=>x.id===id);
          if (!j) return;
          j.checklistResponsavelId=window.currentUser?.id||'';
          j.checklistResponsavelNome=window.currentUser?.nome||'';
          j.checklistResponsavelEmail=window.currentUser?.email||'';
          j.checklistResponsavelEm=stamp();
          localStorage.setItem(key,JSON.stringify(list));
          if (window.onlineStore?.configured) await window.onlineStore.save(list);
        } catch (_) {}
      };
    }
    if (window.currentUser?.perfil === 'admin') {
      const b=document.getElementById('adminBtn');
      if(b) b.onclick=()=>location.href='admin.html';
    }
  });
})();