import { db } from './firebase.js';
import { $, PKR, today, filterProducts, notify } from './utils.js';
import { collection, doc, getDocs, getDoc, setDoc, addDoc, updateDoc, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { products, setProducts } from './state.js';
import { modal } from './ui.js';

const C = {
  products: collection(db,'products'),
  purchases: collection(db,'purchases'),
};

export const refs = {
  saleProduct: $('#saleProduct'),
  buyProduct: $('#buyProduct'),
  salePrice: $('#salePrice'),
  saleQty: $('#saleQty'),
  saleDisc: $('#saleDisc'),
  onHand: $('#onHand'),
  buyQty: $('#buyQty'),
  buyCost: $('#buyCost'),
  buySupplier: $('#buySupplier'),
  prodBody: $('#prodBody'),
};

export async function loadPurchases(){
  const snap = await getDocs(query(C.purchases, orderBy('createdAt','desc')));
  const rows = snap.docs.map(d => d.data());
  const tbody = document.getElementById('buysBody');
  if (!tbody) return;
  tbody.innerHTML = rows.map(p => `
    <tr>
      <td>${p.date}</td>
      <td>${p.sku}</td>
      <td class="right">${p.qty}</td>
      <td class="right">${PKR(p.unitCost)}</td>
      <td class="right">${PKR(p.totalCost)}</td>
      <td>${p.supplier || '—'}</td>
    </tr>
  `).join('');
}

export async function loadProducts(){
  const snap = await getDocs(query(C.products, orderBy('name')));
  const arr = snap.docs.map(d=>d.data());
  setProducts(arr);
  const opts = arr.map(p=>`<option value="${p.sku}">${p.sku} — ${p.name}</option>`).join('');
  refs.saleProduct.innerHTML = opts;
  refs.buyProduct.innerHTML = opts;
  renderProducts(arr);
  updateDefaults();
}

export function renderProducts(list = products){
  refs.prodBody.innerHTML = list.map(p=>`
    <tr data-sku="${p.sku}">
      <td>${p.sku}</td><td>${p.name}</td>
      <td class="right">${PKR(p.sellingPrice)}</td>
      <td class="right">${PKR(p.purchasePrice)}</td>
      <td class="right">${PKR(p.avgCost||0)}</td>
      <td class="right">${p.stock||0}</td>
    </tr>`).join('');
  // row select -> update button label
  document.querySelectorAll('#prodBody tr').forEach(tr=>{
    tr.onclick = ()=>{
      document.querySelectorAll('#prodBody tr').forEach(r=>r.classList.remove('sel'));
      tr.classList.add('sel');
      document.getElementById('btnNew').textContent = 'Update Product';
      document.getElementById('btnNew').dataset.sku = tr.getAttribute('data-sku');
    };
  });
}

export function bindProductSearch(){
  $('#prodSearch').oninput = e => renderProducts(filterProducts(products, e.target.value));
  $('#saleSearch').oninput = e =>{
    const list = filterProducts(products, e.target.value);
    refs.saleProduct.innerHTML = list.map(p=>`<option value="${p.sku}">${p.sku} — ${p.name}</option>`).join('');
    updateDefaults();
  };
  $('#buySearch').oninput = e =>{
    const list = filterProducts(products, e.target.value);
    refs.buyProduct.innerHTML = list.map(p=>`<option value="${p.sku}">${p.sku} — ${p.name}</option>`).join('');
    updateDefaults();
  };
}

export function updateDefaults(){
  const p = products.find(x=>x.sku===refs.saleProduct.value)||products[0];
  if(p){ refs.salePrice.value=p.sellingPrice; refs.onHand.textContent=p.stock||0; }
  const b = products.find(x=>x.sku===refs.buyProduct.value)||products[0];
  if(b){ refs.buyCost.value=b.purchasePrice; }
}
refs.saleProduct.onchange = updateDefaults;
refs.buyProduct.onchange = updateDefaults;

// Product modal create/update
export function bindProductModal(){
  const btnNew = document.getElementById('btnNew');
  const mSku = $('#mSku'), mName=$('#mName'), mSell=$('#mSell'), mBuy=$('#mBuy'), mLow=$('#mLow');

  btnNew.onclick = ()=>{
    const sku = btnNew.dataset.sku || '';
    const isUpdate = !!sku;
    document.getElementById('prodModalTitle').textContent = isUpdate ? 'Update Product' : 'New Product';
    if(isUpdate){
      const p = products.find(x=>x.sku===sku);
      mSku.value = p.sku; mSku.disabled=true;
      mName.value=p.name; mSell.value=p.sellingPrice; mBuy.value=p.purchasePrice; mLow.value=p.lowStockThreshold||5;
    }else{
      mSku.disabled=false; mSku.value=''; mName.value=''; mSell.value=''; mBuy.value=''; mLow.value=5;
    }
    modal.open();
  };

  document.getElementById('prodSave').onclick = async ()=>{
    const sku=(mSku.value||'').trim(), name=(mName.value||'').trim();
    const sp=Number(mSell.value||0), pp=Number(mBuy.value||0), low=Number(mLow.value||0);
    if(!sku || !name || sp<=0 || pp<=0) return notify.error('Please fill all fields with valid numbers.');
    if(btnNew.dataset.sku){ // update
      await updateDoc(doc(db,'products',sku), { name, sellingPrice:sp, purchasePrice:pp, lowStockThreshold:low });
    }else{ // create
      const exists = await getDoc(doc(db,'products',sku));
      if(exists.exists()) return notify.error('This SKU already exists.');
      await setDoc(doc(db,'products',sku), { sku, name, sellingPrice:sp, purchasePrice:pp, avgCost:0, stock:0, lowStockThreshold:low, createdAt:Date.now() });
    }
    modal.close(); btnNew.textContent='New Product'; btnNew.dataset.sku='';
    await loadProducts();
    notify.toast(isUpdate ? 'Product updated' : 'Product created');
  };

  document.getElementById('prodCancel').onclick = ()=>{ btnNew.textContent='New Product'; btnNew.dataset.sku=''; };
}

// Quick purchase (single line) + bill (multi)
export async function quickPurchase(){
  const sku = refs.buyProduct.value; const qty = Number(refs.buyQty.value||0); const cost = Number(refs.buyCost.value||0);
  if(!sku || qty<=0 || cost<=0) return notify.error('Enter valid product, quantity and cost.');
  const pref = doc(db,'products', sku);
  const psnap = await getDoc(pref); if(!psnap.exists()) return notify.error('Product not found.');
  const p = psnap.data(); const newStock=(p.stock||0)+qty; const newAvg = newStock>0 ? (((p.stock||0)*(p.avgCost||0)) + (qty*cost))/newStock : cost;
  await updateDoc(pref,{ stock:newStock, avgCost:newAvg, purchasePrice:cost });
  await addDoc(C.purchases,{ date: today(), sku, qty, unitCost: cost, totalCost: qty*cost, supplier: $('#buySupplier').value||null, createdAt: Date.now() });
  notify.toast('Purchase added');
}

export const POCart = [];
export function renderPO(){
  const body = $('#poBody');
  body.innerHTML = POCart.map((x,i)=>`<tr><td>${x.sku}</td><td>${x.name}</td><td class="right">${x.qty}</td><td class="right">${PKR(x.cost)}</td><td class="right">${PKR(x.total)}</td><td><button data-i="${i}" class="ghost">Remove</button></td></tr>`).join('');
  body.querySelectorAll('button[data-i]').forEach(b=> b.onclick=()=>{ POCart.splice(Number(b.dataset.i),1); renderPO(); updatePOBtn(); });
  updatePOBtn();
}
function updatePOBtn(){ $('#btnSavePO').textContent = `Save Purchase (${POCart.length})`; }

export function addLineToPO(){
  const sku = refs.buyProduct.value; const qty = Number(refs.buyQty.value||0); const cost = Number(refs.buyCost.value||0);
  const p = products.find(x=>x.sku===sku); if(!p) return notify.error('Select a product first.');
  if(qty<=0 || cost<=0) return notify.error('Enter valid quantity and cost.');
  POCart.push({ sku, name:p.name, qty, cost, total:qty*cost }); renderPO();
}

export async function savePO(){
  if(!POCart.length) return notify.error('No lines in bill.');
  const poId = `PO-${Date.now()}`;
  for(const line of POCart){
    const ref = doc(db,'products', line.sku); const snap = await getDoc(ref); if(!snap.exists()) continue;
    const p = snap.data(); const newStock=(p.stock||0)+line.qty;
    const newAvg = newStock>0 ? (((p.stock||0)*(p.avgCost||0)) + (line.qty*line.cost))/newStock : line.cost;
    await updateDoc(ref,{ stock:newStock, avgCost:newAvg, purchasePrice:line.cost });
    await addDoc(C.purchases,{ orderId: poId, date: today(), sku: line.sku, qty: line.qty, unitCost: line.cost, totalCost: line.total, supplier: $('#buySupplier').value||null, createdAt: Date.now() });
  }
  POCart.length = 0; renderPO();
  notify.success(`Purchase saved: ${poId}`);
}
