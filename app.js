
let supa = null;
const state = { 
  products: [], 
  cart: JSON.parse(localStorage.getItem('cart') || '[]'), 
  user: null, profile: null, machinesDict: {}, category:'Toutes',
  isAdmin: false, adminMap: null, adminMarkers: [], favGps: []
};
const fmt = (n) => n.toLocaleString('fr-CA', { style:'currency', currency: APP_CONFIG.baseCurrency });
const qs = (s)=>document.querySelector(s);
const view = (id)=>{ document.querySelectorAll('.view').forEach(v=>v.classList.remove('active')); qs('#'+id).classList.add('active'); }
const saveCart = ()=>{ localStorage.setItem('cart', JSON.stringify(state.cart)); renderCartBadge(); }
const renderCartBadge = ()=>{ qs('#cartCount').textContent = state.cart.reduce((a,i)=>a+i.qty,0); }

// ------- Supabase -------
async function initSupabase(){
  supa = window.supabase.createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY, { auth: { persistSession:true } });
  const { data: { user } } = await supa.auth.getUser();
  state.user = user || null;
  if(state.user){ await ensureProfile(); await checkAdmin(); }
  toggleAuthUI();
  if(state.user){ await loadProfile(); await loadAddresses(); await loadMachines(); await loadOrders(); await loadFavGps(); }
  supa.auth.onAuthStateChange(async (_e, session)=>{
    state.user = session?.user || null;
    if(state.user){ await ensureProfile(); await checkAdmin(); }
    toggleAuthUI();
    if(state.user){ loadProfile(); loadAddresses(); loadMachines(); loadOrders(); loadFavGps(); }
  });
}
function toggleAuthUI(){ qs('#loginBtn').hidden = !!state.user; qs('#logoutBtn').hidden = !state.user; qs('#adminNav').hidden = !state.isAdmin; }

async function checkAdmin(){
  if(!state.user) return state.isAdmin=false;
  const { data } = await supa.from('profiles').select('is_admin').eq('id', state.user.id).single();
  state.isAdmin = !!data?.is_admin;
  qs('#adminNav').hidden = !state.isAdmin;
}

