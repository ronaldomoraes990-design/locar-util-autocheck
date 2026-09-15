(() => {
  const cfg = window.AUTOCHECK_CONFIG || {};
  const configured = cfg.supabaseUrl && cfg.supabaseAnonKey &&
    !cfg.supabaseUrl.includes('SEU-PROJETO') && !cfg.supabaseAnonKey.includes('SUA_CHAVE');
  let client = null;
  if (configured && window.supabase) client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

  window.onlineStore = {
    configured,
    async load() {
      if (!client) return null;
      const { data, error } = await client.from('app_state').select('jobs').eq('id','main').single();
      if (error) throw error;
      return data.jobs || [];
    },
    async save(jobs) {
      if (!client) return false;
      const { error } = await client.from('app_state').upsert({id:'main', jobs, updated_at:new Date().toISOString()});
      if (error) throw error;
      return true;
    },
    async upload(file, jobId, kind) {
      if (!client) throw new Error('Armazenamento online não configurado.');
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
      return client.channel('autocheck-live').on('postgres_changes',
        {event:'*',schema:'public',table:'app_state',filter:'id=eq.main'},
        payload => onJobs(payload.new.jobs || [])
      ).subscribe();
    }
  };
})();
