//@lang=wrun-ts
// The ATR pane, plus an IV leg: the ATR's z-score and the 30-day implied volatility's
// z-score in the same pane, so realized and implied volatility sit on one axis.
//
// Why a separate file: `option_daily` is served by the chart in the browser only.
// The docs refuse it on a Protected indicator ("wrun_option_daily_unsupported") and
// on any alert, and the Code choice is fixed at the first publish. Keeping it out of
// atr-ema.ts keeps that one publishable as Protected, with alerts.

// The timeframe is a choice, not param.timeframe: the Resampler reads an index,
// and the labels below map 1:1 onto tf.CHART..tf.WEEK (0..7), so label order matters.
param.choice("timeframe", ["Chart", "5m", "15m", "30m", "1h", "4h", "1D", "1W"], "Chart", {
  description: "Bars the ATR and its averages are measured on; Chart follows the chart interval",
});
param.int("atr_len", 14, { min: 1, max: 500, description: "ATR length, in bars of the selected timeframe" });
param.int("fast_len", 50, { min: 1, max: 1000, description: "Fast average length, in ATR values" });
param.int("slow_len", 200, { min: 1, max: 2000, description: "Slow average length, in ATR values" });
param.choice("ma_kind", ["EMA", "RMA", "SMA", "WMA"], "EMA", {
  description: "EMA weights the newest bar most. RMA is Wilder smoothing, the ATR's own. SMA is the plain mean. WMA is linear weights over a strict window",
});
param.int("z_len", 100, { min: 5, max: 2000, description: "Window the ATR's z-score is measured over, in ATR values" });
param.int("iv_len", 100, { min: 20, max: 520, description: "Sessions of daily implied volatility the IV z-score is measured over" });

// The primary input defines the request grid, so the price feed comes first;
// a time source can never be index 0.
input("close", ohlcv.close);
// 1D and 1W buckets are exchange trade dates, so the Resampler needs the bar's trade date.
input("trade_date", time.trade_date);
// `missing: "nan"` keeps the run alive on a market without listed options: the IV
// line then draws nothing and everything else works. One row per UTC day, on the
// first bar of its day, NaN on the rest.
input("iv30", option_daily.atm_iv_30d, {
  missing: "nan",
  description: "30-day at-the-money implied volatility of this market's options, in percent, one reading per trading day",
});

// A z-score and an ATR level share no scale, so the z lives in a pane of its own.
pane("z_pane", { title: "ATR z {{z_len}}", height_frac: 0.24, format: "0.00" });

output("atr", line, lower, { color: "#7c3aed", width: 2, format: "price", description: "Average true range" });
output("fast", line, lower, { color: "#2563eb", width: 2, format: "price", description: "Fast average of the ATR" });
output("slow", line, lower, { color: "#f97316", width: 2, format: "price", description: "Slow average of the ATR" });
output("z", line, lower, { pane: "z_pane", color: "#0ea5e9", width: 2, format: "0.00", description: "How many deviations today's ATR sits from its own mean" });
output("z_iv", line, lower, { pane: "z_pane", color: "#14b8a6", width: 2, line_style: "dashed", format: "0.00", description: "How many deviations the 30-day implied volatility sits from its own mean, per session" });
// Levels are guides: a constant written every bar, drawn full width, out of the legend.
output("z_zero", line, lower, { pane: "z_pane", role: "guide", color: "theme.muted", line_style: "dotted", format: "0.00" });
output("z_hot", line, lower, { pane: "z_pane", role: "guide", color: "#ef4444", line_style: "dashed", label: "hot", align: "left", format: "0.00" });

// ma_kind labels, in declaration order.
const MA_EMA: i32 = 0;
const MA_RMA: i32 = 1;
const MA_SMA: i32 = 2;
const MA_WMA: i32 = 3;
// The z-score a volatility spike has to beat.
const Z_HOT: f64 = 2.0;
// The daily options rows are stamped 00:00 UTC of their trade date, so the UTC day names one.
const DAY: f64 = 86400.0;

