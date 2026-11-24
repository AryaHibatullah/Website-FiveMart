// =====================================================
// DATA DI MEMORI (Tanpa localStorage, mulai dari kosong)
// =====================================================
const inventory = [];
const sales = [];
let nextItemId = 1;
let nextSaleId = 1;
let currentTheme = "light"; // Default: Light Mode

const CATEGORY_NAME = {
  minuman: "Minuman",
  makanan: "Makanan & Mi",
  camilan: "Camilan",
  harian: "Kebutuhan Harian",
};

const ICON_MOON = `<svg viewBox="0 0 24 24"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
const ICON_SUN = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`;

// =====================================================
// HELPER
// =====================================================
function rupiah(n) {
  return "Rp" + Number(n || 0).toLocaleString("id-ID");
}

function formatDate(str) {
  if (!str) return "-";
  const [y, m, d] = str.split("-");
  return `${d}/${m}/${y}`;
}

function todayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayReadable() {
  return new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let notifTimer = null;
function showNotif(msg) {
  const el = document.getElementById("notifBar");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(notifTimer);
  notifTimer = setTimeout(() => el.classList.remove("show"), 2500);
}

// =====================================================
// TEMA (LIGHT / DARK MODE)
// =====================================================
function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute("data-theme", theme);

  const isDark = theme === "dark";
  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    const icon = btn.querySelector(".theme-icon");
    const label = btn.querySelector(".theme-label");
    if (icon) icon.innerHTML = isDark ? ICON_SUN : ICON_MOON;
    if (label) label.textContent = isDark ? "Mode Terang" : "Mode Gelap";
  });
}

function toggleTheme() {
  applyTheme(currentTheme === "light" ? "dark" : "light");
}

// =====================================================
// LOGIN & NAVIGASI HALAMAN
// =====================================================
function handleLogin(e) {
  e.preventDefault();
  const rawUser = document.getElementById("loginUser").value.trim();
  const username = rawUser !== "" ? rawUser : "Kasir";

  document.getElementById("displayUsername").textContent = username;
  document.getElementById("loginView").classList.add("hidden");
  document.getElementById("appView").classList.remove("hidden");
  switchPage("dashboard");
  showNotif(`Selamat datang, ${username}.`);
}

function handleLogout() {
  document.getElementById("loginForm").reset();
  document.getElementById("appView").classList.add("hidden");
  document.getElementById("loginView").classList.remove("hidden");
}

function switchPage(pageKey) {
  document.querySelectorAll(".nav-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.page === pageKey);
  });
  document.querySelectorAll(".page").forEach((sec) => {
    sec.classList.toggle("active", sec.id === `page-${pageKey}`);
  });

  if (pageKey === "penjualan") {
    refreshSaleFormOptions();
  }
}

// =====================================================
// INVENTARIS
// =====================================================
function handleAddInventory(e) {
  e.preventDefault();
  const name = document.getElementById("invName").value.trim();
  const category = document.getElementById("invCategory").value;
  const entryDate = document.getElementById("invDate").value;
  const buyPrice = Number(document.getElementById("invBuy").value);
  const sellPrice = Number(document.getElementById("invSell").value);
  const stock = Number(document.getElementById("invStock").value);

  if (!name || stock < 1) return;

  inventory.push({
    id: nextItemId++,
    name,
    category,
    entryDate,
    buyPrice,
    sellPrice,
    stock,
    sold: 0,
  });

  document.getElementById("formInventory").reset();
  document.getElementById("invDate").value = todayISO();

  renderAll();
  showNotif(`"${name}" ditambahkan ke inventaris.`);
}

function deleteItem(id) {
  const idx = inventory.findIndex((i) => i.id === id);
  if (idx === -1) return;
  const removed = inventory.splice(idx, 1)[0];
  renderAll();
  showNotif(`"${removed.name}" dihapus.`);
}

