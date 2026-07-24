/**
 * pages/shift/requireShift.js
 * Kasir wajib membuka shift dulu sebelum bisa transaksi (Barber/Warkop) --
 * permintaan pemilik usaha. Backend (barberCreateTransaksi_/
 * warkopCreateTransaksi_) sudah menolak transaksi Kasir tanpa shift terbuka
 * sebagai penegakan yang sesungguhnya; helper ini murni UX supaya Kasir
 * tidak perlu isi seluruh form dulu baru tahu ditolak saat submit.
 */
import { apiCall, ApiError } from '../../core/api.js';
import { getCurrentUser } from '../../core/auth.js';
import { toastError } from '../../core/toast.js';

/**
 * @param {HTMLElement} root
 * @returns {Promise<boolean>} true kalau halaman pemanggil boleh lanjut
 * render form transaksi seperti biasa; false kalau sudah diganti dengan
 * pesan "shift belum dibuka" (Kasir tanpa shift terbuka).
 */
export async function ensureShiftOpenForKasir(root) {
  const user = getCurrentUser();
  if (!user || user.role !== 'Kasir') return true;

  try {
    const { shift } = await apiCall('shiftGetCurrent', {});
    if (shift) return true;
  } catch (err) {
    // Kalau justru PENGECEKAN shift-nya yang gagal (mis. offline), jangan
    // blokir -- backend tetap jadi penjaga akhir saat submit transaksi.
    toastError(err instanceof ApiError ? err.message : 'Gagal memeriksa status shift.');
    return true;
  }

  root.innerHTML = `
    <div class="mx-auto max-w-md">
      <div class="glass-card p-6 text-center">
        <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-2xl dark:bg-amber-500/10">🔒</div>
        <h2 class="mb-2 text-base font-bold text-slate-900 dark:text-white">Shift Belum Dibuka</h2>
        <p class="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Kamu harus membuka shift terlebih dahulu sebelum bisa membuat transaksi.
        </p>
        <a href="#/shift" class="btn-primary inline-flex">🔓 Buka Shift Sekarang</a>
      </div>
    </div>`;
  return false;
}
