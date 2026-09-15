(() => {
  // Carrega os módulos de acesso de forma síncrona durante o carregamento do app.
  document.write('<script src="auth.js"><\/script><script src="audit.js"><\/script>');
  const cfg = window.AUTOCHECK_CONFIG || {};
  const configured = cfg.supabaseUrl && cfg.supabaseAnonKey &&
    !cfg.supabaseUrl.includes('SEU-PROJETO') && !cfg.supabaseAnonKey.includes('SUA_CHAVE');
  let client = null;
  if (configured && window.supabase) client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

  async function sessionRequired() {
    if (!client) throw new Error('Supabase não configurado.');
    const { data: { session } } = await client.auth.getSession();
    if (!session) throw new Error('Sessão não autenticada.');
    return session;
  }

  window.onlineStore = {
    configured,
    client,
    async load() {
      if (!client) return null;
      await sessionRequired();
      const { data, error } = await client.from('app_state').select('jobs').eq('id','main').single();
      if (error) throw error;
      return data.jobs || [];
    },
    async save(jobs) {
      if (!client) return false;
      await sessionRequired();
      const { error } = await client.from('app_state').upsert({id:'main', jobs, updated_at:new Date().toISOString()});
      if (error) throw error;
      return true;
    },
    async upload(file, jobId, kind) {
      if (!client) throw new Error('Armazenamento online não configurado.');
      await sessionRequired();
      if (file.size > 20 * 1024 * 1024) throw new Error('Cada arquivo pode ter no máximo 20 MB.');
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
      const path = jobId + '/' + Date.now() + '-' + kind + '-' + safe;
      const { error } = await client.storage.from(cfg.bucket || 'checklists').upload(path,file,{contentType:file.type,upsert:false});
      if (error) throw error;
      const { data } = client.storage.from(cfg.bucket || 'checklists').getPublicUrl(path);
      return {name:file.name,type:file.type||'application/octet-stream',size:file.size,url:data.publicUrl,path};
    },
    subscribe(onJobs) {
      if (!client) return;
      return client.auth.getSession().then(({data:{session}})=>{
        if (!session) return null;
        return client.channel('autocheck-live').on('postgres_changes',
          {event:'*',schema:'public',table:'app_state',filter:'id=eq.main'},
          payload => onJobs(payload.new.jobs || [])
        ).subscribe();
      });
    }
  };
})();