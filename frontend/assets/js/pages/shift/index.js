/**
 * pages/shift/index.js
 * Closing Shift (Tutup Kas): buka shift dengan saldo awal, tutup shift
 * dengan input uang kas fisik (Cash/QRIS/Pengeluaran dihitung otomatis oleh
 * backend dari transaksi selama shift berjalan), dan riwayat shift + reopen
 * (Owner/Admin).
 */
import { apiCall, ApiError } from '../../core/api.js';
import { toastError, toastSuccess } from '../../core/toast.js';
import { formatRupiah } from '../../core/format.js';
import { hasPermission } from '../../core/auth.js';

function fmtDateTime(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

export async function renderShift(root) {
  root.innerHTML = `
    <div class="mx-auto max-w-4xl space-y-4">
      <div id="current-shift-area"></div>

      <div class="glass-card overflow-x-auto p-2">
        <h2 class="p-2 text-sm font-bold text-slate-900 dark:text-white">Riwayat Shift</h2>
        <table class="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr class="text-xs uppercase text-slate-400">
              <th class="px-3 py-2">Kasir</th>
              <th class="px-3 py-2">Buka</th>
              <th class="px-3 py-2">Tutup</th>
              <th class="px-3 py-2">Saldo Awal</th>
              <th class="px-3 py-2">Total Seharusnya</th>
              <th class="px-3 py-2">Kas Fisik</th>
              <th class="px-3 py-2">Selisih</th>
              <th class="px-3 py-2">Status</th>
              <th class="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody id="shift-body"></tbody>
        </table>
      </div>
    </div>
  `;

  async function loadCurrent() {
    const area = root.querySelector('#current-shift-area');
    try {
      const { shift } = await apiCall('shiftGetCurrent', {});
      if (!shift) {
        area.innerHTML = `
          <form id="open-form" class="glass-card space-y-3 p-4">
            <h2 class="text-sm font-bold text-slate-900 dark:text-white">Buka Shift</h2>
            <div>
              <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Saldo Awal Kas (Rp)</label>
              <input id="saldo-awal" type="number" min="0" value="0" class="input-field" />
            </div>
            <button type="submit" class="btn-primary">Buka Shift</button>
          </form>`;
        area.querySelector('#open-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          try {
            await apiCall('shiftOpen', { saldoAwal: Number(root.querySelector('#saldo-awal').value) || 0 });
            toastSuccess('Shift dibuka.');
            loadCurrent();
            loadHistory();
          } catch (err) {
            toastError(err instanceof ApiError ? err.message : 'Gagal membuka shift.');
          }
        });
        return;
      }

      area.innerHTML = `
        <form id="close-form" class="glass-card space-y-3 p-4">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-bold text-slate-900 dark:text-white">Shift Sedang Berjalan</h2>
            <span class="rounded-full bg-gabungan-100 px-2 py-0.5 text-xs font-medium text-gabungan-700 dark:bg-gabungan-500/10 dark:text-gabungan-300">Terbuka</span>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400">Dibuka: ${fmtDateTime(shift.JamBuka)} · Saldo Awal: ${formatRupiah(shift.SaldoAwal)}</p>
          <p class="text-xs text-slate-400">Cash, QRIS, dan Pengeluaran akan dihitung otomatis dari transaksi yang tercatat selama shift ini saat ditutup.</p>
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Uang Kas Fisik Saat Ini (Rp)</label>
            <input id="uang-kas-fisik" type="number" min="0" required class="input-field" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Catatan Kasir</label>
            <textarea id="catatan-kasir" rows="2" class="input-field"></textarea>
          </div>
          <button type="submit" class="btn-primary">Tutup Kas</button>
        </form>`;
      area.querySelector('#close-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          const { shift: closed } = await apiCall('shiftClose', {
            uangKasFisik: Number(root.querySelector('#uang-kas-fisik').value),
            catatanKasir: root.querySelector('#catatan-kasir').value.trim()
          });
          toastSuccess(`Shift ditutup. Selisih kas: ${formatRupiah(closed.SelisihKas)}`);
          loadCurrent();
          loadHistory();
        } catch (err) {
          toastError(err instanceof ApiError ? err.message : 'Gagal menutup shift.');
        }
      });
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Gagal memuat status shift.');
    }
  }

  async function loadHistory() {
    try {
      const { shift } = await apiCall('shiftList', { pageSize: 30 });
      root.querySelector('#shift-body').innerHTML = shift.map((s) => `
        <tr class="border-t border-slate-200/60 dark:border-white/10">
          <td class="px-3 py-2">${s.NamaKasir}</td>
          <td class="px-3 py-2">${fmtDateTime(s.JamBuka)}</td>
          <td class="px-3 py-2">${fmtDateTime(s.JamTutup)}</td>
          <td class="px-3 py-2">${formatRupiah(s.SaldoAwal)}</td>
          <td class="px-3 py-2">${formatRupiah(s.TotalSeharusnya)}</td>
          <td class="px-3 py-2">${formatRupiah(s.UangKasFisik)}</td>
          <td class="px-3 py-2 font-semibold ${s.SelisihKas === 0 ? 'text-gabungan-600 dark:text-gabungan-400' : 'text-red-500'}">${formatRupiah(s.SelisihKas)}</td>
          <td class="px-3 py-2">
            <span class="rounded-full px-2 py-0.5 text-xs font-medium ${s.Status === 'Terbuka' ? 'bg-barber-100 text-barber-700 dark:bg-barber-500/10 dark:text-barber-300' : 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-400'}">${s.Status}</span>
          </td>
          <td class="px-3 py-2">
            ${s.Status === 'Ditutup' && hasPermission('reopenShift') ? `<button type="button" data-id="${s.ID}" class="reopen-btn btn-ghost !px-2 !py-1 text-xs">🔓 Buka Lagi</button>` : ''}
          </td>
        </tr>`).join('');

      root.querySelectorAll('.reopen-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          try {
            await apiCall('shiftReopen', { id: btn.dataset.id });
            toastSuccess('Shift dibuka kembali.');
            loadCurrent();
            loadHistory();
          } catch (err) {
            toastError(err instanceof ApiError ? err.message : 'Gagal membuka kembali shift.');
          }
        });
      });
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Gagal memuat riwayat shift.');
    }
  }

  await Promise.all([loadCurrent(), loadHistory()]);
}
