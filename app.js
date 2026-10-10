(() => {
  "use strict";

  const cfg = window.TOKEN_RADAR_CONFIG || {};
  const $ = (id) => document.getElementById(id);

  // Show frontend errors visibly instead of silently failing.
  function showFatalDiagnostic(message) {
    let box = $("token-radar-diagnostic");

    if (!box) {
      box = document.createElement("section");
      box.id = "token-radar-diagnostic";
      box.setAttribute("role", "alert");
      box.style.cssText =
        "margin:16px auto;padding:14px;max-width:980px;border:1px solid #ef6464;border-radius:10px;background:#321b20;color:#fff;font:14px/1.5 system-ui,sans-serif;white-space:pre-wrap;overflow-wrap:anywhere;position:relative;z-index:9999";

      (document.querySelector("main") || document.body).prepend(box);
    }

    box.textContent = "TOKEN RADAR ERROR: " + String(message);
  }

  window.addEventListener("error", (event) => {
    console.error("[TOKEN RADAR] JavaScript error:", event.error || event.message);
    showFatalDiagnostic(event.message || "JavaScript error. Check F12 > Console.");
  });

  window.addEventListener("unhandledrejection", (event) => {
    console.error("[TOKEN RADAR] Promise error:", event.reason);
    showFatalDiagnostic(event.reason?.message || event.reason || "Unexpected promise error.");
  });

  console.info("[TOKEN RADAR] app.js loaded", {
    page: location.href,
    configPresent: !!window.TOKEN_RADAR_CONFIG
  });

  const form = $("scan-form");
  const input = $("contract-address");
  const button = $("scan-button");

  const state = { lastResult: null };

  function shortAddress(value) {
    return value && value.length > 16
      ? `${value.slice(0, 8)}…${value.slice(-6)}`
      : (value || "—");
  }

  function fmtNum(value, max = 3) {
    if (value === null || value === undefined || value === "") return "—";

    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);

    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: max,
      notation: Math.abs(n) >= 1e9 ? "compact" : "standard"
    }).format(n);
  }

  function fmtUsd(value) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
      return "—";
    }

    const n = Number(value);

    if (Math.abs(n) < 0.0001 && n !== 0) {
      return "$" + n.toExponential(2);
    }

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: n < 1 ? 8 : 2
    }).format(n);
  }

  function fmtPct(value) {
    return value === null || value === undefined || !Number.isFinite(Number(value))
      ? "Unknown"
      : `${Number(value).toFixed(2)}%`;
  }

  function setText(id, value) {
    const el = $(id);
    if (!el) return;

    el.textContent =
      value === null || value === undefined || value === ""
        ? "—"
        : String(value);
  }

  function show(id, visible) {
    const el = $(id);
    if (el) el.classList.toggle("hidden", !visible);
  }

  function setLoading(
    loading,
    title = "Scanning contract…",
    message = "Reading on-chain data and checking available sources."
  ) {
    show("status-panel", loading);

    if (button) {
      button.disabled = loading;

      const label = button.querySelector(".button-label");
      if (label) {
        label.textContent = loading ? "SCANNING…" : "SCAN TOKEN";
      }
    }

    if (loading) {
      setText("status-title", title);
      setText("status-message", message);
    }
  }

  function fail(title, message) {
    const panel = $("error-panel");

    if (panel) {
      show("error-panel", true);
      setText("error-title", title);
      setText("error-message", message);
    } else {
      showFatalDiagnostic(`${title}: ${message}`);
    }

    show("results", false);
  }

  function clearError() {
    show("error-panel", false);
    show("token-radar-diagnostic", false);
  }

  function addRiskRow(container, item) {
    const row = document.createElement("div");
    row.className = `risk-row ${item.level || "info"}`;

    const bullet = document.createElement("span");
    bullet.className = "risk-bullet";

    const body = document.createElement("div");

    const title = document.createElement("strong");
    title.textContent = item.title || "Check";

    const p = document.createElement("p");
    p.textContent = item.detail || "";

    body.append(title, p);
    row.append(bullet, body);
    container.append(row);
  }

  function addReason(container, text, index) {
    const row = document.createElement("div");
    row.className = "reason";

    const number = document.createElement("span");
    number.textContent = String(index + 1).padStart(2, "0");

    const p = document.createElement("div");
    p.textContent = text;

    row.append(number, p);
    container.append(row);
  }

  function addSocial(container, label, url) {
    if (!url) return;

    let safe;

    try {
      safe = new URL(url);
    } catch {
      return;
    }

    if (!["https:", "http:"].includes(safe.protocol)) return;

    const a = document.createElement("a");
    a.href = safe.href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = label + " ↗";

    container.append(a);
  }

  function render(data) {
    state.lastResult = data;

    show("empty-state", false);
    show("results", true);
    clearError();

    const token = data.token || {};
    const market = data.market || {};
    const risk = data.risk || {};
    const score = data.score || {};

    setText(
      "scan-time",
      "· " + new Date(data.scannedAt || Date.now()).toLocaleString()
    );

    setText(
      "token-title",
      `${token.name || "Unknown token"}${token.symbol ? " · " + token.symbol : ""}`
    );

    setText(
      "token-subtitle",
      shortAddress(token.address) + " · Robinhood Chain"
    );

    const explorer = $("explorer-link");

    if (explorer && token.address) {
      explorer.href =
        `https://robinhoodchain.blockscout.com/address/${encodeURIComponent(token.address)}`;
    }

    setText("score-value", score.value ?? "—");
    setText("score-label", score.label || "INSUFFICIENT DATA");
    setText("verdict-title", score.headline || "Insufficient data");
    setText("verdict-copy", score.summary || "Review the checks below.");

    const value = Number(score.value || 0);
    const color =
      value >= 70 ? "var(--green)" :
      value >= 45 ? "var(--amber)" :
      "var(--red)";

    const ring = $("score-ring");
    if (ring) {
      ring.style.background =
        `conic-gradient(${color} ${value * 3.6}deg,#20323d 0deg)`;
    }

    const meter = $("score-meter-fill");
    if (meter) {
      meter.style.width = `${value}%`;
      meter.style.background = color;
    }

    setText("metric-price", fmtUsd(market.priceUsd));
    setText("metric-price-source", market.priceSource || "No reliable USD quote found");

    setText("metric-liquidity", fmtUsd(market.liquidityUsd));
    setText("metric-liquidity-source", market.liquiditySource || "Unknown");

    setText("metric-volume", fmtUsd(market.volume24hUsd));
    setText("metric-volume-source", market.volumeSource || "Unknown");

    setText("field-name", token.name || "Unknown");
    setText("field-symbol", token.symbol || "Unknown");
    setText("field-decimals", token.decimals ?? "Unknown");
    setText("field-supply", token.totalSupplyFormatted || "Unknown");

    setText("field-marketcap", fmtUsd(market.marketCapUsd));
    setText("field-fdv", fmtUsd(market.fdvUsd));

    setText(
      "field-verified",
      token.verified === true
        ? "Verified source"
        : token.verified === false
        ? "Not verified"
        : "Unknown"
    );

    setText(
      "field-owner",
      token.owner ? shortAddress(token.owner) : "Not exposed by contract"
    );

    setText(
      "field-deployer",
      token.deployer ? shortAddress(token.deployer) : "Not exposed"
    );

    setText("field-protocol", token.protocol || "Unidentified / generic ERC-20");

    setText(
      "field-pool",
      token.poolAddress ? shortAddress(token.poolAddress) : "Not detected"
    );

    setText(
      "field-curve",
      token.curveAddress ? shortAddress(token.curveAddress) : "Not detected"
    );

    setText(
      "field-pair",
      token.pairedToken
        ? shortAddress(token.pairedToken)
        : token.protocol === "Pons V2"
        ? "Native ETH"
        : "Unknown"
    );

    setText(
      "field-tax",
      token.creatorTaxBps == null
        ? "Unknown"
        : `${(Number(token.creatorTaxBps) / 100).toFixed(2)}%`
    );

    setText("field-graduation", token.graduation?.status || "Unknown");
    setText("field-description", token.description || "No on-chain description returned");
    setText("field-address", token.address || "");

    setText(
      "field-buys",
      market.buys24h == null ? "—" : fmtNum(market.buys24h, 0)
    );

    setText(
      "field-sells",
      market.sells24h == null ? "—" : fmtNum(market.sells24h, 0)
    );

    setText(
      "field-flow",
      market.buys24h != null && market.sells24h != null
        ? `${(Number(market.buys24h) / Math.max(1, Number(market.sells24h))).toFixed(2)}×`
        : "Unknown"
    );

    setText(
      "field-fee",
      token.poolFee == null
        ? "Unknown"
        : `${Number(token.poolFee) / 10000}%`
    );

    setText(
      "field-concentration",
      risk.top10ConcentrationPct == null
        ? "Unknown"
        : fmtPct(risk.top10ConcentrationPct)
    );

    setText(
      "field-holders",
      risk.holderCount == null ? "Unavailable" : fmtNum(risk.holderCount, 0)
    );

    setText(
      "field-progress",
      market.curveData?.progressPct == null
        ? "Unknown"
        : `${Number(market.curveData.progressPct).toFixed(1)}%`
    );

    setText(
      "field-quote-reserve",
      market.curveData?.raisedQuoteRaw
        ? `${market.curveData.raisedQuoteRaw} raw units`
        : "Unknown"
    );

    setText(
      "market-disclaimer",
      market.note || "Market data is provider-dependent and may be delayed or unavailable."
    );

    const riskList = $("risk-list");

    if (riskList) {
      riskList.replaceChildren();

      (risk.items || []).forEach((item) => addRiskRow(riskList, item));

      if (!risk.items?.length) {
        addRiskRow(riskList, {
          level: "info",
          title: "No checks returned",
          detail: "The available sources did not return risk-check data."
        });
      }
    }

    setText(
      "risk-count",
      `${(risk.items || []).filter(item => ["warn", "bad"].includes(item.level)).length} FLAGS`
    );

    const reasons = $("score-reasons");

    if (reasons) {
      reasons.replaceChildren();

      (score.reasons || []).forEach((item, index) =>
        addReason(reasons, item, index)
      );

      if (!score.reasons?.length) {
        addReason(reasons, "Not enough data to explain this score reliably.", 0);
      }
    }

    const socials = $("social-links");

    if (socials) {
      socials.replaceChildren();

      const s = token.socials || {};

      addSocial(socials, "Website", s.website);
      addSocial(socials, "X / Twitter", s.twitter);
      addSocial(socials, "Telegram", s.telegram);
      addSocial(socials, "Discord", s.discord);
      addSocial(socials, "Farcaster", s.farcaster);
    }

    setText("data-sources", "Sources: " + (data.sources || []).join(" · "));

    setText(
      "scan-id",
      data.scanId ? `SCAN ${data.scanId.slice(0, 8).toUpperCase()}` : ""
    );
  }

  async function scan(address) {
    clearError();
    show("results", false);

    setLoading(true);

    console.info("[TOKEN RADAR] Starting scan", { address });

    try {
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        throw new Error(
          "Enter a valid contract address: 0x followed by 40 hexadecimal characters."
        );
      }

      if (
        !cfg.SUPABASE_URL ||
        cfg.SUPABASE_URL.includes("YOUR_PROJECT_REF") ||
        !cfg.SUPABASE_ANON_KEY ||
        cfg.SUPABASE_ANON_KEY.includes("YOUR_SUPABASE")
      ) {
        throw new Error(
          "Supabase is not configured. Edit config.js with your Project URL and public anon/publishable key."
        );
      }

      const baseUrl = cfg.SUPABASE_URL.replace(/\/$/, "");
      const functionName = cfg.SCAN_FUNCTION || "token-scan";
      const url = `${baseUrl}/functions/v1/${functionName}`;

      setLoading(
        true,
        "Scanning contract…",
        "Connecting to Supabase and reading Robinhood Chain data."
      );

      console.info("[TOKEN RADAR] Requesting Edge Function", url);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60000);

      let response;

      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "apikey": cfg.SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${cfg.SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({ address }),
          signal: controller.signal
        });
      } catch (error) {
        console.error("[TOKEN RADAR] Network/fetch error", error);

        if (error?.name === "AbortError") {
          throw new Error(
            "Request timed out after 60 seconds. Check the Edge Function logs and RPC availability."
          );
        }

        throw new Error(
          "Cannot reach Supabase Edge Function. Check config.js URL, network, CORS, and deployment."
        );
      } finally {
        clearTimeout(timer);
      }

      const rawText = await response.text();

      let body = {};

      try {
        body = rawText ? JSON.parse(rawText) : {};
      } catch {
        console.error(
          "[TOKEN RADAR] Non-JSON response",
          response.status,
          rawText.slice(0, 500)
        );

        throw new Error(
          `Supabase returned a non-JSON response (HTTP ${response.status}). Check the Function URL and deployment.`
        );
      }

      console.info("[TOKEN RADAR] Edge Function response", {
        status: response.status,
        ok: response.ok,
        hasToken: !!body.token,
        body
      });

      if (!response.ok) {
        const detail = body.detail ? ` — ${body.detail}` : "";

        throw new Error(
          (body.error || body.message || `Scanner request failed (HTTP ${response.status}).`) +
          detail
        );
      }

      if (!body.token) {
        throw new Error(
          "The Function responded but returned no token object. Check Supabase → Edge Functions → token-scan → Logs."
        );
      }

      render(body);
    } catch (error) {
      console.error("[TOKEN RADAR] Scan failed", error);

      const message =
        error?.message || "Unknown scanner error.";

      fail("Could not complete scan", message);
    } finally {
      setLoading(false);
    }
  }

  // Stop form submission from refreshing the page.
  if (!form || !input || !button) {
    showFatalDiagnostic(
      "Search form elements are missing. Check that index.html has IDs scan-form, contract-address, and scan-button."
    );

    console.error("[TOKEN RADAR] Required search form elements missing.", {
      form: !!form,
      input: !!input,
      button: !!button
    });

    return;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    event.stopPropagation();
    scan(input.value.trim());
  });

  const sampleButton = $("sample-token");

  if (sampleButton) {
    sampleButton.addEventListener("click", (event) => {
      event.preventDefault();

      input.value = "0x39dBED3a2bd333467115dE45665cC57F813C4571";
      scan(input.value);
    });
  }

  const copyButton = $("copy-address");

  if (copyButton) {
    copyButton.addEventListener("click", async (event) => {
      event.preventDefault();

      const value = $("field-address")?.textContent || "";
      if (!value || value === "—") return;

      try {
        await navigator.clipboard.writeText(value);
        copyButton.textContent = "COPIED";

        setTimeout(() => {
          copyButton.textContent = "COPY";
        }, 1200);
      } catch {
        copyButton.textContent = "SELECT TEXT";
      }
    });
  }

  console.info("[TOKEN RADAR] Search handlers attached.");
})();
