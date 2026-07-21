/**
 * payroll — Gaji Capster. Owner/Admin generate & lihat semua slip;
 * Capster hanya lihat slip miliknya sendiri (read-only).
 */

import { apiCall } from '../../core/api.js';
import { getCurrentUser, hasRole } from '../../core/auth.js';
import { showToast, escapeHtml } from '../../core/ui.js';
import { formatRupiah, formatDateTimeID } from '../../core/format.js';

function payrollRowHtml(p) {
  return `
    <tr class="border-b border-slate-100 dark:border-slate-800/60">
      <td class="py-2 pr-3">${escapeHtml(p.NamaCapster)}</td>
      <td class="py-2 pr-3">${escapeHtml(p.Periode)}</td>
      <td class="py-2 pr-3">${p.TotalKepala}</td>
      <td class="py-2 pr-3">${formatRupiah(p.TotalPendapatan)}</td>
      <td class="py-2 pr-3">${p.PersentaseBagiHasil}%</td>
      <td class="py-2 pr-3">${formatRupiah(p.BagiHasilAmount)}</td>
      <td class="py-2 pr-3">${formatRupiah(p.Bonus)}</td>
      <td class="py-2 pr-3">${formatRupiah(p.Potongan)}</td>
      <td class="py-2 pr-3">${formatRupiah(p.Keterlambatan)}</td>
      <td class="py-2 pr-3 font-bold ${p.TotalGaji < 0 ? 'text-red-600 dark:text-red-400' : 'text-barber-600 dark:text-barber-400'}">${formatRupiah(p.TotalGaji)}</td>
      <td class="py-2 pr-3 text-slate-500 dark:text-slate-400">${escapeHtml(formatDateTimeID(p.GeneratedAt))}</td>
    </tr>`;
}

async function renderTable(container, action) {
  const wrap = container.querySelector('#payroll-table-wrap');
  wrap.innerHTML = `<div class="p-6 text-sm text-slate-500">Memuat data gaji...</div>`;
  let rows;
  try {
    rows = await apiCall(action, {});
  } catch (err) {
    wrap.innerHTML = `<div class="p-6 text-sm text-red-600 dark:text-red-400">Gagal memuat: ${escapeHtml(err.message)}</div>`;
    return;
  }
  wrap.innerHTML = `
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <th class="py-2 pr-3">Capster</th><th class="py-2 pr-3">Periode</th><th class="py-2 pr-3">Kepala</th>
          <th class="py-2 pr-3">Pendapatan</th><th class="py-2 pr-3">%</th><th class="py-2 pr-3">Bagi Hasil</th>
          <th class="py-2 pr-3">Bonus</th><th class="py-2 pr-3">Potongan</th><th class="py-2 pr-3">Telat</th>
          <th class="py-2 pr-3">Total Gaji</th><th class="py-2 pr-3">Digenerate</th>
        </tr>
      </thead>
      <tbody>${rows.map(payrollRowHtml).join('')}</tbody>
    </table>
    ${rows.length === 0 ? '<p class="p-4 text-center text-sm text-slate-400">Belum ada slip gaji.</p>' : ''}
  `;
}

export async function renderPayroll(container) {
  const user = getCurrentUser();
  const canGenerate = hasRole(user, ['Owner', 'Admin']);
  const viewAction = canGenerate ? 'payroll.viewAll' : 'payroll.viewSelf';
  const todayYmd = new Date().toISOString().slice(0, 10);

  container.innerHTML = `
    <div class="mx-auto max-w-5xl space-y-6">
      <h1 class="text-xl font-bold">Gaji Capster</h1>

      ${
        canGenerate
          ? `
      <form id="form-generate-payroll" class="glass-card grid gap-4 p-6 sm:grid-cols-3">
        <div>
          <label class="label-field" for="pr-capster">Capster</label>
          <select id="pr-capster" class="input-field" required></select>
        </div>
        <div>
          <label class="label-field" for="pr-start">Periode Mulai</label>
          <input id="pr-start" type="date" class="input-field" value="${todayYmd}" required />
        </div>
        <div>
          <label class="label-field" for="pr-end">Periode Selesai</label>
          <input id="pr-end" type="date" class="input-field" value="${todayYmd}" required />
        </div>
        <div>
          <label class="label-field" for="pr-bonus">Bonus (Rp)</label>
          <input id="pr-bonus" type="number" min="0" value="0" class="input-field" />
        </div>
        <div>
          <label class="label-field" for="pr-potongan">Potongan (Rp)</label>
          <input id="pr-potongan" type="number" min="0" value="0" class="input-field" />
        </div>
        <div>
          <label class="label-field" for="pr-telat">Potongan Keterlambatan (Rp)</label>
          <input id="pr-telat" type="number" min="0" value="0" class="input-field" />
        </div>
        <div class="sm:col-span-3">
          <button type="submit" class="btn-barber">Hitung &amp; Simpan Gaji</button>
          <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">Total Kepala &amp; Pendapatan dihitung otomatis dari transaksi Barber capster ini pada periode terpilih. Generate ulang periode yang sama akan memperbarui slip yang sudah ada (bukan duplikat).</p>
        </div>
      </form>`
          : ''
      }

      <div class="glass-card overflow-x-auto p-4">
        <div id="payroll-table-wrap"></div>
      </div>
    </div>
  `;

  if (canGenerate) {
    let capsters = [];
    try {
      capsters = await apiCall('capster.list', {});
    } catch (err) {
      showToast('Gagal memuat daftar capster: ' + err.message, 'error');
    }
    container.querySelector('#pr-capster').innerHTML = capsters.map((c) => `<option value="${escapeHtml(c.CapsterID)}">${escapeHtml(c.Nama)}</option>`).join('');

    container.querySelector('#form-generate-payroll').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        capsterId: container.querySelector('#pr-capster').value,
        periodeStart: container.querySelector('#pr-start').value,
        periodeEnd: container.querySelector('#pr-end').value,
        bonus: container.querySelector('#pr-bonus').value,
        potongan: container.querySelector('#pr-potongan').value,
        keterlambatan: container.querySelector('#pr-telat').value
      };
      const submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      try {
        await apiCall('payroll.generate', payload);
        showToast('Gaji berhasil dihitung & disimpan', 'success');
        renderTable(container, viewAction);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  await renderTable(container, viewAction);
}
