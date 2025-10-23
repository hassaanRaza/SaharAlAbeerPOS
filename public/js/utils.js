// js/utils.js
export const $ = (s) => document.querySelector(s);
export const PKR = (n) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(n || 0);
export const today = () => new Date().toISOString().slice(0, 10);
export const toCSV = (rows) => rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
export const includes = (h, n) => String(h || '').toLowerCase().includes(String(n || '').toLowerCase());
export const filterProducts = (list, q) => !q ? list : list.filter(p => includes(p.sku, q) || includes(p.name, q));
export const jsPDF = window.jspdf.jsPDF;

/* ---- Partner display names (email -> short name) ---- */
export const userMap = {
    "hassan@saharalabeer.com": "Hassan",
    "hunain@saharalabeer.com": "Hunain",
    "madani@saharalabeer.com": "Madani",
    "mukarram@saharalabeer.com": "Mukarram"
};
export const asName = (email) => userMap[email] || email || "—";

/* ---- 12-hour PK date/time formatter ---- */
export const fmtDateTime12 = (t) => t
    ? new Date(t).toLocaleString('en-PK', {
        hour12: true,
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    })
    : '—';

// --- SweetAlert2 helpers ---
export const notify = {
    success: (msg, title = 'Success') =>
        Swal.fire({ icon: 'success', title, text: msg, timer: 1800, showConfirmButton: false }),
    error: (msg, title = 'Error') =>
        Swal.fire({ icon: 'error', title, text: msg }),
    info: (msg, title = 'Note') =>
        Swal.fire({ icon: 'info', title, text: msg }),
    warn: (msg, title = 'Warning') =>
        Swal.fire({ icon: 'warning', title, text: msg }),
    toast: (msg, icon = 'success') =>
        Swal.fire({ toast: true, position: 'top-end', icon, title: msg, timer: 1800, showConfirmButton: false }),
    confirm: (msg, title = 'Are you sure?', confirmText = 'Yes') =>
        Swal.fire({ title, text: msg, icon: 'warning', showCancelButton: true, confirmButtonText: confirmText })
            .then(r => r.isConfirmed)
};
