let supa=null; let user=null;
function qs(s){return document.querySelector(s)}; function view(id){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active')); qs('#'+id).classList.add('active');}
async function init(){
  supa = window.supabase.createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY);
  const { data: { user: u } } = await supa.auth.getUser(); user=u; toggle();
  supa.auth.onAuthStateChange((_e,s)=>{ user=s?.user||null; toggle(); });
  qs('#authForm').addEventListener('submit', async (e)=>{
    e.preventDefault(); const fd=new FormData(e.target); const email=fd.get('email'); const password=fd.get('password'); 
    const mode=e.submitter?.dataset?.auth||'login';
    if(mode==='signup'){ const {error}=await supa.auth.signUp({email,password}); if(error) alert(error.message); else alert('Vérifie ton email'); }
    else { const {error}=await supa.auth.signInWithPassword({email,password}); if(error) alert(error.message); }
  });
  qs('.nav [data-nav="account"]').addEventListener('click',()=>view('view-account'));
  qs('.nav [data-nav="orders"]').addEventListener('click',()=>view('view-orders'));
  qs('.nav [data-nav="catalog"]').addEventListener('click',()=>view('view-catalog'));
  qs('#loginBtn').addEventListener('click',()=>view('view-account'));
  qs('#logoutBtn').addEventListener('click', async ()=>{ await supa.auth.signOut(); alert('Déconnecté'); });
  // dummy catalog
  const products=[{name:'Urée (DEF) 20 L',price:26.9},{name:'Huile 15W40 18.9 L',price:114}];
  const root=qs('#catalog'); root.innerHTML=''; products.forEach(p=>{ const div=document.createElement('div'); div.textContent=p.name+' — '+p.price+'$'; root.appendChild(div); });
}
function toggle(){
  qs('#loginBtn').hidden = !!user;
  qs('#logoutBtn').hidden = !user;
}
document.addEventListener('DOMContentLoaded', init);
