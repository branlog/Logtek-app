
let supa = null;
const state = {
  products: [],
  cart: JSON.parse(localStorage.getItem('cart') || '[]'),
  user: null,
  profile: null
};
const fmt = (n) => n.toLocaleString('fr-CA', { style:'currency', currency: APP_CONFIG.baseCurrency });
const qs = (s)=>document.querySelector(s);
const view = (id)=>{ document.querySelectorAll('.view').forEach(v=>v.classList.remove('active')); qs('#'+id).classList.add('active'); }
const saveCart = ()=>{ localStorage.setItem('cart', JSON.stringify(state.cart)); renderCartBadge(); }
const renderCartBadge = ()=>{ qs('#cartCount').textContent = state.cart.reduce((a,i)=>a+i.qty,0); }

async function initSupabase(){
  if(APP_CONFIG.SUPABASE_URL && APP_CONFIG.SUPABASE_ANON_KEY){
    supa = window.supabase.createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY, { auth: { persistSession:true } });
    const { data: { user } } = await supa.auth.getUser();
    state.user = user || null;
    toggleAuthUI();
    if(state.user){ await loadProfile(); await loadAddresses(); await loadMachines(); await loadOrders(); }
    supa.auth.onAuthStateChange((_e, session)=>{
      state.user = session?.user || null;
      toggleAuthUI();
      if(state.user){ loadProfile(); loadAddresses(); loadMachines(); loadOrders(); }
      else { qs('#ordersList').textContent = 'Connectez-vous pour voir vos commandes.'; }
    });
  }
}
function toggleAuthUI(){ qs('#loginBtn').hidden = !!state.user; qs('#logoutBtn').hidden = !state.user; }

