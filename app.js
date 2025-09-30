// LOGTEK - app.js (patché avec navigation espace client)

let supa = null;
const state = { products: [], cart: JSON.parse(localStorage.getItem('cart') || '[]'), user: null, profile: null, machinesDict: {} };
const fmt = (n) => n.toLocaleString('fr-CA', { style:'currency', currency: APP_CONFIG.baseCurrency });
const qs = (s)=>document.querySelector(s);
const view = (id)=>{ document.querySelectorAll('.view').forEach(v=>v.classList.remove('active')); qs('#'+id).classList.add('active'); }
const saveCart = ()=>{ localStorage.setItem('cart', JSON.stringify(state.cart)); renderCartBadge(); }
const renderCartBadge = ()=>{ qs('#cartCount').textContent = state.cart.reduce((a,i)=>a+i.qty,0); }

async function initSupabase(){
  supa = window.supabase.createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY, { auth: { persistSession:true } });
  const { data: { user } } = await supa.auth.getUser();
  state.user = user || null;
  toggleAuthUI();
  if(state.user){ await loadProfile(); await loadAddresses(); await loadMachines(); await loadOrders(); }
  supa.auth.onAuthStateChange((_e, session)=>{
    state.user = session?.user || null;
    toggleAuthUI();
    if(state.user){ loadProfile(); loadAddresses(); loadMachines(); loadOrders(); }
  });
}
function toggleAuthUI(){ qs('#loginBtn').hidden = !!state.user; qs('#logoutBtn').hidden = !state.user; }

// --- Correctif espace client ---
function bindAccountTabs(){
  const tabs = document.querySelectorAll('.tabs [data-acc]');
  const sections = document.querySelectorAll('.acc-section');
  tabs.forEach(b=>{
    b.addEventListener('click', ()=>{
      tabs.forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      sections.forEach(s=>s.hidden = true);
      const target = document.getElementById('acc-'+b.dataset.acc);
      if (target) target.hidden = false;
    });
  });
}

// Exemple de listeners init
document.addEventListener('DOMContentLoaded', ()=>{
  // Autres initialisations (catalogue, panier, etc.)
  bindAccountTabs();   // 🔥 correction espace client
  initSupabase();
});
