const state = {
  mode: "IDR_TO_FX",
  chart: null,
  latestRateValue: null,
  latestDate: null,
  watchlist: [],
  theme: "light",
  amountRaw: 1000000,
};

const MARKET_CURRENCIES = ["USD", "SGD", "AUD", "JPY", "EUR", "GBP"];
const sparklineCharts = new Map();
let latestMarketSnapshotItems = [];

const CURRENCY_META = {
  USD: { icon: "🇺🇸", name: "US Dollar" },
  SGD: { icon: "🇸🇬", name: "Singapore Dollar" },
  AUD: { icon: "🇦🇺", name: "Australian Dollar" },
  JPY: { icon: "🇯🇵", name: "Japanese Yen" },
  EUR: { icon: "🇪🇺", name: "Euro" },
  GBP: { icon: "🇬🇧", name: "Pound Sterling" },
  CNY: { icon: "🇨🇳", name: "Chinese Yuan" },
  MYR: { icon: "🇲🇾", name: "Malaysian Ringgit" },
  HKD: { icon: "🇭🇰", name: "Hong Kong Dollar" },
  SAR: { icon: "🇸🇦", name: "Saudi Riyal" },
};

const currencySelect = document.getElementById("currencySelect");
const rangeSelect = document.getElementById("rangeSelect");
const amountInput = document.getElementById("amountInput");
const analyzeBtn = document.getElementById("analyzeBtn");
const watchlistBtn = document.getElementById("watchlistBtn");
const clearWatchlistBtn = document.getElementById("clearWatchlist");
const themeToggle = document.getElementById("themeToggle");

const latestRateEl = document.getElementById("latestRate");
const pastCompareEl = document.getElementById("pastCompare");
const forecastValueEl = document.getElementById("forecastValue");
const conversionResultEl = document.getElementById("conversionResult");
const verdictTextEl = document.getElementById("verdictText");
const biasBadgeEl = document.getElementById("biasBadge");
const chartMetaEl = document.getElementById("chartMeta");

const chartStateEl = document.getElementById("chartState");
const newsStateEl = document.getElementById("newsState");
const watchlistStateEl = document.getElementById("watchlistState");

const newsListEl = document.getElementById("newsList");
const watchlistItemsEl = document.getElementById("watchlistItems");
const marketsGridEl = document.getElementById("marketsGrid");

const dataSourceTextEl = document.getElementById("dataSourceText");
const lastUpdatedTextEl = document.getElementById("lastUpdatedText");

init();

async function init() {
  state.watchlist = readStorage("currency-watchlist", []);
  state.theme = readStorage("currency-theme", "light");
  state.amountRaw = 1000000;

  applyTheme(state.theme);
  bindEvents();
  renderCurrencyOptions();
  syncAmountInput();
  renderWatchlist();
  await runAnalysis();
}

function bindEvents() {
  document.querySelectorAll(".switch-btn").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".switch-btn").forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      state.mode = button.dataset.mode;
      updateConversionOnly();
    });
  });

  analyzeBtn.addEventListener("click", runAnalysis);
  watchlistBtn.addEventListener("click", addCurrentCurrencyToWatchlist);
  clearWatchlistBtn.addEventListener("click", clearWatchlist);

  currencySelect.addEventListener("change", runAnalysis);
  rangeSelect.addEventListener("change", runAnalysis);

  amountInput.addEventListener("input", handleAmountInput);
  amountInput.addEventListener("blur", syncAmountInput);

  themeToggle.addEventListener("click", () => {
    const nextTheme =
      document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";

    state.theme = nextTheme;
    writeStorage("currency-theme", nextTheme);
    applyTheme(nextTheme);
    updateChartTheme();

    if (latestMarketSnapshotItems.length) {
      renderMarketSnapshots(latestMarketSnapshotItems);
    }
  });
}

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return null;
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeToggle.textContent = theme === "dark" ? "☀️" : "🌗";
  themeToggle.setAttribute(
    "aria-label",
    theme === "dark" ? "Ganti ke tema terang" : "Ganti ke tema gelap"
  );
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

  currencySelect.innerHTML = options
    .map((code) => {
      const meta = getCurrencyMeta(code);
      return `
        <option value="${code}" ${selected === code ? "selected" : ""}>
          ${meta.icon} ${code}
        </option>
      `;
    })
    .join("");
}

