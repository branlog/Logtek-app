const state = {
  products: [],
  cart: JSON.parse(localStorage.getItem('cart') || '[]'),
  deferredPrompt: null
};
const fmt = (n) => n.toLocaleString('fr-CA', { style:'currency', currency: APP_CONFIG.baseCurrency });
function qs(s){return document.querySelector(s)}
function view(id){ document.querySelectorAll('.view').forEach(v=>v.classList.remove('active')); qs('#'+id).classList.add('active'); }
function saveCart(){ localStorage.setItem('cart', JSON.stringify(state.cart)); renderCartBadge(); }
function renderCartBadge(){ qs('#cartCount').textContent = state.cart.reduce((a,i)=>a+i.qty,0); }
async function loadProducts(){
  const res = await fetch('products.json'); state.products = await res.json(); renderCatalog(); renderCartBadge();
}
function addToCart(id, qty=1){
  const p = state.products.find(x=>x.id===id); if(!p) return;
  const it = state.cart.find(i=>i.id===id); if(it) it.qty += qty; else state.cart.push({id, qty, price:p.price});
  saveCart(); alert('Ajouté au panier ✓');
}
function renderCatalog(){
  const root = qs('#catalog'); root.innerHTML = '';
  state.products.forEach(p=>{
    const card = document.createElement('div'); card.className='card';
    card.innerHTML = `
      <h3>${p.name}</h3>
      <p>${p.desc || ''}</p>
      <div class="price">${fmt(p.price)} / ${p.unit}</div>
      <div class="qty">
        <input type="number" min="1" value="1" aria-label="Quantité">
        <button class="btn primary">Ajouter</button>
      </div>`;
    const qty = card.querySelector('input');
    card.querySelector('button').addEventListener('click',()=> addToCart(p.id, parseInt(qty.value||'1',10)));
    root.appendChild(card);
  });
}
function renderCart(){
  const root = qs('#cartItems'); root.innerHTML=''; let subtotal=0;
  state.cart.forEach(item=>{
    const p = state.products.find(pp=>pp.id===item.id); const lineTotal=item.qty*(item.price ?? p.price); subtotal+=lineTotal;
    const line = document.createElement('div'); line.className='cart-row';
    line.innerHTML = `
      <div><strong>${p.name}</strong><br><span class="small">${p.sku||''}</span></div>
      <div>${fmt(p.price)}</div>
      <div><input type="number" min="1" value="${item.qty}" style="width:70px"></div>
      <div><button class="btn" data-act="remove">✕</button></div>`;
    const qty = line.querySelector('input');
    qty.addEventListener('change', ()=>{ item.qty = Math.max(1, parseInt(qty.value||'1',10)); saveCart(); renderCart(); });
    line.querySelector('[data-act=remove]').addEventListener('click', ()=>{ state.cart = state.cart.filter(i=>i!==item); saveCart(); renderCart(); });
    root.appendChild(line);
  });
  const ship = subtotal >= APP_CONFIG.freeShippingMin || subtotal===0 ? 0 : APP_CONFIG.shippingFlat;
  qs('#subtotal').textContent = fmt(subtotal);
  qs('#shipping').textContent = fmt(ship);
  qs('#grandtotal').textContent = fmt(subtotal + ship);
}
function buildOrderPayload(fd){
  const items = state.cart.map(c=>{ const p=state.products.find(pp=>pp.id===c.id); return {id:c.id,name:p.name,sku:p.sku,qty:c.qty,unit:p.unit,price:p.price}; });
  const subtotal = items.reduce((a,i)=>a+i.qty*i.price,0);
  const shipping = subtotal >= APP_CONFIG.freeShippingMin || subtotal===0 ? 0 : APP_CONFIG.shippingFlat;
  const taxes = { TPS: +(subtotal*APP_CONFIG.taxes.TPS).toFixed(2), TVQ: +((subtotal+subtotal*APP_CONFIG.taxes.TPS)*APP_CONFIG.taxes.TVQ).toFixed(2) };
  const total = +(subtotal + shipping + taxes.TPS + taxes.TVQ).toFixed(2);
  return {
    meta:{ createdAt:new Date().toISOString(), app:'Logtek', version:'1.0.0' },
    customer:{ name:fd.get('customerName'), phone:fd.get('phone'), email:fd.get('email'), address:fd.get('address'), window:fd.get('window'), payMethod:fd.get('payMethod'), notes:fd.get('notes') },
    items, subtotal, shipping, taxes, total, currency: APP_CONFIG.baseCurrency
  };
}
function textSummary(o){
  const L=[]; L.push(`Nouvelle commande — ${APP_CONFIG.businessName}`);
  L.push(`Client: ${o.customer.name}`); L.push(`Tel: ${o.customer.phone}`);
  if(o.customer.email) L.push(`Courriel: ${o.customer.email}`);
  L.push(`Adresse: ${o.customer.address}`); L.push(`Fenêtre: ${o.customer.window}`); L.push(`Paiement: ${o.customer.payMethod}`);
  if(o.customer.notes) L.push(`Notes: ${o.customer.notes}`); L.push(''); L.push('Articles:');
  o.items.forEach(i=> L.push(`• ${i.name} x${i.qty} @ ${fmt(i.price)} (${i.sku||''})`));
  L.push(''); L.push(`Sous-total: ${fmt(o.subtotal)}`); L.push(`Livraison: ${fmt(o.shipping)}`);
  L.push(`TPS: ${fmt(o.taxes.TPS)} | TVQ: ${fmt(o.taxes.TVQ)}`); L.push(`TOTAL: ${fmt(o.total)}`);
  if(o.customer.payMethod==='etransfer'){ L.push(''); L.push(`Virement Interac: ${APP_CONFIG.etransferEmail}`); }
  L.push('Merci!'); return L.join('\n');
}
function makeWhatsAppLink(text){ const phone = APP_CONFIG.adminPhoneIntl.replace(/[^0-9]/g,''); return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`; }
function makeMailtoLink(subject, body){ const to = encodeURIComponent(APP_CONFIG.adminEmail); return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; }
document.addEventListener('DOMContentLoaded', ()=>{
  loadProducts();
  qs('#cartBtn').addEventListener('click', ()=>{ renderCart(); view('view-cart'); });
  qs('#continueShopping').addEventListener('click', ()=> view('view-catalog'));
  qs('#checkoutBtn').addEventListener('click', ()=>{ if(state.cart.length===0){ alert('Panier vide.'); return;} view('view-checkout'); });
  qs('#backToCart').addEventListener('click', ()=> view('view-cart'));
  qs('#checkoutForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    const order = buildOrderPayload(new FormData(e.target));
    const summary = textSummary(order);
    const orders = JSON.parse(localStorage.getItem('orders') || '[]'); orders.push(order); localStorage.setItem('orders', JSON.stringify(orders));
    qs('#waLink').href = makeWhatsAppLink(summary);
    qs('#mailLink').href = makeMailtoLink('Nouvelle commande', summary);
    qs('#orderJSON').textContent = JSON.stringify(order, null, 2);
    state.cart = []; saveCart(); view('view-confirm');
  });
  window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); const b=qs('#installBtn'); b.hidden=false; b.onclick=async()=>{ e.prompt(); const r=await e.userChoice; b.hidden=true; }; });
  qs('#newOrder').addEventListener('click', ()=> view('view-catalog'));
});
