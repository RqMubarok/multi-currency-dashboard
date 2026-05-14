const state = {
  mode: "IDR_TO_FX",
  chart: null,
  latestRateValue: null,
  watchlist: readStorage("currency-watchlist", []),
  theme: readStorage("currency-theme", "light"),
};

const MARKET_CURRENCIES = ["USD", "JPY", "SGD", "AUD", "GBP"];
const sparklineCharts = new Map();

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
const newsListEl = document.getElementById("newsList");
const watchlistItemsEl = document.getElementById("watchlistItems");
const marketsGridEl = document.getElementById("marketsGrid");

init();

async function init() {
  applyTheme(state.theme);
  bindEvents();
  renderWatchlist();
  await runAnalysis();
}

function bindEvents() {
  document.querySelectorAll(".switch-btn").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".switch-btn").forEach((btn) => {
        btn.classList.remove("active");
      });

      button.classList.add("active");
      state.mode = button.dataset.mode;
      updateConversionOnly();
    });
  });

  analyzeBtn.addEventListener("click", runAnalysis);
  watchlistBtn.addEventListener("click", addCurrentCurrencyToWatchlist);
  clearWatchlistBtn.addEventListener("click", clearWatchlist);

  currencySelect.addEventListener("change", () => {
    runAnalysis();
  });

  rangeSelect.addEventListener("change", () => {
    runAnalysis();
  });

  amountInput.addEventListener("input", () => {
    updateConversionOnly();
  });

  themeToggle.addEventListener("click", () => {
    const nextTheme =
      document.documentElement.getAttribute("data-theme") === "dark"
        ? "light"
        : "dark";

    state.theme = nextTheme;
    writeStorage("currency-theme", nextTheme);
    applyTheme(nextTheme);

    if (state.chart) {
      updateChartTheme();
    }

    if (marketsGridEl?.children.length) {
      runAnalysis();
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

function buildDate(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split("T")[0];
}

function simpleForecast(values) {
  if (!values.length) return 0;
  if (values.length === 1) return values[0];

  const recent = values.slice(-7);
  if (recent.length < 2) return recent[recent.length - 1];

  const deltas = recent.slice(1).map((value, index) => value - recent[index]);
  const averageDelta =
    deltas.reduce((sum, value) => sum + value, 0) / deltas.length;

  return recent[recent.length - 1] + averageDelta * 7;
}

async function fetchRates(currency, days) {
  const start = buildDate(days);
  const end = buildDate(0);
  const url = `https://api.frankfurter.dev/v1/${start}..${end}?base=${currency}&symbols=IDR`;

  let response;

  try {
    response = await fetch(url, { cache: "no-store" });
  } catch {
    throw new Error("Koneksi gagal. Periksa internet lalu coba lagi.");
  }

  if (!response.ok) {
    throw new Error("Server kurs sedang bermasalah.");
  }

  const data = await response.json();

  if (!data.rates || !Object.keys(data.rates).length) {
    throw new Error("Data kurs tidak tersedia untuk periode ini.");
  }

  return data;
}

async function fetchNewsPlaceholders(currency) {
  return Array.from({ length: 10 }, (_, index) => ({
    title: `Placeholder berita ${currency} ${index + 1}`,
    description: "Bagian ini akan diganti saat integrasi berita live diaktifkan.",
    url: "#",
  }));
}

function renderNews(items) {
  if (!items.length) {
    newsListEl.innerHTML = `
      <article class="news-item">
        <strong>Tidak ada berita</strong>
        <p>Coba lagi beberapa saat lagi.</p>
      </article>
    `;
    return;
  }

  newsListEl.innerHTML = items
    .map((item) => {
      const titleMarkup =
        item.url && item.url !== "#"
          ? `<a href="${item.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>`
          : `<strong>${escapeHtml(item.title)}</strong>`;

      return `
        <article class="news-item">
          ${titleMarkup}
          <p>${escapeHtml(item.description || "Tidak ada deskripsi.")}</p>
        </article>
      `;
    })
    .join("");
}

function addCurrentCurrencyToWatchlist() {
  const currency = currencySelect.value;
  const exists = state.watchlist.some((entry) => entry.currency === currency);

  if (exists) return;

  state.watchlist.push({
    currency,
    savedAt: new Date().toISOString(),
  });

  writeStorage("currency-watchlist", state.watchlist);
  renderWatchlist();
}

function clearWatchlist() {
  state.watchlist = [];
  writeStorage("currency-watchlist", state.watchlist);
  renderWatchlist();
}

function renderWatchlist() {
  if (!state.watchlist.length) {
    watchlistItemsEl.innerHTML = `
      <article class="watch-item">
        <strong>Belum ada pantauan</strong>
        <p>Tambahkan mata uang agar muncul di daftar ini.</p>
      </article>
    `;
    return;
  }

  watchlistItemsEl.innerHTML = state.watchlist
    .map((item) => {
      return `
        <article class="watch-item">
          <strong>${escapeHtml(item.currency)}</strong>
          <p>Disimpan di browser ini.</p>
        </article>
      `;
    })
    .join("");
}

function updateConversionOnly() {
  const amount = Number(amountInput.value || 0);
  const currency = currencySelect.value;
  const latest = state.latestRateValue;

  if (!latest || Number.isNaN(amount)) {
    conversionResultEl.textContent = "-";
    return;
  }

  if (state.mode === "IDR_TO_FX") {
    conversionResultEl.textContent = `${formatNumber(amount / latest, 2)} ${currency}`;
  } else {
    conversionResultEl.textContent = `${formatCompactNumber(amount * latest, 0)} IDR`;
  }
}

function buildVerdict(currency, latest, first, forecast, headlineCount) {
  const change = latest - first;
  const percentChange = ((latest - first) / first) * 100;

  let bias = "neutral";
  let directionWord = "relatif stabil";

  if (change > 0) {
    bias = "bullish";
    directionWord = "menguat";
  } else if (change < 0) {
    bias = "bearish";
    directionWord = "melemah";
  }

  let forecastText = "dengan arah jangka pendek yang cenderung datar";
  if (forecast > latest) {
    forecastText = "dengan tekanan naik jangka pendek";
  } else if (forecast < latest) {
    forecastText = "dengan tekanan turun jangka pendek";
  }

  return {
    bias,
    label:
      bias === "bullish"
        ? "Menguat"
        : bias === "bearish"
        ? "Melemah"
        : "Netral",
    text: `${currency} ${directionWord} terhadap IDR pada periode terpilih (${formatNumber(
      percentChange,
      2
    )}%), ${forecastText}. Konteks berita saat ini berjumlah ${headlineCount} item dan sebaiknya dibaca sebagai pendamping, bukan kepastian arah pasar.`,
  };
}

function getChartColors() {
  const styles = getComputedStyle(document.documentElement);

  return {
    line: styles.getPropertyValue("--primary").trim() || "#2f5be7",
    fill:
      document.documentElement.getAttribute("data-theme") === "dark"
        ? "rgba(125, 162, 255, 0.16)"
        : "rgba(47, 91, 231, 0.10)",
    grid: styles.getPropertyValue("--line").trim() || "rgba(19, 23, 34, 0.08)",
    tick: styles.getPropertyValue("--text-faint").trim() || "#8b95a7",
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
        animation: {
          duration: 300,
        },
        plugins: {
          legend: {
            display: false,
          },
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
  if (!marketsGridEl) return;

  if (!items.length) {
    destroySparklineCharts();
    marketsGridEl.innerHTML = `<div class="market-empty">Data pair lain belum tersedia.</div>`;
    return;
  }

  destroySparklineCharts();

  marketsGridEl.innerHTML = items
    .map((item) => {
      const isActive = item.currency === currencySelect.value;
      const trend = getTrendMeta(item.deltaPct);
      const absolutePrefix = item.absoluteChange >= 0 ? "+" : "-";
      const absoluteValue = `${absolutePrefix}${formatNumber(
        Math.abs(item.absoluteChange),
        4
      )}`;

      const deltaClass =
        item.absoluteChange > 0
          ? "up"
          : item.absoluteChange < 0
          ? "down"
          : "flat";

      return `
        <button
          type="button"
          class="market-card ${isActive ? "active" : ""}"
          data-currency="${item.currency}"
          aria-label="Buka analisis ${item.currency} terhadap IDR"
        >
          <div class="market-card-head">
            <div>
              <span class="market-card-pair">${item.currency} / IDR</span>
              <div class="market-card-subrate">${formatNumber(item.latest, 4)}</div>
            </div>

            <span class="market-card-add" aria-hidden="true">+</span>
          </div>

          <div class="market-card-main">
            <strong class="market-card-rate">${formatNumber(item.latest, 4)}</strong>

            <div class="market-card-change-wrap">
              <span class="market-card-delta ${deltaClass}">${absoluteValue}</span>

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
    const fillColor = positive
      ? "rgba(23, 128, 61, 0.10)"
      : "rgba(180, 35, 24, 0.10)";

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
            borderWidth: 1.8,
            tension: 0.35,
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
      runAnalysis();
    });
  });
}

function setLoadingState() {
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Memuat...";
  chartMetaEl.textContent = "Mengambil data historis...";
  verdictTextEl.textContent = "Sedang menyiapkan analisis.";
  latestRateEl.textContent = "-";
  pastCompareEl.textContent = "-";
  forecastValueEl.textContent = "-";
  conversionResultEl.textContent = "-";

  biasBadgeEl.textContent = "Netral";
  biasBadgeEl.className = "badge neutral";

  setUIState(chartStateEl, "loading", "Memuat data grafik...");
  setUIState(newsStateEl, "loading", "Memuat daftar berita...");

  if (marketsGridEl) {
    marketsGridEl.innerHTML = `<div class="market-empty">Memuat pair lain...</div>`;
  }
}

function resetButtonState() {
  analyzeBtn.disabled = false;
  analyzeBtn.textContent = "Analisis sekarang";
}

async function runAnalysis() {
  const currency = currencySelect.value;
  const days = Number(rangeSelect.value);

  setLoadingState();

  try {
    const [rateData, headlines, marketItems] = await Promise.all([
      fetchRates(currency, days),
      fetchNewsPlaceholders(currency),
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

    state.latestRateValue = latest;

    latestRateEl.textContent = `1 ${currency} = ${formatNumber(latest, 2)} IDR`;
    pastCompareEl.textContent = `${deltaPct >= 0 ? "+" : ""}${formatNumber(deltaPct, 2)}%`;
    forecastValueEl.textContent = `~${formatNumber(forecast, 2)} IDR`;

    updateConversionOnly();
    renderChart(labels, values, currency);
    renderMarketSnapshots(marketItems);
    renderNews(headlines);

    chartMetaEl.textContent = `Periode ${days} hari · sumber data: Frankfurter`;

    const verdict = buildVerdict(currency, latest, first, forecast, headlines.length);
    verdictTextEl.textContent = verdict.text;
    biasBadgeEl.textContent = verdict.label;
    biasBadgeEl.className = `badge ${verdict.bias}`;

    setUIState(chartStateEl, "", "");
    setUIState(newsStateEl, "", "");
  } catch (error) {
    state.latestRateValue = null;

    latestRateEl.textContent = "-";
    pastCompareEl.textContent = "-";
    forecastValueEl.textContent = "-";
    conversionResultEl.textContent = "-";
    chartMetaEl.textContent = "Gagal memuat data historis.";
    verdictTextEl.textContent =
      error?.message || "Analisis gagal dimuat. Coba lagi beberapa saat.";
    biasBadgeEl.textContent = "Netral";
    biasBadgeEl.className = "badge neutral";

    newsListEl.innerHTML = `
      <article class="news-item">
        <strong>Gagal memuat berita</strong>
        <p>Data belum tersedia untuk saat ini.</p>
      </article>
    `;

    if (marketsGridEl) {
      destroySparklineCharts();
      marketsGridEl.innerHTML = `<div class="market-empty">Gagal memuat pair lain.</div>`;
    }

    setUIState(chartStateEl, "error", error?.message || "Gagal memuat data grafik.");
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