function getCurrencyMeta(code) {
  return CURRENCY_META[code] || { icon: "💱", name: code };
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

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateOnly(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatNumber(value, digits = 2) {
  return Number(value).toLocaleString("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatCompactNumber(value, digits = 0) {
  return Number(value).toLocaleString("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatInputNumber(value) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function parseLocaleNumber(value) {
  if (!value) return 0;

  const cleaned = String(value)
    .replace(/[^\d.,]/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function handleAmountInput(event) {
  const input = event.target;
  const parsed = parseLocaleNumber(input.value);

  state.amountRaw = parsed;
  input.value = parsed ? formatInputNumber(parsed) : "";
  updateConversionOnly();
}

function syncAmountInput() {
  amountInput.value = state.amountRaw ? formatInputNumber(state.amountRaw) : "";
}

function formatSplitNumber(value, digits = 2) {
  const isNegative = Number(value) < 0;
  const abs = Math.abs(Number(value));
  const fixed = abs.toLocaleString("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

  const [intPart, decimalPart = "00"] = fixed.split(",");
  return {
    sign: isNegative ? "-" : "",
    intPart,
    decimalPart,
  };
}

function renderSplitNumber(value, options = {}) {
  const {
    digits = 2,
    prefix = "",
    suffix = "",
    positiveSign = false,
  } = options;

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return `<span class="number-main">-</span>`;

  const { sign, intPart, decimalPart } = formatSplitNumber(numeric, digits);
  const computedSign = positiveSign && numeric > 0 ? "+" : sign;

  return `
    <span class="number-main">${escapeHtml(prefix)}${computedSign}${escapeHtml(intPart)}</span>
    <span class="number-decimal">,${escapeHtml(decimalPart)}</span>
    ${suffix ? `<span class="number-suffix">${escapeHtml(suffix)}</span>` : ""}
  `;
}

function renderPlainMetric(text) {
  return `<span class="number-main">${escapeHtml(text)}</span>`;
}

function updateMetric(el, html) {
  el.innerHTML = html;
}

function simpleForecast(values) {
  if (!values.length) return 0;
  if (values.length === 1) return values[0];

  const recent = values.slice(-7);
  if (recent.length < 2) return recent[recent.length - 1];

  const deltas = recent.slice(1).map((value, index) => value - recent[index]);
  const avgDelta = deltas.reduce((sum, val) => sum + val, 0) / deltas.length;
  return recent[recent.length - 1] + avgDelta * 5;
}

function classifyIndicativeDirection(latest, forecast) {
  if (!Number.isFinite(latest) || !Number.isFinite(forecast)) {
    return { label: "Netral", badge: "neutral" };
  }

  const pct = ((forecast - latest) / latest) * 100;

  if (pct > 0.3) return { label: "Cenderung naik", badge: "bullish" };
  if (pct < -0.3) return { label: "Cenderung turun", badge: "bearish" };
  return { label: "Relatif stabil", badge: "neutral" };
}

function updateLastUpdated(dateValue) {
  state.latestDate = dateValue || new Date().toISOString();
  lastUpdatedTextEl.textContent = formatDateTime(state.latestDate);
}

function updateDataSourceText() {
  dataSourceTextEl.textContent = "Frankfurter · Google News RSS";
}

async function fetchRates(currency, days) {
  const start = buildDate(days);
  const end = buildDate(0);
  const url = `https://api.frankfurter.dev/v1/${start}..${end}?base=${currency}&symbols=IDR`;

  let response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch {
    throw new Error("Koneksi bermasalah. Coba lagi saat internet sudah stabil.");
  }

  if (!response.ok) {
    throw new Error("Data kurs sedang tidak bisa diambil.");
  }

  const data = await response.json();

  if (!data.rates || !Object.keys(data.rates).length) {
    throw new Error("Belum ada data kurs untuk periode ini.");
  }

  return data;
}

async function fetchLiveNews(currency) {
  const queryMap = {
    USD: "USD IDR rupiah",
    SGD: "SGD IDR rupiah",
    AUD: "AUD IDR rupiah",
    JPY: "JPY IDR rupiah",
    EUR: "EUR IDR rupiah",
    GBP: "GBP IDR rupiah",
    CNY: "CNY IDR rupiah",
    MYR: "MYR IDR rupiah",
    HKD: "HKD IDR rupiah",
    SAR: "SAR IDR rupiah",
  };

  const query = encodeURIComponent(queryMap[currency] || `${currency} IDR rupiah`);
  const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=id&gl=ID&ceid=ID:id`;
  const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;

  try {
    const response = await fetch(apiUrl, { cache: "no-store" });
    if (!response.ok) throw new Error("Gagal mengambil feed berita.");

    const data = await response.json();
    if (!data.items || !Array.isArray(data.items)) return [];

    return data.items.slice(0, 6).map((item) => ({
      title: item.title || "Tanpa judul",
      source: item.author || item.source || "Google News",
      url: item.link || "#",
      pubDate: item.pubDate || "",
    }));
  } catch {
    return [];
  }
}

function renderNews(items) {
  if (!items.length) {
    setUIState(
      newsStateEl,
      "success",
      "Belum ada berita yang relevan untuk pair ini saat ini."
    );

    newsListEl.innerHTML = `
      <article class="news-item">
        <strong>Belum ada berita untuk pair ini</strong>
        <p>Coba ganti mata uang atau perbarui data beberapa saat lagi.</p>
      </article>
    `;
    return;
  }

  setUIState(newsStateEl, "", "");

  newsListEl.innerHTML = items
    .map((item) => {
      const source = item.source || "Google News";
      const dateText = formatDateOnly(item.pubDate) || "Tanggal tidak tersedia";

      return `
        <article class="news-item">
          <div class="news-item-top">
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">
              ${escapeHtml(item.title)}
            </a>
          </div>
          <div class="news-meta">${escapeHtml(source)} · ${escapeHtml(dateText)}</div>
          <p>
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">
              Buka sumber berita
            </a>
          </p>
        </article>
      `;
    })
    .join("");
}

function addCurrentCurrencyToWatchlist() {
  const currency = currencySelect.value;
  const exists = state.watchlist.some((entry) => entry.currency === currency);

  if (exists) {
    setUIState(watchlistStateEl, "success", `${currency} sudah ada di kurs tersimpan.`);
    return;
  }

  state.watchlist.push({
    currency,
    savedAt: new Date().toISOString(),
  });

  writeStorage("currency-watchlist", state.watchlist);
  renderWatchlist();
  setUIState(watchlistStateEl, "success", `${currency} berhasil disimpan.`);
}

function clearWatchlist() {
  state.watchlist = [];
  writeStorage("currency-watchlist", state.watchlist);
  renderWatchlist();
  setUIState(watchlistStateEl, "success", "Semua kurs tersimpan sudah dihapus.");
}

function renderWatchlist() {
  if (!state.watchlist.length) {
    setUIState(
      watchlistStateEl,
      "success",
      "Belum ada kurs yang disimpan. Tambahkan pair yang sering kamu cek."
    );

    watchlistItemsEl.innerHTML = `
      <article class="watch-item">
        <strong>Belum ada kurs tersimpan</strong>
        <p>Simpan pair dari bagian atas agar lebih cepat dibuka lagi nanti.</p>
      </article>
    `;
    return;
  }

  setUIState(watchlistStateEl, "", "");

  watchlistItemsEl.innerHTML = state.watchlist
    .map((item) => {
      const meta = getCurrencyMeta(item.currency);
      return `
        <article class="watch-item">
          <div class="watch-item-top">
            <strong>${meta.icon} ${escapeHtml(item.currency)}</strong>
          </div>
          <p>Disimpan pada ${escapeHtml(formatDateTime(item.savedAt))}.</p>
        </article>
      `;
    })
    .join("");
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
    updateMetric(
      conversionResultEl,
      renderSplitNumber(result, { digits: 2, suffix: currency })
    );
  } else {
    const result = amount * latest;
    updateMetric(
      conversionResultEl,
      renderSplitNumber(result, { digits: 2, suffix: "IDR" })
    );
  }
}

function buildVerdict(currency, latest, first, indicative, headlineCount) {
  const pct = ((latest - first) / first) * 100;

  const changeText =
    pct > 0
      ? `menguat ${formatNumber(Math.abs(pct), 2)}%`
      : pct < 0
      ? `melemah ${formatNumber(Math.abs(pct), 2)}%`
      : "bergerak relatif datar";

  const newsText =
    headlineCount > 0
      ? `Ada ${headlineCount} berita yang bisa dipakai sebagai konteks tambahan.`
      : "Belum ada berita relevan yang berhasil dimuat saat ini.";

  return `${currency}/IDR ${changeText} dalam periode yang dipilih. Sinyal tren saat ini ${indicative.label.toLowerCase()}. ${newsText}`;
}

function getChartColors() {
  const styles = getComputedStyle(document.documentElement);

  return {
    line: styles.getPropertyValue("--primary").trim() || "#275df6",
    fill:
      document.documentElement.getAttribute("data-theme") === "dark"
        ? "rgba(134, 168, 255, 0.16)"
        : "rgba(39, 93, 246, 0.10)",
    grid: styles.getPropertyValue("--line").trim() || "rgba(17, 24, 39, 0.08)",
    tick: styles.getPropertyValue("--text-faint").trim() || "#8a94a6",
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
        datasets: [
          {
            label: `${currency}/IDR`,
            data: values,
            borderColor: colors.line,
            backgroundColor: colors.fill,
            fill: true,
            tension: 0.34,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHitRadius: 16,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 280 },
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
        interaction: {
          mode: "index",
          intersect: false,
        },
        scales: {
          x: {
            ticks: {
              color: colors.tick,
              maxTicksLimit: 6,
            },
            grid: {
              color: colors.grid,
              drawBorder: false,
            },
          },
          y: {
            ticks: {
              color: colors.tick,
              callback: (value) => formatCompactNumber(value, 0),
            },
            grid: {
              color: colors.grid,
              drawBorder: false,
            },
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
  if (deltaPct > 0) {
    return {
      badgeClass: "up",
      icon: "↗",
      label: `+${formatNumber(deltaPct, 2)}%`,
    };
  }

  if (deltaPct < 0) {
    return {
      badgeClass: "down",
      icon: "↘",
      label: `-${formatNumber(Math.abs(deltaPct), 2)}%`,
    };
  }

  return {
    badgeClass: "flat",
    icon: "→",
    label: "0,00%",
  };
}

function destroySparklineCharts() {
  sparklineCharts.forEach((chart) => chart.destroy());
  sparklineCharts.clear();
}

async function fetchMarketSnapshots(days = 14) {
  const items = await Promise.all(
    MARKET_CURRENCIES.map(async (currency) => {
      try {
        const data = await fetchRates(currency, days);
        const labels = Object.keys(data.rates);
        const values = labels.map((date) => data.rates[date].IDR);

        if (!values.length) return null;

        const first = values[0];
        const latest = values[values.length - 1];
        const absoluteChange = latest - first;
        const deltaPct = ((latest - first) / first) * 100;

        return {
          currency,
          labels,
          values,
          latest,
          absoluteChange,
          deltaPct,
        };
      } catch {
        return null;
      }
    })
  );

  return items.filter(Boolean);
}

function renderMarketSnapshots(items) {
  latestMarketSnapshotItems = items;

  if (!marketsGridEl) return;

  if (!items.length) {
    destroySparklineCharts();
    marketsGridEl.innerHTML = `
      <div class="market-empty">
        Pair lain belum tersedia sekarang. Coba perbarui data beberapa saat lagi.
      </div>
    `;
    return;
  }

  destroySparklineCharts();

  marketsGridEl.innerHTML = items
    .map((item) => {
      const isActive = item.currency === currencySelect.value;
      const trend = getTrendMeta(item.deltaPct);
      const absolutePrefix = item.absoluteChange >= 0 ? "+" : "-";
      const deltaClass =
        item.absoluteChange > 0 ? "up" : item.absoluteChange < 0 ? "down" : "flat";
      const meta = getCurrencyMeta(item.currency);

      return `
        <button
          type="button"
          class="market-card ${isActive ? "active" : ""}"
          data-currency="${item.currency}"
          aria-label="Buka analisis ${item.currency} terhadap IDR"
        >
          <div class="market-card-head">
            <div class="market-card-identity">
              <span class="currency-logo" aria-hidden="true">${meta.icon}</span>
              <div class="market-card-pair-wrap">
                <span class="market-card-pair">${item.currency} / IDR</span>
                <div class="market-card-subrate">${escapeHtml(meta.name)}</div>
              </div>
            </div>
          </div>

          <div class="market-card-main">
            <div class="market-card-rate">
              ${renderSplitNumber(item.latest, { digits: 2 })}
            </div>

            <div class="market-card-change-wrap">
              <span class="market-card-delta ${deltaClass}">
                ${absolutePrefix}${formatNumber(Math.abs(item.absoluteChange), 2)}
              </span>

              <span class="market-card-badge ${trend.badgeClass}">
                <span>${trend.icon}</span>
                <span>${trend.label}</span>
              </span>
            </div>
          </div>

          <div class="market-sparkline">
            <canvas id="sparkline-${item.currency}"></canvas>
          </div>
        </button>
      `;
    })
    .join("");

  items.forEach((item) => {
    const canvas = document.getElementById(`sparkline-${item.currency}`);
    if (!canvas) return;

    const positive = item.deltaPct >= 0;
    const lineColor = positive ? "#17803d" : "#b42318";
    const fillColor = positive ? "rgba(23, 128, 61, 0.10)" : "rgba(180, 35, 24, 0.10)";

    const chart = new Chart(canvas, {
      type: "line",
      data: {
        labels: item.labels,
        datasets: [
          {
            data: item.values,
            borderColor: lineColor,
            backgroundColor: fillColor,
            fill: true,
            borderWidth: 1.4,
            tension: 0.32,
            pointRadius: 0,
            pointHoverRadius: 0,
          },
        ],
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

function setLoadingState() {
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Memperbarui...";

  chartMetaEl.textContent = "Mengambil data kurs terbaru...";
  verdictTextEl.textContent = "Sedang menyiapkan insight untuk pair aktif.";

  updateMetric(latestRateEl, renderPlainMetric("-"));
  updateMetric(pastCompareEl, renderPlainMetric("-"));
  updateMetric(forecastValueEl, renderPlainMetric("-"));
  updateMetric(conversionResultEl, renderPlainMetric("-"));

  biasBadgeEl.textContent = "Netral";
  biasBadgeEl.className = "badge neutral";

  updateDataSourceText();
  updateLastUpdated(new Date().toISOString());

  setUIState(chartStateEl, "loading", "Grafik sedang dimuat...");
  setUIState(newsStateEl, "loading", "Berita terbaru sedang dimuat...");

  if (marketsGridEl) {
    marketsGridEl.innerHTML = `
      <article class="market-card-skeleton">
        <span class="skeleton-bar sm"></span>
        <span class="skeleton-bar md"></span>
        <span class="skeleton-bar lg"></span>
        <div class="skeleton-chart"></div>
      </article>
      <article class="market-card-skeleton">
        <span class="skeleton-bar sm"></span>
        <span class="skeleton-bar md"></span>
        <span class="skeleton-bar lg"></span>
        <div class="skeleton-chart"></div>
      </article>
      <article class="market-card-skeleton">
        <span class="skeleton-bar sm"></span>
        <span class="skeleton-bar md"></span>
        <span class="skeleton-bar lg"></span>
        <div class="skeleton-chart"></div>
      </article>
    `;
  }
}

function resetButtonState() {
  analyzeBtn.disabled = false;
  analyzeBtn.textContent = "Perbarui hasil";
}

async function runAnalysis() {
  const currency = currencySelect.value;
  const days = Number(rangeSelect.value);

  setLoadingState();

  try {
    const [rateData, headlines, marketItems] = await Promise.all([
      fetchRates(currency, days),
      fetchLiveNews(currency),
      fetchMarketSnapshots(14),
    ]);

    const labels = Object.keys(rateData.rates);
    const values = labels.map((date) => rateData.rates[date].IDR);

    if (!values.length) {
      throw new Error("Data historis kosong.");
    }

    const first = values[0];
    const latest = values[values.length - 1];
    const forecast = simpleForecast(values);
    const deltaPct = ((latest - first) / first) * 100;
    const indicative = classifyIndicativeDirection(latest, forecast);

    state.latestRateValue = latest;

    updateMetric(latestRateEl, renderSplitNumber(latest, { digits: 2, suffix: "IDR" }));
    updateMetric(
      pastCompareEl,
      renderSplitNumber(deltaPct, { digits: 2, suffix: "%", positiveSign: true })
    );
    updateMetric(conversionResultEl, renderPlainMetric("-"));
    updateMetric(forecastValueEl, renderPlainMetric(indicative.label));

    updateConversionOnly();
    renderChart(labels, values, currency);
    renderMarketSnapshots(marketItems);
    renderNews(headlines);

    chartMetaEl.textContent = `Periode ${days} hari · ${currency}/IDR`;
    verdictTextEl.textContent = buildVerdict(currency, latest, first, indicative, headlines.length);
    biasBadgeEl.textContent = indicative.label;
    biasBadgeEl.className = `badge ${indicative.badge}`;

    updateDataSourceText();
    updateLastUpdated(new Date().toISOString());

    setUIState(chartStateEl, "", "");
  } catch (error) {
    state.latestRateValue = null;

    updateMetric(latestRateEl, renderPlainMetric("-"));
    updateMetric(pastCompareEl, renderPlainMetric("-"));
    updateMetric(forecastValueEl, renderPlainMetric("-"));
    updateMetric(conversionResultEl, renderPlainMetric("-"));

    chartMetaEl.textContent = "Data kurs belum berhasil dimuat.";
    verdictTextEl.textContent =
      error?.message || "Insight belum tersedia. Coba lagi beberapa saat.";
    biasBadgeEl.textContent = "Netral";
    biasBadgeEl.className = "badge neutral";

    newsListEl.innerHTML = `
      <article class="news-item">
        <strong>Berita belum bisa dimuat</strong>
        <p>Sumber berita sedang tidak tersedia atau koneksi belum stabil.</p>
      </article>
    `;

    destroySparklineCharts();
    marketsGridEl.innerHTML = `
      <div class="market-empty">
        Kurs lain belum bisa dimuat sekarang. Coba lagi beberapa saat.
      </div>
    `;

    setUIState(chartStateEl, "error", error?.message || "Gagal memuat grafik.");
    setUIState(newsStateEl, "error", "Gagal memuat daftar berita.");

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
