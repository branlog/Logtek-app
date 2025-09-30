
let supa=null;
const state={cart:JSON.parse(localStorage.getItem('cart')||'[]'),products:[],user:null,machines:{}};
const fmt=(n)=>n.toLocaleString('fr-CA',{style:'currency',currency:'CAD'});
const qs=(s)=>document.querySelector(s);
function show(id){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active')); qs('#'+id).classList.add('active'); if(id==='cart') renderCart(); if(id==='checkout'){initMap(); initMachines();} if(id==='account') loadAccount();}
document.addEventListener('click',e=>{const v=e.target.getAttribute('data-view'); if(v){e.preventDefault(); show(v);}});

async function init(){
  supa = window.supabase.createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY, {auth:{persistSession:true}});
  const { data: { user } } = await supa.auth.getUser(); state.user=user||null;
  toggleAuth();
  await loadProducts();
  bindAuth();
  qs('#toCheckout').onclick=()=>show('checkout');
  qs('#loginBtn').onclick=()=>show('auth');
  qs('#logoutBtn').onclick=async()=>{ await supa.auth.signOut(); state.user=null; toggleAuth(); alert('Déconnecté.'); show('auth'); };
  qs('#checkoutForm').addEventListener('submit', submitOrder);
}
function toggleAuth(){ qs('#loginBtn').style.display = state.user?'none':'inline-block'; qs('#logoutBtn').style.display = state.user?'inline-block':'none'; }
async function loadProducts(){
  try{
    const { data, error } = await supa.from('products').select('*').eq('active',true).order('category').order('name');
    if(!error && data && data.length>0){
      state.products = data.map(p=>({id:'p-'+p.id, name:p.name, desc:p.desc, price:Number(p.price), unit:p.unit, sku:p.sku, category:p.category}));
    } else {
      const res = await fetch('products.json'); state.products = await res.json();
    }
  }catch(e){ const res = await fetch('products.json'); state.products = await res.json(); }
  renderCatalog();
}
function renderCatalog(){
  const root=qs('#catalogList'); root.innerHTML='';
  state.products.forEach(p=>{
    const el=document.createElement('div'); el.className='card';
    el.innerHTML=`<h3>${p.name}</h3><div class="muted">${p.desc||''}</div>
      <div class="row"><div><strong>${fmt(p.price)}</strong> <span class="muted">/ ${p.unit||'unité'}</span></div>
      <div class="row"><input type="number" min="1" value="1" style="width:80px"><button class="primary">Ajouter</button></div></div>`;
    const qty=el.querySelector('input');
    el.querySelector('button').onclick=()=>{ addToCart(p.id, parseInt(qty.value||'1',10)); };
    root.appendChild(el);
  });
}
function addToCart(id, qty){
  const it=state.cart.find(i=>i.id===id);
  if(it) it.qty+=qty; else { const p=state.products.find(x=>x.id===id); state.cart.push({id, qty, price:p.price}); }
  localStorage.setItem('cart', JSON.stringify(state.cart)); alert('Ajouté au panier.');
}
function renderCart(){
  const root=qs('#cartList'); root.innerHTML='';
  let subtotal=0;
  state.cart.forEach(c=>{
    const p=state.products.find(x=>x.id===c.id);
    const row=document.createElement('div'); row.className='row';
    row.innerHTML=`<div><strong>${p.name}</strong><div class="muted">${p.sku||''}</div></div>
      <div>${fmt(p.price)}</div><div><input type="number" min="1" value="${c.qty}" style="width:80px"></div>
      <button>✕</button>`;
    row.querySelector('input').onchange=(ev)=>{ c.qty=Math.max(1,parseInt(ev.target.value||'1',10)); localStorage.setItem('cart', JSON.stringify(state.cart)); renderCart(); };
    row.querySelector('button').onclick=()=>{ state.cart=state.cart.filter(x=>x!==c); localStorage.setItem('cart', JSON.stringify(state.cart)); renderCart(); };
    root.appendChild(row);
    subtotal += c.qty*p.price;
  });
  const ship = (subtotal===0 || subtotal>=APP_CONFIG.freeShippingMin) ? 0 : APP_CONFIG.shippingFlat;
  qs('#totals').innerHTML = `<div class="card">Sous-total: <strong>${fmt(subtotal)}</strong> — Livraison: <strong>${fmt(ship)}</strong> — Total: <strong>${fmt(subtotal+ship)}</strong></div>`;
}

// Machines selector
async function initMachines(){
  try{
    const res = await fetch('machines.json'); state.machines = await res.json();
    const brand = qs('#brand'), model=qs('#model'), year=qs('#year');
    brand.innerHTML = '<option value="">Marque</option>';
    Object.keys(state.machines).sort().forEach(b=> brand.appendChild(new Option(b,b)));
    brand.onchange=()=>{ model.innerHTML='<option value="">Modèle</option>'; year.innerHTML='<option value="">Année</option>'; if(!brand.value) return; Object.keys(state.machines[brand.value]).sort().forEach(m=> model.appendChild(new Option(m,m))); };
    model.onchange=()=>{ year.innerHTML='<option value="">Année</option>'; if(!brand.value||!model.value) return; (state.machines[brand.value][model.value]||[]).forEach(y=> year.appendChild(new Option(y,y))); };
  }catch(e){ console.warn('machines.json manquant'); }
}

