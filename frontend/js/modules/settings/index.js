/**
 * settings — lihat & ubah pengaturan usaha (sheet Settings). Semua role bisa
 * melihat, hanya Owner yang bisa mengubah (sesuai RBAC backend).
 */

import { apiCall } from '../../core/api.js';
import { getCurrentUser, hasRole } from '../../core/auth.js';
import { showToast, escapeHtml } from '../../core/ui.js';
import { invalidateSettingsCache } from '../../core/settings-cache.js';

const EDITABLE_LABELS = {
  businessName: 'Nama Usaha',
  address: 'Alamat',
  whatsapp: 'Nomor WhatsApp',
  instagram: 'Instagram',
  receiptFooterMessage: 'Ucapan Penutup Struk',
  colorBarber: 'Warna Tema Barber',
  colorWarkop: 'Warna Tema Warkop',
  colorGabungan: 'Warna Tema Gabungan',
  loyaltyPointsPerRupiah: 'Rp per 1 Poin Loyalti',
  lowStockThresholdDefault: 'Ambang Batas Stok Rendah Default',
  sessionTokenTtlHours: 'Masa Berlaku Sesi Login (jam)'
};

export async function renderSettings(container) {
  container.innerHTML = `<div class="glass-card p-6">Memuat pengaturan...</div>`;
  const user = getCurrentUser();
  const canEdit = hasRole(user, ['Owner']);

  let settings;
  try {
    settings = await apiCall('settings.view', {});
  } catch (err) {
    container.innerHTML = `<div class="glass-card p-6 text-red-600 dark:text-red-400">Gagal memuat pengaturan: ${escapeHtml(err.message)}</div>`;
    return;
  }

  container.innerHTML = `
    <div class="mx-auto max-w-2xl">
      <h1 class="mb-4 text-xl font-bold">Pengaturan Usaha</h1>
      <form id="form-settings" class="glass-card grid gap-4 p-6 sm:grid-cols-2">
        ${Object.entries(EDITABLE_LABELS)
          .map(
            ([key, label]) => `
            <div>
              <label class="label-field" for="setting-${key}">${escapeHtml(label)}</label>
              <input id="setting-${key}" name="${key}" class="input-field" value="${escapeHtml(settings[key] ?? '')}" ${canEdit ? '' : 'disabled'} />
            </div>`
          )
          .join('')}
        ${canEdit ? `<div class="sm:col-span-2"><button type="submit" class="btn-primary">Simpan Perubahan</button></div>` : ''}
      </form>
      ${!canEdit ? `<p class="mt-3 text-xs text-slate-400">Hanya Owner yang dapat mengubah pengaturan.</p>` : ''}
    </div>
  `;

  if (!canEdit) return;

  container.querySelector('#form-settings').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const patch = {};
    Object.keys(EDITABLE_LABELS).forEach((key) => {
      patch[key] = formData.get(key);
    });
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      await apiCall('settings.update', patch);
      invalidateSettingsCache();
      showToast('Pengaturan berhasil disimpan', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });
}
