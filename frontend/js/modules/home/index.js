/**
 * home — halaman beranda setelah login. Fase 2 belum punya Dashboard
 * (Fase 3) atau modul transaksi (Fase 4/5), jadi beranda menampilkan info
 * akun + tautan ke modul yang SUDAH benar-benar berfungsi saat ini, bukan
 * placeholder ke halaman kosong.
 */

import { getCurrentUser, hasRole } from '../../core/auth.js';
import { escapeHtml } from '../../core/ui.js';

const AVAILABLE_MODULES = [
  { path: '/settings', label: 'Pengaturan', desc: 'Lihat & ubah profil usaha (nama, alamat, kontak, warna tema).', roles: null },
  { path: '/users', label: 'Manajemen User', desc: 'Kelola akun Owner/Admin/Kasir/Capster.', roles: ['Owner'] },
  { path: '/audit-log', label: 'Audit Log', desc: 'Riwayat aktivitas seluruh user.', roles: ['Owner', 'Admin'] },
  { path: '/backup', label: 'Backup & Restore', desc: 'Backup database ke Drive & pulihkan bila perlu.', roles: ['Owner'] }
];

export async function renderHome(container) {
  const user = getCurrentUser();
  const modules = AVAILABLE_MODULES.filter((m) => !m.roles || hasRole(user, m.roles));

  container.innerHTML = `
    <div class="mx-auto max-w-3xl">
      <div class="glass-card mb-6 p-6">
        <h1 class="text-xl font-bold">Halo, ${escapeHtml(user?.name || '')} 👋</h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Masuk sebagai <span class="badge-neutral">${escapeHtml(user?.role || '')}</span>
        </p>
      </div>

      <div class="glass-card mb-6 p-6">
        <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Modul Aktif</h2>
        <div class="grid gap-3 sm:grid-cols-2">
          ${modules
            .map(
              (m) => `
            <a href="#${m.path}" class="rounded-xl border border-slate-200 p-4 text-slate-800 visited:text-slate-800 transition-colors hover:bg-white/70 dark:border-slate-800 dark:text-slate-100 dark:visited:text-slate-100 dark:hover:bg-white/5">
              <div class="font-medium">${escapeHtml(m.label)}</div>
              <div class="mt-1 text-sm text-slate-500 dark:text-slate-400">${escapeHtml(m.desc)}</div>
            </a>`
            )
            .join('')}
        </div>
      </div>

      <div class="glass-card p-6 text-sm text-slate-500 dark:text-slate-400">
        Dashboard Gabungan/Barber/Warkop, modul transaksi, inventory, dan laporan
        sedang dikerjakan secara bertahap di fase-fase berikutnya — akan muncul
        di sini begitu selesai diuji.
      </div>
    </div>
  `;
}
