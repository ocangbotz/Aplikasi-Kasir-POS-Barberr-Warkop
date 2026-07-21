/**
 * barber/pelanggan — daftar & pencarian pelanggan Barber, detail riwayat
 * haircut, member & poin loyalti. Pelanggan baru otomatis dibuat saat
 * transaksi (Barber.js); halaman ini untuk melihat & mengedit data mereka.
 */

import { apiCall } from '../../core/api.js';
import { showToast, escapeHtml } from '../../core/ui.js';
import { formatRupiah, formatDateTimeID } from '../../core/format.js';

function pelangganRowHtml(p) {
  return `
    <tr class="cursor-pointer border-b border-slate-100 hover:bg-white/70 dark:border-slate-800/60 dark:hover:bg-white/5" data-pelanggan-id="${escapeHtml(p.PelangganID)}">
      <td class="py-2 pr-3">${escapeHtml(p.Nama)} ${p.Member ? '<span class="badge-barber ml-1">Member</span>' : ''}</td>
      <td class="py-2 pr-3">${escapeHtml(p.NoHP)}</td>
      <td class="py-2 pr-3">${p.TotalKunjungan}</td>
      <td class="py-2 pr-3">${formatRupiah(p.TotalPengeluaran)}</td>
      <td class="py-2 pr-3">${p.PoinLoyalti}</td>
    </tr>`;
}

export async function renderPelangganBarber(container) {
  container.innerHTML = `
    <div class="mx-auto max-w-4xl">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 class="text-xl font-bold">Data Pelanggan — Barber</h1>
        <input id="pelanggan-search" class="input-field !w-64" placeholder="Cari nama / no HP..." />
      </div>
      <div class="glass-card overflow-x-auto p-4">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <th class="py-2 pr-3">Nama</th>
              <th class="py-2 pr-3">No HP</th>
              <th class="py-2 pr-3">Kunjungan</th>
              <th class="py-2 pr-3">Total Belanja</th>
              <th class="py-2 pr-3">Poin</th>
            </tr>
          </thead>
          <tbody id="pelanggan-table-body"></tbody>
        </table>
      </div>
    </div>
    <div id="pelanggan-detail-modal"></div>
  `;

  const tbody = container.querySelector('#pelanggan-table-body');
  const searchInput = container.querySelector('#pelanggan-search');
  let searchTimer = null;

  async function loadAll() {
    tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-sm text-slate-500">Memuat...</td></tr>`;
    try {
      const rows = await apiCall('pelanggan.view', {});
      tbody.innerHTML = rows.length ? rows.map(pelangganRowHtml).join('') : '<tr><td colspan="5" class="p-4 text-center text-sm text-slate-400">Belum ada pelanggan.</td></tr>';
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-sm text-red-600 dark:text-red-400">Gagal memuat: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  async function search(query) {
    if (!query) return loadAll();
    tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-sm text-slate-500">Mencari...</td></tr>`;
    try {
      const rows = await apiCall('pelanggan.view', { query });
      tbody.innerHTML = rows.length ? rows.map(pelangganRowHtml).join('') : '<tr><td colspan="5" class="p-4 text-center text-sm text-slate-400">Tidak ditemukan.</td></tr>';
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-sm text-red-600 dark:text-red-400">Gagal mencari: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => search(searchInput.value.trim()), 300);
  });

  tbody.addEventListener('click', async (e) => {
    const row = e.target.closest('[data-pelanggan-id]');
    if (!row) return;
    await showDetail(row.dataset.pelangganId);
  });

  async function showDetail(pelangganId) {
    const modalRoot = container.querySelector('#pelanggan-detail-modal');
    let detail;
    try {
      detail = await apiCall('pelanggan.view', { pelangganId });
    } catch (err) {
      showToast(err.message, 'error');
      return;
    }
    const p = detail.pelanggan;
    const riwayat = detail.riwayatHaircut;

    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/50 p-4';
    overlay.innerHTML = `
      <div class="glass-card max-h-[85vh] w-full max-w-lg overflow-y-auto bg-white p-6 dark:bg-slate-900">
        <div class="mb-4 flex items-start justify-between">
          <div>
            <h3 class="text-lg font-semibold">${escapeHtml(p.Nama)}</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400">${escapeHtml(p.NoHP)}</p>
          </div>
          <button type="button" data-action="close" class="btn-outline !px-2.5 !py-1.5 text-xs">Tutup</button>
        </div>
        <div class="mb-4 grid grid-cols-3 gap-3 text-center text-sm">
          <div class="glass-panel p-3"><div class="text-lg font-bold">${p.TotalKunjungan}</div><div class="text-xs text-slate-500">Kunjungan</div></div>
          <div class="glass-panel p-3"><div class="text-lg font-bold">${formatRupiah(p.TotalPengeluaran)}</div><div class="text-xs text-slate-500">Total Belanja</div></div>
          <div class="glass-panel p-3"><div class="text-lg font-bold">${p.PoinLoyalti}</div><div class="text-xs text-slate-500">Poin Loyalti</div></div>
        </div>
        <label class="mb-4 flex items-center gap-2 text-sm">
          <input type="checkbox" id="pelanggan-member-toggle" ${p.Member ? 'checked' : ''} />
          Member
        </label>
        <h4 class="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Riwayat Haircut</h4>
        <div class="space-y-2">
          ${
            riwayat.length
              ? riwayat
                  .map(
                    (t) => `
            <div class="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800">
              <div class="flex justify-between">
                <span>${escapeHtml(formatDateTimeID(t.CreatedAt))}</span>
                <span class="font-medium">${formatRupiah(t.GrandTotal)}</span>
              </div>
              <div class="text-xs text-slate-500 dark:text-slate-400">Capster: ${escapeHtml(t.NamaCapster)} · ${escapeHtml(t.NomorTransaksi)}</div>
            </div>`
                  )
                  .join('')
              : '<p class="text-sm text-slate-400">Belum ada riwayat.</p>'
          }
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.closest('[data-action="close"]')) overlay.remove();
    });

    overlay.querySelector('#pelanggan-member-toggle').addEventListener('change', async (e) => {
      try {
        await apiCall('pelanggan.manage', { pelangganId: p.PelangganID, member: e.target.checked });
        showToast('Status member diperbarui', 'success');
        loadAll();
      } catch (err) {
        showToast(err.message, 'error');
        e.target.checked = !e.target.checked;
      }
    });
  }

  await loadAll();
}