// Leaflet map
let map=null, marker=null;
function initMap(){
  map = L.map('map').setView([47.67,-68.48], 8);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
  map.on('click', e=>{
    if(marker) marker.remove();
    marker=L.marker(e.latlng).addTo(map);
    qs('#lat').value=e.latlng.lat; qs('#lng').value=e.latlng.lng;
    qs('#gpsLabel').textContent=`${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
  });
  qs('#useMyLocation').onclick=()=>{
    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(pos=>{
        const lat=pos.coords.latitude, lng=pos.coords.longitude;
        map.setView([lat,lng], 13);
        if(marker) marker.remove();
        marker=L.marker([lat,lng]).addTo(map);
        qs('#lat').value=lat; qs('#lng').value=lng;
        qs('#gpsLabel').textContent=`${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      }, err=> alert('GPS non disponible: '+err.message));
    }
  };
}

// Auth
function bindAuth(){
  qs('#signin').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const fd=new FormData(e.target);
    const { error } = await supa.auth.signInWithPassword({ email: fd.get('email'), password: fd.get('password') });
    if(error) return alert(error.message);
    const { data:{ user } } = await supa.auth.getUser(); state.user=user; toggleAuth(); show('account');
  });
  qs('#signup').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const fd=new FormData(e.target);
    const { error } = await supa.auth.signUp({ email: fd.get('email'), password: fd.get('password') });
    if(error) return alert(error.message);
    alert('Compte créé. Vérifie ton email pour confirmer.');
  });
}
async function loadAccount(){
  if(!state.user){ show('auth'); return; }
  const { data } = await supa.from('orders').select('id,created_at,total,payload').eq('user_id',state.user.id).order('created_at',{ascending:false});
  qs('#accountInfo').innerHTML = `<div>Email: <strong>${state.user.email}</strong></div>`;
  const list = qs('#orders'); list.innerHTML='';
  (data||[]).forEach(o=>{
    const d=document.createElement('div'); d.className='card';
    d.innerHTML = `<strong>#${o.id}</strong><br>${new Date(o.created_at).toLocaleString('fr-CA')}<br>Total: ${fmt(o.total)}`;
    list.appendChild(d);
  });
}

// Order submit
async function submitOrder(e){
  e.preventDefault();
  if(state.cart.length===0) return alert('Panier vide.');
  const fd=new FormData(e.target);
  const items = state.cart.map(c=>{
    const p=state.products.find(x=>x.id===c.id);
    return { id:c.id, name:p.name, qty:c.qty, price:p.price, sku:p.sku };
  });
  const subtotal = items.reduce((a,i)=>a+i.qty*i.price,0);
  const ship = (subtotal===0 || subtotal>=APP_CONFIG.freeShippingMin) ? 0 : APP_CONFIG.shippingFlat;
  const taxes = subtotal*APP_CONFIG.taxes.TPS + (subtotal+subtotal*APP_CONFIG.taxes.TPS)*APP_CONFIG.taxes.TVQ;
  const total = +(subtotal+ship+taxes).toFixed(2);
  const machine = fd.get('machineCustom') || [qs('#brand').value, qs('#model').value, qs('#year').value].filter(Boolean).join(' ');
  const order = {
    customer:{ name:fd.get('name'), phone:fd.get('phone'), address:fd.get('address'), machine },
    items, subtotal, ship, total, gps_point: (fd.get('lat')&&fd.get('lng')) ? {lat:Number(fd.get('lat')),lng:Number(fd.get('lng'))} : null
  };
  await supa.from('orders').insert({ user_id: state.user?.id || null, total, email: state.user?.email || null, phone: fd.get('phone'), address: fd.get('address'), payload: order, gps_point: order.gps_point });
  // WhatsApp send
  const text = encodeURIComponent(`Commande Logtek\nClient: ${order.customer.name}\nTel: ${order.customer.phone}\nAdr: ${order.customer.address}\nMachine: ${order.customer.machine}\nTotal: ${total}\nItems: ${items.map(i=>i.name+' x'+i.qty).join(' | ')}\nGPS: ${order.gps_point?order.gps_point.lat+','+order.gps_point.lng:'—'}`);
  const wa = `https://wa.me/${APP_CONFIG.adminPhoneIntl.replace(/[^0-9]/g,'')}?text=${text}`;
  window.open(wa,'_blank');
  state.cart=[]; localStorage.setItem('cart','[]');
  alert('Commande envoyée ✓');
  show('catalog');
}

document.addEventListener('DOMContentLoaded', init);
