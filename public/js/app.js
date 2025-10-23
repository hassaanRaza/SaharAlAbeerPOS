// js/app.js
import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { $, PKR, notify, asName } from './utils.js';
import { switchTabs } from './ui.js';

import {
  refs, loadProducts, bindProductSearch, bindProductModal,
  addLineToPO, savePO, renderPO, loadPurchases
} from './inventory.js';

import {
  addCartLine, renderCart, bindCartInputs,
  saveCart, loadSales, invoice
} from './sales.js';

import { addExpense, loadExpenses } from './expenses.js';
import { runReports, bindReportSearch } from './reports.js';
import { products, lastSaleId } from './state.js';

// ---------------- Auth guard + topbar ----------------
onAuthStateChanged(auth, (u) => {
  if (!u) location.href = 'index.html';
  else $('#who').textContent = `Signed in: ${asName(u.email)}`;
});

$('#logoutBtn').onclick = async () => {
  const ok = await notify.confirm('You will be signed out.', 'Logout?', 'Logout');
  if (!ok) return;
  await signOut(auth);
  location.href = '/';
};

window.renderKPIs = renderKPIs;

// ---------------- Tabs ----------------
switchTabs();

const loaded = { sales: false, purchases: false };

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

// ---------------- Initial load ----------------
await loadProducts();
await loadExpenses();
bindProductSearch();
bindProductModal();
bindReportSearch();
bindCartInputs();
renderPO();
renderCart();
await renderKPIs();

document.getElementById('btnAddToPO').onclick = () => { addLineToPO(); };
document.getElementById('btnSavePO').onclick = async () => {
  await savePO();
  await loadProducts();
  if (loaded.purchases) await loadPurchases();
  await renderKPIs();
};

document.getElementById('btnAddToCart').onclick = () => addCartLine(refs);
document.getElementById('btnSaveSale').onclick = async () => {
  await saveCart();
  await loadProducts();
  if (loaded.sales) await loadSales();
  await renderKPIs();
};

document.getElementById('btnInvoice').onclick = () => invoice(lastSaleId);

// ---------------- KPIs ----------------
async function renderKPIs() {
  // Stock value
  const stockVal = products.reduce((s, p) => s + (p.stock || 0) * (p.avgCost || 0), 0);

  // --- Sales ---
  const sSnap = await getDocs(collection(db, 'sales'));
  const s = sSnap.docs.map(d => d.data());
  const revenue = s.reduce((x, y) => x + y.revenue, 0);
  const cogs    = s.reduce((x, y) => x + (y.costAtSale * y.qty), 0);
  const gp      = revenue - cogs;

  // --- Expenses ---
  const eSnap = await getDocs(collection(db, 'expenses'));
  const totalExpenses = eSnap.docs.reduce((sum, d) => sum + (Number(d.data().amount) || 0), 0);

  // --- Net Profit ---
  const netProfit = gp - totalExpenses;

  // Fill cards
  $('#kpiStockVal').textContent = PKR(stockVal);
  $('#kpiRevenue').textContent  = PKR(revenue);
  $('#kpiCogs').textContent     = PKR(cogs);

  $('#kpiProfit').textContent   = PKR(gp);
  $('#kpiPartner').textContent  = `Partner share (÷4): ${PKR(gp / 4)}`;

  const netEl = document.getElementById('kpiNetProfit');
  if (netEl) {
    netEl.textContent = PKR(netProfit);
    netEl.classList.toggle('negative', netProfit < 0);
    netEl.classList.toggle('positive', netProfit >= 0);
  }

  // NEW: Net profit note "Gross – Expenses"
  const netNote = document.getElementById('kpiNetNote');
  if (netNote) {
    netNote.textContent = `Gross (${PKR(gp)}) – Expenses (${PKR(totalExpenses)})`;
  }

  // If you also show partner share of net:
  const netPartner = document.getElementById('kpiNetPartner');
  if (netPartner) {
    netPartner.textContent = `Partner share (÷4): ${PKR(netProfit / 4)}`;
  }
}

// Make callable from other modules (e.g., after adding an expense)
window.renderKPIs = renderKPIs;


// ---------------- Reports ----------------
document.getElementById('runReports').onclick = runReports;

document.getElementById('addExpense').onclick = addExpense;
