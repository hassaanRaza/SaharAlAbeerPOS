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
  else {
    const name = asName(u.email);
    $('#who').textContent = `Signed in: ${name}`;
  }
});

$('#logoutBtn').onclick = async () => {
  const ok = await notify.confirm('You will be signed out.', 'Logout?', 'Logout');
  if (!ok) return;
  await signOut(auth);
  location.href = '/';
};

// ---------------- Tabs ----------------
switchTabs();

// ---------- Simple live table filter ----------
const _tableFilters = [];
function setupFilter(inputId, tbodyId) {
  const input = document.getElementById(inputId);
  if (!input) return; // skip silently if that page doesn't have a search box

  const apply = () => {
    const q = input.value.trim().toLowerCase();
    document
      .querySelectorAll(`#${tbodyId} tr`)
      .forEach(tr => {
        tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
  };

  input.addEventListener('input', apply);
  _tableFilters.push(apply);   // so we can re-apply after table re-renders
}
// Attach filters (only if those inputs exist on the page)
setupFilter('salesSearch', 'salesBody');         // All Sales
setupFilter('purchasesSearch', 'buysBody');      // All Purchases
setupFilter('exSearch', 'exBody');               // Expenses (optional, see HTML below)


const loaded = { sales: false, purchases: false };

document.querySelectorAll('.tabs .tab').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const tab = btn.getAttribute('data-tab');
    if (tab === 'sales-all' && !loaded.sales) {
      await loadSales();
      loaded.sales = true;
      _tableFilters.forEach(fn => fn());   // re-apply active filters
    }
    if (tab === 'purchases-all' && !loaded.purchases) {
      await loadPurchases();
      loaded.purchases = true;
      _tableFilters.forEach(fn => fn());
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

// ---------------- Quick actions ----------------
document.getElementById('btnAddToPO').onclick = () => { addLineToPO(); };
document.getElementById('btnSavePO').onclick = async () => {
  await savePO();
  await loadProducts();
  if (loaded.purchases) await loadPurchases();
  _tableFilters.forEach(fn => fn());
  await renderKPIs();
};

document.getElementById('btnAddToCart').onclick = () => addCartLine(refs);
document.getElementById('btnSaveSale').onclick = async () => {
  await saveCart();
  await loadProducts();
  if (loaded.sales) await loadSales();
  _tableFilters.forEach(fn => fn());
  await renderKPIs();
};

document.getElementById('btnInvoice').onclick = () => invoice(lastSaleId);

// ---------------- KPIs (client aggregates) ----------------
export async function renderKPIs() {
  // Calculate stock value
  const stockVal = products.reduce((s, p) => s + (p.stock || 0) * (p.avgCost || 0), 0);

  // --- Sales ---
  const sSnap = await getDocs(collection(db, 'sales'));
  const s = sSnap.docs.map((d) => d.data());
  const revenue = s.reduce((x, y) => x + y.revenue, 0);
  const cogs = s.reduce((x, y) => x + (y.costAtSale * y.qty), 0);
  const gp = revenue - cogs;

  // --- Expenses ---
  const eSnap = await getDocs(collection(db, 'expenses'));
  const e = eSnap.docs.map((d) => d.data());
  const totalExpenses = e.reduce((sum, row) => sum + (row.amount || 0), 0);

  // --- Net Profit ---
  const netProfit = gp - totalExpenses;

  // Update KPI cards
  $('#kpiStockVal').textContent = PKR(stockVal);
  $('#kpiRevenue').textContent = PKR(revenue);
  $('#kpiCogs').textContent = PKR(cogs);
  $('#kpiProfit').textContent = PKR(gp);
  $('#kpiPartner').textContent = `Partner share (÷4): ${PKR(gp / 4)}`;

  const kpiNet = document.getElementById('kpiNetProfit');
  const kpiNetShare = document.getElementById('kpiNetPartner');
  const kpiNetNote = document.getElementById('kpiNetNote');
  if (kpiNet) {
    kpiNet.textContent = PKR(netProfit);
    kpiNet.classList.toggle('negative', netProfit < 0);
  }
  if (kpiNetShare) {
    kpiNetShare.textContent = `Partner share (÷4): ${PKR(netProfit / 4)}`;
  }
  if (kpiNetNote) {
    kpiNetNote.textContent = `Gross (${PKR(gp)}) — Expenses (${PKR(totalExpenses)})`;
  }
}

// --- KPI collapse/expand with persistence ---
(function setupKpiToggle() {
  const wrap = document.getElementById('kpiWrap');
  const btn = document.getElementById('toggleKPI');
  if (!wrap || !btn) return;

  const KEY = 'kpiCollapsed';

  function apply(isCollapsed) {
    wrap.classList.toggle('collapsed', isCollapsed);
    btn.textContent = isCollapsed ? 'Show dashboard ▼' : 'Hide dashboard ▲';
  }

  // restore last state
  const saved = localStorage.getItem(KEY);
  const startCollapsed = saved === '1';
  apply(startCollapsed);

  btn.addEventListener('click', () => {
    const next = !wrap.classList.contains('collapsed');
    apply(next);
    localStorage.setItem(KEY, next ? '1' : '0');
  });
})();

document.getElementById('addExpense').onclick = async () => {
  await addExpense();
  _tableFilters?.forEach(fn => fn()); // keep search applied
  await renderKPIs();
};


// also expose globally to avoid import cycles
window.renderKPIs = renderKPIs;

// ---------------- Reports ----------------
document.getElementById('runReports').onclick = runReports;
