const state = {
  mode: "IDR_TO_FX",
  chart: null,
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
  const pair = `IDR/${currencySelect.value}`;

  if (!state.watchlist.includes(pair)) {
    state.watchlist.push(pair);
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

function renderWatchlist() {
  if (!state.watchlist.length) {
    watchlistItemsEl.innerHTML = `
      <div class="watch-item">
        <strong>No watchlist yet</strong>
        <p>Add a currency pair to keep it here in this browser.</p>
      </div>
    `;
    return;
  }

  watchlistItemsEl.innerHTML = state.watchlist
    .map((item) => {
      return `
        <div class="watch-item">
          <strong>${item}</strong>
          <p>Saved locally in this browser.</p>
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

function simpleForecast(values) {
  if (!values.length) return 0;
  if (values.length === 1) return values[0];

  const recent = values.slice(-7);
  if (recent.length < 2) return recent[recent.length - 1];

  const deltas = recent.slice(1).map((value, index) => value - recent[index]);
  const averageDelta = deltas.reduce((sum, value) => sum + value, 0) / deltas.length;

  return recent[recent.length - 1] + averageDelta * 7;
}

function buildVerdict(currency, latest, first, forecast, headlineCount) {
  const change = latest - first;
  const direction =
    change > 0 ? "strengthening" : change < 0 ? "softening" : "stable";

  const outlook =
    forecast > latest
      ? "with upward short-term pressure"
      : forecast < latest
      ? "with softer short-term bias"
      : "with a flat short-term outlook";

  const bias =
    change > 0 ? "bullish" : change < 0 ? "bearish" : "neutral";

  return {
    bias,
    text: `${currency} is ${direction} against IDR over the selected period, ${outlook}, while the current headline set (${headlineCount} items) should be treated as context rather than certainty.`,
  };
}

async function fetchRates(currency, days) {
  const start = buildDate(days);
  const end = buildDate(0);

  const url = `https://api.frankfurter.dev/v1/${start}..${end}?base=${currency}&symbols=IDR`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Failed to fetch rates");
  }

  return response.json();
}

async function fetchNewsPlaceholders(currency) {
  return Array.from({ length: 10 }, (_, index) => ({
    title: `${currency} headline placeholder ${index + 1}`,
    description: "This will be replaced later by live headline data.",
    url: "#",
  }));
}

function renderNews(items) {
  if (!items.length) {
    newsListEl.innerHTML = `
      <article class="news-item">
        <strong>No headlines available</strong>
        <p>Try again later.</p>
      </article>
    `;
    return;
  }

  newsListEl.innerHTML = items
    .map((item) => {
      return `
        <article class="news-item">
          <a href="${item.url}" target="_blank" rel="noopener noreferrer">
            ${item.title}
          </a>
          <p>${item.description || "No description available."}</p>
        </article>
      `;
    })
    .join("");
}

function renderChart(labels, values, currency) {
  const ctx = document.getElementById("rateChart");

  if (state.chart) {
    state.chart.destroy();
  }

  state.chart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: `${currency}/IDR`,
          data: values,
          borderColor: "#5b8cff",
          backgroundColor: "rgba(91, 140, 255, 0.16)",
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 4,
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
      },
      scales: {
        x: {
          ticks: {
            color: "#7b8798",
            maxTicksLimit: 6,
          },
          grid: {
            color: "rgba(120, 130, 150, 0.12)",
          },
        },
        y: {
          ticks: {
            color: "#7b8798",
          },
          grid: {
            color: "rgba(120, 130, 150, 0.12)",
          },
        },
      },
    },
  });
}

function updateConversionOnly() {
  const latestText = latestRateEl.dataset.latestRate;
  const amount = Number(amountInput.value || 0);
  const currency = currencySelect.value;

  if (!latestText) {
    conversionResultEl.textContent = "-";
    return;
  }

  const latest = Number(latestText);

  if (state.mode === "IDR_TO_FX") {
    conversionResultEl.textContent = `${(amount / latest).toFixed(2)} ${currency}`;
  } else {
    conversionResultEl.textContent = `${(amount * latest).toLocaleString("id-ID")} IDR`;
  }
}

async function runAnalysis() {
  const currency = currencySelect.value;
  const days = Number(rangeSelect.value);

  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Analyzing...";

  try {
    const [rateData, headlines] = await Promise.all([
      fetchRates(currency, days),
      fetchNewsPlaceholders(currency),
    ]);

    const labels = Object.keys(rateData.rates);
    const values = labels.map((date) => rateData.rates[date].IDR);

    if (!values.length) {
      throw new Error("No historical values found");
    }

    const latest = values[values.length - 1];
    const first = values[0];
    const forecast = simpleForecast(values);
    const deltaPct = ((latest - first) / first) * 100;

    latestRateEl.dataset.latestRate = String(latest);
    latestRateEl.textContent = `1 ${currency} = ${latest.toLocaleString("id-ID")} IDR`;
    pastCompareEl.textContent = `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(2)}% vs start`;
    forecastValueEl.textContent = `~${forecast.toLocaleString("id-ID")} IDR`;

    updateConversionOnly();
    renderChart(labels, values, currency);
    renderNews(headlines);

    chartMetaEl.textContent = `${days}-day historical range · source: Frankfurter`;

    const verdict = buildVerdict(currency, latest, first, forecast, headlines.length);
    verdictTextEl.textContent = verdict.text;
    biasBadgeEl.textContent =
      verdict.bias.charAt(0).toUpperCase() + verdict.bias.slice(1);
    biasBadgeEl.className = `badge ${verdict.bias}`;
  } catch (error) {
    latestRateEl.textContent = "-";
    pastCompareEl.textContent = "-";
    forecastValueEl.textContent = "-";
    conversionResultEl.textContent = "-";
    verdictTextEl.textContent = "Analysis failed. Please try again.";
    biasBadgeEl.textContent = "Neutral";
    biasBadgeEl.className = "badge neutral";
    newsListEl.innerHTML = `
      <article class="news-item">
        <strong>Error</strong>
        <p>Unable to load data right now.</p>
      </article>
    `;
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "Analyze now";
  }
}

renderWatchlist();
runAnalysis();