(() => {
  const cfg=window.AUTOCHECK_CONFIG||{};
  const configured=!!(cfg.supabaseUrl&&cfg.supabaseAnonKey&&!cfg.supabaseUrl.includes('SEU-PROJETO')&&!cfg.supabaseAnonKey.includes('SUA_CHAVE'));
  const client=configured&&window.supabase?window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey):null;
  function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});}
  window.autocheckAuthReady=Promise.all([loadScript('auth.js'),loadScript('audit.js')]).then(async()=>{
    if(!window.appAuth)return null;
    const user=await window.appAuth.init();
    const isLogin=/login\.html$/.test(location.pathname);
    if(isLogin&&user){location.href='index.html';return user;}
    if(!isLogin&&!user){location.replace('login.html');return null;}
    return user;
  }).catch(()=>null);
  async function sessionRequired(){
    if(!client)throw new Error('Supabase não configurado.');
    const {data:{session}}=await client.auth.getSession();
    if(!session)throw new Error('Sessão não autenticada.');
    return session;
  }
  window.onlineStore={
    configured,client,
    async load(){
      if(!client)return null;
      await sessionRequired();
      const {data,error}=await client.from('app_state').select('jobs').eq('id','main').maybeSingle();
      if(error)throw error;
      return data?.jobs||[];
    },
    async save(jobs){
      if(!client)return false;
      await sessionRequired();
      const {error}=await client.from('app_state').upsert({id:'main',jobs:jobs||[],updated_at:new Date().toISOString()},{onConflict:'id'});
      if(error)throw error;
      return true;
    },
    async upload(file,jobId,kind){
      if(!client)throw new Error('Armazenamento online não configurado.');
      await sessionRequired();
      if(file.size>20*1024*1024)throw new Error('Cada arquivo pode ter no máximo 20 MB.');
      const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
      const path=jobId+'/'+Date.now()+'-'+kind+'-'+safe;
      const bucket=cfg.bucket||'checklists';
      const {error}=await client.storage.from(bucket).upload(path,file,{contentType:file.type,upsert:false});
      if(error)throw error;
      const {data,error:urlError}=await client.storage.from(bucket).createSignedUrl(path,60*60*24*7);
      if(urlError)throw urlError;
      return {name:file.name,type:file.type||'application/octet-stream',size:file.size,url:data.signedUrl,path};
    },
    subscribe(onJobs){
      if(!client)return null;
      return client.auth.getSession().then(({data:{session}})=>{
        if(!session)return null;
        return client.channel('autocheck-live').on('postgres_changes',{event:'*',schema:'public',table:'app_state',filter:'id=eq.main'},payload=>onJobs(payload.new?.jobs||[])).subscribe();
      });
    }
  };
})();
