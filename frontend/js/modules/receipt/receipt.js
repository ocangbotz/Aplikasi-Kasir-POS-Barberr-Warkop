/**
 * receipt.js — modal struk yang bisa dicetak (window.print), dipakai modul
 * Barber (Fase 3) & Warkop (Fase 4). Isi struk sesuai spesifikasi: logo,
 * nama usaha, alamat, WA, IG, kasir, capster (khusus Barber), nomor
 * transaksi, tanggal/jam, item, subtotal, diskon, grand total, metode
 * bayar, QR code QRIS, ucapan terima kasih.
 */

import { getSettings } from '../../core/settings-cache.js';
import { formatRupiah } from '../../core/format.js';
import { escapeHtml } from '../../core/ui.js';

function metodeBayarLabel(t) {
  if (t.MetodeBayar === 'QRIS') return 'QRIS';
  if (t.MetodeBayar === 'Split') return 'Split (Cash + QRIS)';
  return 'Cash';
}

function receiptItemsHtml(items) {
  return (items || [])
    .map(
      (it) => `
    <div class="flex justify-between gap-2 text-xs">
      <span>${escapeHtml(it.nama)} x${it.qty}</span>
      <span class="whitespace-nowrap">${formatRupiah(it.harga * it.qty)}</span>
    </div>`
    )
    .join('');
}

function row(label, value, bold) {
  return `<div class="flex justify-between ${bold ? 'text-sm font-bold' : 'text-xs'}"><span>${label}</span><span>${value}</span></div>`;
}

/** transaksi: hasil transaksi.create/transaksi.list (sudah punya field Items array). jenisUsaha: 'Barber'|'Warkop'. */
export async function showReceiptModal(transaksi, jenisUsaha) {
  const settings = await getSettings();

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4 print:bg-white print:p-0';
  overlay.innerHTML = `
    <div class="glass-card flex max-h-[90vh] w-full max-w-sm flex-col bg-white dark:bg-slate-900 print:max-h-none print:shadow-none print:border-0 print:bg-white">
      <div class="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800 print:hidden">
        <h3 class="font-semibold">Struk Transaksi</h3>
        <button type="button" data-action="close" class="btn-outline !px-2.5 !py-1.5 text-xs">Tutup</button>
      </div>
      <div class="overflow-y-auto p-4">
        <div id="receipt-print-area" class="mx-auto w-full max-w-[300px] font-mono text-xs text-slate-900">
          ${settings.logoUrl ? `<img src="${escapeHtml(settings.logoUrl)}" class="mx-auto mb-2 h-12 w-12 object-contain" alt="Logo" />` : ''}
          <div class="text-center">
            <div class="text-sm font-bold">${escapeHtml(settings.businessName)}</div>
            ${settings.address ? `<div>${escapeHtml(settings.address)}</div>` : ''}
            ${settings.whatsapp ? `<div>WA: ${escapeHtml(settings.whatsapp)}</div>` : ''}
            ${settings.instagram ? `<div>IG: ${escapeHtml(settings.instagram)}</div>` : ''}
          </div>
          <div class="my-2 border-t border-dashed border-slate-400"></div>
          <div>No: ${escapeHtml(transaksi.NomorTransaksi)}</div>
          <div>Tanggal: ${escapeHtml(transaksi.Tanggal)} ${escapeHtml(transaksi.Jam)}</div>
          <div>Kasir: ${escapeHtml(transaksi.NamaKasir)}</div>
          ${jenisUsaha === 'Barber' ? `<div>Capster: ${escapeHtml(transaksi.NamaCapster)}</div>` : ''}
          ${transaksi.NamaPelanggan ? `<div>Pelanggan: ${escapeHtml(transaksi.NamaPelanggan)}</div>` : ''}
          <div class="my-2 border-t border-dashed border-slate-400"></div>
          ${receiptItemsHtml(transaksi.Items)}
          <div class="my-2 border-t border-dashed border-slate-400"></div>
          ${row('Subtotal', formatRupiah(transaksi.Subtotal))}
          ${transaksi.Diskon ? row('Diskon', '-' + formatRupiah(transaksi.Diskon)) : ''}
          ${row('Grand Total', formatRupiah(transaksi.GrandTotal), true)}
          <div class="my-2 border-t border-dashed border-slate-400"></div>
          ${row('Metode Bayar', metodeBayarLabel(transaksi))}
          ${transaksi.CashAmount ? row('Cash', formatRupiah(transaksi.CashAmount)) : ''}
          ${transaksi.QrisAmount ? row('QRIS', formatRupiah(transaksi.QrisAmount)) : ''}
          ${transaksi.Kembalian ? row('Kembalian', formatRupiah(transaksi.Kembalian)) : ''}
          ${
            (transaksi.MetodeBayar === 'QRIS' || transaksi.MetodeBayar === 'Split') && settings.qrisStaticImageUrl
              ? `<div class="my-2 text-center"><img src="${escapeHtml(settings.qrisStaticImageUrl)}" class="mx-auto h-32 w-32 object-contain" alt="QRIS" /></div>`
              : ''
          }
          <div class="my-2 border-t border-dashed border-slate-400"></div>
          <div class="text-center">${escapeHtml(settings.receiptFooterMessage)}</div>
        </div>
      </div>
      <div class="border-t border-slate-200 p-4 dark:border-slate-800 print:hidden">
        <button type="button" data-action="print" class="btn-primary w-full">Cetak Struk</button>
      </div>
    </div>
  `;

  overlay.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'close') overlay.remove();
    if (action === 'print') window.print();
  });

  document.body.appendChild(overlay);
}