async function loadProducts(){
  const res = await fetch('products.json'); state.products = await res.json();
  renderCatalog(); renderCartBadge();
}
function addToCart(id, qty=1){
  const it = state.cart.find(i=>i.id===id);
  if(it) it.qty += qty; else {
    const p = state.products.find(x=>x.id===id);
    state.cart.push({ id, qty, price:p.price });
  }
  saveCart();
}
function renderCatalog(){
  const root = qs('#catalog'); root.innerHTML = '';
  state.products.forEach(p=>{
    const el = document.createElement('div'); el.className='card';
    el.innerHTML = `
      <h3>${p.name}</h3>
      <p>${p.desc || ''}</p>
      <div class="row">
        <div class="price">${fmt(p.price)} <span class="small">/ ${p.unit}</span></div>
        <div class="row qty" style="margin-left:auto">
          <input type="number" min="1" value="1">
          <button class="btn accent">Ajouter</button>
        </div>
      </div>`;
    const qty = el.querySelector('input');
    el.querySelector('button').addEventListener('click', ()=>{
      addToCart(p.id, parseInt(qty.value||'1',10));
      el.querySelector('button').textContent='Ajouté ✓'; setTimeout(()=>el.querySelector('button').textContent='Ajouter',900);
    });
    root.appendChild(el);
  });
}
function renderCart(){
  const root = qs('#cartItems'); root.innerHTML = '';
  let subtotal=0;
  state.cart.forEach(item=>{
    const p = state.products.find(pp=>pp.id===item.id); const total = item.qty*p.price; subtotal+=total;
    const row = document.createElement('div'); row.className='row'; row.style.justifyContent='space-between'; row.style.padding='8px 0'; row.style.borderBottom='1px dashed #242424';
    row.innerHTML = `<div><strong>${p.name}</strong><div class="small">${p.sku||''}</div></div>
      <div>${fmt(p.price)}</div>
      <div style="min-width:88px"><input type="number" min="1" value="${item.qty}" style="width:80px"></div>
      <button class="btn ghost" aria-label="Retirer">✕</button>`;
    const input = row.querySelector('input');
    input.addEventListener('change', ()=>{ item.qty = Math.max(1, parseInt(input.value||'1',10)); saveCart(); renderCart(); });
    row.querySelector('button').addEventListener('click', ()=>{ state.cart = state.cart.filter(i=>i!==item); saveCart(); renderCart(); });
    root.appendChild(row);
  });
  const ship = subtotal >= APP_CONFIG.freeShippingMin || subtotal===0 ? 0 : APP_CONFIG.shippingFlat;
  qs('#subtotal').textContent = fmt(subtotal);
  qs('#shipping').textContent = fmt(ship);
  qs('#grandtotal').textContent = fmt(subtotal + ship);
}
function buildOrder(fd){
  const items = state.cart.map(c=>{ const p=state.products.find(pp=>pp.id===c.id); return {id:c.id,name:p.name,sku:p.sku,qty:c.qty,unit:p.unit,price:p.price}; });
  const subtotal = items.reduce((a,i)=>a+i.qty*i.price,0);
  const shipping = subtotal >= APP_CONFIG.freeShippingMin || subtotal===0 ? 0 : APP_CONFIG.shippingFlat;
  const taxes = { TPS: +(subtotal*APP_CONFIG.taxes.TPS).toFixed(2), TVQ: +((subtotal+subtotal*APP_CONFIG.taxes.TPS)*APP_CONFIG.taxes.TVQ).toFixed(2) };
  const total = +(subtotal + shipping + taxes.TPS + taxes.TVQ).toFixed(2);
  return {
    meta:{ createdAt: new Date().toISOString(), app:'Logtek', version:'pro-brand-1.0.0' },
    customer:{ name:fd.get('customerName'), phone:fd.get('phone'), email:fd.get('email'), address:fd.get('address'), window:fd.get('window'), payMethod:fd.get('payMethod'), notes:fd.get('notes'), machine:fd.get('machine') },
    items, subtotal, shipping, taxes, total, currency: APP_CONFIG.baseCurrency,
    user_id: state.user?.id || null
  };
}
const textSummary = (o)=>{
  const L=[]; L.push(`Nouvelle commande — ${APP_CONFIG.businessName}`);
  L.push(`Client: ${o.customer.name}`); L.push(`Tel: ${o.customer.phone}`);
  if(o.customer.email) L.push(`Courriel: ${o.customer.email}`);
  L.push(`Adresse: ${o.customer.address}`);
  if(o.customer.machine) L.push(`Machine: ${o.customer.machine}`);
  L.push(`Fenêtre: ${o.customer.window}`); L.push(`Paiement: ${o.customer.payMethod}`);
  if(o.customer.notes) L.push(`Notes: ${o.customer.notes}`); L.push(''); L.push('Articles:');
  o.items.forEach(i=> L.push(`• ${i.name} x${i.qty} @ ${fmt(i.price)} (${i.sku||''})`));
  L.push(''); L.push(`Sous-total: ${fmt(o.subtotal)}`); L.push(`Livraison: ${fmt(o.shipping)}`);
  L.push(`TPS: ${fmt(o.taxes.TPS)} | TVQ: ${fmt(o.taxes.TVQ)}`); L.push(`TOTAL: ${fmt(o.total)}`);
  if(o.customer.payMethod==='etransfer'){ L.push(''); L.push(`Virement Interac: ${APP_CONFIG.etransferEmail}`); }
  L.push('Merci!'); return L.join('\\n');
}
const wa = (t)=>`https://wa.me/${APP_CONFIG.adminPhoneIntl.replace(/[^0-9]/g,'')}?text=${encodeURIComponent(t)}`;
const mailto = (s,b)=>`mailto:${encodeURIComponent(APP_CONFIG.adminEmail)}?subject=${encodeURIComponent(s)}&body=${encodeURIComponent(b)}`;

// Supabase helpers
async function ensureProfile(){ if(!supa || !state.user) return; await supa.from('profiles').upsert({ id: state.user.id }, { onConflict:'id' }); }
async function loadProfile(){ if(!supa || !state.user) return; const { data } = await supa.from('profiles').select('*').eq('id', state.user.id).single(); state.profile=data||null;
  if(state.profile){ const pf=qs('#profileForm'); pf.company.value=state.profile.company||''; pf.phone.value=state.profile.phone||''; pf.default_address.value=state.profile.default_address||''; } }
async function saveProfile(e){ e.preventDefault(); if(!supa || !state.user) return;
  const pf=new FormData(qs('#profileForm')); await supa.from('profiles').upsert({ id:state.user.id, company:pf.get('company'), phone:pf.get('phone'), default_address:pf.get('default_address') }, { onConflict:'id' });
  alert('Profil enregistré ✓'); }
async function loadAddresses(){ if(!supa || !state.user) return; const { data }=await supa.from('addresses').select('*').eq('user_id',state.user.id).order('created_at',{ascending:false});
  const root=qs('#addresses'); root.innerHTML=''; (data||[]).forEach(a=>{ const d=document.createElement('div'); d.className='card'; d.innerHTML=`<strong>${a.label||'Adresse'}</strong><div class="small">${a.address}</div>`; root.appendChild(d); }); }