// ------- Products / Categories / Cart -------
async function loadProducts(){
  // Try Supabase products first
  try {
    const { data, error } = await supa.from('products').select('*').eq('active', true).order('category').order('name');
    if(!error && data && data.length>0){
      state.products = data.map(p=>({
        id: 'p-'+p.id, category:p.category, name:p.name, desc:p.desc, price: Number(p.price), unit:p.unit, sku:p.sku, image:p.image
      }));
    } else {
      const res = await fetch('products.json'); state.products = await res.json();
    }
  } catch(e){
    const res = await fetch('products.json'); state.products = await res.json();
  }
  buildCategoryUI(); renderCatalog(); renderCartBadge();
}
function buildCategoryUI(){
  const cats = Array.from(new Set(state.products.map(p=>p.category))).sort();
  const pills = qs('#categories'); const select = qs('#catFilter');
  pills.innerHTML = ''; select.innerHTML = '';
  const all = ['Toutes', ...cats];
  all.forEach(c=>{
    const pill = document.createElement('button'); pill.className='cat-pill'+(c==='Toutes'?' active':''); pill.textContent=c;
    pill.addEventListener('click', ()=>{ document.querySelectorAll('.cat-pill').forEach(x=>x.classList.remove('active')); pill.classList.add('active'); state.category=c; renderCatalog(); });
    pills.appendChild(pill);
    const opt=document.createElement('option'); opt.value=c; opt.textContent=c; select.appendChild(opt);
  });
  select.value='Toutes';
  select.onchange=()=>{ state.category=select.value; document.querySelectorAll('.cat-pill').forEach(x=> x.textContent===state.category ? x.classList.add('active') : x.classList.remove('active')); renderCatalog(); };
}
function productsFiltered(){
  if(state.category==='Toutes') return state.products;
  return state.products.filter(p=>p.category===state.category);
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
  productsFiltered().forEach(p=>{
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

// ------- Machines selector (checkout) -------
async function initMachinesSelector(){
  const err = qs('#machineError');
  try{
    const res = await fetch('machines.json');
    if(!res.ok) throw new Error('machines.json not found');
    state.machinesDict = await res.json();
  }catch(e){
    if(err){ err.hidden = false; }
    console.error('Machines JSON load failed', e);
    return;
  }
  const brandSel = document.getElementById('machineBrand');
  const modelSel = document.getElementById('machineModel');
  const yearSel = document.getElementById('machineYear');

  brandSel.innerHTML = '<option value="">-- Choisir marque --</option>';
  Object.keys(state.machinesDict).sort().forEach(b=>{
    const opt = document.createElement('option'); opt.value=b; opt.textContent=b; brandSel.appendChild(opt);
  });

  brandSel.addEventListener('change', ()=>{
    modelSel.innerHTML = '<option value="">-- Choisir modèle --</option>';
    yearSel.innerHTML = '<option value="">-- Année --</option>';
    const b = brandSel.value;
    if(!b) return;
    Object.keys(state.machinesDict[b]).sort().forEach(m=>{
      const opt = document.createElement('option'); opt.value=m; opt.textContent=m; modelSel.appendChild(opt);
    });
  });

  modelSel.addEventListener('change', ()=>{
    yearSel.innerHTML = '<option value="">-- Année --</option>';
    const b = brandSel.value, m = modelSel.value;
    if(!b || !m) return;
    (state.machinesDict[b][m] || []).forEach(y=>{
      const opt = document.createElement('option'); opt.value=y; opt.textContent=y; yearSel.appendChild(opt);
    });
  });
}

function machineFromForm(fd){
  const manual = fd.get('machineCustom');
  if(manual) return manual.trim();
  const b = fd.get('machineBrand') || '';
  const m = fd.get('machineModel') || '';
  const y = fd.get('machineYear') || '';
  const parts = [b,m,y].filter(Boolean);
  return parts.join(' ');
}

// ------- GPS Map (Leaflet) + favoris -------
let checkoutMap = null, checkoutMarker = null;
function initCheckoutMap(){
  const mapDiv = document.getElementById('map');
  if(!mapDiv) return;
  checkoutMap = L.map('map').setView([47.67, -68.48], 9);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(checkoutMap);
  checkoutMap.on('click', function(e){
    if(checkoutMarker) checkoutMarker.remove();
    checkoutMarker = L.marker(e.latlng).addTo(checkoutMap);
    document.getElementById('lat').value = e.latlng.lat;
    document.getElementById('lng').value = e.latlng.lng;
    qs('#gpsLabel').textContent = `Point: ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
  });
  const btn = document.getElementById('useMyLocation');
  btn?.addEventListener('click', ()=>{
    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition((pos)=>{
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        checkoutMap.setView([lat,lng], 13);
        if(checkoutMarker) checkoutMarker.remove();
        checkoutMarker = L.marker([lat,lng]).addTo(checkoutMap);
        document.getElementById('lat').value = lat;
        document.getElementById('lng').value = lng;
        qs('#gpsLabel').textContent = `Point: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      }, (err)=> alert('Impossible de récupérer la position: '+err.message));
    } else alert('Géolocalisation non disponible.');
  });
  bindFavGpsUI();
}
function bindFavGpsUI(){
  const sel = qs('#favGpsSelect'); if(!sel) return;
  sel.innerHTML = ''; sel.appendChild(new Option('— points GPS favoris —',''));
  state.favGps.forEach(f=> sel.appendChild(new Option(`${f.label} (${f.lat.toFixed(4)},${f.lng.toFixed(4)})`, JSON.stringify(f))));
  sel.onchange = ()=>{
    try{
      const f = JSON.parse(sel.value); if(!f) return;
      if(checkoutMap){
        checkoutMap.setView([f.lat,f.lng], 13);
        if(checkoutMarker) checkoutMarker.remove();
        checkoutMarker = L.marker([f.lat,f.lng]).addTo(checkoutMap);
      }
      qs('#lat').value=f.lat; qs('#lng').value=f.lng; qs('#gpsLabel').textContent = `Point: ${f.lat.toFixed(5)}, ${f.lng.toFixed(5)}`;
    }catch{}
  };
  const saveBtn = qs('#saveFavGps');
  saveBtn.onclick = async ()=>{
    const lat = Number(qs('#lat').value), lng = Number(qs('#lng').value);
    if(!lat || !lng){ alert('Sélectionne un point sur la carte d’abord.'); return; }
    const label = prompt('Nom du point (ex: Camp Nord, Bloc 2025-09)?') || 'Point';
    await supa.from('gps_favorites').insert({ user_id: state.user?.id, label, lat, lng });
    await loadFavGps(); bindFavGpsUI(); alert('Point GPS enregistré ✓');
  };
}
async function loadFavGps(){ if(!supa || !state.user) return state.favGps=[];
  const { data } = await supa.from('gps_favorites').select('id,label,lat,lng').eq('user_id',state.user.id).order('created_at',{ascending:false});
  state.favGps = data||[];
}

