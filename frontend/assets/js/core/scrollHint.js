/**
 * scrollHint.js
 * Banyak halaman punya tabel lebar di dalam wrapper `.overflow-x-auto`
 * (Riwayat, Laporan, Kelola Transaksi, dst) supaya kolomnya tidak dipaksa
 * muat di layar sempit. Tanpa petunjuk visual, di HP/tablet tabel itu
 * kelihatan "terpotong" begitu saja -- user tidak sadar bisa digeser ke
 * samping untuk lihat kolom/tombol aksi yang tersembunyi. Fungsi ini
 * menambahkan fade + panah di sisi yang masih bisa digeser, otomatis
 * hilang begitu sudah di-scroll sampai ujung.
 */
export function wireScrollHints(root) {
  root.querySelectorAll('.overflow-x-auto').forEach((el) => {
    function update() {
      const scrollable = el.scrollWidth > el.clientWidth + 1;
      const atStart = el.scrollLeft <= 1;
      const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 1;
      el.classList.toggle('scroll-hint-right', scrollable && !atEnd);
      el.classList.toggle('scroll-hint-left', scrollable && !atStart);
    }
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    // Banyak tabel diisi ASYNC (tbody.innerHTML = ... setelah apiCall) --
    // lebar tabel yang tidak punya min-w tetap (mis. Laporan) baru pasti
    // setelah baris data masuk, jadi perlu dicek ulang tiap DOM-nya berubah.
    new MutationObserver(update).observe(el, { childList: true, subtree: true });
  });
}
