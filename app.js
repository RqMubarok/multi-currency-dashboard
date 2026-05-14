const state = {
  mode: "IDR_TO_FX",
  chart: null,
  latestRateValue: null,
  watchlist: JSON.parse(localStorage.getItem("currency-watchlist") || "[]"),
  theme: localStorage.getItem("currency-theme") || "light",
};

const currencySelect = document.getElementById("currencySelect");
const rangeSelect = document.getElementById("rangeSelect");
const amountInput = document.getElementById("amountInput");
const analyzeBtn = document.getElementById("analyzeBtn");
const watchlistBtn = document.getElementById("watchlistBtn");
const clearWatchlistBtn = document.getElementById("clearWatchlist");

const latestRateEl = document.getElementById("latestRate");
const pastCompareEl = document.getElementById("pastCompare");
const forecastValueEl = document.getElementById("forecastValue");
const conversionResultEl = document.getElementById("conversionResult");
const verdictTextEl = document.getElementById("verdictText");
const biasBadgeEl = document.getElementById("biasBadge");
const chartMetaEl = document.getElementById("chartMeta");
const newsListEl = document.getElementById("newsList");
const watchlistItemsEl = document.getElementById("watchlistItems");
const themeToggle = document.getElementById("themeToggle");

document.documentElement.setAttribute("data-theme", state.theme);

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

themeToggle.addEventListener("click", () => {
  state.theme = state.theme === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", state.theme);
  localStorage.setItem("currency-theme", state.theme);
});

watchlistBtn.addEventListener("click", () => {
  const currency = currencySelect.value;
  const item = {
    currency,
    savedAt: new Date().toISOString(),
  };

  const exists = state.watchlist.some((entry) => entry.currency === currency);

  if (!exists) {
    state.watchlist.push(item);
    localStorage.setItem("currency-watchlist", JSON.stringify(state.watchlist));
    renderWatchlist();
  }
});

clearWatchlistBtn.addEventListener("click", () => {
  state.watchlist = [];
  localStorage.setItem("currency-watchlist", JSON.stringify(state.watchlist));
  renderWatchlist();
});

analyzeBtn.addEventListener("click", runAnalysis);
amountInput.addEventListener("input", updateConversionOnly);
currencySelect.addEventListener("change", updateConversionOnly);

function renderWatchlist() {
  if (!state.watchlist.length) {
    watchlistItemsEl.innerHTML = `
      <div class="watch-item">
        <strong>Belum ada pantauan</strong>
        <p>Tambahkan mata uang agar muncul di daftar ini.</p>
      </div>
    `;
    return;
  }

  watchlistItemsEl.innerHTML = state.watchlist
    .map((item) => {
      return `
        <div class="watch-item">
          <strong>${item.currency}</strong>
          <p>Disimpan di browser ini.</p>
        </div>
      `;
    })
    .join("");
}

function buildDate(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split("T")[0];
}

function formatNumber(num, digits = 2) {
  return Number(num).toLocaleString("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatCompactNumber(num, digits = 0) {
  return Number(num).toLocaleString("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
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

function buildVerdict(currency, latest, first, forecast, headlineCount) {
  const change = latest - first;
  const percentChange = ((latest - first) / first) * 100;

  let arah = "relatif stabil";
  let bias = "neutral";

  if (change > 0) {
    arah = "menguat";
    bias = "bullish";
  } else if (change < 0) {
    arah = "melemah";
    bias = "bearish";
  }

  let outlook = "dengan arah jangka pendek yang cenderung datar";
  if (forecast > latest) {
    outlook = "dengan tekanan naik jangka pendek";
  } else if (forecast < latest) {
    outlook = "dengan tekanan turun jangka pendek";
  }

  return {
    bias,
    label:
      bias === "bullish"
        ? "Menguat"
        : bias === "bearish"
        ? "Melemah"
        : "Netral",
    text: `${currency} ${arah} terhadap IDR pada periode terpilih (${formatNumber(
      percentChange,
      2
    )}%), ${outlook}. Konteks berita saat ini berjumlah ${headlineCount} item dan sebaiknya dibaca sebagai pendamping, bukan kepastian arah pasar.`,
  };
}

async function fetchRates(currency, days) {
  const start = buildDate(days);
  const end = buildDate(0);

  const url = `https://api.frankfurter.dev/v1/${start}..${end}?base=${currency}&symbols=IDR`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Gagal mengambil data kurs");
  }

  return response.json();
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
      const isPlaceholder = item.url === "#";
      const titleTag = isPlaceholder
        ? `<strong>${item.title}</strong>`
        : `<a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.title}</a>`;

      return `
        <article class="news-item">
          ${titleTag}
          <p>${item.description || "Tidak ada deskripsi."}</p>
        </article>
      `;
    })
    .join("");
}