// =====================================================
// PENJUALAN
// =====================================================
function initHourOptions() {
  const select = document.getElementById("saleHour");
  select.innerHTML = "";
  for (let h = 6; h <= 23; h++) {
    const label = `${String(h).padStart(2, "0")}:00`;
    select.innerHTML += `<option value="${h}">${label}</option>`;
  }
  const nowHour = Math.min(23, Math.max(6, new Date().getHours()));
  select.value = String(nowHour);
}

function refreshSaleFormOptions() {
  const select = document.getElementById("saleItem");
  const btnSubmit = document.getElementById("btnSubmitSale");
  const available = inventory.filter((i) => i.stock > 0);

  if (available.length === 0) {
    select.innerHTML = `<option value="">-- Belum ada stok barang --</option>`;
    btnSubmit.disabled = true;
    document.getElementById("calcStock").textContent = "-";
    document.getElementById("calcRevenue").textContent = "Rp0";
    document.getElementById("calcProfit").textContent = "Rp0";
    document.getElementById("calcRemain").textContent = "-";
    return;
  }

  const prevVal = select.value;
  select.innerHTML = available
    .map((i) => `<option value="${i.id}">${esc(i.name)} (Stok: ${i.stock})</option>`)
    .join("");

  if (available.some((i) => String(i.id) === prevVal)) {
    select.value = prevVal;
  }

  btnSubmit.disabled = false;
  updateSaleCalc();
}

function updateSaleCalc() {
  const id = Number(document.getElementById("saleItem").value);
  const item = inventory.find((i) => i.id === id);
  const qtyInput = document.getElementById("saleQty");

  if (!item) return;

  qtyInput.max = item.stock;
  const qty = Math.max(0, Number(qtyInput.value) || 0);
  const revenue = qty * item.sellPrice;
  const profit = qty * (item.sellPrice - item.buyPrice);
  const remain = item.stock - qty;

  document.getElementById("calcStock").textContent = `${item.stock} pcs`;
  document.getElementById("calcRevenue").textContent = rupiah(revenue);
  document.getElementById("calcProfit").textContent = rupiah(profit);
  document.getElementById("calcRemain").textContent = remain >= 0 ? `${remain} pcs` : "Melebihi stok";
}

function handleRecordSale(e) {
  e.preventDefault();
  const itemId = Number(document.getElementById("saleItem").value);
  const qty = Number(document.getElementById("saleQty").value);
  const hour = Number(document.getElementById("saleHour").value);

  const item = inventory.find((i) => i.id === itemId);
  if (!item) return;

  if (qty < 1 || qty > item.stock) {
    showNotif(`Jumlah harus antara 1 sampai ${item.stock}.`);
    return;
  }

  item.stock -= qty;
  item.sold += qty;

  sales.unshift({
    id: nextSaleId++,
    itemName: item.name,
    qty,
    hour,
    revenue: qty * item.sellPrice,
    profit: qty * (item.sellPrice - item.buyPrice),
  });

  document.getElementById("saleQty").value = 1;
  renderAll();
  showNotif(`Tercatat ${qty} pcs "${item.name}" terjual.`);
}

// =====================================================
// RENDER SEMUA BAGIAN
// =====================================================
function renderSummary() {
  const totalStock = inventory.reduce((s, i) => s + i.stock, 0);
  const totalSold = sales.reduce((s, x) => s + x.qty, 0);
  const totalRevenue = sales.reduce((s, x) => s + x.revenue, 0);
  const totalProfit = sales.reduce((s, x) => s + x.profit, 0);
  const emptyCount = inventory.filter((i) => i.stock === 0).length;
  const margin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1).replace(".", ",") : null;

  document.getElementById("dashTotalStock").textContent = `${totalStock} pcs`;
  document.getElementById("dashTotalJenis").textContent =
    emptyCount > 0
      ? `${inventory.length} jenis (${emptyCount} habis)`
      : `${inventory.length} jenis barang`;

  document.getElementById("dashTotalSold").textContent = `${totalSold} pcs`;
  document.getElementById("dashTotalTx").textContent = `${sales.length} transaksi tercatat`;
  document.getElementById("dashTotalRevenue").textContent = rupiah(totalRevenue);
  document.getElementById("dashTotalProfit").textContent = rupiah(totalProfit);
  document.getElementById("dashProfitSub").textContent = margin
    ? `Margin bersih ${margin}%`
    : "Harga jual dikurangi modal";

  document.getElementById("salesTotalTag").textContent = `Total: ${totalSold} pcs`;
}