async function addAddress(address){ if(!supa || !state.user) return; await supa.from('addresses').insert({ user_id:state.user.id, address, label:'Livraison' }); await loadAddresses(); }
async function loadMachines(){ if(!supa || !state.user) return; const { data }=await supa.from('machines').select('*').eq('user_id',state.user.id).order('created_at',{ascending:false});
  const root=qs('#machines'); root.innerHTML=''; (data||[]).forEach(m=>{ const d=document.createElement('div'); d.className='card'; d.innerHTML=`<strong>${m.model}</strong><div class="small">${m.notes||''}</div>`; root.appendChild(d); }); }
async function addMachine(model){ if(!supa || !state.user) return; await supa.from('machines').insert({ user_id:state.user.id, model }); await loadMachines(); }
async function saveOrder(order){ if(!supa) return; await supa.from('orders').insert({ user_id: order.user_id, payload: order, total: order.total, email: order.customer.email, phone: order.customer.phone, address: order.customer.address }); }
async function loadOrders(){ if(!supa || !state.user) return; const { data }=await supa.from('orders').select('id,created_at,total,payload').eq('user_id',state.user.id).order('created_at',{ascending:false});
  const root=qs('#ordersList'); root.innerHTML=''; (data||[]).forEach(o=>{ const d=document.createElement('div'); d.className='card'; const when=new Date(o.created_at).toLocaleString('fr-CA'); d.innerHTML=`<strong>Commande #${o.id}</strong><br>${when}<br>Total: ${fmt(o.total)}<br><span class="small">${o.payload.items.length} articles</span>`; root.appendChild(d); }); }

document.addEventListener('DOMContentLoaded', ()=>{
  // nav
  document.querySelectorAll('[data-nav]').forEach(b=> b.addEventListener('click', ()=>{ view('view-'+b.dataset.nav); if(b.dataset.nav==='orders') loadOrders(); if(b.dataset.nav==='account') renderAccount(); }));
  // auth buttons
  qs('#loginBtn').addEventListener('click', ()=> view('view-account'));
  qs('#logoutBtn').addEventListener('click', async ()=>{ if(!supa) return; await supa.auth.signOut(); alert('Déconnecté'); });
  // catalog/cart
  loadProducts();
  qs('#cartBtn').addEventListener('click', ()=>{ renderCart(); view('view-cart'); });
  qs('#continueShopping').addEventListener('click', ()=> view('view-catalog'));
  qs('#checkoutBtn').addEventListener('click', ()=>{ if(state.cart.length===0){ alert('Panier vide.'); return;} view('view-checkout'); });
  qs('#backToCart').addEventListener('click', ()=> view('view-cart'));
  // checkout submit
  qs('#checkoutForm').addEventListener('submit', async (e)=>{
    e.preventDefault(); if(supa && state.user){ await ensureProfile(); }
    const order = buildOrder(new FormData(e.target));
    if(supa){ await saveOrder(order); }
    const summary = textSummary(order);
    qs('#waLink').href = wa(summary);
    qs('#mailLink').href = mailto('Nouvelle commande', summary);
    if(APP_CONFIG.stripePaymentLink){ qs('#stripeLink').style.display='inline-block'; qs('#stripeLink').href = APP_CONFIG.stripePaymentLink; }
    qs('#orderJSON').textContent = JSON.stringify(order, null, 2);
    state.cart = []; saveCart(); view('view-confirm');
  });
  // account forms
  const pf = qs('#profileForm'); if(pf) pf.addEventListener('submit', saveProfile);
  const addA = qs('#addAddressBtn'); if(addA) addA.addEventListener('click', async ()=>{ const a=prompt('Nouvelle adresse'); if(a) await addAddress(a); });
  const addM = qs('#addMachineBtn'); if(addM) addM.addEventListener('click', async ()=>{ const m=prompt('Modèle de machine'); if(m) await addMachine(m); });
  // auth form
  qs('#authForm').addEventListener('submit', async (e)=>{
    e.preventDefault(); if(!supa){ alert('Supabase non configuré'); return; }
    const fd=new FormData(e.target); const email=fd.get('email'); const password=fd.get('password'); const mode=e.submitter?.dataset?.auth || 'login';
    if(mode==='signup'){ const { error } = await supa.auth.signUp({ email, password }); if(error) alert(error.message); else alert('Vérifie ton email pour confirmer.'); }
    else { const { error } = await supa.auth.signInWithPassword({ email, password }); if(error) alert(error.message); }
  });
  // PWA install
  window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); const b=qs('#installBtn'); b.hidden=false; b.onclick=async()=>{ e.prompt(); await e.userChoice; b.hidden=true; }; });
  initSupabase();
});
function renderAccount(){ const auth=qs('#authArea'); const prof=qs('#profileArea'); if(state.user){ auth.hidden=true; prof.hidden=false; } else { auth.hidden=false; prof.hidden=true; } }
