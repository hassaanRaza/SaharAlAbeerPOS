import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { $, PKR } from './utils.js';
import { switchTabs } from './ui.js';
import { refs, loadProducts, bindProductSearch, bindProductModal, quickPurchase, addLineToPO, savePO, renderPO, loadPurchases } from './inventory.js';
import { quickSale, cart, addCartLine, renderCart, bindCartInputs, saveCart, loadSales, invoice } from './sales.js';
import { addExpense, loadExpenses } from './expenses.js';
import { runReports, bindReportSearch } from './reports.js';
import { products, lastSaleId } from './state.js';

// Auth guard + who + logout
onAuthStateChanged(auth, u=>{
  if(!u) location.href='index.html';
  else $('#who').textContent = `Signed in: ${u.email}`;
});
$('#logoutBtn').onclick = async ()=>{ await signOut(auth); location.href='index.html'; };

// Tabs
switchTabs();

// Seed
//const seedNames = ["Oud Royal","Musk Rose","Amber Noir","Citrus Zest","Vanilla Sky","Saffron Smoke","Blue Ocean","White Musk","Leather Intense","Spice Route","Floral Bloom","Woody Trail","Fresh Linen","Cocoa Velvet","Tobacco Gold","Green Tea","Cherry Blossom","Midnight Rain","Golden Sand","Pearl Mist","Cedar Breeze","Noir Nuit"];
/*$('#btnSeed').onclick = async ()=>{
  if(!confirm('Seed 22 products?')) return;
  const { setDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  const pcol = collection(db,'products');
  for(let i=0;i<seedNames.length;i++){
    const sku=`SKU-${i+1}`;
    await setDoc(doc(pcol, sku), { sku, name: seedNames[i], sellingPrice:1200+(i%5)*100, purchasePrice:800+(i%5)*50, avgCost:0, stock:0, lowStockThreshold:5, createdAt:Date.now() });
  }
  await loadProducts();
  alert('Seeded.');
};*/

// Export JSON backup
$('#btnExport').onclick = async ()=>{
  const all = {};
  for (const key of ['products','purchases','sales','expenses']){
    const snap = await getDocs(collection(db,key));
    all[key] = snap.docs.map(d=> ({ id:d.id, ...d.data() }));
  }
  const blob = new Blob([JSON.stringify(all,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`backup_${Date.now()}.json`; a.click();
};

// Load & bind UI
await loadProducts();
await loadSales();
await loadExpenses();
await loadPurchases();
bindProductSearch(); bindProductModal(); bindReportSearch(); bindCartInputs();
renderPO(); renderCart();

// Quick actions
document.getElementById('addBuy').onclick    = async ()=>{ await quickPurchase(); await loadProducts(); await loadPurchases(); await import('./inventory.js').then(m=>m.renderPO()); };
document.getElementById('btnAddToPO').onclick = ()=>{ addLineToPO(); };
document.getElementById('btnSavePO').onclick  = async ()=>{ await savePO(); await loadProducts(); await loadPurchases(); };

document.getElementById('addSale').onclick   = async ()=>{ await quickSale(refs); await loadProducts(); await loadSales(); await renderKPIs(); };
document.getElementById('btnAddToCart').onclick = ()=> addCartLine(refs);
document.getElementById('btnSaveSale').onclick  = async ()=>{ await saveCart(); await loadProducts(); await loadSales(); await renderKPIs(); };
document.getElementById('btnInvoice').onclick   = ()=> invoice(lastSaleId);

// KPIs
async function renderKPIs(){
  const stockVal = products.reduce((s,p)=> s + (p.stock||0)*(p.avgCost||0), 0);
  const sSnap = await getDocs(collection(db,'sales')); const s = sSnap.docs.map(d=>d.data());
  const revenue = s.reduce((x,y)=>x+y.revenue,0);
  const cogs = s.reduce((x,y)=>x+(y.costAtSale*y.qty),0);
  const gp = revenue - cogs;
  $('#kpiStockVal').textContent = PKR(stockVal);
  $('#kpiRevenue').textContent = PKR(revenue);
  $('#kpiCogs').textContent = PKR(cogs);
  $('#kpiProfit').textContent = PKR(gp);
  $('#kpiPartner').textContent = `Partner share (÷4): ${PKR(gp/4)}`;
}
await renderKPIs();

// Reports
document.getElementById('runReports').onclick = runReports;
