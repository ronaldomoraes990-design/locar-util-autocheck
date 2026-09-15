(() => {
  const cfg = window.AUTOCHECK_CONFIG || {};
  let client = null;
  if (window.supabase && cfg.supabaseUrl && cfg.supabaseAnonKey) client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  const safe=s=>String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  window.appAuth = {
    client, session:null, profile:null,
    async init(){
      if(!client)return null;
      const {data:{session}}=await client.auth.getSession(); this.session=session;
      if(!session)return null;
      const {data:profile,error}=await client.from('app_users').select('*').eq('id',session.user.id).maybeSingle();
      if(error||!profile||!profile.ativo){await client.auth.signOut();this.session=null;return null;}
      this.profile=profile; window.currentUser={id:session.user.id,email:session.user.email,nome:profile.nome,perfil:profile.perfil}; return window.currentUser;
    },
    async login(email,password){
      if(!client)throw new Error('Supabase não configurado.');
      const {data,error}=await client.auth.signInWithPassword({email,password}); if(error)throw error;
      this.session=data.session; return this.init();
    },
    async logout(){if(client)await client.auth.signOut();location.href='login.html';}
  };

  document.addEventListener('DOMContentLoaded',async()=>{
    const isLogin=/login\.html$/.test(location.pathname), user=await window.appAuth.init();
    if(isLogin){
      if(user){location.href='index.html';return;}
      const form=document.getElementById('loginForm');
      if(form)form.onsubmit=async e=>{e.preventDefault();const msg=document.getElementById('loginMsg');try{msg.textContent='Entrando...';const u=await window.appAuth.login(form.email.value.trim(),form.password.value);if(!u)throw new Error('Usuário sem cadastro no sistema ou inativo.');location.href='index.html';}catch(err){msg.textContent='Não foi possível entrar: '+err.message;}};
      return;
    }
    if(!user){location.replace('login.html');return;}
    const authUser=document.getElementById('authUser'), admin=document.getElementById('adminBtn'), logout=document.getElementById('logoutBtn');
    if(authUser)authUser.textContent=`${user.nome} · ${user.perfil}`;
    if(admin){admin.style.display=user.perfil==='admin'?'inline-block':'none';admin.onclick=()=>location.href='admin.html';}
    if(logout)logout.onclick=()=>window.appAuth.logout();
  });
})();