// ------- Checkout / Order -------
function buildOrder(fd){
  const items = state.cart.map(c=>{ const p=state.products.find(pp=>pp.id===c.id); return {id:c.id,name:p.name,sku:p.sku,qty:c.qty,unit:p.unit,price:p.price}; });
  const subtotal = items.reduce((a,i)=>a+i.qty*i.price,0);
  const shipping = subtotal >= APP_CONFIG.freeShippingMin || subtotal===0 ? 0 : APP_CONFIG.shippingFlat;
  const taxes = { TPS: +(subtotal*APP_CONFIG.taxes.TPS).toFixed(2), TVQ: +((subtotal+subtotal*APP_CONFIG.taxes.TPS)*APP_CONFIG.taxes.TVQ).toFixed(2) };
  const total = +(subtotal + shipping + taxes.TPS + taxes.TVQ).toFixed(2);
  const lat = fd.get('lat'), lng = fd.get('lng');
  const gps_point = (lat && lng) ? { lat: Number(lat), lng: Number(lng) } : null;
  return {
    meta:{ createdAt: new Date().toISOString(), app:'Logtek', version:'logtek-3.0.0' },
    customer:{
      name:fd.get('customerName'), phone:fd.get('phone'), email:fd.get('email'),
      address:fd.get('address'), window:fd.get('window'), payMethod:fd.get('payMethod'),
      notes:fd.get('notes'), machine: machineFromForm(fd)
    },
    items, subtotal, shipping, taxes, total, currency: APP_CONFIG.baseCurrency,
    gps_point,
    user_id: state.user?.id || null
  };
}
const textSummary = (o)=>{
  const L=[]; L.push(`Nouvelle commande — ${APP_CONFIG.businessName}`);
  L.push(`Client: ${o.customer.name}`); L.push(`Tel: ${o.customer.phone}`);
  if(o.customer.email) L.push(`Courriel: ${o.customer.email}`);
  L.push(`Adresse: ${o.customer.address}`);
  if(o.customer.machine) L.push(`Machine: ${o.customer.machine}`);
  if(o.gps_point) L.push(`GPS: ${o.gps_point.lat}, ${o.gps_point.lng}`);
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

async function ensureProfile(){ if(!supa || !state.user) return; await supa.from('profiles').upsert({ id: state.user.id }, { onConflict:'id' }); }
async function loadProfile(){ if(!supa || !state.user) return; const { data } = await supa.from('profiles').select('*').eq('id', state.user.id).single(); state.profile=data||null; }
async function loadAddresses(){}
async function loadMachines(){}
async function addAddress(){}
async function addMachine(){}

async function saveOrder(order){ if(!supa) return; await supa.from('orders').insert({ user_id: order.user_id, payload: order, total: order.total, email: order.customer.email, phone: order.customer.phone, address: order.customer.address, gps_point: order.gps_point }); }
async function loadOrders(){ if(!supa || !state.user) return; const { data }=await supa.from('orders').select('id,created_at,total,payload').eq('user_id',state.user.id).order('created_at',{ascending:false});
  const root=qs('#ordersList'); if(!root) return; root.innerHTML=''; (data||[]).forEach(o=>{ const d=document.createElement('div'); d.className='card'; const when=new Date(o.created_at).toLocaleString('fr-CA'); d.innerHTML=`<strong>Commande #${o.id}</strong><br>${when}<br>Total: ${fmt(o.total)}<br><span class="small">${o.payload.items.length} articles</span>
    <div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn" data-reorder="${o.id}">Commander à l’identique</button></div>`; 
    d.querySelector(`[data-reorder="${o.id}"]`).addEventListener('click', ()=>{ state.cart = o.payload.items.map(i=>({ id:i.id, qty:i.qty, price:i.price })); saveCart(); view('view-cart'); }); 
    root.appendChild(d); }); }

// ------- AUTH (tabs + actions) -------
function bindAuthTabs(){
  const tabs = document.querySelectorAll('.auth-tabs button');
  const forms = { signin: qs('#form-signin'), signup: qs('#form-signup'), reset: qs('#form-reset') };
  tabs.forEach(b=>{
    b.addEventListener('click', ()=>{
      tabs.forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      Object.values(forms).forEach(f=> f.hidden = true);
      forms[b.dataset.tab].hidden = false;
    });
  });

  forms.signin.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const fd=new FormData(forms.signin);
    const { error } = await supa.auth.signInWithPassword({ email: fd.get('email'), password: fd.get('password') });
    if(error) return alert(error.message);
    await checkAdmin();
    view(state.isAdmin ? 'view-admin' : 'view-account');
    await ensureProfile(); await loadProfile(); await loadFavGps(); await loadOrders();
  });
  forms.signup.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const fd=new FormData(forms.signup);
    const { error } = await supa.auth.signUp({ email: fd.get('email'), password: fd.get('password') });
    if(error) return alert(error.message);
    alert('Compte créé. Vérifie ton email pour confirmer.');
  });
  forms.reset.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const fd=new FormData(forms.reset);
    const { error } = await supa.auth.resetPasswordForEmail(fd.get('email'), { redirectTo: window.location.origin });
    if(error) return alert(error.message);
    alert('Lien de réinitialisation envoyé.');
  });
}

