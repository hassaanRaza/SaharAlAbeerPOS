import { auth, db } from './firebase.js';
import { $, PKR, today, notify, asName, fmtDateTime12 } from './utils.js';
import { collection, addDoc, getDocs, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const C = { expenses: collection(db, 'expenses') };

export async function addExpense() {
  const e = {
    date: $('#exDate').value || today(),
    category: $('#exCat').value,
    amount: Number($('#exAmt').value || 0),
    note: $('#exNote').value || '',
    createdAt: Date.now(),
    createdBy: auth.currentUser?.email || 'unknown@user'
  };
  if (!e.amount) return notify.error('Please enter a valid amount.');
  await addDoc(C.expenses, e);
  await loadExpenses();
  notify.toast('Expense added');

  // reset form
  $('#exDate').value = today();
  $('#exCat').selectedIndex = 0;
  $('#exAmt').value = '';
  $('#exNote').value = '';

  // refresh KPIs
  window.renderKPIs?.();
}

export async function loadExpenses() {
  const snap = await getDocs(query(C.expenses, orderBy('createdAt', 'desc')));
  const rows = snap.docs.map(d => d.data());
  $('#exBody').innerHTML = rows.map(x => `
    <tr>
      <td>${x.date}</td>
      <td>${x.category}</td>
      <td>${x.note || ''}</td>
      <td class='right'>${PKR(x.amount)}</td>
      <td>${asName(x.createdBy)}</td>
      <td>${fmtDateTime12(x.createdAt)}</td>
    </tr>`).join('');

  // re-apply active table filters (defined in app.js)
  if (window._tableFilters) window._tableFilters.forEach(fn => fn());
}
