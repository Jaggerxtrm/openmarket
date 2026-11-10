# ATR + EMA

Average true range with a fast and a slow moving average of the ATR, plus a
z-score of volatility against its own history. One pane below the price for the
three ATR series, a second pane for the z-score.

- Source: [`atr-ema.ts`](./atr-ema.ts) — published as `@you/atr-ema`
- IV variant: [`atr-ema-iv.ts`](./atr-ema-iv.ts) — same file plus the implied
  volatility leg ([below](#the-iv-leg-atr-ema-ivts)); browser-only
- Platform: [OpenMarket wrun](https://openmarket.xyz/wrun/llms.txt) — TypeScript
  syntax compiled to WebAssembly, one file per indicator
- Language marker: the file's first line, `//@lang=wrun-ts`

---

## Install

1. Open a chart on [openmarket.xyz](https://openmarket.xyz) and press **Editor**
   (the code icon), then **New indicator**.
2. Paste the whole of `atr-ema.ts` (or `atr-ema-iv.ts`), marker line included,
   replacing the starter.
3. Press **Run**. Two panes appear under the price.

The file runs on any market and any interval. Nothing is imported: `param`,
`output`, `pane`, `Atr`, `Ema`, `Rma`, `Sma`, `Wma`, `Zscore`, `Resampler`,
`tf`, `bar` and the generated `p_*` / `out_*` readers are provided by the
editor.

### If Run refuses

The Console names the refusal and underlines the line. Two that this file can
produce:

| Message | Cause | Fix |
| --- | --- | --- |
| `Input 'trade_date' (inputSources): a time source cannot be the primary input (index 0)` | `input("trade_date", …)` was declared before the price feed | keep `input("close", ohlcv.close);` first — the primary input defines the request grid |
| `Output 'atr' is NaN on all N ready bars` | not an error: the chosen timeframe pin is refused, or the history is shorter than the warm-up | pick a timeframe at or above the chart's interval, or load more history |

---

## Publish

The registry page is built from four things, and there is no README or guide
upload — the wrun docs document no such field:

| Page element | Where it comes from |
| --- | --- |
| Name | the editor tab's title, under `@yourname/` |
| Description | the **Description** field in the Publish dialog, one paragraph |
| Cover | a picture of the pane taken at publish time (no picker) |
| Legend | the `description` of every drawn output |

So the paragraph below is what the page gets. It carries the whole pitch
because nothing longer is available:

> Average true range with a fast and a slow moving average of the ATR, plus a
> z-score of volatility against its own history. ATR against its fast average
> reads a live expansion or contraction; ATR against its slow average reads the
> regime. The z pane rescales the same reading so it compares across symbols and
> across time, with +2 marking a spike in the top of the distribution. Measured
> on the chart's own timeframe or pinned to a higher one, with closed candles
> only, so it does not repaint.

Publishing steps: **Publish** → name after `@yourname/` (lowercase letters,
digits, dashes; read-only after the first publish, so a rename is a new
indicator) → the first release is 0.1.0 → **Who can use it** → **Code** →
Description → Publish. Later revisions are **Publish a new version**
(Patch / Minor / Major) with a one-line *What changed*, up to 280 characters.

The **Code** choice has a consequence for this file:

- **Protected** — OpenMarket's servers compute it and stream the result; it
  cannot be forked, and it has **no Style page**. The six outputs are therefore
  fixed to the colours declared here, and the settings dialog is exactly the six
  settings above. Protected is fixed at the first publish and cannot change;
  moving an indicator across means publishing under a new name.
  **The IV variant cannot be published Protected:** `option_daily` is refused on
  OpenMarket's servers (`wrun_option_daily_unsupported`), and an alert on an
  indicator that reads it is refused too. That is why the IV leg is a second
  file rather than a setting — see [the IV leg](#the-iv-leg-atr-ema-ivts).
- **Compiled** / **Open source** — runs in the browser, and both get the chart's
  Style page, so users can recolour or hide each output themselves. The two can
  alternate from version to version. Open source code is capped at 256 KB (this
  file is ~6 KB).

---

## What it draws

Six outputs across two panes. Only `z_pane` is declared: the three ATR series
name no pane, so they land in the chart's default lower pane and set its scale
between them.

| Pane | Output | Plot | Colour | What it is |
| --- | --- | --- | --- | --- |
| default | `atr` | line, width 2 | `#7c3aed` violet | average true range |
| default | `fast` | line, width 2 | `#2563eb` blue | fast average of the ATR |
| default | `slow` | line, width 2 | `#f97316` orange | slow average of the ATR |
| `z_pane` | `z` | line, width 2 | `#0ea5e9` sky | ATR's z-score |
| `z_pane` | `z_zero` | guide, dotted | `theme.muted` | level at `0` |
| `z_pane` | `z_hot` | guide, dashed, label `hot` | `#ef4444` red | level at `+2` |

The three ATR series share one scale, so they share the default pane — no
`pane(...)` declaration for them. The z-score runs about ±3 while the ATR is in
price units, so it takes `pane("z_pane", { title: "ATR z {{z_len}}",
height_frac: 0.2, format: "0.00" })` below. `{{z_len}}` in the title is
interpolated from the setting.

Levels are **guides**: a `line` output with `role: "guide"` written to a
constant on every bar. The chart draws one full-width line at its last value,
keeps it out of the legend, and keeps it inside the pane's autoscale. They are
written every bar, including while the series are blanked, so the z pane never
collapses to nothing.

All six outputs are written on every bar. An output not written on a bar stays
`NaN` and draws nothing there, which would leave gaps in a confirmed
higher-timeframe staircase, so `writeValues()` is the single exit of `onBar()`.

---

## The IV leg (`atr-ema-iv.ts`)

A second file, identical to `atr-ema.ts` but for five blocks, which adds one line
to the z pane: the z-score of **implied** volatility.

| Pane | Output | Plot | Colour | What it is |
| --- | --- | --- | --- | --- |
| `z_pane` | `z_iv` | line, width 2, dashed | `#14b8a6` teal | how many deviations the 30-day IV sits from its own mean |

`z_pane` grows to `height_frac: 0.24` to hold the second line, and the `+2`
guide now serves both.

### Why it is a separate file

`option_daily` is **the chart's alone**: the browser serves it, OpenMarket's
servers refuse it by name (`wrun_option_daily_unsupported`), and an alert on an
indicator that reads it is refused. Combined with "the Code choice is fixed at
the first publish", that makes the input a file-level decision, not a setting:
`atr-ema.ts` keeps its Protected publish and its alerts, `atr-ema-iv.ts` gives
both up in exchange for the IV line and can only ship Compiled or Open source.
An input cannot be hidden behind a `param.bool`, so a toggle would still cost
`atr-ema.ts` its Protected route.

### The source

```ts
input("iv30", option_daily.atm_iv_30d, {
  missing: "nan",
  description: "30-day at-the-money implied volatility of this market's options, in percent, one reading per trading day",
});
```

- `option_daily` reads the chart's own chain by default: a crypto venue's, a CME
  future's or a US stock's listed options. `venue` and `book` pick another.
- Rows land **one per UTC day**, on the first bar of that day, `NaN` on the rest
  (`missing: "nan"`). That is also what keeps the file runnable on a market with
  no listed options: every bar reads `NaN`, the IV line draws nothing, and the
  ATR pane is unaffected.
- The 30-day tenor is the constant-maturity ATM IV of the daily statistics, not
  Deribit's polled `implied_volatility` source — that one is refreshed by
  polling and carries no history, so it cannot fill a window.

### Why a z-score and not price units

The obvious conversion is "IV as a per-bar expected move in price units":
`iv_move = IV% / 100 × close × sqrt(barSec / secondsPerYear)`. It fails on one
detail: ATR is a **mean absolute range**, IV a **1σ move**, and the constant
between them is not a constant. For a Brownian path over a bar,
`E[range] ≈ 1.596σ`; on real discrete bars it lands nearer 1.0–1.3σ, and gaps
the ATR absorbs push it higher again. Any factor baked in would be a fudge the
reader cannot see, and it would be wrong differently on a 1m and a 4h bar.

Dividing each series by its own mean and deviation needs no factor at all. Both
lines are then dimensionless, share the ±3 axis, and the pane reads as a
comparison rather than as two quantities that happen to be near each other.

`option_daily.implied_move_front` *is* a price distance, but it is the front
expiry's move over days, not over one bar, and it jumps when the front expiry
rolls — no better as a per-bar twin.

### What the two windows measure

| Line | Fed | Window |
| --- | --- | --- |
| `z` | ATR values, one per fold | `z_len` bars of the selected timeframe (100 by default) |
| `z_iv` | daily IV rows, one per session | `iv_len` sessions (100 by default, about five months) |

The spans differ by design: a volatility spike is a bar-scale event, an IV
regime is a seasonal one. Compare levels and signs, not exact equality. The IV
window is a new setting, `iv_len`, on its own because it counts sessions while
`z_len` counts bars.

A session is counted once: the file remembers the UTC day it has already read,
so a repeated read — a carry policy, a replayed bar — cannot pad the window with
copies of one observation.

### How to read it

- `z_iv` **above** `z`: options price more movement than the tape has delivered.
  Realized vol is cheap against implied, which is the sign of a positive variance
  risk premium and the state that punishes buying options outright.
- `z_iv` **below** `z`: implied is cheap against what is being realized.
- Both high: a violent regime, and the question is whether it persists.
- Both low: calm, and a compression worth watching for the expansion.

The reading is relative to each series' own history, so it compares across
symbols and across years, which is the whole point of putting it on the z pane.

### If you want it in the main file

Delete `atr-ema-iv.ts` and cut the `param.int("iv_len", …)`, the `input("iv30",
…)`, the `ziv`/`zIvValue`/`ivDay` state, the `iv_len` line in `onStart()`, the
session block at the top of `onBar()`, the `zIvValue = NaN` in the refusal, the
`z_iv` output and its `out_z_iv(...)` line — then raise `z_pane`'s `height_frac`
back to `0.2`. The result is byte-identical to `atr-ema.ts`.

---

## Formulas

With `N` a length and `TR` the true range:

```
TR   = max(high − low, |high − prevClose|, |low − prevClose|)      bar 0: high − low
ATR  = RMA(TR, atr_len)          RMA: (prev·(N−1) + TR) / N        seed: mean of the first N
fast = avg(ATR, fast_len)        avg: EMA | RMA | SMA | WMA, per the setting
slow = avg(ATR, slow_len)
z    = (ATR − mean(ATR, z_len)) / stdev(ATR, z_len)               population stdev
```

The averages smooth **the ATR**, not the close. That is what keeps one pane
readable: an average of price would sit hundreds of ATRs above the pane.

---

## How to read it

**ATR pane.**

- ATR **above its fast average** — volatility expanding now.
- ATR **above its slow average** — an elevated regime, not an event.
- The gap between the two averages is the direction of volatility: fast above
  slow means the recent range exceeds the base, fast below slow means
  compression.

**Z pane.** Raw ATR is instrument- and era-specific, so the z-score is the
comparable half:

- `0` — volatility at its recent norm.
- below `0` — compression.
- `+2` — the top of its own distribution, a spike worth noting.

The distribution is right-skewed (volatility spikes up far more often than
down), which is why the `+2` level is drawn and `−2` is not.

A common combination: ATR at a low z-score with price breaking out, then the
z-score crossing `+2` as the expansion arrives.

---

## Settings

| Setting | Kind | Default | Range | Reader | Meaning |
| --- | --- | --- | --- | --- | --- |
| Timeframe | `param.choice` | `Chart` | 8 labels, see below | `p_timeframe()` | bars the ATR and its averages are measured on |
| ATR length | `param.int` | 14 | 1..500 | `p_atr_len()` | Wilder ATR window, in bars of the selected timeframe |
| Fast length | `param.int` | 50 | 1..1000 | `p_fast_len()` | fast average window, in ATR values |
| Slow length | `param.int` | 200 | 1..2000 | `p_slow_len()` | slow average window, in ATR values |
| MA kind | `param.choice` | `EMA` | 4 labels | `p_ma_kind()` | which average smooths the ATR |
| Z window | `param.int` | 100 | 5..2000 | `p_z_len()` | window the z-score is measured over, in ATR values |

The IV variant adds one more: `iv_len` (`param.int`, 100, 20..520,
`p_iv_len()`) — the sessions its IV z-score is measured over. 252, a trading
year, is the classic window, but a z-score prints nothing until its window is
full and the daily options history is younger than that on most symbols; 100 is
where the line shows up within months.

Every setting is read in `onStart()`, so a change reruns the module without
recompiling, and a value outside its range is refused by name before the module
runs. Nothing is declared that the code does not read (the checks dialog warns
about such a setting: "never read, so changing the setting changes nothing").

### Timeframe labels and the index they must keep

`param.timeframe` is not used here, because it exposes no reader. `Resampler`
takes an **index**, so the labels are a `param.choice` whose order *is* the
mapping:

| Label | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| shown | `Chart` | `5m` | `15m` | `30m` | `1h` | `4h` | `1D` | `1W` |
| constant | `tf.CHART` | `tf.FIVE_MINUTES` | `tf.FIFTEEN_MINUTES` | `tf.THIRTY_MINUTES` | `tf.HOUR` | `tf.FOUR_HOURS` | `tf.DAY` | `tf.WEEK` |
| seconds | — | 300 | 900 | 1800 | 3600 | 14400 | trade date | Monday week |

Inserting, removing or reordering a label silently repoints every pin: keep
this table and the declaration in step. `Chart` is index 0 and is read as a
flag (`onChart`) rather than through the resampler — see below.

### MA kind labels and the index they must keep

| Label | 0 | 1 | 2 | 3 |
| --- | --- | --- | --- | --- |
| shown | `EMA` | `RMA` | `SMA` | `WMA` |
| constant | `MA_EMA` | `MA_RMA` | `MA_SMA` | `MA_WMA` |
| class | `Ema` | `Rma` | `Sma` | `Wma` |

`averageFast()` and `averageSlow()` dispatch on `maKind`, falling through to
EMA. A new label needs a new constant, a new pair of instances in `onStart()`
and a new arm in both helpers.

---

## Which average, and why

**EMA (default).** True range is fat-tailed: one news bar can print several times
the normal range. An EMA decays that bar continuously, while a strict window
(SMA, WMA) holds it at full weight until it drops off the edge, so the line steps
up on the spike and steps down exactly `N` bars later for no market reason. Its
lag is bounded and known at `(N−1)/2`.

**RMA.** Wilder smoothing, the same accumulator the ATR itself uses — the
gentlest of the four. Use it when the average is a slow regime reference rather
than a cross trigger. It does double-smooth (ATR is already an RMA of TR), which
is fine, but it buys nothing over EMA except more lag.

**SMA.** The plain mean, and what the classic ATR+MA indicator shows. Easiest to
cross-check against another platform.

**WMA.** The most responsive: lag ≈ `(N−1)/3` against the EMA's `(N−1)/2`, so a
WMA50 turns about 8 bars sooner. The trade-off is window-edge steps.

**HMA is deliberately absent.** Its inner `2·WMA(N/2) − WMA(N)` overshoots by
design, and on a non-negative series like ATR it can print a **negative** average
in quiet stretches. A volatility floor that goes below zero is a broken line.

**VWAP is deliberately absent.** `Vwma` weights by volume, not by range, so one
10× volume bar would carry ~10× the weight inside a 50-bar window and the average
would behave like a 5-bar one on exactly the bars where volume spiked. It also
makes the reading incomparable across venues, and returns `NaN` when a window's
volume sums to zero. Session-anchored VWAP is worse still: it resets at the open,
which is where ATR matters most.

---

## Timeframes

Two paths, picked by `onChart`:

**`Chart` (index 0)** folds the chart's own bar in `onBar()` with
`bar.high()`, `bar.low()`, `bar.close()` — exactly what the built-in indicators
do, live on the forming bar.

**Any pin (1..7)** folds the chart's bars into that timeframe with
`./sdk/resample`:

```ts
r.update(bar.time(), in_trade_date(), bar.open(), bar.high(), bar.low(), bar.close(), bar.volume());
if (r.closed()) foldCandle(r.last.high, r.last.low, r.last.close);
```

Only **closed** selected candles are folded. Each value therefore steps once per
selected bar and holds in between: on a 4h pin over a 1h chart the lines are flat
for four bars and step on the fifth. That staircase is the signature of a
confirmed, non-repainting higher timeframe — history shows what the live chart
showed, so a backtest of a signal built on these lines matches production.

`Chart` is handled natively rather than as `new Resampler(tf.CHART, true)`.
The resampler's confirmed rule is "a chart bar inside selected bar k shows the
state after bar k−1", which on the chart's own timeframe means the previous
bar — a one-bar lag on every line. (That is read from the docs' confirmed rule,
not from a stated special case for `tf.CHART`.) The native path has no such lag
and matches the built-ins.

`in_trade_date()` comes from `input("trade_date", time.trade_date)`. 1D and 1W
buckets are keyed on the exchange trade date — a CME bar from the 17:00 Chicago
open belongs to the next day — so the resampler needs it. A 1D or 1W pin on a
market that serves no trade date is refused.

### Refusal

`r.refused()` is true when the pin cannot be built: a timeframe narrower than
the chart's bars (`5m` on a `1h` chart), or a 1D/1W bucket without a trade date.
Nothing is blanked automatically, so the module must blank the series itself:

```ts
atrValue = NaN; fastValue = NaN; slowValue = NaN; zValue = NaN;
writeValues();
return;
```

The state is **not** folded on a refused bar, so garbage cannot enter the ATR,
the averages or the z window. The two guide levels are still written, because
they are chart furniture rather than data.

---

## Warm-up

Warm-up counts bars of the selected timeframe; a pin waits for history in the
pinned timeframe, not in chart bars.

| Line | First value on bar (1-based) | On defaults |
| --- | --- | --- |
| `atr` | `atr_len` | 14 |
| `fast` | `atr_len + fast_len − 1` | 63 |
| `slow` | `atr_len + slow_len − 1` | 213 |
| `z` | `atr_len + z_len − 1` | 113 |

The two guide levels have no warm-up: they are constants written from the first
bar, so the z pane shows its levels before the z line exists.

The fast line is never held back for the slow one, so a 200-bar slow average
does not cost the fast line its history. Nothing is written into an average
while the ATR is still `NaN`, so a warm-up hole cannot contaminate a window.

A pin multiplies the requirement: `1W` with the defaults needs 213 weekly bars
before the slow line draws, which on a young symbol may be more history than the
chart has loaded.

---

## How the code is organised

In file order:

1. **Language marker**, then a comment block on the timeframe mapping.
2. **Settings** — six `param` declarations.
3. **Inputs** — `close` (primary, defines the request grid), then `trade_date`.
   The order matters: a time source cannot be index 0.
4. **Panes and outputs** — `pane("z_pane", …)`, then all six outputs.
5. **Constants** — `MA_*` for the average dispatch, `Z_HOT` for the level.
6. **State** — one `Atr`, four average pairs (eight instances), one `Zscore`,
   the four held values, `onChart`, `maKind`, `r`.
7. **`onStart()`** — rebuilds every stateful object at the chosen lengths, reads
   each setting once, computes `onChart`.
8. **`onBar()`** — one branch on `onChart`; refuses before folding; folds once
   per closed candle; always ends in `writeValues()`.
9. **`foldCandle(high, low, close)`** — updates the ATR, then (only on a finite
   ATR) the two averages and the z-score.
10. **`averageFast` / `averageSlow`** — dispatch on `maKind`.
11. **`writeValues()`** — the single place any output is written, including the
    guide constants.

Invariants worth preserving if you edit:

- Every stateful class is constructed at module level **and** rebuilt in
  `onStart()`, so a bad setting reports in the Console instead of throwing later.
- `writeValues()` is the only writer; every path through `onBar()` reaches it.
- Averages and the z-score only receive finite ATR values.
- Nothing is folded on a refused bar.
- Two `i32` indices (`p_timeframe()`, `p_ma_kind()`) are read in `onStart()`, not
  per bar.

---

## Adapting it

**Add an average kind.** Add the label to `ma_kind`, a `MA_*` constant at the new
index, a pair of instances (`fastXx`, `slowXx`) and their construction in
`onStart()`, then an arm in both helpers. Classes available: `Sma`, `Ema`,
`Rma`, `Wma`, `Hma`, `Alma`, `Swma`, `Linreg`, `Vwma` (`Vwma` needs
`update(x, volume)`).

**Make the hot level a setting.** Replace `const Z_HOT` with
`param.number("z_hot", 2.0, { min: 0, max: 6, description: "Z-score counted as a
volatility spike" })` and read `p_z_hot()` into a module `f64` in `onStart()`.
The constant is used so the level cannot drift between the guide and a future
alert.

**Alert on a spike.** `alert(...)` takes an output handle as its gate, so the
output must be bound with a top-level `const`:

```ts
const zGate = output("z_gate", none, lower, { pane: "z_pane" });
alert("z_spike", {
  when: zGate,
  message: "{{symbol}}: ATR z-score is +2 or more at {{close}}",
  description: "ATR z-score crossed +2",
});
```

Write `zValue >= Z_HOT ? 1.0 : 0.0` to `out_z_gate()` in `writeValues()`.
Alerts only run once the indicator is published; a draft cannot carry one.

**ATR as a percent of price.** Add `output("atr_pct", line, lower, { color:
"#94a3b8", width: 1, format: "%" })` and write `100.0 * atrValue / bar.close()`
in `writeValues()`. Note this mixes scales again — either give it its own pane
or accept a squashed line.

**A different price field for the averages.** The pinned path would need the
selected candle's own field (`r.source(field.CLOSE, false)`), so a
`param.source` fits the chart path only. Simpler to publish two indicators than
to branch a picker across timeframes.

---

## Verification status

What has been checked, and what has not:

- **Checked (both files):** each transpiles as TypeScript with no syntax errors
  (`bun build`). Every declared setting is read; every declared output is
  written; every `pane: "<name>"` resolves to a declared pane; braces and parens
  balance. `atr-ema-iv.ts` was diffed against `atr-ema.ts`: the only differences
  are the IV leg's blocks and the `height_frac` change.
- **Not checked locally:** wrun's own build. There is no offline compiler — the
  editor's **Run** compiles in the browser and is the only authority on the
  declarations and the AssemblyScript build. The first paste is the real
  verification step, and the Console's line numbers are the ground truth if it
  refuses.
- **Doc-derived assumptions** worth re-checking on a live chart if something
  looks wrong: `pane(..., { format: "0.00" })` on a lower pane, `title` with
  `{{z_len}}` interpolation, `label` + `align` on a guide, `format: "price"` axis
  digits on a lower-pane output, and the `tf.CHART..tf.WEEK` numbering claimed
  for the timeframe menu.