// ------- Admin UI -------
function bindAdminTabs(){
  const tabs = document.querySelectorAll('.tabs [data-adm]');
  const sections = document.querySelectorAll('.adm-section');
  tabs.forEach(b=>{
    b.addEventListener('click', ()=>{
      tabs.forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      sections.forEach(s=>s.hidden = true);
      const target = document.getElementById('adm-'+b.dataset.adm);
      if (target) target.hidden = false;
      if(b.dataset.adm==='map') initAdminMap();
      if(b.dataset.adm==='orders') loadAdminOrders();
      if(b.dataset.adm==='products') loadAdminProducts();
      if(b.dataset.adm==='clients') loadAdminClients();
      if(b.dataset.adm==='dashboard') loadAdminDashboard();
    });
  });
}
async function guardAdmin(){
  if(!state.isAdmin){
    alert('Accès admin requis.');
    view('view-catalog');
    return false;
  }
  return true;
}

async function loadAdminDashboard(){
  if(!(await guardAdmin())) return;
  const { data: orders } = await supa.from('orders').select('id,total,created_at,payload').order('created_at',{ascending:false}).limit(8);
  const ca = (orders||[]).reduce((a,o)=>a+Number(o.total||0),0);
  qs('#adm-ca').textContent = fmt(ca);
  qs('#adm-orders-count').textContent = (orders||[]).length.toString();
  const { count: customersCount } = await supa.from('profiles').select('*', { count:'exact', head:true });
  qs('#adm-customers-count').textContent = (customersCount||0).toString();
  const list = qs('#adm-last-orders'); list.innerHTML='';
  (orders||[]).forEach(o=>{
    const d=document.createElement('div'); d.className='card';
    const when=new Date(o.created_at).toLocaleString('fr-CA');
    d.innerHTML = `<strong>#${o.id}</strong> — ${when}<br>Total: ${fmt(o.total)}<br><span class="small">${o.payload?.customer?.name||''}</span>`;
    list.appendChild(d);
  });
}
async function loadAdminOrders(){
  if(!(await guardAdmin())) return;
  const { data } = await supa.from('orders').select('id,created_at,total,payload,gps_point').order('created_at',{ascending:false}).limit(100);
  const list = qs('#adm-orders-list'); list.innerHTML='';
  (data||[]).forEach(o=>{
    const d=document.createElement('div'); d.className='card';
    const when=new Date(o.created_at).toLocaleString('fr-CA');
    const gps = o.gps_point ? `GPS: ${o.gps_point.lat?.toFixed?.(5)}, ${o.gps_point.lng?.toFixed?.(5)}` : 'GPS: —';
    d.innerHTML = `<strong>#${o.id}</strong> — ${when}<br>Total: ${fmt(o.total)}<br>${gps}<br><span class="small">${o.payload?.customer?.name||''}</span>`;
    list.appendChild(d);
  });
}
async function initAdminMap(){
  if(!(await guardAdmin())) return;
  const mapDiv = document.getElementById('adminMap');
  if(!mapDiv) return;
  if(!state.adminMap){
    state.adminMap = L.map('adminMap').setView([47.67, -68.48], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(state.adminMap);
  }
  state.adminMarkers.forEach(m=> m.remove());
  state.adminMarkers = [];
  const { data } = await supa.from('orders').select('id,total,created_at,gps_point,payload').not('gps_point','is',null).order('created_at',{ascending:false}).limit(500);
  (data||[]).forEach(o=>{
    const lat = o.gps_point?.lat, lng = o.gps_point?.lng;
    if(typeof lat==='number' && typeof lng==='number'){
      const marker = L.marker([lat,lng]).addTo(state.adminMap).bindPopup(`#${o.id} — ${fmt(o.total)}<br>${new Date(o.created_at).toLocaleString('fr-CA')}<br>${o.payload?.customer?.name||''}`);
      state.adminMarkers.push(marker);
    }
  });
}

// ------- Admin Products -------
async function loadAdminProducts(){
  if(!(await guardAdmin())) return;
  const list = qs('#adm-products-list'); list.innerHTML='';
  const { data } = await supa.from('products').select('*').order('category').order('name');
  (data||[]).forEach(p=>{
    const d=document.createElement('div'); d.className='card';
    d.innerHTML = `<strong>${p.name}</strong> — ${fmt(p.price)} <span class="small">/ ${p.unit||''}</span><br>
      <span class="small">${p.category||''} — ${p.sku||''}</span>
      <div class="row" style="justify-content:flex-end;gap:6px;margin-top:8px">
        <button class="btn" data-edit="${p.id}">✏️ Modifier</button>
        <button class="btn danger" data-del="${p.id}">🗑 Supprimer</button>
      </div>`;
    d.querySelector(`[data-edit="${p.id}"]`).addEventListener('click', async ()=>{
      const name = prompt('Nom', p.name); if(!name) return;
      const price = Number(prompt('Prix', p.price)); if(isNaN(price)) return;
      const unit = prompt('Unité', p.unit||'unité') || 'unité';
      await supa.from('products').update({ name, price, unit }).eq('id', p.id);
      await loadAdminProducts();
    });
    d.querySelector(`[data-del="${p.id}"]`).addEventListener('click', async ()=>{
      if(confirm('Supprimer ce produit ?')){ await supa.from('products').delete().eq('id', p.id); await loadAdminProducts(); }
    });
    list.appendChild(d);
  });
  qs('#btnNewProduct').onclick = async ()=>{
    const category = prompt('Catégorie (Chaînes / Guides / Huiles / Urée DEF / Filtres)');
    if(!category) return;
    const name = prompt('Nom du produit'); if(!name) return;
    const desc = prompt('Description') || '';
    const price = Number(prompt('Prix')); if(isNaN(price)) return;
    const unit = prompt('Unité', 'unité') || 'unité';
    const sku = prompt('SKU') || '';
    await supa.from('products').insert({ category, name, desc, price, unit, sku, active:true });
    await loadAdminProducts(); await loadProducts();
  };
  qs('#btnImportSeed').onclick = async ()=>{
    const res = await fetch('products.json'); const items = await res.json();
    if(!confirm(`Importer ${items.length} produits de products.json ?`)) return;
    for(const p of items){
      await supa.from('products').upsert({ category:p.category, name:p.name, desc:p.desc, price:p.price, unit:p.unit, sku:p.sku, active:true });
    }
    await loadAdminProducts(); await loadProducts();
    alert('Import terminé ✓');
  };
  qs('#btnExportCSV').onclick = async ()=>{
    const { data } = await supa.from('orders').select('id,created_at,total,payload').order('created_at',{ascending:true});
    const rows = [['id','date','client','total','items']].concat((data||[]).map(o=>[o.id,new Date(o.created_at).toISOString(),o.payload?.customer?.name||'',o.total,(o.payload?.items||[]).map(i=>`${i.name} x${i.qty}`).join(' | ')]));
    const csv = rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='ventes.csv'; a.click();
    URL.revokeObjectURL(url);
  };
}

// ------- Admin Clients -------
async function loadAdminClients(){
  if(!(await guardAdmin())) return;
  const list = qs('#adm-clients-list'); list.innerHTML='';
  const { data } = await supa.from('profiles').select('id,company,phone,default_address,is_admin,created_at').order('created_at',{ascending:false}).limit(200);
  (data||[]).forEach(p=>{
    const d=document.createElement('div'); d.className='card';
    d.innerHTML = `<strong>${p.company||'Client'}</strong> — ${p.phone||''}<br><span class="small">${p.default_address||''}</span><br>
    <span class="small">${p.is_admin ? 'ADMIN' : ''}</span>`;
    list.appendChild(d);
  });
}

// ------- DOM Ready -------
document.addEventListener('DOMContentLoaded', ()=>{
  // nav
  document.querySelectorAll('[data-nav]').forEach(b=> b.addEventListener('click', async ()=>{
    if(b.dataset.nav==='account' && !state.user){ view('view-auth'); return; }
    if(b.dataset.nav==='admin'){ await checkAdmin(); if(!state.isAdmin){ alert('Accès admin requis.'); return;} }
    view('view-'+b.dataset.nav);
    if(b.dataset.nav==='orders') loadOrders();
    if(b.dataset.nav==='admin'){ bindAdminTabs(); loadAdminDashboard(); }
    if(b.dataset.nav==='checkout'){ initMachinesSelector(); initCheckoutMap(); }
  }));

  // header auth buttons
  qs('#loginBtn').addEventListener('click', ()=> view('view-auth'));
  qs('#logoutBtn').addEventListener('click', async ()=>{ await supa.auth.signOut(); state.isAdmin=false; toggleAuthUI(); alert('Déconnecté'); view('view-auth'); });

  // catalog/cart
  loadProducts();
  qs('#cartBtn').addEventListener('click', ()=>{ renderCart(); view('view-cart'); });
  qs('#continueShopping').addEventListener('click', ()=> view('view-catalog'));
  qs('#checkoutBtn').addEventListener('click', ()=>{ renderCart(); if(state.cart.length===0){ alert('Panier vide.'); return;} view('view-checkout'); initMachinesSelector(); initCheckoutMap(); });
  qs('#backToCart').addEventListener('click', ()=> view('view-cart'));

  // checkout submit
  qs('#checkoutForm').addEventListener('submit', async (e)=>{
    e.preventDefault(); if(state.user){ await ensureProfile(); }
    const order = buildOrder(new FormData(e.target));
    await saveOrder(order);
    const summary = textSummary(order);
    qs('#waLink').href = wa(summary);
    qs('#mailLink').href = mailto('Nouvelle commande', summary);
    if(APP_CONFIG.stripePaymentLink){ qs('#stripeLink').style.display='inline-block'; qs('#stripeLink').href = APP_CONFIG.stripePaymentLink; }
    qs('#orderJSON').textContent = JSON.stringify(order, null, 2);
    state.cart = []; saveCart(); view('view-confirm');
  });

  // PWA install
  window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); const b=document.getElementById('installBtn'); if(!b) return; b.hidden=false; b.onclick=async()=>{ e.prompt(); await e.userChoice; b.hidden=true; }; });

  // init supabase
  initSupabase();
});

