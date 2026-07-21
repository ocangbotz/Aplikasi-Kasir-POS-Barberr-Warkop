/**
 * nav.js
 * Registry menu sidebar, terpisah dari router supaya setiap modul (Barber,
 * Warkop, Inventory, dst. -- ditambahkan di fase-fase berikutnya) cukup
 * memanggil registerNavItem() sendiri tanpa mengedit layout.js.
 */
const navItems = [];

/**
 * @param {{path: string, label: string, icon: string, permission?: string, group?: string}} item
 * icon: satu karakter/emoji (ringan, tanpa font icon eksternal).
 */
export function registerNavItem(item) {
  navItems.push(item);
}

export function getNavItems() {
  return navItems.slice();
}
