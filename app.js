const state = {
  mode: "IDR_TO_FX",
  chart: null,
  latestRateValue: null,
  latestDate: null,
  watchlist: [],
  theme: "light",
  amountRaw: 1000000,
  cache: new Map(),
  releases: [],
  selectedReleaseIndex: 0,
};

const MARKET_CURRENCIES = ["USD", "SGD", "AUD", "JPY", "EUR", "GBP", "MYR", "CNY", "SAR", "HKD"];
const COMPARE_CURRENCIES = ["AUD", "USD", "SGD", "MYR"];
const sparklineCharts = new Map();
let latestMarketSnapshotItems = [];
let amountInputTimer = null;

const CURRENCY_META = {
  USD: { icon: "🇺🇸", name: "US Dollar", queries: ["Federal Reserve press release", "USD central bank statement", "US inflation release"] },
  SGD: { icon: "🇸🇬", name: "Singapore Dollar", queries: ["MAS statement", "Singapore monetary policy", "SGD central bank release"] },
  AUD: { icon: "🇦🇺", name: "Australian Dollar", queries: ["RBA statement", "Australia CPI release", "AUD central bank release"] },
  JPY: { icon: "🇯🇵", name: "Japanese Yen", queries: ["Bank of Japan statement", "Japan inflation release", "JPY central bank release"] },
  EUR: { icon: "🇪🇺", name: "Euro", queries: ["ECB press release", "Euro area inflation release", "EUR central bank statement"] },
  GBP: { icon: "🇬🇧", name: "Pound Sterling", queries: ["Bank of England statement", "UK inflation release", "GBP central bank release"] },
  CNY: { icon: "🇨🇳", name: "Chinese Yuan", queries: ["PBOC statement", "China economic release", "CNY central bank release"] },
  MYR: { icon: "🇲🇾", name: "Malaysian Ringgit", queries: ["Bank Negara Malaysia statement", "Malaysia CPI release", "MYR central bank release"] },
  HKD: { icon: "🇭🇰", name: "Hong Kong Dollar", queries: ["HKMA statement", "Hong Kong economic release", "HKD policy release"] },
  SAR: { icon: "🇸🇦", name: "Saudi Riyal", queries: ["Saudi Central Bank statement", "Saudi inflation release", "SAR central bank release"] },
};

const currencySelect = document.getElementById("currencySelect");
const rangeSelect = document.getElementById("rangeSelect");
const amountInput = document.getElementById("amountInput");
const analyzeBtn = document.getElementById("analyzeBtn");
const watchlistBtn = document.getElementById("watchlistBtn");
const clearWatchlistBtn = document.getElementById("clearWatchlist");
const themeToggle = document.getElementById("themeToggle");
const presetChipsEl = document.getElementById("presetChips");
const refreshReleasesBtn = document.getElementById("refreshReleasesBtn");

const latestRateEl = document.getElementById("latestRate");
const pastCompareEl = document.getElementById("pastCompare");
const pastCompareHintEl = document.getElementById("pastCompareHint");
const forecastValueEl = document.getElementById("forecastValue");
const conversionResultEl = document.getElementById("conversionResult");
const averageRateEl = document.getElementById("averageRate");
const lowestRateEl = document.getElementById("lowestRate");
const highestRateEl = document.getElementById("highestRate");
const volatilityLabelEl = document.getElementById("volatilityLabel");
const verdictTextEl = document.getElementById("verdictText");
const biasBadgeEl = document.getElementById("biasBadge");
const chartMetaEl = document.getElementById("chartMeta");

const chartStateEl = document.getElementById("chartState");
const newsStateEl = document.getElementById("newsState");
const watchlistStateEl = document.getElementById("watchlistState");
const releaseStateEl = document.getElementById("releaseState");

const newsListEl = document.getElementById("newsList");
const watchlistItemsEl = document.getElementById("watchlistItems");
const marketsGridEl = document.getElementById("marketsGrid");
const compareGridEl = document.getElementById("compareGrid");
const releasePrimaryEl = document.getElementById("releasePrimary");
const releaseListEl = document.getElementById("releaseList");

const dataSourceTextEl = document.getElementById("dataSourceText");
const lastUpdatedTextEl = document.getElementById("lastUpdatedText");

const releaseDialog = document.getElementById("releaseValidationDialog");
const dialogOptionsEl = document.getElementById("dialogOptions");
const confirmDialogBtn = document.getElementById("confirmDialogBtn");

init();

async function init() {
  state.watchlist = [];
  state.theme = "light";
  state.amountRaw = 1000000;

  applyTheme(state.theme);
  bindEvents();
  renderCurrencyOptions();
  syncAmountInput();
  renderWatchlist();
  renderCompareCards([]);
  renderReleasePanel([]);
  await runAnalysis();
}