function getChartColors() {
  const styles = getComputedStyle(document.documentElement);
  const isLight = document.documentElement.getAttribute("data-theme") === "light";

  return {
    line: styles.getPropertyValue("--primary").trim() || "#5b8cff",
    fill: isLight ? "rgba(53, 89, 224, 0.10)" : "rgba(124, 156, 255, 0.16)",
    grid: isLight ? "rgba(21, 32, 56, 0.08)" : "rgba(255, 255, 255, 0.08)",
    tick: styles.getPropertyValue("--text-faint").trim() || "#7d8796",
  };
}

function renderChart(labels, values, currency) {
  const canvas = document.getElementById("rateChart");
  const colors = getChartColors();

  if (state.chart) {
    state.chart.destroy();
  }

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
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          mode: "index",
          intersect: false,
          callbacks: {
            label: (context) =>
              ` ${formatCompactNumber(context.parsed.y, 2)} IDR`,
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
          },
        },
        y: {
          ticks: {
            color: colors.tick,
            callback: (value) => formatCompactNumber(value, 0),
          },
          grid: {
            color: colors.grid,
          },
        },
      },
    },
  });
}

function updateConversionOnly() {
  const amount = Number(amountInput.value || 0);
  const currency = currencySelect.value;
  const latest = state.latestRateValue;

  if (!latest) {
    conversionResultEl.textContent = "-";
    return;
  }

  if (state.mode === "IDR_TO_FX") {
    conversionResultEl.textContent = `${formatNumber(amount / latest, 2)} ${currency}`;
  } else {
    conversionResultEl.textContent = `${formatCompactNumber(amount * latest, 0)} IDR`;
  }
}

function setLoadingState() {
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Memuat...";
  chartMetaEl.textContent = "Mengambil data historis...";
  verdictTextEl.textContent = "Sedang menyiapkan analisis.";
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
    const [rateData, headlines] = await Promise.all([
      fetchRates(currency, days),
      fetchNewsPlaceholders(currency),
    ]);

    const labels = Object.keys(rateData.rates);
    const values = labels.map((date) => rateData.rates[date].IDR);

    if (!values.length) {
      throw new Error("Data historis kosong");
    }

    const latest = values[values.length - 1];
    const first = values[0];
    const forecast = simpleForecast(values);
    const deltaPct = ((latest - first) / first) * 100;

    state.latestRateValue = latest;

    latestRateEl.textContent = `1 ${currency} = ${formatCompactNumber(latest, 2)} IDR`;
    pastCompareEl.textContent = `${deltaPct >= 0 ? "+" : ""}${formatNumber(deltaPct, 2)}%`;
    forecastValueEl.textContent = `~${formatCompactNumber(forecast, 2)} IDR`;

    updateConversionOnly();
    renderChart(labels, values, currency);
    renderNews(headlines);

    chartMetaEl.textContent = `Periode ${days} hari · sumber data: Frankfurter`;

    const verdict = buildVerdict(currency, latest, first, forecast, headlines.length);
    verdictTextEl.textContent = verdict.text;
    biasBadgeEl.textContent = verdict.label;
    biasBadgeEl.className = `badge ${verdict.bias}`;
  } catch (error) {
    state.latestRateValue = null;
    latestRateEl.textContent = "-";
    pastCompareEl.textContent = "-";
    forecastValueEl.textContent = "-";
    conversionResultEl.textContent = "-";
    chartMetaEl.textContent = "Gagal memuat data historis.";
    verdictTextEl.textContent =
      "Analisis gagal dimuat. Coba lagi dalam beberapa saat.";
    biasBadgeEl.textContent = "Netral";
    biasBadgeEl.className = "badge neutral";
    newsListEl.innerHTML = `
      <article class="news-item">
        <strong>Gagal memuat berita</strong>
        <p>Data belum tersedia untuk saat ini.</p>
      </article>
    `;

    if (state.chart) {
      state.chart.destroy();
      state.chart = null;
    }
  } finally {
    resetButtonState();
  }
}

renderWatchlist();
runAnalysis();
