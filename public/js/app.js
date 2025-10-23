// js/app.js
import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { $, PKR, notify } from './utils.js';
import { switchTabs } from './ui.js';

import {
  refs, loadProducts, bindProductSearch, bindProductModal,
  quickPurchase, addLineToPO, savePO, renderPO, loadPurchases
} from './inventory.js';

import {
  quickSale, addCartLine, renderCart, bindCartInputs,
  saveCart, loadSales, invoice
} from './sales.js';

import { addExpense, loadExpenses } from './expenses.js';
import { runReports, bindReportSearch } from './reports.js';
import { products, lastSaleId } from './state.js';

// ---------------- Auth guard + topbar ----------------
onAuthStateChanged(auth, (u) => {
  if (!u) location.href = 'index.html';
  else $('#who').textContent = `Signed in: ${u.email}`;
});

$('#logoutBtn').onclick = async () => {
  const ok = await notify.confirm('You will be signed out.', 'Logout?', 'Logout');
  if (!ok) return;
  await signOut(auth);
  location.href = '/';
};

// ---------------- Tabs ----------------
switchTabs(); // keeps show/hide of [data-panel] in sync with .tab buttons

// Lazy-load flags for heavy lists
const loaded = { sales: false, purchases: false };

// When a tab is clicked, load its data on demand
document.querySelectorAll('.tabs .tab').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const tab = btn.getAttribute('data-tab');
    if (tab === 'sales-all' && !loaded.sales) {
      await loadSales();
      loaded.sales = true;
    }
    if (tab === 'purchases-all' && !loaded.purchases) {
      await loadPurchases();
      loaded.purchases = true;
    }
  });
});

// ---------------- Export JSON backup ----------------
$('#btnExport').onclick = async () => {
  const all = {};
  for (const key of ['products', 'purchases', 'sales', 'expenses']) {
    const snap = await getDocs(collection(db, key));
    all[key] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `backup_${Date.now()}.json`;
  a.click();
};

// ---------------- Initial load (fast path) ----------------
await loadProducts();        // lightweight + needed everywhere
await loadExpenses();        // small list
bindProductSearch();
bindProductModal();
bindReportSearch();
bindCartInputs();
renderPO();
renderCart();
await renderKPIs();          // KPIs at start

// ---------------- Quick actions ----------------
/*document.getElementById('addBuy').onclick = async () => {
  await quickPurchase();
  await loadProducts();
  if (loaded.purchases) await loadPurchases(); // refresh history only if previously loaded
  await renderKPIs();
  renderPO(); // recalculates PO button text
};*/

document.getElementById('btnAddToPO').onclick = () => { addLineToPO(); };
document.getElementById('btnSavePO').onclick = async () => {
  await savePO();
  await loadProducts();
  if (loaded.purchases) await loadPurchases();
  await renderKPIs();
};

/*document.getElementById('addSale').onclick = async () => {
  await quickSale(refs);
  await loadProducts();
  if (loaded.sales) await loadSales();
  await renderKPIs();
};*/

document.getElementById('btnAddToCart').onclick = () => addCartLine(refs);
document.getElementById('btnSaveSale').onclick = async () => {
  await saveCart();
  await loadProducts();
  if (loaded.sales) await loadSales();
  await renderKPIs();
};

document.getElementById('btnInvoice').onclick = () => invoice(lastSaleId);

// ---------------- KPIs (client aggregates) ----------------
async function renderKPIs() {
  const stockVal = products.reduce((s, p) => s + (p.stock || 0) * (p.avgCost || 0), 0);
  const sSnap = await getDocs(collection(db, 'sales'));
  const s = sSnap.docs.map((d) => d.data());
  const revenue = s.reduce((x, y) => x + y.revenue, 0);
  const cogs = s.reduce((x, y) => x + (y.costAtSale * y.qty), 0);
  const gp = revenue - cogs;

  $('#kpiStockVal').textContent = PKR(stockVal);
  $('#kpiRevenue').textContent = PKR(revenue);
  $('#kpiCogs').textContent = PKR(cogs);
  $('#kpiProfit').textContent = PKR(gp);
  $('#kpiPartner').textContent = `Partner share (÷4): ${PKR(gp / 4)}`;
}

// ---------------- Reports ----------------
document.getElementById('runReports').onclick = runReports;