let atr = new Atr(14);
let fastEma = new Ema(50);
let slowEma = new Ema(200);
let fastRma = new Rma(50);
let slowRma = new Rma(200);
let fastSma = new Sma(50);
let slowSma = new Sma(200);
let fastWma = new Wma(50);
let slowWma = new Wma(200);
let zs = new Zscore(100);
let ziv = new Zscore(100);

let atrValue: f64 = NaN;
let fastValue: f64 = NaN;
let slowValue: f64 = NaN;
let zValue: f64 = NaN;
let zIvValue: f64 = NaN;
// The day whose implied-volatility row has already been counted, so a repeated
// read (a carry policy, a bar replayed) cannot pad the window with copies.
let ivDay: f64 = NaN;

let onChart: bool = true;
let maKind: i32 = MA_EMA;
let r = new Resampler(tf.CHART, true);

function onStart(): void {
  // Constructed here, so a bad setting reports in the Console.
  const atrLen = i32(p_atr_len());
  const fastLen = i32(p_fast_len());
  const slowLen = i32(p_slow_len());
  atr = new Atr(atrLen);
  fastEma = new Ema(fastLen);
  slowEma = new Ema(slowLen);
  fastRma = new Rma(fastLen);
  slowRma = new Rma(slowLen);
  fastSma = new Sma(fastLen);
  slowSma = new Sma(slowLen);
  fastWma = new Wma(fastLen);
  slowWma = new Wma(slowLen);
  zs = new Zscore(i32(p_z_len()));
  ziv = new Zscore(i32(p_iv_len()));
  maKind = i32(p_ma_kind());
  onChart = i32(p_timeframe()) == 0;
  r = new Resampler(i32(p_timeframe()), true);
}

function onBar(): void {
  // The implied volatility is a daily series, so it is counted once per session on
  // its own clock — whatever the pin, the ATR's staircase never feeds it.
  const t = bar.time();
  if (!isNaN(t)) {
    const day = Math.floor(t / DAY);
    const iv = in_iv30();
    if (day != ivDay && !isNaN(iv) && iv > 0.0) {
      ivDay = day;
      zIvValue = ziv.update(iv);
    }
  }

  if (onChart) {
    // The chart's own bars: fold this bar as the built-in indicators do.
    foldCandle(bar.high(), bar.low(), bar.close());
    writeValues();
    return;
  }
  r.update(bar.time(), in_trade_date(), bar.open(), bar.high(), bar.low(), bar.close(), bar.volume());
  if (r.refused()) {
    // A pin narrower than the chart (or a 1D/1W bar without a trade date): blank the
    // series, but keep the pane's levels drawn.
    atrValue = NaN;
    fastValue = NaN;
    slowValue = NaN;
    zValue = NaN;
    zIvValue = NaN;
    writeValues();
    return;
  }
  if (r.closed()) {
    // A selected bar just closed: fold its final candle. The value then holds until the next close.
    foldCandle(r.last.high, r.last.low, r.last.close);
  }
  writeValues();
}

function foldCandle(high: f64, low: f64, close: f64): void {
  atrValue = atr.update(high, low, close);
  // The averages and the z-score read the ATR itself, so they start once it has a value.
  if (isNaN(atrValue)) return;
  fastValue = averageFast(atrValue);
  slowValue = averageSlow(atrValue);
  zValue = zs.update(atrValue);
}

// One reader per average, because the four TA classes share no base type.
function averageFast(x: f64): f64 {
  if (maKind == MA_RMA) return fastRma.update(x);
  if (maKind == MA_SMA) return fastSma.update(x);
  if (maKind == MA_WMA) return fastWma.update(x);
  return fastEma.update(x);
}

function averageSlow(x: f64): f64 {
  if (maKind == MA_RMA) return slowRma.update(x);
  if (maKind == MA_SMA) return slowSma.update(x);
  if (maKind == MA_WMA) return slowWma.update(x);
  return slowEma.update(x);
}

function writeValues(): void {
  out_atr(atrValue);
  out_fast(fastValue);
  out_slow(slowValue);
  out_z(zValue);
  out_z_iv(zIvValue);
  out_z_zero(0.0);
  out_z_hot(Z_HOT);
}