function bindEvents() {
  document.querySelectorAll(".switch-btn").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".switch-btn").forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      state.mode = button.dataset.mode;
      updateConversionOnly();
      renderCompareCards(latestMarketSnapshotItems);
    });
  });

  presetChipsEl?.querySelectorAll(".chip-btn").forEach((button) => {
    button.addEventListener("click", () => {
      presetChipsEl.querySelectorAll(".chip-btn").forEach((chip) => chip.classList.remove("active"));
      button.classList.add("active");
      state.amountRaw = Number(button.dataset.amount || 0);
      syncAmountInput();
      updateConversionOnly();
      renderCompareCards(latestMarketSnapshotItems);
    });
  });

  analyzeBtn.addEventListener("click", runAnalysis);
  refreshReleasesBtn?.addEventListener("click", () => loadReleases(currencySelect.value));
  watchlistBtn.addEventListener("click", addCurrentCurrencyToWatchlist);
  clearWatchlistBtn.addEventListener("click", clearWatchlist);
  currencySelect.addEventListener("change", runAnalysis);
  rangeSelect.addEventListener("change", runAnalysis);

  amountInput.addEventListener("input", handleAmountInput);
  amountInput.addEventListener("blur", syncAmountInput);

  themeToggle.addEventListener("click", () => {
    const nextTheme = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    state.theme = nextTheme;
    applyTheme(nextTheme);
    updateChartTheme();
    if (latestMarketSnapshotItems.length) renderMarketSnapshots(latestMarketSnapshotItems);
  });

  confirmDialogBtn?.addEventListener("click", () => {
    const selected = dialogOptionsEl.querySelector(".dialog-option.active");
    if (!selected) return;
    state.selectedReleaseIndex = Number(selected.dataset.index || 0);
    applySelectedRelease();
    releaseDialog.close();
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeToggle.textContent = theme === "dark" ? "☀️" : "🌗";
  themeToggle.setAttribute("aria-label", theme === "dark" ? "Ganti ke tema terang" : "Ganti ke tema gelap");
}

function setUIState(element, type, message) {
  if (!element) return;
  if (!message) {
    element.className = "ui-state hidden";
    element.textContent = "";
    return;
  }
  element.className = `ui-state ${type}`;
  element.textContent = message;
}

function renderCurrencyOptions() {
  const selected = currencySelect.value;
  const options = Array.from(currencySelect.options).map((option) => option.value);
  currencySelect.innerHTML = options.map((code) => {
    const meta = getCurrencyMeta(code);
    return `<option value="${code}" ${selected === code ? "selected" : ""}>${meta.icon} ${code}</option>`;
  }).join("");
}

function getCurrencyMeta(code) {
  return CURRENCY_META[code] || { icon: "💱", name: code, queries: [`${code} central bank release`] };
}

function buildDate(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split("T")[0];
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatDateOnly(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function formatNumber(value, digits = 2) {
  return Number(value).toLocaleString("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatCompactNumber(value, digits = 0) {
  return Number(value).toLocaleString("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatInputNumber(value) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function parseLocaleNumber(value) {
  if (!value) return 0;
  const cleaned = String(value).replace(/[^\d.,]/g, "").replace(/\./g, "").replace(/,/g, ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function handleAmountInput(event) {
  const input = event.target;
  const parsed = parseLocaleNumber(input.value);
  state.amountRaw = parsed;
  input.value = parsed ? formatInputNumber(parsed) : "";
  clearTimeout(amountInputTimer);
  amountInputTimer = setTimeout(() => {
    updateConversionOnly();
    renderCompareCards(latestMarketSnapshotItems);
  }, 120);
}

function syncAmountInput() {
  amountInput.value = state.amountRaw ? formatInputNumber(state.amountRaw) : "";
}

function formatSplitNumber(value, options = {}) {
  const { digits = 2, prefix = "", suffix = "", positiveSign = false } = options;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return `<span class="number-main">-</span>`;
  const isNegative = numeric < 0;
  const abs = Math.abs(numeric);
  const fixed = abs.toLocaleString("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const [intPart, decimalPart = "00"] = fixed.split(",");
  const sign = positiveSign && numeric > 0 ? "+" : isNegative ? "-" : "";
  return `<span class="number-main">${escapeHtml(prefix)}${sign}${escapeHtml(intPart)}</span><span class="number-decimal">,${escapeHtml(decimalPart)}</span>${suffix ? `<span class="number-suffix">${escapeHtml(suffix)}</span>` : ""}`;
}

function renderPlainMetric(text) {
  return `<span class="number-main">${escapeHtml(text)}</span>`;
}

function updateMetric(el, html) {
  el.innerHTML = html;
}

function simpleForecast(values) {
  if (!values.length) return 0;
  const recent = values.slice(-7);
  if (recent.length < 2) return recent[recent.length - 1] || 0;
  const deltas = recent.slice(1).map((value, index) => value - recent[index]);
  const avgDelta = deltas.reduce((sum, val) => sum + val, 0) / deltas.length;
  return recent[recent.length - 1] + avgDelta * 5;
}

function classifyIndicativeDirection(latest, forecast) {
  if (!Number.isFinite(latest) || !Number.isFinite(forecast)) return { label: "Netral", badge: "neutral" };
  const pct = ((forecast - latest) / latest) * 100;
  if (pct > 0.3) return { label: "Cenderung naik", badge: "bearish" };
  if (pct < -0.3) return { label: "Cenderung turun", badge: "bullish" };
  return { label: "Relatif stabil", badge: "neutral" };
}

function calculateAverage(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function calculateLow(values) {
  return values.length ? Math.min(...values) : null;
}

function calculateHigh(values) {
  return values.length ? Math.max(...values) : null;
}

function calculateVolatilityLabel(values) {
  if (!values.length) return "-";
  const low = Math.min(...values);
  const high = Math.max(...values);
  const avg = calculateAverage(values);
  if (!avg) return "-";
  const rangePct = ((high - low) / avg) * 100;
  if (rangePct < 2) return "Tenang";
  if (rangePct < 5) return "Moderat";
  return "Cepat bergerak";
}

function getRupiahChangeState(deltaPct) {
  if (!Number.isFinite(deltaPct)) return { className: "metric-neutral", hint: "Data belum tersedia" };
  if (deltaPct >= -0.5 && deltaPct <= 0.5) return { className: "metric-neutral", hint: "Relatif stabil" };
  if (deltaPct < -0.5) return { className: "metric-positive", hint: "Rupiah menguat" };
  return { className: "metric-negative", hint: "Rupiah melemah" };
}

function applyPastCompareStyle(deltaPct) {
  const current = getRupiahChangeState(deltaPct);
  pastCompareEl.classList.remove("metric-positive", "metric-negative", "metric-neutral");
  pastCompareEl.classList.add(current.className);
  pastCompareHintEl.textContent = current.hint;
  pastCompareHintEl.classList.remove("metric-positive", "metric-negative", "metric-neutral");
  pastCompareHintEl.classList.add(current.className);
}

function updateLastUpdated(dateValue) {
  state.latestDate = dateValue || new Date().toISOString();
  lastUpdatedTextEl.textContent = formatDateTime(state.latestDate);
}

function updateDataSourceText() {
  dataSourceTextEl.textContent = "Frankfurter · Google News RSS";
}

async function fetchRates(currency, days) {
  const cacheKey = `rates:${currency}:${days}`;
  if (state.cache.has(cacheKey)) return state.cache.get(cacheKey);
  const start = buildDate(days);
  const end = buildDate(0);
  const url = `https://api.frankfurter.dev/v1/${start}..${end}?base=${currency}&symbols=IDR`;
  let response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch {
    throw new Error("Koneksi bermasalah. Coba lagi saat internet sudah stabil.");
  }
  if (!response.ok) throw new Error("Data kurs sedang tidak bisa diambil.");
  const data = await response.json();
  if (!data.rates || !Object.keys(data.rates).length) throw new Error("Belum ada data kurs untuk periode ini.");
  state.cache.set(cacheKey, data);
  return data;
}

async function fetchLiveNews(currency) {
  const query = encodeURIComponent(`${currency} IDR rupiah`);
  const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=id&gl=ID&ceid=ID:id`;
  const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
  try {
    const response = await fetch(apiUrl, { cache: "no-store" });
    if (!response.ok) throw new Error();
    const data = await response.json();
    if (!data.items || !Array.isArray(data.items)) return [];
    return data.items.slice(0, 3).map((item) => ({
      title: item.title || "Tanpa judul",
      source: item.author || item.source || "Google News",
      url: item.link || "#",
      pubDate: item.pubDate || "",
    }));
  } catch {
    return [];
  }
}

function inferReleaseType(item) {
  const text = `${item.title} ${item.source}`.toLowerCase();
  const officialWords = ["central bank", "bank of", "federal reserve", "ecb", "rba", "boj", "mas", "hkma", "bank negara", "press release", "statement"];
  const mediaWords = ["reuters", "bloomberg", "cnbc", "investing", "market", "news", "media"];
  const official = officialWords.some((word) => text.includes(word));
  const media = mediaWords.some((word) => text.includes(word));

  if (official && !media) return { type: "official", label: "Rilis resmi", confidence: 0.85 };
  if (official && media) return { type: "ambiguous", label: "Butuh validasi", confidence: 0.55 };
  if (media) return { type: "media", label: "Headline media", confidence: 0.62 };
  return { type: "ambiguous", label: "Perlu cek sumber", confidence: 0.4 };
}

async function fetchReleaseCandidates(currency) {
  const meta = getCurrencyMeta(currency);
  const queries = meta.queries.slice(0, 2);

  const settled = await Promise.all(
    queries.map(async (query) => {
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
      const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
      try {
        const response = await fetch(apiUrl, { cache: "no-store" });
        if (!response.ok) throw new Error();
        const data = await response.json();
        return Array.isArray(data.items) ? data.items.slice(0, 3) : [];
      } catch {
        return [];
      }
    })
  );

  const merged = settled.flat().map((item) => {
    const releaseMeta = inferReleaseType(item);
    return {
      title: item.title || "Tanpa judul",
      source: item.author || item.source || "Google News",
      url: item.link || "#",
      pubDate: item.pubDate || "",
      type: releaseMeta.type,
      label: releaseMeta.label,
      confidence: releaseMeta.confidence,
    };
  });

  const unique = [];
  const seen = new Set();

  for (const item of merged) {
    const key = `${item.title}|${item.source}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  unique.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  return unique.slice(0, 4);
}

function renderNews(items) {
  if (!items.length) {
    setUIState(newsStateEl, "success", "Belum ada headline pendukung untuk pair ini saat ini.");
    newsListEl.innerHTML = `<article class="news-item"><strong>Belum ada berita pendukung</strong><div class="news-meta">Coba ganti mata uang atau perbarui data beberapa saat lagi.</div></article>`;
    return;
  }

  setUIState(newsStateEl, "", "");
  newsListEl.innerHTML = items.map((item) => {
    const source = item.source || "Google News";
    const dateText = formatDateOnly(item.pubDate) || "Tanggal tidak tersedia";
    return `<article class="news-item"><div class="news-item-top"><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a></div><div class="news-meta">${escapeHtml(source)} · ${escapeHtml(dateText)}</div></article>`;
  }).join("");
}

function addCurrentCurrencyToWatchlist() {
  const currency = currencySelect.value;
  const exists = state.watchlist.some((entry) => entry.currency === currency);

  if (exists) {
    setUIState(watchlistStateEl, "success", `${currency} sudah ada di pantauan.`);
    return;
  }

  state.watchlist.push({ currency, savedAt: new Date().toISOString() });
  renderWatchlist();
  setUIState(watchlistStateEl, "success", `${currency} berhasil disimpan.`);
}

function clearWatchlist() {
  state.watchlist = [];
  renderWatchlist();
  setUIState(watchlistStateEl, "success", "Semua pantauan sudah dihapus.");
}

function renderWatchlist() {
  if (!state.watchlist.length) {
    setUIState(watchlistStateEl, "success", "Belum ada pair yang disimpan.");
    watchlistItemsEl.innerHTML = `<article class="watch-item"><strong>Belum ada pair tersimpan</strong><p>Simpan pair dari panel atas agar lebih cepat dibuka lagi nanti.</p></article>`;
    return;
  }

  setUIState(watchlistStateEl, "", "");
  watchlistItemsEl.innerHTML = state.watchlist.map((item) => {
    const meta = getCurrencyMeta(item.currency);
    return `<article class="watch-item"><div class="watch-item-top"><strong>${meta.icon} ${escapeHtml(item.currency)}</strong></div><p>Disimpan pada ${escapeHtml(formatDateTime(item.savedAt))}.</p></article>`;
  }).join("");
}

function updateConversionOnly() {
  const amount = state.amountRaw;
  const currency = currencySelect.value;
  const latest = state.latestRateValue;

  if (!Number.isFinite(latest) || !Number.isFinite(amount)) {
    updateMetric(conversionResultEl, renderPlainMetric("-"));
    return;
  }

  if (state.mode === "IDR_TO_FX") {
    const result = amount / latest;
    updateMetric(conversionResultEl, formatSplitNumber(result, { digits: 2, suffix: currency }));
  } else {
    const result = amount * latest;
    updateMetric(conversionResultEl, formatSplitNumber(result, { digits: 2, suffix: "IDR" }));
  }
}

function buildVerdict(currency, latest, first, indicative, release) {
  const pct = ((latest - first) / first) * 100;
  let rupiahState = "relatif stabil";

  if (pct > 0.5) rupiahState = "melemah";
  if (pct < -0.5) rupiahState = "menguat";

  const releaseText = release
    ? `Rilis yang paling menonjol saat ini: ${release.label.toLowerCase()} dari ${release.source || "sumber terkait"}.`
    : "Belum ada rilis yang cukup kuat untuk dijadikan konteks utama.";

  return `Terhadap ${currency}, rupiah ${rupiahState} pada periode aktif. Sinyal saat ini ${indicative.label.toLowerCase()}. ${releaseText}`;
}

function getChartColors() {
  const styles = getComputedStyle(document.documentElement);
  return {
    line: styles.getPropertyValue("--primary").trim() || "#2459d9",
    fill: document.documentElement.getAttribute("data-theme") === "dark"
      ? "rgba(138, 168, 255, 0.16)"
      : "rgba(36, 89, 217, 0.10)",
    grid: styles.getPropertyValue("--line").trim() || "rgba(20, 32, 51, 0.08)",
    tick: styles.getPropertyValue("--text-faint").trim() || "#8a97a9",
  };
}

function renderChart(labels, values, currency) {
  const canvas = document.getElementById("rateChart");
  const colors = getChartColors();

  if (!state.chart) {
    state.chart = new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: `${currency}/IDR`,
          data: values,
          borderColor: colors.line,
          backgroundColor: colors.fill,
          fill: true,
          tension: 0.32,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHitRadius: 14,
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        normalized: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: "index",
            intersect: false,
            displayColors: false,
            callbacks: {
              label: (context) => ` ${formatNumber(context.parsed.y, 2)} IDR`,
            },
          },
        },
        interaction: { mode: "index", intersect: false },
        scales: {
          x: {
            ticks: { color: colors.tick, maxTicksLimit: 6 },
            grid: { color: colors.grid, drawBorder: false },
          },
          y: {
            ticks: {
              color: colors.tick,
              callback: (value) => formatCompactNumber(value, 0),
            },
            grid: { color: colors.grid, drawBorder: false },
          },
        },
      },
    });
    return;
  }

  state.chart.data.labels = labels;
  state.chart.data.datasets[0].label = `${currency}/IDR`;
  state.chart.data.datasets[0].data = values;
  state.chart.data.datasets[0].borderColor = colors.line;
  state.chart.data.datasets[0].backgroundColor = colors.fill;
  state.chart.options.scales.x.ticks.color = colors.tick;
  state.chart.options.scales.y.ticks.color = colors.tick;
  state.chart.options.scales.x.grid.color = colors.grid;
  state.chart.options.scales.y.grid.color = colors.grid;
  state.chart.update("none");
}

function updateChartTheme() {
  if (!state.chart) return;
  const colors = getChartColors();
  state.chart.data.datasets[0].borderColor = colors.line;
  state.chart.data.datasets[0].backgroundColor = colors.fill;
  state.chart.options.scales.x.ticks.color = colors.tick;
  state.chart.options.scales.y.ticks.color = colors.tick;
  state.chart.options.scales.x.grid.color = colors.grid;
  state.chart.options.scales.y.grid.color = colors.grid;
  state.chart.update("none");
}

function getTrendMeta(deltaPct) {
  if (deltaPct > 0.5) return { badgeClass: "up", icon: "↗", label: `+${formatNumber(deltaPct, 2)}%` };
  if (deltaPct < -0.5) return { badgeClass: "down", icon: "↘", label: `-${formatNumber(Math.abs(deltaPct), 2)}%` };
  return { badgeClass: "flat", icon: "→", label: "Netral" };
}

function destroySparklineCharts() {
  sparklineCharts.forEach((chart) => chart.destroy());
  sparklineCharts.clear();
}

async function fetchMarketSnapshots(days = 14) {
  const shortlist = MARKET_CURRENCIES.slice(0, 6);
  const items = await Promise.all(shortlist.map(async (currency) => {
    try {
      const data = await fetchRates(currency, days);
      const labels = Object.keys(data.rates);
      const values = labels.map((date) => data.rates[date].IDR);

      if (!values.length) return null;

      const first = values[0];
      const latest = values[values.length - 1];
      const absoluteChange = latest - first;
      const deltaPct = ((latest - first) / first) * 100;

      return { currency, labels, values, latest, absoluteChange, deltaPct };
    } catch {
      return null;
    }
  }));

  return items.filter(Boolean);
}

function renderMarketSnapshots(items) {
  latestMarketSnapshotItems = items;
  if (!marketsGridEl) return;

  if (!items.length) {
    destroySparklineCharts();
    marketsGridEl.innerHTML = `<div class="market-empty">Pair lain belum tersedia sekarang.</div>`;
    return;
  }

  destroySparklineCharts();

  marketsGridEl.innerHTML = items.map((item) => {
    const isActive = item.currency === currencySelect.value;
    const trend = getTrendMeta(item.deltaPct);
    const absolutePrefix = item.absoluteChange >= 0 ? "+" : "-";
    const deltaClass = item.absoluteChange > 0.5 ? "up" : item.absoluteChange < -0.5 ? "down" : "flat";
    const meta = getCurrencyMeta(item.currency);

    return `<button type="button" class="market-card ${isActive ? "active" : ""}" data-currency="${item.currency}" aria-label="Buka analisis ${item.currency} terhadap IDR"><div class="market-card-head"><div class="market-card-identity"><span class="currency-logo" aria-hidden="true">${meta.icon}</span><div class="market-card-pair-wrap"><span class="market-card-pair">${item.currency} / IDR</span><div class="market-card-subrate">${escapeHtml(meta.name)}</div></div></div></div><div class="market-card-main"><div class="market-card-rate">${formatSplitNumber(item.latest, { digits: 2 })}</div><div class="market-card-change-wrap"><span class="market-card-delta ${deltaClass}">${absolutePrefix}${formatNumber(Math.abs(item.absoluteChange), 2)}</span><span class="market-card-badge ${trend.badgeClass}"><span>${trend.icon}</span><span>${trend.label}</span></span></div></div><div class="market-sparkline"><canvas id="sparkline-${item.currency}"></canvas></div></button>`;
  }).join("");

  items.forEach((item) => {
    const canvas = document.getElementById(`sparkline-${item.currency}`);
    if (!canvas) return;

    const rupiahGood = item.deltaPct < -0.5;
    const rupiahBad = item.deltaPct > 0.5;
    const lineColor = rupiahGood ? "#17803d" : rupiahBad ? "#b42318" : "#7f8998";
    const fillColor = rupiahGood ? "rgba(23, 128, 61, 0.10)" : rupiahBad ? "rgba(180, 35, 24, 0.10)" : "rgba(127, 137, 152, 0.10)";

    const chart = new Chart(canvas, {
      type: "line",
      data: {
        labels: item.labels,
        datasets: [{
          data: item.values,
          borderColor: lineColor,
          backgroundColor: fillColor,
          fill: true,
          borderWidth: 1.4,
          tension: 0.32,
          pointRadius: 0,
          pointHoverRadius: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
        },
        scales: {
          x: { display: false },
          y: { display: false },
        },
      },
    });

    sparklineCharts.set(item.currency, chart);
  });

  marketsGridEl.querySelectorAll(".market-card").forEach((button) => {
    button.addEventListener("click", () => {
      currencySelect.value = button.dataset.currency;
      button.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
      runAnalysis();
    });
  });
}

function renderCompareCards(items) {
  if (!compareGridEl) return;

  if (!items.length) {
    compareGridEl.innerHTML = `<article class="compare-card"><span class="compare-label">Belum ada data</span><strong>-</strong><p class="compare-subtext">Perbandingan akan tampil setelah data berhasil dimuat.</p></article>`;
    return;
  }

  const filtered = items.filter((item) => COMPARE_CURRENCIES.includes(item.currency)).slice(0, 4);
  const amount = state.amountRaw || 0;

  compareGridEl.innerHTML = filtered.map((item) => {
    const result = state.mode === "IDR_TO_FX" ? amount / item.latest : amount * item.latest;
    return `<article class="compare-card"><span class="compare-label">${item.currency}/IDR</span><strong>${formatNumber(result, 2)} ${state.mode === "IDR_TO_FX" ? item.currency : "IDR"}</strong><p class="compare-subtext">Kurs ${formatNumber(item.latest, 2)} IDR</p></article>`;
  }).join("");
}

function renderReleasePanel(items) {
  state.releases = items;
  state.selectedReleaseIndex = 0;

  if (!items.length) {
    releasePrimaryEl.innerHTML = `Belum ada rilis utama yang terdeteksi.`;
    releaseListEl.innerHTML = `<article class="release-item"><strong>Belum ada kandidat rilis</strong><div class="release-meta">Coba muat ulang atau ganti mata uang.</div></article>`;
    return;
  }

  const primary = items[0];
  releasePrimaryEl.innerHTML = `<span class="release-tag ${primary.type}">${escapeHtml(primary.label)}</span><p><strong>${escapeHtml(primary.title)}</strong></p><div class="release-meta">${escapeHtml(primary.source)} · ${escapeHtml(formatDateOnly(primary.pubDate) || "Tanggal tidak tersedia")}</div>`;

  releaseListEl.innerHTML = items.map((item, index) => `
    <article class="release-item ${index === 0 ? "active" : ""}" data-index="${index}" tabindex="0">
      <span class="release-tag ${item.type}">${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.title)}</strong>
      <div class="release-meta">${escapeHtml(item.source)} · ${escapeHtml(formatDateOnly(item.pubDate) || "Tanggal tidak tersedia")}</div>
    </article>
  `).join("");

  releaseListEl.querySelectorAll(".release-item").forEach((itemEl) => {
    itemEl.addEventListener("click", () => {
      const index = Number(itemEl.dataset.index || 0);
      state.selectedReleaseIndex = index;
      const selected = state.releases[index];

      if (selected?.type === "ambiguous") {
        openReleaseValidationDialog();
      } else {
        applySelectedRelease();
      }
    });
  });
}

function applySelectedRelease() {
  const release = state.releases[state.selectedReleaseIndex];
  if (!release) return;

  releaseListEl.querySelectorAll(".release-item").forEach((item, index) => {
    item.classList.toggle("active", index === state.selectedReleaseIndex);
  });

  releasePrimaryEl.innerHTML = `<span class="release-tag ${release.type}">${escapeHtml(release.label)}</span><p><strong><a href="${escapeHtml(release.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(release.title)}</a></strong></p><div class="release-meta">${escapeHtml(release.source)} · ${escapeHtml(formatDateOnly(release.pubDate) || "Tanggal tidak tersedia")}</div>`;
}

function openReleaseValidationDialog() {
  if (!releaseDialog || !state.releases.length) return;

  dialogOptionsEl.innerHTML = state.releases.slice(0, 3).map((item, index) => `
    <button type="button" class="dialog-option ${index === state.selectedReleaseIndex ? "active" : ""}" data-index="${index}">
      <span class="release-tag ${item.type}">${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.title)}</strong>
      <div class="release-meta">${escapeHtml(item.source)} · ${escapeHtml(formatDateOnly(item.pubDate) || "Tanggal tidak tersedia")}</div>
    </button>
  `).join("");

  dialogOptionsEl.querySelectorAll(".dialog-option").forEach((button) => {
    button.addEventListener("click", () => {
      dialogOptionsEl.querySelectorAll(".dialog-option").forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      state.selectedReleaseIndex = Number(button.dataset.index || 0);
    });
  });

  if (typeof releaseDialog.showModal === "function") {
    releaseDialog.showModal();
  }
}

function setLoadingState() {
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Memperbarui...";
  chartMetaEl.textContent = "Mengambil data kurs terbaru...";
  verdictTextEl.textContent = "Sedang menyiapkan insight untuk pair aktif.";

  updateMetric(latestRateEl, renderPlainMetric("-"));
  updateMetric(pastCompareEl, renderPlainMetric("-"));
  updateMetric(forecastValueEl, renderPlainMetric("-"));
  updateMetric(conversionResultEl, renderPlainMetric("-"));
  updateMetric(averageRateEl, renderPlainMetric("-"));
  updateMetric(lowestRateEl, renderPlainMetric("-"));
  updateMetric(highestRateEl, renderPlainMetric("-"));
  updateMetric(volatilityLabelEl, renderPlainMetric("-"));

  applyPastCompareStyle(NaN);
  biasBadgeEl.textContent = "Netral";
  biasBadgeEl.className = "badge neutral";

  updateDataSourceText();
  updateLastUpdated(new Date().toISOString());

  setUIState(chartStateEl, "loading", "Grafik sedang dimuat...");
  setUIState(newsStateEl, "loading", "Headline pendukung sedang dimuat...");
  setUIState(releaseStateEl, "loading", "Mencari rilis terbaru...");

  if (marketsGridEl) {
    marketsGridEl.innerHTML = `<article class="market-card-skeleton"><span class="skeleton-bar sm"></span><span class="skeleton-bar md"></span><span class="skeleton-bar lg"></span><div class="skeleton-chart"></div></article><article class="market-card-skeleton"><span class="skeleton-bar sm"></span><span class="skeleton-bar md"></span><span class="skeleton-bar lg"></span><div class="skeleton-chart"></div></article><article class="market-card-skeleton"><span class="skeleton-bar sm"></span><span class="skeleton-bar md"></span><span class="skeleton-bar lg"></span><div class="skeleton-chart"></div></article>`;
  }
}

function resetButtonState() {
  analyzeBtn.disabled = false;
  analyzeBtn.textContent = "Perbarui hasil";
}

async function loadReleases(currency) {
  setUIState(releaseStateEl, "loading", "Mencari rilis terbaru...");
  const releases = await fetchReleaseCandidates(currency);
  renderReleasePanel(releases);

  if (!releases.length) {
    setUIState(releaseStateEl, "success", "Belum ada rilis utama yang berhasil ditemukan.");
    return [];
  }

  setUIState(releaseStateEl, "", "");
  applySelectedRelease();
  return releases;
}

async function runAnalysis() {
  const currency = currencySelect.value;
  const days = Number(rangeSelect.value);
  setLoadingState();

  try {
    const rateData = await fetchRates(currency, days);
    const labels = Object.keys(rateData.rates);
    const values = labels.map((date) => rateData.rates[date].IDR);

    if (!values.length) throw new Error("Data historis kosong.");

    const first = values[0];
    const latest = values[values.length - 1];
    const forecast = simpleForecast(values);
    const deltaPct = ((latest - first) / first) * 100;
    const indicative = classifyIndicativeDirection(latest, forecast);
    const average = calculateAverage(values);
    const low = calculateLow(values);
    const high = calculateHigh(values);
    const volatility = calculateVolatilityLabel(values);

    state.latestRateValue = latest;

    updateMetric(latestRateEl, formatSplitNumber(latest, { digits: 2, suffix: "IDR" }));
    updateMetric(pastCompareEl, formatSplitNumber(deltaPct, { digits: 2, suffix: "%", positiveSign: true }));
    applyPastCompareStyle(deltaPct);
    updateMetric(conversionResultEl, renderPlainMetric("-"));
    updateMetric(forecastValueEl, renderPlainMetric(indicative.label));
    updateMetric(averageRateEl, formatSplitNumber(average, { digits: 2, suffix: "IDR" }));
    updateMetric(lowestRateEl, formatSplitNumber(low, { digits: 2, suffix: "IDR" }));
    updateMetric(highestRateEl, formatSplitNumber(high, { digits: 2, suffix: "IDR" }));
    updateMetric(volatilityLabelEl, renderPlainMetric(volatility));

    updateConversionOnly();
    renderChart(labels, values, currency);

    chartMetaEl.textContent = `Periode ${days} hari · ${currency}/IDR`;
    biasBadgeEl.textContent = getRupiahChangeState(deltaPct).hint;
    biasBadgeEl.className = `badge ${deltaPct < -0.5 ? "bullish" : deltaPct > 0.5 ? "bearish" : "neutral"}`;

    updateDataSourceText();
    updateLastUpdated(new Date().toISOString());
    setUIState(chartStateEl, "", "");

    const [headlines, marketItems, releases] = await Promise.all([
      fetchLiveNews(currency),
      fetchMarketSnapshots(Math.min(days, 30)),
      loadReleases(currency),
    ]);

    renderMarketSnapshots(marketItems);
    renderCompareCards(marketItems);
    renderNews(headlines);
    verdictTextEl.textContent = buildVerdict(currency, latest, first, indicative, releases[0]);
  } catch (error) {
    state.latestRateValue = null;

    updateMetric(latestRateEl, renderPlainMetric("-"));
    updateMetric(pastCompareEl, renderPlainMetric("-"));
    updateMetric(forecastValueEl, renderPlainMetric("-"));
    updateMetric(conversionResultEl, renderPlainMetric("-"));
    updateMetric(averageRateEl, renderPlainMetric("-"));
    updateMetric(lowestRateEl, renderPlainMetric("-"));
    updateMetric(highestRateEl, renderPlainMetric("-"));
    updateMetric(volatilityLabelEl, renderPlainMetric("-"));

    applyPastCompareStyle(NaN);
    renderCompareCards([]);

    chartMetaEl.textContent = "Data kurs belum berhasil dimuat.";
    verdictTextEl.textContent = error?.message || "Insight belum tersedia. Coba lagi beberapa saat.";
    biasBadgeEl.textContent = "Netral";
    biasBadgeEl.className = "badge neutral";

    newsListEl.innerHTML = `<article class="news-item"><strong>Berita belum bisa dimuat</strong><div class="news-meta">Sumber berita sedang tidak tersedia atau koneksi belum stabil.</div></article>`;
    renderReleasePanel([]);
    destroySparklineCharts();
    marketsGridEl.innerHTML = `<div class="market-empty">Kurs lain belum bisa dimuat sekarang.</div>`;

    setUIState(chartStateEl, "error", error?.message || "Gagal memuat grafik.");
    setUIState(newsStateEl, "error", "Gagal memuat headline pendukung.");
    setUIState(releaseStateEl, "error", "Gagal memuat rilis terbaru.");

    if (state.chart) {
      state.chart.data.labels = [];
      state.chart.data.datasets[0].data = [];
      state.chart.update("none");
    }
  } finally {
    resetButtonState();
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