function renderTables() {
  // 1. Ringkasan Inventaris di Dashboard
  const dashInv = document.getElementById("dashInvBody");
  if (inventory.length === 0) {
    dashInv.innerHTML = `<tr><td colspan="4" class="empty-td">Belum ada barang di inventaris.</td></tr>`;
  } else {
    dashInv.innerHTML = inventory
      .slice(0, 6)
      .map(
        (i) => `
        <tr>
          <td><strong>${esc(i.name)}</strong></td>
          <td class="num">${rupiah(i.sellPrice)}</td>
          <td class="num ${i.stock === 0 ? "stok-habis" : ""}">${i.stock} pcs</td>
          <td class="num">${i.sold} pcs</td>
        </tr>`
      )
      .join("");
  }

  // 2. Ringkasan Penjualan di Dashboard
  const dashSales = document.getElementById("dashSalesBody");
  if (sales.length === 0) {
    dashSales.innerHTML = `<tr><td colspan="4" class="empty-td">Belum ada penjualan tercatat.</td></tr>`;
  } else {
    dashSales.innerHTML = sales
      .slice(0, 6)
      .map(
        (s) => `
        <tr>
          <td class="num" style="text-align:left!important">${String(s.hour).padStart(2, "0")}:00</td>
          <td><strong>${esc(s.itemName)}</strong></td>
          <td class="num">${s.qty} pcs</td>
          <td class="num">${rupiah(s.revenue)}</td>
        </tr>`
      )
      .join("");
  }

  // 3. Tabel Lengkap Halaman Inventaris (dengan filter pencarian)
  const query = (document.getElementById("invSearch").value || "").trim().toLowerCase();
  const filteredInv = query
    ? inventory.filter(
        (i) =>
          i.name.toLowerCase().includes(query) ||
          (CATEGORY_NAME[i.category] || "").toLowerCase().includes(query)
      )
    : inventory;

  document.getElementById("invCountLabel").textContent = `${inventory.length} barang terdaftar`;
  const fullInv = document.getElementById("fullInvBody");
  if (inventory.length === 0) {
    fullInv.innerHTML = `<tr><td colspan="8" class="empty-td">Inventaris masih kosong. Tambah barang melalui form di samping.</td></tr>`;
  } else if (filteredInv.length === 0) {
    fullInv.innerHTML = `<tr><td colspan="8" class="empty-td">Tidak ada barang yang cocok dengan "${esc(query)}".</td></tr>`;
  } else {
    fullInv.innerHTML = filteredInv
      .map(
        (i) => `
        <tr>
          <td><strong>${esc(i.name)}</strong></td>
          <td><span class="cat-label">${CATEGORY_NAME[i.category] || "-"}</span></td>
          <td>${formatDate(i.entryDate)}</td>
          <td class="num">${rupiah(i.buyPrice)}</td>
          <td class="num">${rupiah(i.sellPrice)}</td>
          <td class="num ${i.stock === 0 ? "stok-habis" : ""}">${i.stock} pcs</td>
          <td class="num">${i.sold} pcs</td>
          <td class="num"><button class="btn-del" data-del="${i.id}">Hapus</button></td>
        </tr>`
      )
      .join("");
  }

  // 4. Tabel Lengkap Halaman Penjualan
  document.getElementById("salesCountLabel").textContent = `${sales.length} transaksi`;
  const fullSales = document.getElementById("fullSalesBody");
  if (sales.length === 0) {
    fullSales.innerHTML = `<tr><td colspan="6" class="empty-td">Belum ada transaksi penjualan.</td></tr>`;
  } else {
    fullSales.innerHTML = sales
      .map(
        (s, idx) => `
        <tr>
          <td>${sales.length - idx}</td>
          <td class="num" style="text-align:left!important">${String(s.hour).padStart(2, "0")}:00</td>
          <td><strong>${esc(s.itemName)}</strong></td>
          <td class="num">${s.qty} pcs</td>
          <td class="num">${rupiah(s.revenue)}</td>
          <td class="num laba-val">${rupiah(s.profit)}</td>
        </tr>`
      )
      .join("");
  }
}

