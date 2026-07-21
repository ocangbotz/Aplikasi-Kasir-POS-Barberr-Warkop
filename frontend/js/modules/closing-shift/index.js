/**
 * closing-shift — buka/tutup kas kasir + riwayat shift (Owner/Admin bisa
 * membuka kembali shift yang sudah ditutup).
 */

import { apiCall } from '../../core/api.js';
import { getCurrentUser, hasRole } from '../../core/auth.js';
import { showToast, confirmDialog, escapeHtml } from '../../core/ui.js';
import { formatRupiah, formatDateTimeID } from '../../core/format.js';

function selisihBadge(selisih) {
  if (selisih === 0) return '<span class="badge-gabungan">Pas</span>';
  if (selisih > 0) return `<span class="badge-gabungan">Lebih ${formatRupiah(selisih)}</span>`;
  return `<span class="badge-danger">Kurang ${formatRupiah(-selisih)}</span>`;
}

async function renderShiftStatus(container) {
  const el = container.querySelector('#shift-status-card');
  el.innerHTML = `<div class="glass-card p-6 text-sm text-slate-500">Memuat status shift...</div>`;

  let preview;
  try {
    preview = await apiCall('shift.view', { preview: true });
  } catch (err) {
    el.innerHTML = `<div class="glass-card p-6 text-red-600 dark:text-red-400">Gagal memuat: ${escapeHtml(err.message)}</div>`;
    return;
  }

  if (!preview) {
    el.innerHTML = `
      <div class="glass-card p-6">
        <h2 class="mb-3 font-semibold">Belum Ada Shift Terbuka</h2>
        <form id="form-open-shift" class="flex flex-wrap items-end gap-3">
          <div>
            <label class="label-field" for="saldo-awal">Saldo Awal Kas</label>
            <input id="saldo-awal" type="number" min="0" value="0" class="input-field" required />
          </div>
          <button type="submit" class="btn-primary">Buka Shift</button>
        </form>
      </div>
    `;
    el.querySelector('#form-open-shift').addEventListener('submit', async (e) => {
      e.preventDefault();
      const saldoAwal = el.querySelector('#saldo-awal').value;
      try {
        await apiCall('shift.open', { saldoAwal });
        showToast('Shift berhasil dibuka', 'success');
        renderShiftStatus(container);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
    return;
  }

  el.innerHTML = `
    <div class="glass-card p-6">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="font-semibold">Shift Sedang Berjalan</h2>
        <span class="badge-neutral">Dibuka ${escapeHtml(formatDateTimeID(preview.shift.TanggalBuka))}</span>
      </div>
      <div class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="stat-tile"><div class="text-xs text-slate-500">Saldo Awal</div><div class="text-lg font-bold">${formatRupiah(preview.shift.SaldoAwal)}</div></div>
        <div class="stat-tile"><div class="text-xs text-slate-500">Cash Barber</div><div class="text-lg font-bold text-barber-600 dark:text-barber-400">${formatRupiah(preview.cashBarber)}</div></div>
        <div class="stat-tile"><div class="text-xs text-slate-500">Cash Warkop</div><div class="text-lg font-bold text-warkop-600 dark:text-warkop-400">${formatRupiah(preview.cashWarkop)}</div></div>
        <div class="stat-tile"><div class="text-xs text-slate-500">Estimasi Kas Sistem</div><div class="text-lg font-bold">${formatRupiah(preview.totalSistemEstimasi)}</div></div>
        <div class="stat-tile"><div class="text-xs text-slate-500">QRIS Barber</div><div class="text-lg font-bold">${formatRupiah(preview.qrisBarber)}</div></div>
        <div class="stat-tile"><div class="text-xs text-slate-500">QRIS Warkop</div><div class="text-lg font-bold">${formatRupiah(preview.qrisWarkop)}</div></div>
        <div class="stat-tile"><div class="text-xs text-slate-500">Pengeluaran Barber</div><div class="text-lg font-bold text-red-600 dark:text-red-400">${formatRupiah(preview.pengeluaranBarber)}</div></div>
        <div class="stat-tile"><div class="text-xs text-slate-500">Pengeluaran Warkop</div><div class="text-lg font-bold text-red-600 dark:text-red-400">${formatRupiah(preview.pengeluaranWarkop)}</div></div>
      </div>
      <form id="form-close-shift" class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="label-field" for="uang-fisik">Uang Kas Fisik (hasil hitung manual)</label>
          <input id="uang-fisik" type="number" min="0" class="input-field" required />
        </div>
        <div>
          <label class="label-field" for="catatan-kasir">Catatan Kasir</label>
          <input id="catatan-kasir" class="input-field" />
        </div>
        <div class="sm:col-span-2">
          <button type="submit" class="btn-danger">Tutup Kas</button>
        </div>
      </form>
    </div>
  `;

  el.querySelector('#form-close-shift').addEventListener('submit', async (e) => {
    e.preventDefault();
    const uangFisik = el.querySelector('#uang-fisik').value;
    const catatanKasir = el.querySelector('#catatan-kasir').value;
    const ok = await confirmDialog('Setelah ditutup, shift ini terkunci dan tidak bisa diedit kecuali dibuka kembali oleh Owner/Admin. Lanjutkan?', {
      title: 'Konfirmasi Tutup Kas', confirmText: 'Ya, Tutup Kas', danger: true
    });
    if (!ok) return;
    try {
      const result = await apiCall('shift.close', { uangFisik, catatanKasir });
      showToast('Kas berhasil ditutup', 'success');
      showCloseSummary(container, result);
      renderShiftStatus(container);
      renderRiwayat(container);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

function showCloseSummary(container, shift) {
  const el = container.querySelector('#shift-close-summary');
  el.innerHTML = `
    <div class="glass-card p-6">
      <h2 class="mb-3 font-semibold">Ringkasan Penutupan Kas Terakhir</h2>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div class="stat-tile"><div class="text-xs text-slate-500">Total Sistem</div><div class="text-lg font-bold">${formatRupiah(shift.TotalSistem)}</div></div>
        <div class="stat-tile"><div class="text-xs text-slate-500">Uang Fisik</div><div class="text-lg font-bold">${formatRupiah(shift.UangFisik)}</div></div>
        <div class="stat-tile"><div class="text-xs text-slate-500">Selisih</div><div class="text-lg font-bold">${selisihBadge(shift.Selisih)}</div></div>
      </div>
    </div>
  `;
}

async function renderRiwayat(container) {
  const el = container.querySelector('#shift-riwayat');
  const canReopen = hasRole(getCurrentUser(), ['Owner', 'Admin']);
  el.innerHTML = `<div class="glass-card p-6 text-sm text-slate-500">Memuat riwayat shift...</div>`;

  let rows;
  try {
    rows = await apiCall('shift.view', {});
  } catch (err) {
    el.innerHTML = `<div class="glass-card p-6 text-red-600 dark:text-red-400">Gagal memuat: ${escapeHtml(err.message)}</div>`;
    return;
  }

  el.innerHTML = `
    <div class="glass-card overflow-x-auto p-4">
      <h2 class="mb-3 px-2 font-semibold">Riwayat Shift</h2>
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <th class="py-2 pr-3">Kasir</th>
            <th class="py-2 pr-3">Dibuka</th>
            <th class="py-2 pr-3">Ditutup</th>
            <th class="py-2 pr-3">Total Sistem</th>
            <th class="py-2 pr-3">Selisih</th>
            <th class="py-2 pr-3">Status</th>
            ${canReopen ? '<th class="py-2 pr-3">Aksi</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (s) => `
            <tr class="border-b border-slate-100 dark:border-slate-800/60" data-shift-id="${escapeHtml(s.ShiftID)}">
              <td class="py-2 pr-3">${escapeHtml(s.NamaKasir)}</td>
              <td class="py-2 pr-3 text-slate-500 dark:text-slate-400">${escapeHtml(formatDateTimeID(s.TanggalBuka))}</td>
              <td class="py-2 pr-3 text-slate-500 dark:text-slate-400">${s.TanggalTutup ? escapeHtml(formatDateTimeID(s.TanggalTutup)) : '-'}</td>
              <td class="py-2 pr-3">${s.Status === 'Closed' ? formatRupiah(s.TotalSistem) : '-'}</td>
              <td class="py-2 pr-3">${s.Status === 'Closed' ? selisihBadge(s.Selisih) : '-'}</td>
              <td class="py-2 pr-3">${s.Status === 'Open' ? '<span class="badge-neutral">Open</span>' : '<span class="badge-gabungan">Closed</span>'}</td>
              ${canReopen ? `<td class="py-2 pr-3">${s.Status === 'Closed' ? '<button type="button" class="btn-outline !px-2.5 !py-1.5 text-xs" data-action="reopen">Buka Kembali</button>' : ''}</td>` : ''}
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
      ${rows.length === 0 ? '<p class="p-4 text-center text-sm text-slate-400">Belum ada riwayat shift.</p>' : ''}
    </div>
  `;

  if (!canReopen) return;
  el.querySelectorAll('[data-action="reopen"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const shiftId = btn.closest('[data-shift-id]').dataset.shiftId;
      const reason = window.prompt('Alasan membuka kembali shift ini:');
      if (!reason) return;
      try {
        await apiCall('shift.reopen', { shiftId, reason });
        showToast('Shift berhasil dibuka kembali', 'success');
        renderRiwayat(container);
        renderShiftStatus(container);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

export async function renderClosingShift(container) {
  container.innerHTML = `
    <div class="mx-auto max-w-4xl space-y-6">
      <h1 class="text-xl font-bold">Closing Shift (Tutup Kas)</h1>
      <div id="shift-status-card"></div>
      <div id="shift-close-summary"></div>
      <div id="shift-riwayat"></div>
    </div>
  `;
  await renderShiftStatus(container);
  await renderRiwayat(container);
}
