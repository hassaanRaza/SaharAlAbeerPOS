export const $ = (s)=>document.querySelector(s);
export const PKR = (n)=> new Intl.NumberFormat(undefined,{style:'currency',currency:'PKR',maximumFractionDigits:0}).format(n||0);
export const today = ()=> new Date().toISOString().slice(0,10);
export const toCSV = (rows)=> rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');
export const includes = (h, n)=> String(h||'').toLowerCase().includes(String(n||'').toLowerCase());
export const filterProducts = (list,q)=> !q?list:list.filter(p=>includes(p.sku,q)||includes(p.name,q));
export const jsPDF = window.jspdf.jsPDF;
