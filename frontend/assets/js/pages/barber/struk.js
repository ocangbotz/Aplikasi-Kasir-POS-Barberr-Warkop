/**
 * pages/barber/struk.js
 * Render & cetak struk transaksi Barber. Dipakai baik langsung setelah
 * transaksi dibuat maupun untuk cetak ulang dari halaman riwayat.
 */
import { apiCall } from '../../core/api.js';
import { formatRupiah, formatDateID } from '../../core/format.js';

function strukHtml(transaksi, settings) {
  const items = Array.isArray(transaksi.Layanan) ? transaksi.Layanan : [];
  const itemsHtml = items.map((it) => `
    <div class="flex justify-between gap-2 py-0.5">
      <span>${it.nama}</span>
      <span>${formatRupiah(it.harga)}</span>
    </div>`).join('');

  const qrisBlock = transaksi.MetodePembayaran === 'QRIS' && settings.qris_image_url
    ? `<div class="mt-3 flex flex-col items-center">
         <img src="${settings.qris_image_url}" alt="QRIS" class="h-32 w-32 object-contain" />
         <p class="mt-1 text-[10px]">Scan QRIS untuk pembayaran</p>
       </div>`
    : '';

  const logoBlock = settings.logo_url
    ? `<img src="${settings.logo_url}" alt="Logo" class="mx-auto mb-1 h-10 w-10 rounded object-contain" />`
    : `<div class="mx-auto mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-lg text-white">✂</div>`;

  return `
    <div class="font-mono text-xs leading-relaxed text-slate-900">
      <div class="text-center">
        ${logoBlock}
        <p class="text-sm font-bold">${settings.nama_usaha || 'Barber & Warkop'}</p>
        ${settings.alamat ? `<p>${settings.alamat}</p>` : ''}
        ${settings.whatsapp ? `<p>WA: ${settings.whatsapp}</p>` : ''}
        ${settings.instagram ? `<p>IG: ${settings.instagram}</p>` : ''}
      </div>
      <div class="my-2 border-t border-dashed border-slate-400"></div>
      <div>No: ${transaksi.NomorTransaksi}</div>
      <div>Tanggal: ${formatDateID(transaksi.Tanggal)} ${transaksi.Jam}</div>
      <div>Kasir: ${transaksi.NamaKasir}</div>
      <div>Capster: ${transaksi.NamaCapster}</div>
      <div>Pelanggan: ${transaksi.NamaPelanggan}</div>
      <div class="my-2 border-t border-dashed border-slate-400"></div>
      ${itemsHtml}
      <div class="my-2 border-t border-dashed border-slate-400"></div>
      <div class="flex justify-between"><span>Subtotal</span><span>${formatRupiah(transaksi.Subtotal)}</span></div>
      <div class="flex justify-between"><span>Diskon</span><span>-${formatRupiah(transaksi.Diskon)}</span></div>
      <div class="flex justify-between text-sm font-bold"><span>Total</span><span>${formatRupiah(transaksi.GrandTotal)}</span></div>
      <div class="flex justify-between"><span>Bayar</span><span>${transaksi.MetodePembayaran}</span></div>
      ${qrisBlock}
      <div class="my-2 border-t border-dashed border-slate-400"></div>
      <p class="text-center">Terima kasih atas kunjungan Anda!</p>
    </div>`;
}

export async function openStrukModal(transaksi) {
  const { settings } = await apiCall('getSettings', {});

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 p-4 print:hidden';
  overlay.innerHTML = `
    <div class="glass-card w-full max-w-xs overflow-hidden">
      <div class="max-h-[70vh] overflow-y-auto bg-white p-4" id="struk-print-area">
        ${strukHtml(transaksi, settings)}
      </div>
      <div class="flex gap-2 border-t border-slate-200/70 p-3 dark:border-white/10">
        <button type="button" id="struk-close" class="btn-ghost flex-1">Tutup</button>
        <button type="button" id="struk-print" class="btn-primary flex-1">🖨️ Cetak</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('#struk-close').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#struk-print').addEventListener('click', () => window.print());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}
