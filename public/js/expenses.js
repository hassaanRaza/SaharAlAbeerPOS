import { db } from './firebase.js';
import { $, PKR, today } from './utils.js';
import { collection, addDoc, getDocs, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const C = { expenses: collection(db,'expenses') };

export async function addExpense(){
  const e = { date: $('#exDate').value||today(), category: $('#exCat').value, amount: Number($('#exAmt').value||0), note: $('#exNote').value||'', createdAt: Date.now() };
  if(!e.amount) return alert('Enter amount');
  await addDoc(C.expenses, e); await loadExpenses();
}
export async function loadExpenses(){
  const snap = await getDocs(query(C.expenses, orderBy('createdAt','desc')));
  const rows = snap.docs.map(d=>d.data());
  $('#exBody').innerHTML = rows.map(x=>`<tr><td>${x.date}</td><td>${x.category}</td><td>${x.note||''}</td><td class='right'>${PKR(x.amount)}</td></tr>`).join('');
}