function renderHourlyChart() {
  const container = document.getElementById("hourlyChart");
  const emptyNote = document.getElementById("chartEmptyNote");
  const totals = {};
  for (let h = 6; h <= 23; h++) totals[h] = 0;

  sales.forEach((s) => {
    if (totals[s.hour] !== undefined) totals[s.hour] += s.qty;
  });

  let maxQty = 0;
  let peakHour = null;
  for (let h = 6; h <= 23; h++) {
    if (totals[h] > maxQty) {
      maxQty = totals[h];
      peakHour = h;
    }
  }

  const peakLabel = document.getElementById("peakHourText");
  if (maxQty > 0) {
    peakLabel.textContent = `Jam ramai ${String(peakHour).padStart(2, "0")}:00 · ${maxQty} pcs`;
    peakLabel.classList.add("has-data");
    emptyNote.classList.add("hidden");
  } else {
    peakLabel.textContent = "Belum ada transaksi";
    peakLabel.classList.remove("has-data");
    emptyNote.classList.remove("hidden");
  }

  container.innerHTML = Object.entries(totals)
    .map(([h, qty]) => {
      const pct = maxQty > 0 ? Math.max(qty > 0 ? 6 : 0, Math.round((qty / maxQty) * 100)) : 0;
      const isPeak = maxQty > 0 && Number(h) === peakHour;
      return `
        <div class="bar-item" title="Pukul ${String(h).padStart(2, "0")}:00 — ${qty} pcs">
          <span class="bar-num">${qty > 0 ? qty : ""}</span>
          <div class="bar-col">
            <div class="bar-fill ${isPeak ? "peak" : ""}" style="height: ${pct}%"></div>
          </div>
          <span class="bar-hour">${String(h).padStart(2, "0")}</span>
        </div>`;
    })
    .join("");
}

function renderAll() {
  renderSummary();
  renderTables();
  renderHourlyChart();
  refreshSaleFormOptions();
}

// =====================================================
// INISIALISASI EVENT
// =====================================================
document.addEventListener("DOMContentLoaded", () => {
  applyTheme("light");
  document.getElementById("invDate").value = todayISO();
  document.getElementById("todayLabel").textContent = todayReadable();
  initHourOptions();

  // Ganti tema (Light / Dark)
  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    btn.addEventListener("click", toggleTheme);
  });

  // Login & Logout
  document.getElementById("loginForm").addEventListener("submit", handleLogin);
  document.getElementById("btnLogout").addEventListener("click", handleLogout);

  // Navigasi
  document.querySelectorAll(".nav-tab").forEach((btn) => {
    btn.addEventListener("click", () => switchPage(btn.dataset.page));
  });
  document.querySelectorAll("[data-goto]").forEach((btn) => {
    btn.addEventListener("click", () => switchPage(btn.dataset.goto));
  });

  // Inventaris & Pencarian
  document.getElementById("formInventory").addEventListener("submit", handleAddInventory);
  document.getElementById("invSearch").addEventListener("input", renderTables);
  document.getElementById("fullInvBody").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-del]");
    if (btn) deleteItem(Number(btn.dataset.del));
  });

  // Penjualan
  document.getElementById("formSale").addEventListener("submit", handleRecordSale);
  document.getElementById("saleItem").addEventListener("change", updateSaleCalc);
  document.getElementById("saleQty").addEventListener("input", updateSaleCalc);

  renderAll();
});