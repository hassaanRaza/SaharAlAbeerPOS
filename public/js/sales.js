import { auth, db } from './firebase.js';
import { $, PKR, today, jsPDF, notify, asName, fmtDateTime12 } from './utils.js';
import { products, setLastSaleId } from './state.js';
import { collection, doc, getDocs, getDoc, addDoc, updateDoc, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const C = { sales: collection(db, 'sales') };

export async function loadSales() {
  const snap = await getDocs(query(C.sales, orderBy('createdAt', 'desc')));
  const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  $('#salesBody').innerHTML = rows.map(s => {
    const p = products.find(x => x.sku === s.sku);
    const profit = s.revenue - (s.costAtSale * s.qty);
    return `
      <tr>
        <td>${s.date}</td>
        <td>${s.sku} — ${p ? p.name : ''}</td>
        <td class='right'>${s.qty}</td>
        <td class='right'>${PKR(s.unitPrice)}</td>
        <td class='right'>${PKR(s.lineDiscount || 0)}</td>
        <td class='right'>${PKR(s.revenue)}</td>
        <td class='right'>${PKR(s.costAtSale)}</td>
        <td class='right'>${PKR(profit)}</td>
        <td>${asName(s.createdBy)}</td>
        <td>${fmtDateTime12(s.createdAt)}</td>
      </tr>`;
  }).join('');
}

// Cart sale (multi-item)
export const cart = [];
export function renderCart() {
  const body = $('#cartBody');
  body.innerHTML = cart.map((x, i) => `<tr><td>${x.sku}</td><td>${x.name}</td><td class="right">${x.qty}</td><td class="right">${PKR(x.unit)}</td><td class="right">${PKR(x.disc || 0)}</td><td class="right">${PKR(x.lineGross)}</td><td><button data-i="${i}" class="ghost">Remove</button></td></tr>`).join('');
  body.querySelectorAll('button[data-i]').forEach(b => b.onclick = () => { cart.splice(Number(b.dataset.i), 1); updateTotals(); renderCart(); });
  updateTotals();
}
function updateTotals() {
  const gross = cart.reduce((s, x) => s + x.lineGross, 0);
  const hdr = Number($('#saleHeaderDisc').value || 0);
  const lineDisc = cart.reduce((s, x) => s + (x.disc || 0), 0);
  const payable = Math.max(0, gross - hdr - lineDisc);
  $('#cartItems').textContent = cart.length;
  $('#cartGross').textContent = PKR(gross);
  $('#cartHdr').textContent = PKR(hdr);
  $('#cartPay').textContent = PKR(payable);
  $('#btnSaveSale').textContent = `Save Sale (${cart.length})`;
}
export function bindCartInputs() { $('#saleHeaderDisc').oninput = updateTotals; }

export function addCartLine(sel) {
  const { saleProduct, saleQty, salePrice, saleDisc } = sel;
  const sku = saleProduct.value; const qty = Number(saleQty.value || 0); const unit = Number(salePrice.value || 0); const disc = Number(saleDisc.value || 0);
  const p = products.find(x => x.sku === sku); if (!p) return notify.error('Select a product first.');
  if (qty <= 0 || unit <= 0) return notify.error('Enter valid quantity and unit price.');
  if (qty > (p.stock || 0)) return notify.warn('Not enough stock.');
  cart.push({ sku, name: p.name, qty, unit, disc, lineGross: qty * unit, costAtSale: p.avgCost || 0 });
  renderCart();
}

export async function saveCart() {
  if (!cart.length) return notify.error('Cart is empty.');
  const orderId = `SO-${Date.now()}`;
  const hdrDisc = Number($('#saleHeaderDisc').value || 0);
  const coupon = ($('#saleCoupon').value || '').trim();
  const gross = cart.reduce((s, x) => s + x.lineGross, 0);
  const user = auth.currentUser?.email || 'unknown@user';

  for (const line of cart) {
    const hdrShare = gross > 0 ? (line.lineGross / gross) * hdrDisc : 0;
    const revenue = Math.max(0, line.lineGross - (line.disc || 0) - hdrShare);

    const ref = doc(db, 'products', line.sku);
    const snap = await getDoc(ref); const p = snap.data();
    if (line.qty > (p.stock || 0)) { notify.warn(`Insufficient stock for ${line.sku}`); return; }
    await updateDoc(ref, { stock: (p.stock || 0) - line.qty });

    const sRef = await addDoc(C.sales, {
      orderId, date: today(), sku: line.sku, qty: line.qty,
      unitPrice: line.unit, lineDiscount: line.disc || 0, headerDiscountShare: Math.round(hdrShare),
      revenue: Math.round(revenue), costAtSale: line.costAtSale,
      coupon: coupon || null,
      createdAt: Date.now(), createdBy: user
    });
    setLastSaleId(sRef.id);
  }

  // clear cart & form inputs
  cart.length = 0; renderCart(); updateTotals();
  $('#saleHeaderDisc').value = '';
  $('#saleCoupon').value = '';
  $('#saleQty').value = 1;
  $('#saleDisc').value = 0;

  notify.success(`Sale saved: ${orderId}`);

  // Refresh KPIs live
  window.renderKPIs?.();
}

// Invoice for last line
export async function invoice(lastId) {
  if (!lastId) return notify.info('Do a sale first to generate an invoice.');
  const sDoc = await getDoc(doc(db, 'sales', lastId)); const s = sDoc.data();
  const pdf = new jsPDF(); pdf.setFontSize(16); pdf.text('Sahar-Al-Abeer', 14, 16);
  pdf.setFontSize(10); pdf.text('Invoice', 14, 24); pdf.text(`Date: ${s.date}`, 14, 30);
  pdf.text(`SKU: ${s.sku}`, 14, 36); pdf.text(`Qty: ${s.qty}   Unit: PKR ${s.unitPrice}`, 14, 42);
  pdf.text(`Discount: PKR ${s.lineDiscount || 0}`, 14, 48); pdf.text(`Payable: PKR ${s.revenue}`, 14, 54);
  pdf.line(14, 58, 196, 58); pdf.text('Thank you!', 14, 66); pdf.save(`invoice_${lastId}.pdf`);
}
