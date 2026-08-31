import { useCallback, useEffect, useMemo, useState } from "react";

import StatusDonutChart from "./StatusDonutChart";

import {
  fetchDirectorPackingVolumeReport,
} from "../api/directorReportApi";

const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const percent = (numerator, denominator, empty = 0) => {
  const base = number(denominator);
  if (base <= 0) return empty;
  return Math.max(0, Math.min(100, (number(numerator) / base) * 100));
};

const compact = (value, maximumFractionDigits = 1) =>
  new Intl.NumberFormat("en-IN", {
    notation: number(value) >= 10000 ? "compact" : "standard",
    maximumFractionDigits,
  }).format(number(value));

function KpiCard({ label, value, detail, accent = "#2563eb", tag, progress, onClick }) {
  const safeProgress = Number.isFinite(Number(progress))
    ? Math.max(0, Math.min(100, Number(progress)))
    : null;

  const Tag = onClick ? "button" : "div";

  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick} style={{ ...kpiCard, ...(onClick ? kpiButton : {}) }}>
      <div style={kpiTop}>
        <div style={kpiLabel}>{label}</div>
        {tag && <div style={kpiTag(accent)}>{tag}</div>}
      </div>
      <div style={kpiValue}>{value}</div>
      <div style={kpiDetail}>{detail}</div>
      {safeProgress !== null && (
        <div style={kpiProgressTrack}>
          <div
            style={{
              ...kpiProgressFill,
              width: `${safeProgress}%`,
              background: accent,
            }}
          />
        </div>
      )}
      {onClick && <div style={kpiInspectHint}>View aggregate breakdown →</div>}
    </Tag>
  );
}

function Insight({ index, title, text, tone = "info" }) {
  const palette = insightPalette[tone] || insightPalette.info;
  return (
    <div style={insightRow}>
      <div style={insightIndex(palette)}>{String(index).padStart(2, "0")}</div>
      <div>
        <div style={insightTitle}>{title}</div>
        <div style={insightText}>{text}</div>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, detail, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      style={{ ...miniMetric, ...(onClick ? miniMetricButton : {}) }}
    >
      <div style={miniLabel}>{label}</div>
      <div style={miniValue}>{value}</div>
      <div style={miniDetail}>{detail}</div>
      {onClick && <div style={miniInspectHint}>View breakdown →</div>}
    </Tag>
  );
}

function HorizontalMetric({ label, value, max, accent, detail }) {
  const safeMax = Math.max(number(max), 1);
  const width = Math.max(0, Math.min(100, (number(value) / safeMax) * 100));
  return (
    <div style={horizontalRow}>
      <div style={horizontalMeta}>
        <div>
          <div style={horizontalLabel}>{label}</div>
          <div style={horizontalDetail}>{detail}</div>
        </div>
        <strong style={horizontalValue}>{compact(value)}</strong>
      </div>
      <div style={horizontalTrack}>
        <div style={{ ...horizontalFill, width: `${width}%`, background: accent }} />
      </div>
    </div>
  );
}

function TripsTrend({ data = {} }) {
  const entries = Object.entries(data || {}).slice(-12);
  if (entries.length === 0) {
    return <div style={trendEmpty}>Trip trend will appear when logistics shift history is available.</div>;
  }

  const values = entries.map(([, value]) => number(value));
  const max = Math.max(...values, 1);
  const width = 520;
  const height = 150;
  const padX = 12;
  const padY = 18;
  const points = entries
    .map(([, value], index) => {
      const x =
        entries.length <= 1
          ? width / 2
          : padX + (index / (entries.length - 1)) * (width - padX * 2);
      const y = height - padY - (number(value) / max) * (height - padY * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div>
      <svg width="100%" height="165" viewBox={`0 0 ${width} ${height + 15}`} preserveAspectRatio="none">
        {[35, 75, 115].map((y) => (
          <line
            key={y}
            x1="0"
            x2={width}
            y1={y}
            y2={y}
            stroke="rgba(148,163,184,.12)"
            strokeDasharray="4 7"
          />
        ))}
        <polyline
          points={points}
          fill="none"
          stroke="#2563eb"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {entries.map(([, value], index) => {
          const [x, y] = points.split(" ")[index].split(",").map(Number);
          return <circle key={`${index}-${value}`} cx={x} cy={y} r="3.2" fill="#2563eb" />;
        })}
      </svg>
      <div style={trendLabels}>
        <span>{String(entries[0]?.[0] || "")}</span>
        <span>{String(entries[entries.length - 1]?.[0] || "")}</span>
      </div>
    </div>
  );
}

function RouteMix({ data = {} }) {
  const entries = Object.entries(data || {})
    .map(([key, value]) => [key, number(value)])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);

  if (entries.length === 0) {
    return <div style={trendEmpty}>No route-category distribution is available in the current logistics aggregate.</div>;
  }

  return (
    <div style={routeList}>
      {entries.map(([label, value], index) => {
        const share = total > 0 ? (value / total) * 100 : 0;
        return (
          <div key={label} style={routeRow}>
            <div style={routeRank}>{String(index + 1).padStart(2, "0")}</div>
            <div style={routeMain}>
              <div style={routeTop}>
                <span style={routeLabel}>{label}</span>
                <strong style={routeValue}>{compact(value)}</strong>
              </div>
              <div style={routeTrack}>
                <div style={{ ...routeFill, width: `${share}%` }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}


const padDatePart = (value) =>
  String(value).padStart(2, "0");

const todayYmd = () => {
  const date = new Date();

  return `${date.getFullYear()}-${padDatePart(
    date.getMonth() + 1
  )}-${padDatePart(date.getDate())}`;
};

const monthStartYmd = () => {
  const date = new Date();

  return `${date.getFullYear()}-${padDatePart(
    date.getMonth() + 1
  )}-01`;
};

const toStartDateTime = (value) =>
  `${value}T00:00:00`;

const toEndDateTime = (value) =>
  `${value}T23:59:59`;

const formatCbm = (value) =>
  number(value).toLocaleString("en-IN", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });

const formatDirectorDateTime = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
};

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const measuredVolume = (row) => {
  const value = Number(row?.volumeCbm);

  return Number.isFinite(value) && value >= 0
    ? value
    : null;
};

const median = (values = []) => {
  const clean = values
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  if (clean.length === 0) return 0;

  const middle = Math.floor(clean.length / 2);

  return clean.length % 2 === 0
    ? (clean[middle - 1] + clean[middle]) / 2
    : clean[middle];
};

const percentile = (values = [], percentileValue = 0.9) => {
  const clean = values
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  if (clean.length === 0) return 0;

  const index = Math.min(
    clean.length - 1,
    Math.max(
      0,
      Math.ceil(
        percentileValue * clean.length
      ) - 1
    )
  );

  return clean[index];
};

const ymdFromDateTime = (value) => {
  if (!value) return "UNKNOWN";

  const raw = String(value).trim();
  const match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})/
  );

  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return "UNKNOWN";
  }

  return `${date.getFullYear()}-${padDatePart(
    date.getMonth() + 1
  )}-${padDatePart(date.getDate())}`;
};

const shortDate = (value) => {
  if (!value || value === "UNKNOWN") {
    return "Unknown";
  }

  const parts = String(value).split("-");

  if (parts.length !== 3) {
    return String(value);
  }

  const date = new Date(
    Number(parts[0]),
    Number(parts[1]) - 1,
    Number(parts[2]),
    12
  );

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
  }).format(date);
};

const cleanCsvValue = (value) => {
  let text = String(
    value ?? ""
  ).replace(/\r?\n/g, " ");

  /*
   * Prevent spreadsheet formula injection when a Director exports client /
   * item text to CSV and later opens it in Excel.
   */
  if (/^[=+\-@]/.test(text.trimStart())) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
};

function VolumeKpi({
  label,
  value,
  detail,
  accent = "#2563eb",
  warning = false,
}) {
  return (
    <div
      style={{
        ...volumeKpi,
        borderTop: `3px solid ${
          warning ? "#d97706" : accent
        }`,
      }}
    >
      <div style={volumeKpiLabel}>
        {label}
      </div>
      <div style={volumeKpiValue}>
        {value}
      </div>
      <div style={volumeKpiDetail}>
        {detail}
      </div>
    </div>
  );
}

function VolumeTrendChart({
  rows = [],
}) {
  if (rows.length === 0) {
    return (
      <div style={trendEmpty}>
        Volume trend will appear when measured packets exist in the selected range.
      </div>
    );
  }

  const width = 720;
  const height = 220;
  const padX = 30;
  const padY = 26;

  const maximum = Math.max(
    0.001,
    ...rows.map((row) =>
      number(row.volumeCbm)
    )
  );

  const plotWidth =
    width - padX * 2;

  const plotHeight =
    height - padY * 2 - 22;

  const points = rows
    .map((row, index) => {
      const x =
        rows.length <= 1
          ? width / 2
          : padX +
            (index /
              (rows.length - 1)) *
              plotWidth;

      const y =
        padY +
        plotHeight -
        (number(row.volumeCbm) /
          maximum) *
          plotHeight;

      return `${x},${y}`;
    })
    .join(" ");

  const labelStep = Math.max(
    1,
    Math.ceil(rows.length / 8)
  );

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={volumeTrendSvg}
        role="img"
        aria-label="Packing volume trend by date"
      >
        {[0.25, 0.5, 0.75].map(
          (ratio) => {
            const y =
              padY +
              plotHeight -
              plotHeight * ratio;

            return (
              <line
                key={ratio}
                x1={padX}
                x2={width - padX}
                y1={y}
                y2={y}
                stroke="rgba(148,163,184,.15)"
                strokeDasharray="5 7"
              />
            );
          }
        )}

        <polyline
          points={points}
          fill="none"
          stroke="#0f766e"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {rows.map((row, index) => {
          if (
            index % labelStep !== 0 &&
            index !== rows.length - 1
          ) {
            return null;
          }

          const [
            x,
            y,
          ] = points
            .split(" ")
            [index].split(",")
            .map(Number);

          return (
            <g key={row.key}>
              <circle
                cx={x}
                cy={y}
                r="3.5"
                fill="#0f766e"
              />
              <text
                x={x}
                y={height - 8}
                textAnchor="middle"
                fill="var(--pf-text-muted)"
                fontSize="9"
              >
                {row.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function VolumeRankList({
  rows = [],
  emptyText,
  valueLabel = "m³",
}) {
  if (rows.length === 0) {
    return (
      <div style={trendEmpty}>
        {emptyText}
      </div>
    );
  }

  const maximum = Math.max(
    0.001,
    ...rows.map((row) =>
      number(row.volumeCbm)
    )
  );

  return (
    <div style={volumeRankList}>
      {rows.map((row, index) => (
        <div
          key={`${row.label}-${index}`}
          style={volumeRankRow}
        >
          <div style={volumeRankNo}>
            {String(index + 1).padStart(2, "0")}
          </div>

          <div style={volumeRankMain}>
            <div style={volumeRankTop}>
              <span style={volumeRankLabel}>
                {row.label}
              </span>
              <strong style={volumeRankValue}>
                {formatCbm(row.volumeCbm)} {valueLabel}
              </strong>
            </div>

            <div style={volumeRankTrack}>
              <div
                style={{
                  ...volumeRankFill,
                  width: `${Math.max(
                    3,
                    (number(row.volumeCbm) /
                      maximum) *
                      100
                  )}%`,
                }}
              />
            </div>

            <div style={volumeRankSub}>
              {row.packets} packet
              {row.packets === 1 ? "" : "s"}
              {row.share !== undefined
                ? ` • ${Math.round(
                    row.share * 100
                  )}% of measured cube`
                : ""}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DirectorVolumeWorkspace({
  mode,
  draftFrom,
  setDraftFrom,
  draftTo,
  setDraftTo,
  applyRange,
  refresh,
  loading,
  error,
  analytics,
  rows,
  search,
  setSearch,
  plantFilter,
  setPlantFilter,
  statusFilter,
  setStatusFilter,
  sizeFilter,
  setSizeFilter,
  page,
  setPage,
  pageSize,
  setPageSize,
  exportCsv,
}) {
  const isRegister =
    mode === "register";

  return (
    <section style={directorVolumeShell}>
      <div style={directorVolumeHero}>
        <div>
          <div style={sectionEyebrow}>
            DIRECTOR • PHYSICAL PACKING INTELLIGENCE
          </div>
          <div style={directorVolumeTitle}>
            {isRegister
              ? "Volume Packet Register"
              : "Volume Intelligence"}
          </div>
          <div style={directorVolumeSubtitle}>
            {isRegister
              ? "Read-only packet-level physical cube register for management review. User identity and client address are intentionally excluded."
              : "Cube-based workload, capacity concentration and dimension-quality analytics for the selected packing period."}
          </div>
        </div>

        <div style={directorVolumeHeroValue}>
          <span>
            Selected measured cube
          </span>
          <strong>
            {formatCbm(
              analytics.filteredVolumeCbm
            )} m³
          </strong>
          <small>
            {analytics.filteredMeasuredPackets.toLocaleString(
              "en-IN"
            )} measured packets
          </small>
        </div>
      </div>

      <div style={volumeControlBar}>
        <label style={volumeControlField}>
          <span>From</span>
          <input
            type="date"
            value={draftFrom}
            onChange={(event) =>
              setDraftFrom(
                event.target.value
              )
            }
            style={volumeInput}
          />
        </label>

        <label style={volumeControlField}>
          <span>To</span>
          <input
            type="date"
            value={draftTo}
            onChange={(event) =>
              setDraftTo(
                event.target.value
              )
            }
            style={volumeInput}
          />
        </label>

        <button
          type="button"
          style={volumeApplyButton}
          onClick={applyRange}
          disabled={loading}
        >
          {loading
            ? "Loading…"
            : "Apply Range"}
        </button>

        <button
          type="button"
          style={volumeSecondaryButton}
          onClick={refresh}
          disabled={loading}
        >
          Refresh
        </button>

        {isRegister && (
          <button
            type="button"
            style={volumeExportButton}
            onClick={exportCsv}
            disabled={rows.length === 0}
          >
            Export filtered CSV
          </button>
        )}
      </div>

      {error && (
        <div style={volumeErrorBox}>
          {error}
        </div>
      )}

      <div style={volumeKpiGrid}>
        <VolumeKpi
          label="Packed Volume"
          value={`${formatCbm(
            analytics.totalVolumeCbm
          )} m³`}
          detail={`${analytics.measuredPackets.toLocaleString(
            "en-IN"
          )} measured packets in selected range`}
          accent="#0f766e"
        />
        <VolumeKpi
          label="Median Cube"
          value={`${formatCbm(
            analytics.medianCbm
          )} m³`}
          detail={`P90 ${formatCbm(
            analytics.p90Cbm
          )} m³ • max ${formatCbm(
            analytics.maxCbm
          )} m³`}
          accent="#2563eb"
        />
        <VolumeKpi
          label="Dimension Coverage"
          value={`${Math.round(
            analytics.dimensionCoverage * 100
          )}%`}
          detail={`${analytics.missingDimensions.toLocaleString(
            "en-IN"
          )} packet rows without usable cube`}
          warning={
            analytics.missingDimensions > 0
          }
          accent="#7c3aed"
        />
        <VolumeKpi
          label="Client Mix"
          value={analytics.uniqueClients}
          detail={`${analytics.uniquePlants} plants • ${analytics.largeCubePackets} packets at/above P90 cube`}
          accent="#0284c7"
        />
        <VolumeKpi
          label="Average Cube"
          value={`${formatCbm(
            analytics.averageCbm
          )} m³`}
          detail="Average cube across measured packet rows"
          accent="#16a34a"
        />
        <VolumeKpi
          label="Latest 7-Day Cube"
          value={`${formatCbm(
            analytics.latestSevenVolume
          )} m³`}
          detail={
            analytics.previousSevenVolume > 0
              ? `${analytics.sevenDayTrend >= 0 ? "+" : ""}${(
                  analytics.sevenDayTrend *
                  100
                ).toFixed(1)}% vs previous 7 days`
              : "Previous 7-day baseline unavailable"
          }
          accent={
            analytics.sevenDayTrend < 0
              ? "#d97706"
              : "#059669"
          }
        />
      </div>

      {!isRegister && (
        <>
          <div style={volumeAnalyticsGrid}>
            <div style={panel}>
              <div style={sectionEyebrow}>
                DAILY CUBE TREND
              </div>
              <div style={sectionTitle}>
                Physical packing volume by day
              </div>
              <div style={sectionSub}>
                Helps distinguish high-cube workload from days that merely have many small packets.
              </div>
              <VolumeTrendChart
                rows={analytics.dailyRows}
              />
            </div>

            <div style={panel}>
              <div style={sectionEyebrow}>
                PLANT CONCENTRATION
              </div>
              <div style={sectionTitle}>
                Cube contribution by plant
              </div>
              <div style={sectionSub}>
                Top plants ranked by measured physical packing cube.
              </div>
              <VolumeRankList
                rows={analytics.plantRows}
                emptyText="No measured plant volume is available."
              />
            </div>

            <div style={panel}>
              <div style={sectionEyebrow}>
                CLIENT LOAD
              </div>
              <div style={sectionTitle}>
                Highest physical packing demand
              </div>
              <div style={sectionSub}>
                Client concentration by selected-period measured cube.
              </div>
              <VolumeRankList
                rows={analytics.clientRows}
                emptyText="No measured client volume is available."
              />
            </div>

            <div style={panel}>
              <div style={sectionEyebrow}>
                SIZE DISTRIBUTION
              </div>
              <div style={sectionTitle}>
                Packet cube bands
              </div>
              <div style={sectionSub}>
                Management view of the physical size profile being handled by Packing.
              </div>
              <div style={volumeBandList}>
                {analytics.sizeBands.map(
                  (band) => (
                    <div
                      key={band.label}
                      style={volumeBandRow}
                    >
                      <div>
                        <div style={volumeBandLabel}>
                          {band.label}
                        </div>
                        <div style={volumeBandSub}>
                          {band.packets} packet
                          {band.packets === 1
                            ? ""
                            : "s"}
                        </div>
                      </div>
                      <strong style={volumeBandValue}>
                        {formatCbm(
                          band.volumeCbm
                        )} m³
                      </strong>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          <div style={volumeDecisionStrip}>
            <div>
              <div style={sectionEyebrow}>
                DIRECTOR SIGNALS
              </div>
              <div style={sectionTitle}>
                Management interpretation
              </div>
            </div>

            <div style={volumeSignalGrid}>
              {analytics.signals.map(
                (signal) => (
                  <div
                    key={signal.title}
                    style={volumeSignalCard(
                      signal.tone
                    )}
                  >
                    <strong>
                      {signal.title}
                    </strong>
                    <span>
                      {signal.text}
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        </>
      )}

      {isRegister && (
        <>
          <div style={volumeRegisterToolbar}>
            <input
              value={search}
              onChange={(event) => {
                setSearch(
                  event.target.value
                );
                setPage(0);
              }}
              placeholder="Search client, PD, drawing, code, item, packet, dimensions, sticker..."
              style={volumeSearchInput}
            />

            <select
              value={plantFilter}
              onChange={(event) => {
                setPlantFilter(
                  event.target.value
                );
                setPage(0);
              }}
              style={volumeSelect}
            >
              <option value="ALL">
                All Plants
              </option>
              {analytics.plantOptions.map(
                (plant) => (
                  <option
                    key={plant}
                    value={plant}
                  >
                    {plant}
                  </option>
                )
              )}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(
                  event.target.value
                );
                setPage(0);
              }}
              style={volumeSelect}
            >
              <option value="ALL">
                All Status
              </option>
              {analytics.statusOptions.map(
                (status) => (
                  <option
                    key={status}
                    value={status}
                  >
                    {status.replaceAll(
                      "_",
                      " "
                    )}
                  </option>
                )
              )}
            </select>

            <select
              value={sizeFilter}
              onChange={(event) => {
                setSizeFilter(
                  event.target.value
                );
                setPage(0);
              }}
              style={volumeSelect}
            >
              <option value="ALL">
                All Cube Sizes
              </option>
              <option value="SMALL">
                Small &lt; 0.10 m³
              </option>
              <option value="MEDIUM">
                Medium 0.10–0.50 m³
              </option>
              <option value="LARGE">
                Large 0.50–1.00 m³
              </option>
              <option value="XL">
                XL ≥ 1.00 m³
              </option>
              <option value="MISSING">
                Missing Dimensions
              </option>
            </select>
          </div>

          <div style={volumeRegisterMeta}>
            <span>
              {analytics.filteredRows.length.toLocaleString(
                "en-IN"
              )} matching packet rows
            </span>
            <span>
              {formatCbm(
                analytics.filteredVolumeCbm
              )} m³ measured cube
            </span>
            <span>
              Page {analytics.safePage + 1} of{" "}
              {analytics.pageCount}
            </span>
          </div>

          <div style={volumeTableWrap}>
            <table style={volumeTable}>
              <thead>
                <tr>
                  {[
                    "Packed At",
                    "Plant",
                    "Client",
                    "PD / Drawing",
                    "SKU / Code",
                    "Item",
                    "Packet",
                    "Dimensions",
                    "Cube (m³)",
                    "Status",
                    "Sticker",
                  ].map((label) => (
                    <th
                      key={label}
                      style={volumeTh}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {loading &&
                  analytics.filteredRows
                    .length === 0 && (
                    <tr>
                      <td
                        colSpan={11}
                        style={volumeEmptyTd}
                      >
                        Loading Director volume register…
                      </td>
                    </tr>
                  )}

                {!loading &&
                  analytics.pagedRows.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan={11}
                        style={volumeEmptyTd}
                      >
                        No packet rows match the selected Director filters.
                      </td>
                    </tr>
                  )}

                {analytics.pagedRows.map(
                  (row) => (
                    <tr
                      key={
                        row.packetItemId ||
                        `${row.packetNumber}-${row.packedAt}-${row.zohoItemId}`
                      }
                    >
                      <td style={volumeTd}>
                        {formatDirectorDateTime(
                          row.packedAt
                        )}
                      </td>
                      <td style={volumeTdStrong}>
                        {row.plantCode || "—"}
                      </td>
                      <td style={volumeTd}>
                        {row.clientName || "—"}
                      </td>
                      <td style={volumeTd}>
                        <strong>
                          {row.pdNo || "—"}
                        </strong>
                        <div style={volumeCellSub}>
                          {row.drawingNo || "—"}
                        </div>
                      </td>
                      <td style={volumeTd}>
                        {row.sku || row.pdNo || "—"}
                      </td>
                      <td style={volumeTd}>
                        <strong>
                          {row.itemName || "—"}
                        </strong>
                        {row.description && (
                          <div style={volumeCellSub}>
                            {row.description}
                          </div>
                        )}
                      </td>
                      <td style={volumeTdStrong}>
                        {row.packetNumber || "—"}
                      </td>
                      <td style={volumeTd}>
                        {row.dimensions || "—"}
                      </td>
                      <td style={volumeTdStrong}>
                        {measuredVolume(row) === null
                          ? "—"
                          : formatCbm(
                              row.volumeCbm
                            )}
                      </td>
                      <td style={volumeTd}>
                        <span style={volumeStatusPill}>
                          {String(
                            row.status ||
                              "PACKED"
                          ).replaceAll(
                            "_",
                            " "
                          )}
                        </span>
                      </td>
                      <td style={volumeTd}>
                        {row.stickerNumber || "—"}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>

          <div style={volumePagination}>
            <div style={volumePageSizes}>
              {[25, 50, 100].map(
                (size) => (
                  <button
                    key={size}
                    type="button"
                    style={volumePageSizeButton(
                      pageSize === size
                    )}
                    onClick={() => {
                      setPageSize(size);
                      setPage(0);
                    }}
                  >
                    {size}
                  </button>
                )
              )}
            </div>

            <div style={volumePageNav}>
              <button
                type="button"
                style={volumePageButton}
                disabled={
                  analytics.safePage <= 0
                }
                onClick={() =>
                  setPage((current) =>
                    Math.max(
                      0,
                      current - 1
                    )
                  )
                }
              >
                ← Previous
              </button>

              <button
                type="button"
                style={volumePageButton}
                disabled={
                  analytics.safePage >=
                  analytics.pageCount - 1
                }
                onClick={() =>
                  setPage((current) =>
                    Math.min(
                      analytics.pageCount -
                        1,
                      current + 1
                    )
                  )
                }
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function DirectorMetricModal({ detail, onClose }) {
  if (!detail) return null;

  return (
    <div style={directorModalOverlay} onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <div style={directorModal} role="dialog" aria-modal="true" aria-label={detail.title}>
        <div style={directorModalHeader}>
          <div>
            <div style={sectionEyebrow}>DIRECTOR • AGGREGATE BREAKDOWN</div>
            <div style={directorModalTitle}>{detail.title}</div>
            <div style={directorModalSubtitle}>{detail.subtitle}</div>
          </div>
          <button type="button" style={directorModalClose} onClick={onClose}>×</button>
        </div>
        <div style={directorBreakdownGrid}>
          {(detail.rows || []).map((row) => (
            <div key={row.label} style={directorBreakdownCard}>
              <div style={miniLabel}>{row.label}</div>
              <div style={miniValue}>{row.value}</div>
              {row.detail && <div style={miniDetail}>{row.detail}</div>}
            </div>
          ))}
        </div>
        <div style={directorPrivacyNote}>
          Executive inspection remains read-only. Admin trace/deletion/activity and user-performance data stay excluded. The Director Volume Packet Register is a specific sanitized exception and does not expose packed-by identity or client address.
        </div>
      </div>
    </div>
  );
}

export default function DirectorExecutiveDashboard({ stats = {}, logistics = {} }) {
  const [metricDetail, setMetricDetail] = useState(null);
  const [directorExporting, setDirectorExporting] = useState(false);

  const [workspace, setWorkspace] =
    useState("brief");

  const [volumeDraftFrom, setVolumeDraftFrom] =
    useState(monthStartYmd());

  const [volumeDraftTo, setVolumeDraftTo] =
    useState(todayYmd());

  const [volumeRange, setVolumeRange] =
    useState(() => ({
      from: monthStartYmd(),
      to: todayYmd(),
    }));

  const [volumeRows, setVolumeRows] =
    useState([]);

  const [volumeLoading, setVolumeLoading] =
    useState(false);

  const [volumeError, setVolumeError] =
    useState("");

  const [volumeSearch, setVolumeSearch] =
    useState("");

  const [volumePlantFilter, setVolumePlantFilter] =
    useState("ALL");

  const [volumeStatusFilter, setVolumeStatusFilter] =
    useState("ALL");

  const [volumeSizeFilter, setVolumeSizeFilter] =
    useState("ALL");

  const [volumePage, setVolumePage] =
    useState(0);

  const [volumePageSize, setVolumePageSize] =
    useState(25);

  const loadDirectorVolume =
    useCallback(
      async ({
        forceRefresh = false,
      } = {}) => {
        const from =
          volumeRange.from;

        const to =
          volumeRange.to;

        if (!from || !to) {
          return;
        }

        if (from > to) {
          setVolumeError(
            "From date cannot be after To date."
          );
          return;
        }

        try {
          setVolumeLoading(true);
          setVolumeError("");

          const rows =
            await fetchDirectorPackingVolumeReport(
              toStartDateTime(from),
              toEndDateTime(to),
              {
                forceRefresh,
              }
            );

          setVolumeRows(
            Array.isArray(rows)
              ? rows
              : []
          );
        } catch (error) {
          console.error(
            "Director volume intelligence failed:",
            error
          );

          setVolumeError(
            error?.message ||
              "Unable to load Director volume intelligence."
          );
        } finally {
          setVolumeLoading(false);
        }
      },
      [
        volumeRange.from,
        volumeRange.to,
      ]
    );

  useEffect(() => {
    void loadDirectorVolume();
  }, [loadDirectorVolume]);

  const applyVolumeRange =
    useCallback(() => {
      if (
        !volumeDraftFrom ||
        !volumeDraftTo
      ) {
        setVolumeError(
          "Select both From and To dates."
        );
        return;
      }

      if (
        volumeDraftFrom >
        volumeDraftTo
      ) {
        setVolumeError(
          "From date cannot be after To date."
        );
        return;
      }

      setVolumePage(0);
      setVolumeRange({
        from: volumeDraftFrom,
        to: volumeDraftTo,
      });
    }, [
      volumeDraftFrom,
      volumeDraftTo,
    ]);
  const inventoryTotal =
    number(stats.warehouseItems) +
      number(stats.readyToDispatchItems) +
      number(stats.readyItems) ||
    number(stats.totalItems);

  const packingCompletion = percent(stats.packetItemsWithSticker, stats.packetItems, 0);
  const masterCompletion = percent(stats.fullyPackedMasterItems, stats.masterItems, 0);
  const dispatchReadyShare = percent(stats.readyToDispatchItems, inventoryTotal, 0);

  const currentExceptions =
    number(stats.masterItemsWithoutPackets) +
    number(stats.packetsWithoutPacketItems) +
    number(stats.packetItemsWithoutMaster) +
    number(stats.duplicateCurrentStickers) +
    number(stats.readyItemsStillInPkd);
  const legacyExceptions =
    number(stats.dispatchedWithoutPacketItem) +
    number(stats.dispatchedWithoutChallan) +
    number(stats.dispatchedWithoutDriver);
  const totalExceptions = Math.max(
    number(stats.exceptionsCount),
    currentExceptions + legacyExceptions
  );

  const complianceFlags =
    number(stats.expiredFitness) +
    number(stats.expiredInsurance) +
    number(stats.expiredPucc);
  const todayThroughput =
    number(stats.todayStickerGenerated) + number(stats.todayChallanGenerated);

  const readinessMax = Math.max(
    number(stats.packedItems),
    number(stats.pendingItems),
    number(stats.readyItems),
    number(stats.warehouseItems),
    number(stats.readyToDispatchItems),
    1
  );

  const volumeAnalytics =
    useMemo(() => {
      const values =
        volumeRows
          .map(measuredVolume)
          .filter(
            (value) =>
              value !== null
          );

      const totalVolumeCbm =
        values.reduce(
          (sum, value) =>
            sum + value,
          0
        );

      const measuredPackets =
        values.length;

      const missingDimensions =
        Math.max(
          0,
          volumeRows.length -
            measuredPackets
        );

      const uniqueClients =
        new Set(
          volumeRows
            .map((row) =>
              String(
                row?.clientName || ""
              ).trim()
            )
            .filter(Boolean)
        ).size;

      const uniquePlants =
        new Set(
          volumeRows
            .map((row) =>
              String(
                row?.plantCode || ""
              ).trim()
            )
            .filter(Boolean)
        ).size;

      const p90Cbm =
        percentile(
          values,
          0.9
        );

      const medianCbm =
        median(values);

      const maxCbm =
        values.length > 0
          ? Math.max(...values)
          : 0;

      const averageCbm =
        measuredPackets > 0
          ? totalVolumeCbm /
            measuredPackets
          : 0;

      const groupVolume = (
        keyGetter,
        limit = 6
      ) => {
        const map = new Map();

        volumeRows.forEach((row) => {
          const value =
            measuredVolume(row);

          if (value === null) {
            return;
          }

          const label =
            String(
              keyGetter(row) ||
                "Unassigned"
            ).trim() ||
            "Unassigned";

          const current =
            map.get(label) || {
              label,
              packets: 0,
              volumeCbm: 0,
            };

          current.packets += 1;
          current.volumeCbm += value;
          map.set(label, current);
        });

        return Array.from(
          map.values()
        )
          .map((row) => ({
            ...row,
            share:
              totalVolumeCbm > 0
                ? row.volumeCbm /
                  totalVolumeCbm
                : 0,
          }))
          .sort(
            (a, b) =>
              b.volumeCbm -
              a.volumeCbm
          )
          .slice(0, limit);
      };

      const dailyMap =
        new Map();

      volumeRows.forEach((row) => {
        const value =
          measuredVolume(row);

        if (value === null) {
          return;
        }

        const key =
          ymdFromDateTime(
            row?.packedAt
          );

        if (key === "UNKNOWN") {
          return;
        }

        const current =
          dailyMap.get(key) || {
            key,
            label: shortDate(key),
            packets: 0,
            volumeCbm: 0,
          };

        current.packets += 1;
        current.volumeCbm += value;
        dailyMap.set(key, current);
      });

      const dailyRows =
        Array.from(
          dailyMap.values()
        ).sort(
          (a, b) =>
            a.key.localeCompare(
              b.key
            )
        );

      const last14 =
        dailyRows.slice(-14);

      /*
       * Compare non-overlapping completed chunks. When fewer than eight
       * active volume dates are present there is no legitimate prior
       * seven-day baseline, so the prior period remains empty instead of
       * comparing the same dates against themselves.
       */
      const latestSeven =
        last14.slice(-7);

      const previousSeven =
        last14.length > 7
          ? last14.slice(0, -7)
          : [];

      const previousSevenVolume =
        previousSeven.reduce(
          (sum, row) =>
            sum +
            row.volumeCbm,
          0
        );

      const latestSevenVolume =
        latestSeven.reduce(
          (sum, row) =>
            sum +
            row.volumeCbm,
          0
        );

      const sevenDayTrend =
        previousSevenVolume > 0
          ? (
              latestSevenVolume -
              previousSevenVolume
            ) /
            previousSevenVolume
          : 0;

      const sizeBands = [
        {
          key: "SMALL",
          label: "< 0.10 m³",
          packets: 0,
          volumeCbm: 0,
        },
        {
          key: "MEDIUM",
          label: "0.10–0.50 m³",
          packets: 0,
          volumeCbm: 0,
        },
        {
          key: "LARGE",
          label: "0.50–1.00 m³",
          packets: 0,
          volumeCbm: 0,
        },
        {
          key: "XL",
          label: "≥ 1.00 m³",
          packets: 0,
          volumeCbm: 0,
        },
      ];

      values.forEach((value) => {
        const target =
          value < 0.1
            ? sizeBands[0]
            : value < 0.5
              ? sizeBands[1]
              : value < 1
                ? sizeBands[2]
                : sizeBands[3];

        target.packets += 1;
        target.volumeCbm += value;
      });

      const plantOptions =
        Array.from(
          new Set(
            volumeRows
              .map((row) =>
                String(
                  row?.plantCode || ""
                ).trim()
              )
              .filter(Boolean)
          )
        ).sort();

      const statusOptions =
        Array.from(
          new Set(
            volumeRows
              .map((row) =>
                String(
                  row?.status ||
                    "PACKED"
                )
                  .trim()
                  .toUpperCase()
              )
              .filter(Boolean)
          )
        ).sort();

      const query =
        normalizeText(
          volumeSearch
        );

      const filteredRows =
        volumeRows.filter(
          (row) => {
            const plant =
              String(
                row?.plantCode || ""
              ).trim();

            const status =
              String(
                row?.status ||
                  "PACKED"
              )
                .trim()
                .toUpperCase();

            const value =
              measuredVolume(row);

            if (
              volumePlantFilter !==
                "ALL" &&
              plant !==
                volumePlantFilter
            ) {
              return false;
            }

            if (
              volumeStatusFilter !==
                "ALL" &&
              status !==
                volumeStatusFilter
            ) {
              return false;
            }

            if (
              volumeSizeFilter ===
                "MISSING" &&
              value !== null
            ) {
              return false;
            }

            if (
              volumeSizeFilter ===
                "SMALL" &&
              !(
                value !== null &&
                value < 0.1
              )
            ) {
              return false;
            }

            if (
              volumeSizeFilter ===
                "MEDIUM" &&
              !(
                value !== null &&
                value >= 0.1 &&
                value < 0.5
              )
            ) {
              return false;
            }

            if (
              volumeSizeFilter ===
                "LARGE" &&
              !(
                value !== null &&
                value >= 0.5 &&
                value < 1
              )
            ) {
              return false;
            }

            if (
              volumeSizeFilter ===
                "XL" &&
              !(
                value !== null &&
                value >= 1
              )
            ) {
              return false;
            }

            if (!query) {
              return true;
            }

            const haystack =
              [
                row?.clientName,
                row?.pdNo,
                row?.drawingNo,
                row?.sku,
                row?.itemName,
                row?.description,
                row?.packetNumber,
                row?.dimensions,
                row?.stickerNumber,
                row?.plantCode,
                row?.floor,
                row?.status,
              ]
                .map(
                  normalizeText
                )
                .join(" ");

            return haystack.includes(
              query
            );
          }
        );

      const filteredMeasured =
        filteredRows
          .map(measuredVolume)
          .filter(
            (value) =>
              value !== null
          );

      const filteredVolumeCbm =
        filteredMeasured.reduce(
          (sum, value) =>
            sum + value,
          0
        );

      const pageCount =
        Math.max(
          1,
          Math.ceil(
            filteredRows.length /
              volumePageSize
          )
        );

      const safePage =
        Math.min(
          volumePage,
          pageCount - 1
        );

      const pagedRows =
        filteredRows.slice(
          safePage *
            volumePageSize,
          safePage *
            volumePageSize +
            volumePageSize
        );

      const dimensionCoverage =
        volumeRows.length > 0
          ? measuredPackets /
            volumeRows.length
          : 0;

      const largeCubePackets =
        p90Cbm > 0
          ? values.filter(
              (value) =>
                value >= p90Cbm
            ).length
          : 0;

      const signals = [];

      if (
        missingDimensions > 0
      ) {
        signals.push({
          tone: "watch",
          title: "Dimension completeness needs attention",
          text: `${missingDimensions.toLocaleString(
            "en-IN"
          )} packet rows are excluded from cube totals because dimensions are missing or invalid.`,
        });
      } else {
        signals.push({
          tone: "good",
          title: "Dimension coverage is complete",
          text: "Every selected packet row contributes a usable physical cube value.",
        });
      }

      if (
        plantRowsForSignal(totalVolumeCbm, volumeRows) > 0.5
      ) {
        const top =
          groupVolume(
            (row) =>
              row?.plantCode,
            1
          )[0];

        if (top) {
          signals.push({
            tone: "info",
            title: "Packing cube is concentrated",
            text: `${top.label} contributes ${Math.round(
              top.share * 100
            )}% of measured cube in the selected period.`,
          });
        }
      }

      if (
        p90Cbm >= 0.75
      ) {
        signals.push({
          tone: "watch",
          title: "Large-packet handling is material",
          text: `The P90 packet is ${formatCbm(
            p90Cbm
          )} m³. Floor-space and vehicle planning should consider cube, not packet count alone.`,
        });
      } else {
        signals.push({
          tone: "good",
          title: "Packet cube profile is relatively compact",
          text: `P90 cube is ${formatCbm(
            p90Cbm
          )} m³ across measured packets.`,
        });
      }

      signals.push({
        tone:
          sevenDayTrend < -0.15
            ? "watch"
            : "info",
        title: "Recent cube movement",
        text:
          previousSevenVolume > 0
            ? `Latest seven measured days are ${sevenDayTrend >= 0 ? "up" : "down"} ${Math.abs(
                sevenDayTrend *
                  100
              ).toFixed(
                1
              )}% versus the previous seven.`
            : "A two-week measured baseline is not yet available for the selected range.",
      });

      return {
        totalVolumeCbm,
        measuredPackets,
        missingDimensions,
        uniqueClients,
        uniquePlants,
        p90Cbm,
        medianCbm,
        maxCbm,
        averageCbm,
        dimensionCoverage,
        largeCubePackets,
        plantRows: groupVolume(
          (row) =>
            row?.plantCode,
          6
        ),
        clientRows: groupVolume(
          (row) =>
            row?.clientName,
          6
        ),
        dailyRows,
        sizeBands,
        latestSevenVolume,
        previousSevenVolume,
        sevenDayTrend,
        plantOptions,
        statusOptions,
        filteredRows,
        filteredVolumeCbm,
        filteredMeasuredPackets:
          filteredMeasured.length,
        pageCount,
        safePage,
        pagedRows,
        signals: signals.slice(0, 4),
      };
    }, [
      volumeRows,
      volumeSearch,
      volumePlantFilter,
      volumeStatusFilter,
      volumeSizeFilter,
      volumePage,
      volumePageSize,
    ]);

  function plantRowsForSignal(
    totalVolumeCbm,
    rows
  ) {
    if (
      totalVolumeCbm <= 0 ||
      !Array.isArray(rows) ||
      rows.length === 0
    ) {
      return 0;
    }

    const map = new Map();

    rows.forEach((row) => {
      const value =
        measuredVolume(row);

      if (value === null) {
        return;
      }

      const plant =
        String(
          row?.plantCode ||
            "Unassigned"
        ).trim() ||
        "Unassigned";

      map.set(
        plant,
        (map.get(plant) || 0) +
          value
      );
    });

    const top =
      Math.max(
        0,
        ...map.values()
      );

    return top / totalVolumeCbm;
  }

  const exportDirectorVolumeCsv =
    useCallback(() => {
      const rows =
        volumeAnalytics.filteredRows;

      if (
        rows.length === 0 ||
        typeof document ===
          "undefined"
      ) {
        return;
      }

      const columns = [
        ["packedAt", "Packed At"],
        ["plantCode", "Plant"],
        ["clientName", "Client"],
        ["pdNo", "PD No."],
        ["drawingNo", "Drawing No."],
        ["sku", "SKU / Code"],
        ["itemName", "Item Name"],
        ["description", "Description"],
        ["packetNumber", "Packet No."],
        ["quantity", "Qty"],
        ["dimensions", "Dimensions"],
        ["volumeCbm", "Volume (m³)"],
        ["status", "Status"],
        ["stickerNumber", "Sticker No."],
      ];

      const csvRows = [
        columns
          .map(([, label]) =>
            cleanCsvValue(label)
          )
          .join(","),
        ...rows.map((row) =>
          columns
            .map(([key]) => {
              const value =
                key === "volumeCbm" &&
                measuredVolume(row) !==
                  null
                  ? formatCbm(
                      row.volumeCbm
                    )
                  : row?.[key] ?? "";

              return cleanCsvValue(value);
            })
            .join(",")
        ),
      ];

      const blob = new Blob(
        [
          "\uFEFF" +
            csvRows.join("\r\n"),
        ],
        {
          type:
            "text/csv;charset=utf-8;",
        }
      );

      const url =
        URL.createObjectURL(blob);

      const anchor =
        document.createElement("a");

      anchor.href = url;
      anchor.download =
        `Director_Volume_Register_${volumeRange.from}_to_${volumeRange.to}.csv`;

      document.body.appendChild(
        anchor
      );

      anchor.click();
      anchor.remove();

      URL.revokeObjectURL(url);
    }, [
      volumeAnalytics.filteredRows,
      volumeRange.from,
      volumeRange.to,
    ]);

  const insights = useMemo(() => {
    const rows = [];

    if (totalExceptions > 0) {
      rows.push({
        tone: "risk",
        title: "Data integrity needs management attention",
        text: `${totalExceptions} current/legacy linkage exceptions are present. This is a control risk, not a production-volume KPI, and should be reconciled before using affected records for audit decisions.`,
      });
    } else {
      rows.push({
        tone: "good",
        title: "Current PackFlow linkage controls are clear",
        text: "No tracked master/packet/sticker/dispatch integrity exception is present in this snapshot.",
      });
    }

    if (number(stats.readyToDispatchItems) > 0) {
      rows.push({
        tone: "opportunity",
        title: "Finished goods are available for outbound conversion",
        text: `${number(stats.readyToDispatchItems)} items are marked Ready to Dispatch, representing ${Math.round(dispatchReadyShare)}% of the current tracked finished-goods position.`,
      });
    } else {
      rows.push({
        tone: "info",
        title: "No item is currently sitting in the Ready-to-Dispatch bucket",
        text: "Review packing/FG movement if outbound commitments are expected but this queue remains empty.",
      });
    }

    if (number(stats.packetItemsPendingSticker || stats.pendingItems) > 0) {
      rows.push({
        tone: "watch",
        title: "Packing work-in-progress remains open",
        text: `${number(stats.packetItemsPendingSticker || stats.pendingItems)} packet items remain pending; current packet-level sticker completion is ${Math.round(packingCompletion)}%.`,
      });
    } else {
      rows.push({
        tone: "good",
        title: "No packet-level sticker backlog in the current snapshot",
        text: "Packing completion is not showing an open sticker queue at this moment.",
      });
    }

    if (complianceFlags > 0) {
      rows.push({
        tone: "risk",
        title: "Fleet documentation has active expiry flags",
        text: `${complianceFlags} fitness/insurance/PUCC flags are present. Counts can overlap by vehicle, so this dashboard intentionally does not manufacture a fleet-compliance percentage.`,
      });
    } else {
      rows.push({
        tone: "good",
        title: "No fleet-document expiry flag is currently reported",
        text: `${number(stats.activeVehicles)} active vehicle records are available to PackFlow logistics.`,
      });
    }

    return rows.slice(0, 4);
  }, [
    complianceFlags,
    dispatchReadyShare,
    packingCompletion,
    stats,
    totalExceptions,
  ]);

  const exportDirectorBriefExcel = async () => {
    try {
      setDirectorExporting(true);

      const [excelModule, fileSaverModule] =
        await Promise.all([
          import("exceljs"),
          import("file-saver"),
        ]);

      const ExcelJS =
        excelModule.default || excelModule;

      const saveAs =
        fileSaverModule.saveAs ||
        fileSaverModule.default?.saveAs ||
        fileSaverModule.default;

      if (!ExcelJS || !saveAs) {
        throw new Error(
          "Excel export dependencies are unavailable."
        );
      }

      const workbook =
        new ExcelJS.Workbook();

      workbook.creator =
        "ALSORG PackFlow Director Brief";
      workbook.created = new Date();

      const safeExcelText = (value) => {
        let text = String(value ?? "");

        if (/^[=+\-@]/.test(text.trimStart())) {
          text = `'${text}`;
        }

        return text;
      };

      const styleHeader = (row) => {
        row.eachCell((cell) => {
          cell.font = {
            bold: true,
            color: { argb: "FFFFFFFF" },
          };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF16324F" },
          };
          cell.alignment = {
            vertical: "middle",
            horizontal: "left",
          };
        });
      };

      const summarySheet =
        workbook.addWorksheet(
          "Director Brief"
        );

      summarySheet.columns = [
        { key: "section", width: 24 },
        { key: "metric", width: 34 },
        { key: "value", width: 24 },
        { key: "detail", width: 74 },
      ];

      summarySheet.mergeCells("A1:D2");
      const titleCell =
        summarySheet.getCell("A1");
      titleCell.value =
        "DIRECTOR INVENTORY, PACKING & OUTBOUND BRIEF";
      titleCell.font = {
        bold: true,
        size: 18,
        color: { argb: "FFFFFFFF" },
      };
      titleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0B2339" },
      };
      titleCell.alignment = {
        vertical: "middle",
        horizontal: "left",
      };

      summarySheet.mergeCells("A3:D3");
      summarySheet.getCell("A3").value =
        `Volume period: ${volumeRange.from} to ${volumeRange.to} • Generated ${new Intl.DateTimeFormat(
          "en-IN",
          {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Kolkata",
          }
        ).format(new Date())}`;
      summarySheet.getCell("A3").font = {
        italic: true,
        color: { argb: "FF64748B" },
      };

      const header =
        summarySheet.addRow([
          "Section",
          "Metric",
          "Value",
          "Management Context",
        ]);
      styleHeader(header);

      const summaryRows = [
        [
          "Execution",
          "Packing completion",
          `${Math.round(packingCompletion)}%`,
          `${compact(stats.packetItemsWithSticker)} of ${compact(stats.packetItems)} packet items sticker-complete`,
        ],
        [
          "Execution",
          "Fully packed master items",
          `${Math.round(masterCompletion)}%`,
          `${compact(stats.fullyPackedMasterItems)} of ${compact(stats.masterItems)} master items`,
        ],
        [
          "Outbound",
          "Ready to dispatch",
          compact(stats.readyToDispatchItems),
          `${Math.round(dispatchReadyShare)}% of current tracked finished-goods position`,
        ],
        [
          "Today",
          "Execution events",
          compact(todayThroughput),
          `${compact(stats.todayStickerGenerated)} sticker events • ${compact(stats.todayChallanGenerated)} dispatched item rows`,
        ],
        [
          "Control",
          "Integrity exceptions",
          compact(totalExceptions),
          `${compact(currentExceptions)} current linkage • ${compact(legacyExceptions)} legacy outbound`,
        ],
        [
          "Compliance",
          "Fleet document flags",
          compact(complianceFlags),
          `${compact(stats.expiredFitness)} fitness • ${compact(stats.expiredInsurance)} insurance • ${compact(stats.expiredPucc)} PUCC`,
        ],
        [
          "Physical Volume",
          "Selected-range cube",
          `${formatCbm(volumeAnalytics.totalVolumeCbm)} m³`,
          `${volumeAnalytics.measuredPackets.toLocaleString("en-IN")} measured packets`,
        ],
        [
          "Physical Volume",
          "Average / median / P90 cube",
          `${formatCbm(volumeAnalytics.averageCbm)} / ${formatCbm(volumeAnalytics.medianCbm)} / ${formatCbm(volumeAnalytics.p90Cbm)} m³`,
          `Maximum ${formatCbm(volumeAnalytics.maxCbm)} m³`,
        ],
        [
          "Data Quality",
          "Dimension coverage",
          `${Math.round(volumeAnalytics.dimensionCoverage * 100)}%`,
          `${volumeAnalytics.missingDimensions.toLocaleString("en-IN")} packet rows without usable cube`,
        ],
        [
          "Logistics",
          "Trips / Drivers / Vehicles",
          `${compact(logistics?.totalTrips)} / ${compact(logistics?.activeDrivers)} / ${compact(logistics?.activeVehicles)}`,
          "Existing aggregate logistics analytics",
        ],
      ];

      summaryRows.forEach((values) => {
        const row = summarySheet.addRow(
          values.map(safeExcelText)
        );
        row.alignment = {
          vertical: "top",
          wrapText: true,
        };
      });

      insights.forEach((insight) => {
        const row = summarySheet.addRow([
          "Management Readout",
          safeExcelText(insight.title),
          String(insight.tone || "INFO").toUpperCase(),
          safeExcelText(insight.text),
        ]);
        row.alignment = {
          vertical: "top",
          wrapText: true,
        };
      });

      volumeAnalytics.signals.forEach((signal) => {
        const row = summarySheet.addRow([
          "Volume Signal",
          safeExcelText(signal.title),
          String(signal.tone || "INFO").toUpperCase(),
          safeExcelText(signal.text),
        ]);
        row.alignment = {
          vertical: "top",
          wrapText: true,
        };
      });

      summarySheet.views = [
        { state: "frozen", ySplit: 4 },
      ];
      summarySheet.autoFilter = {
        from: "A4",
        to: `D${Math.max(4, summarySheet.rowCount)}`,
      };

      const volumeSheet =
        workbook.addWorksheet(
          "Volume Packet Register"
        );

      const volumeColumns = [
        ["packedAt", "Packed At", 22],
        ["plantCode", "Plant", 18],
        ["clientName", "Client", 28],
        ["pdNo", "PD No.", 18],
        ["drawingNo", "Drawing No.", 20],
        ["sku", "SKU / Code", 22],
        ["itemName", "Item Name", 34],
        ["description", "Description", 48],
        ["packetNumber", "Packet No.", 18],
        ["quantity", "Qty", 10],
        ["dimensions", "Dimensions", 24],
        ["volumeCbm", "Volume (m³)", 15],
        ["status", "Status", 18],
        ["stickerNumber", "Sticker No.", 20],
      ];

      volumeSheet.columns =
        volumeColumns.map(
          ([key, headerText, width]) => ({
            key,
            header: headerText,
            width,
          })
        );

      styleHeader(volumeSheet.getRow(1));

      volumeRows.forEach((row) => {
        volumeSheet.addRow({
          packedAt: safeExcelText(
            formatDirectorDateTime(row?.packedAt)
          ),
          plantCode: safeExcelText(row?.plantCode),
          clientName: safeExcelText(row?.clientName),
          pdNo: safeExcelText(row?.pdNo),
          drawingNo: safeExcelText(row?.drawingNo),
          sku: safeExcelText(row?.sku),
          itemName: safeExcelText(row?.itemName),
          description: safeExcelText(row?.description),
          packetNumber: safeExcelText(row?.packetNumber),
          quantity: number(row?.quantity),
          dimensions: safeExcelText(row?.dimensions),
          volumeCbm:
            measuredVolume(row) ?? "",
          status: safeExcelText(row?.status),
          stickerNumber: safeExcelText(row?.stickerNumber),
        });
      });

      volumeSheet.getColumn("volumeCbm").numFmt =
        "0.000";
      volumeSheet.views = [
        { state: "frozen", ySplit: 1 },
      ];
      volumeSheet.autoFilter = {
        from: "A1",
        to: `N${Math.max(1, volumeSheet.rowCount)}`,
      };

      for (
        let rowNumber = 2;
        rowNumber <= volumeSheet.rowCount;
        rowNumber += 1
      ) {
        volumeSheet.getRow(rowNumber).alignment = {
          vertical: "top",
          wrapText: true,
        };
      }

      const buffer =
        await workbook.xlsx.writeBuffer();

      saveAs(
        new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `Director_Brief_${volumeRange.from}_to_${volumeRange.to}.xlsx`
      );
    } catch (error) {
      console.error(
        "Director Brief Excel export failed:",
        error
      );

      setVolumeError(
        error?.message ||
          "Unable to export Director Brief."
      );
    } finally {
      setDirectorExporting(false);
    }
  };

  return (
    <>
      <section style={directorWorkspaceBar}>
        <div>
          <div style={sectionEyebrow}>
            DIRECTOR-ONLY WORKSPACE
          </div>
          <div style={directorWorkspaceTitle}>
            Executive brief and physical-volume intelligence
          </div>
        </div>

        <div style={directorWorkspaceTabs}>
          {[
            ["brief", "Executive Brief"],
            ["volume", "Volume Intelligence"],
            ["register", "Volume Packet Register"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              style={directorWorkspaceTab(
                workspace === key
              )}
              onClick={() =>
                setWorkspace(key)
              }
            >
              {label}
            </button>
          ))}

          <button
            type="button"
            style={directorExportBriefButton}
            onClick={exportDirectorBriefExcel}
            disabled={directorExporting}
          >
            {directorExporting
              ? "Exporting…"
              : "Export Director Excel"}
          </button>
        </div>
      </section>

      {workspace === "brief" ? (
        <>
      <section style={kpiGrid}>
        <KpiCard
          label="Packing completion"
          value={`${Math.round(packingCompletion)}%`}
          detail={`${compact(stats.packetItemsWithSticker)} of ${compact(stats.packetItems)} packet items sticker-complete`}
          accent="#2563eb"
          tag="EXECUTION"
          progress={packingCompletion}
          onClick={() => setMetricDetail({
            title: "Packing completion",
            subtitle: "Aggregate packet/master completion without exposing user-level production records.",
            rows: [
              { label: "Packet items", value: compact(stats.packetItems), detail: "Total operational packet rows" },
              { label: "Sticker-complete", value: compact(stats.packetItemsWithSticker), detail: `${Math.round(packingCompletion)}% completion` },
              { label: "Pending sticker", value: compact(stats.packetItemsPendingSticker), detail: "Open packing identity work" },
              { label: "Sticker reprints", value: compact(stats.stickerReprints), detail: "Reprint events" },
              { label: "Fully packed masters", value: compact(stats.fullyPackedMasterItems), detail: `${Math.round(masterCompletion)}% of master items` },
            ],
          })}
        />
        <KpiCard
          label="Dispatch-ready FG"
          value={compact(stats.readyToDispatchItems)}
          detail={`${Math.round(dispatchReadyShare)}% of live Warehouse + Ready + Ready-to-Dispatch stock`}
          accent="#0f766e"
          tag="OUTBOUND"
          progress={dispatchReadyShare}
          onClick={() => setMetricDetail({
            title: "Finished-goods readiness",
            subtitle: "Current aggregate stock position and outbound queue.",
            rows: [
              { label: "Warehouse", value: compact(stats.warehouseItems), detail: "Stored finished goods" },
              { label: "Ready", value: compact(stats.readyItems), detail: "Processed / ready stock" },
              { label: "Ready to Dispatch", value: compact(stats.readyToDispatchItems), detail: `${Math.round(dispatchReadyShare)}% of current FG position` },
              { label: "Warehouse requests", value: compact(stats.warehouseRequestedItems), detail: "Inbound approvals pending" },
              { label: "Return requests", value: compact(stats.returnRequestedItems), detail: "Return-to-dispatch requests" },
            ],
          })}
        />
        <KpiCard
          label="Today execution"
          value={compact(todayThroughput)}
          detail={`${compact(stats.todayStickerGenerated)} sticker events • ${compact(stats.todayChallanGenerated)} dispatched items`}
          accent="#7c3aed"
          tag="TODAY"
          onClick={() => setMetricDetail({
            title: "Today execution",
            subtitle: "Today's PackFlow aggregate execution counts; dispatched item rows and distinct challans are kept separate.",
            rows: [
              { label: "Sticker events", value: compact(stats.todayStickerGenerated), detail: "Generated/reprint events recorded today" },
              { label: "Dispatched items", value: compact(stats.todayChallanGenerated), detail: "Outbound item rows today" },
              { label: "Distinct challans", value: compact(stats.todayDispatchChallans), detail: "Normal dispatch challans today" },
              { label: "Custom challans", value: compact(stats.todayCustomChallans), detail: "Custom movement challans today" },
            ],
          })}
        />
        <KpiCard
          label="Control exceptions"
          value={compact(totalExceptions)}
          detail={`${compact(currentExceptions)} current linkage • ${compact(legacyExceptions)} legacy dispatch`}
          accent={totalExceptions > 0 ? "#dc2626" : "#16a34a"}
          tag="RISK"
          onClick={() => setMetricDetail({
            title: "Control exceptions",
            subtitle: "Aggregate integrity-control counts only. Exact records remain ADMIN-only.",
            rows: [
              { label: "Master without packets", value: compact(stats.masterItemsWithoutPackets) },
              { label: "Packets without items", value: compact(stats.packetsWithoutPacketItems) },
              { label: "Packet items without master", value: compact(stats.packetItemsWithoutMaster) },
              { label: "Duplicate stickers", value: compact(stats.duplicateCurrentStickers) },
              { label: "Ready still in PKD", value: compact(stats.readyItemsStillInPkd) },
              { label: "Dispatch without packet", value: compact(stats.dispatchedWithoutPacketItem) },
              { label: "Dispatch without challan", value: compact(stats.dispatchedWithoutChallan) },
              { label: "Dispatch without driver / vehicle", value: compact(stats.dispatchedWithoutDriver) },
            ],
          })}
        />
        <KpiCard
          label="Fleet document flags"
          value={compact(complianceFlags)}
          detail={`${compact(stats.expiredFitness)} fitness • ${compact(stats.expiredInsurance)} insurance • ${compact(stats.expiredPucc)} PUCC`}
          accent={complianceFlags > 0 ? "#d97706" : "#16a34a"}
          tag="COMPLIANCE"
          onClick={() => setMetricDetail({
            title: "Fleet compliance flags",
            subtitle: "Aggregate fleet-document readiness. Counts can overlap on the same vehicle.",
            rows: [
              { label: "Active vehicles", value: compact(stats.activeVehicles), detail: "Vehicle master records" },
              { label: "Active drivers", value: compact(stats.activeDrivers), detail: "Driver master records" },
              { label: "Expired fitness", value: compact(stats.expiredFitness) },
              { label: "Expired insurance", value: compact(stats.expiredInsurance) },
              { label: "Expired PUCC", value: compact(stats.expiredPucc) },
            ],
          })}
        />
      </section>

      <section style={mainGrid}>
        <div style={panel}>
          <div style={sectionEyebrow}>MANAGEMENT READOUT</div>
          <div style={sectionTitle}>What matters in this snapshot</div>
          <div style={sectionSub}>
            Deterministic interpretations of current PackFlow data; no external benchmark is being implied.
          </div>
          <div style={insightList}>
            {insights.map((row, index) => (
              <Insight key={row.title} index={index + 1} {...row} />
            ))}
          </div>
        </div>

        <div style={panel}>
          <div style={sectionEyebrow}>FINISHED GOODS</div>
          <div style={sectionTitle}>Current stock position</div>
          <div style={sectionSub}>Warehouse, Ready to Dispatch and Ready status share.</div>
          <div style={donutWrap}>
            <StatusDonutChart
              warehouse={stats.warehouseItems}
              readyToDispatch={stats.readyToDispatchItems}
              ready={stats.readyItems}
            />
          </div>
        </div>
      </section>

      <section style={secondaryGrid}>
        <div style={panel}>
          <div style={sectionEyebrow}>PRODUCTION → PACKING → OUTBOUND</div>
          <div style={sectionTitle}>Operational readiness bands</div>
          <div style={sectionSub}>
            Independent current counts; these are not presented as a mathematically additive funnel.
          </div>
          <div style={horizontalList}>
            <HorizontalMetric
              label="Packed packet items"
              value={stats.packedItems}
              max={readinessMax}
              accent="#2563eb"
              detail="Packet items already packed/stickered"
            />
            <HorizontalMetric
              label="Pending packet items"
              value={stats.pendingItems}
              max={readinessMax}
              accent="#d97706"
              detail="Packing work still open"
            />
            <HorizontalMetric
              label="Ready"
              value={stats.readyItems}
              max={readinessMax}
              accent="#16a34a"
              detail="Processed / ready stock"
            />
            <HorizontalMetric
              label="Warehouse"
              value={stats.warehouseItems}
              max={readinessMax}
              accent="#0284c7"
              detail="Stored finished goods"
            />
            <HorizontalMetric
              label="Ready to Dispatch"
              value={stats.readyToDispatchItems}
              max={readinessMax}
              accent="#ea580c"
              detail="Outbound action queue"
            />
          </div>
        </div>

        <div style={panel}>
          <div style={sectionEyebrow}>BUSINESS CONTROL SNAPSHOT</div>
          <div style={sectionTitle}>Project-packet execution</div>
          <div style={miniGrid}>
            <MiniMetric
              label="Master items"
              value={compact(stats.masterItems)}
              detail={`${Math.round(masterCompletion)}% fully packed`}
              onClick={() => setMetricDetail({
                title: "Master item execution",
                subtitle: "Aggregate parent-item packing position.",
                rows: [
                  { label: "Master items", value: compact(stats.masterItems) },
                  { label: "Fully packed", value: compact(stats.fullyPackedMasterItems) },
                  { label: "Partially packed", value: compact(stats.partiallyPackedMasterItems) },
                  { label: "Unpacked", value: compact(stats.unpackedMasterItems) },
                ],
              })}
            />
            <MiniMetric
              label="Packets"
              value={compact(stats.totalPackets)}
              detail={`${compact(stats.pendingPackets)} pending`}
              onClick={() => setMetricDetail({
                title: "Packet execution",
                subtitle: "Aggregate packet and packet-item completion.",
                rows: [
                  { label: "Packets", value: compact(stats.totalPackets) },
                  { label: "Packed packets", value: compact(stats.packedPackets) },
                  { label: "Pending packets", value: compact(stats.pendingPackets) },
                  { label: "Packet items", value: compact(stats.packetItems) },
                  { label: "Pending sticker", value: compact(stats.packetItemsPendingSticker) },
                ],
              })}
            />
            <MiniMetric
              label="Normal challans"
              value={compact(stats.normalDispatchChallans)}
              detail={`${compact(stats.todayDispatchChallans)} today`}
              onClick={() => setMetricDetail({
                title: "Normal dispatch challans",
                subtitle: "Aggregate outbound-document and trip status.",
                rows: [
                  { label: "Normal challans", value: compact(stats.normalDispatchChallans) },
                  { label: "Today challans", value: compact(stats.todayDispatchChallans) },
                  { label: "Running trips", value: compact(stats.runningTrips) },
                  { label: "Ended trips", value: compact(stats.endedTrips) },
                ],
              })}
            />
            <MiniMetric
              label="Custom challans"
              value={compact(stats.customChallans)}
              detail={`${compact(stats.customChallanItems)} manual items`}
              onClick={() => setMetricDetail({
                title: "Custom challans",
                subtitle: "Aggregate manual/site movement documentation.",
                rows: [
                  { label: "Custom challans", value: compact(stats.customChallans) },
                  { label: "Today custom challans", value: compact(stats.todayCustomChallans) },
                  { label: "Custom challan items", value: compact(stats.customChallanItems) },
                ],
              })}
            />
            <MiniMetric
              label="Running trips"
              value={compact(stats.runningTrips)}
              detail={`${compact(stats.endedTrips)} ended`}
              onClick={() => setMetricDetail({
                title: "Trip status",
                subtitle: "Aggregate current trip lifecycle.",
                rows: [
                  { label: "Running trips", value: compact(stats.runningTrips) },
                  { label: "Ended trips", value: compact(stats.endedTrips) },
                  { label: "Closure rate", value: `${Math.round(percent(stats.endedTrips, number(stats.endedTrips) + number(stats.runningTrips), 100))}%` },
                ],
              })}
            />
            <MiniMetric
              label="Warehouse requests"
              value={compact(stats.warehouseRequestedItems)}
              detail={`${compact(stats.returnRequestedItems)} return requests`}
              onClick={() => setMetricDetail({
                title: "Warehouse movement queue",
                subtitle: "Aggregate warehouse approvals and return movement position.",
                rows: [
                  { label: "Warehouse stock", value: compact(stats.warehouseItems) },
                  { label: "Inbound requests", value: compact(stats.warehouseRequestedItems) },
                  { label: "Return requests", value: compact(stats.returnRequestedItems) },
                  { label: "Ready to store", value: compact(stats.readyToStoreItems) },
                ],
              })}
            />
          </div>
        </div>
      </section>

      <section style={secondaryGrid}>
        <div style={panel}>
          <div style={sectionEyebrow}>LOGISTICS TREND</div>
          <div style={sectionTitle}>Trips over recorded shift history</div>
          <div style={logisticsMetaRow}>
            <MiniMetric
              label="Trips"
              value={compact(logistics?.totalTrips)}
              detail="Recorded aggregate"
              onClick={() => setMetricDetail({
                title: "Logistics trip volume",
                subtitle: "Aggregate logistics activity from the existing analytics endpoint.",
                rows: [
                  { label: "Trips", value: compact(logistics?.totalTrips) },
                  { label: "Loaders", value: compact(logistics?.totalLoaders) },
                  { label: "Drivers", value: compact(logistics?.activeDrivers) },
                  { label: "Vehicles", value: compact(logistics?.activeVehicles) },
                ],
              })}
            />
            <MiniMetric
              label="Drivers"
              value={compact(logistics?.activeDrivers)}
              detail="Driver records"
              onClick={() => setMetricDetail({
                title: "Driver capacity",
                subtitle: "Aggregate driver capacity; identities remain excluded.",
                rows: [
                  { label: "Drivers", value: compact(logistics?.activeDrivers) },
                  { label: "Trips / driver", value: number(logistics?.averageTripsPerDriver).toFixed(1) },
                  { label: "Trips", value: compact(logistics?.totalTrips) },
                ],
              })}
            />
            <MiniMetric
              label="Vehicles"
              value={compact(logistics?.activeVehicles)}
              detail="Vehicle records"
              onClick={() => setMetricDetail({
                title: "Fleet capacity",
                subtitle: "Aggregate fleet capacity; vehicle-level compliance records remain outside Director scope.",
                rows: [
                  { label: "Vehicles", value: compact(logistics?.activeVehicles) },
                  { label: "Trips / vehicle", value: number(logistics?.averageTripsPerVehicle).toFixed(1) },
                  { label: "Fleet document flags", value: compact(complianceFlags) },
                ],
              })}
            />
            <MiniMetric
              label="Trips / driver"
              value={number(logistics?.averageTripsPerDriver).toFixed(1)}
              detail="Aggregate average"
              onClick={() => setMetricDetail({
                title: "Trips per driver",
                subtitle: "Historical aggregate ratio, not an individual productivity score.",
                rows: [
                  { label: "Trips / driver", value: number(logistics?.averageTripsPerDriver).toFixed(1) },
                  { label: "Trips", value: compact(logistics?.totalTrips) },
                  { label: "Drivers", value: compact(logistics?.activeDrivers) },
                ],
              })}
            />
          </div>
          <TripsTrend data={logistics?.tripsOverTime} />
        </div>

        <div style={panel}>
          <div style={sectionEyebrow}>ROUTE MIX</div>
          <div style={sectionTitle}>Where recorded trips are concentrated</div>
          <div style={sectionSub}>Top route categories from the existing logistics aggregate.</div>
          <RouteMix data={logistics?.tripsByLocation} />
        </div>
      </section>

      <div style={directorBoundaryNote}>
        Director dashboard excludes raw activity logs, admin trace/deletion/correction tools,
        scheduled-report administration and user-performance views. The Volume Packet Register is
        the only packet-level Director feed and is sanitized server-side to exclude packed-by identity
        and client address.
      </div>
        </>
      ) : (
        <DirectorVolumeWorkspace
          mode={workspace}
          draftFrom={volumeDraftFrom}
          setDraftFrom={setVolumeDraftFrom}
          draftTo={volumeDraftTo}
          setDraftTo={setVolumeDraftTo}
          applyRange={applyVolumeRange}
          refresh={() =>
            loadDirectorVolume({
              forceRefresh: true,
            })
          }
          loading={volumeLoading}
          error={volumeError}
          analytics={volumeAnalytics}
          rows={volumeRows}
          search={volumeSearch}
          setSearch={setVolumeSearch}
          plantFilter={volumePlantFilter}
          setPlantFilter={setVolumePlantFilter}
          statusFilter={volumeStatusFilter}
          setStatusFilter={setVolumeStatusFilter}
          sizeFilter={volumeSizeFilter}
          setSizeFilter={setVolumeSizeFilter}
          page={volumePage}
          setPage={setVolumePage}
          pageSize={volumePageSize}
          setPageSize={setVolumePageSize}
          exportCsv={exportDirectorVolumeCsv}
        />
      )}

      <DirectorMetricModal
        detail={metricDetail}
        onClose={() =>
          setMetricDetail(null)
        }
      />
    </>
  );
}

const insightPalette = {
  risk: { accent: "#dc2626", soft: "rgba(220,38,38,.08)", border: "rgba(220,38,38,.18)" },
  watch: { accent: "#d97706", soft: "rgba(217,119,6,.08)", border: "rgba(217,119,6,.18)" },
  opportunity: { accent: "#0f766e", soft: "rgba(15,118,110,.08)", border: "rgba(15,118,110,.18)" },
  good: { accent: "#16a34a", soft: "rgba(22,163,74,.08)", border: "rgba(22,163,74,.18)" },
  info: { accent: "#2563eb", soft: "rgba(37,99,235,.08)", border: "rgba(37,99,235,.18)" },
};

const hero = {
  minHeight: 190,
  padding: "26px clamp(20px,3vw,42px)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 24,
  flexWrap: "wrap",
  borderRadius: 14,
  border: "1px solid var(--pf-border)",
  background:
    "radial-gradient(circle at 88% 18%,rgba(37,99,235,.11),transparent 28%),linear-gradient(118deg,var(--pf-surface),var(--pf-surface-alt))",
  boxShadow: "0 16px 42px rgba(var(--pf-shadow-rgb),.07)",
};
const heroContent = { flex: "1 1 680px", minWidth: 0 };
const heroEyebrow = { color: "#2563eb", fontSize: 9, fontWeight: 950, letterSpacing: ".16em" };
const heroTitle = { margin: "8px 0 0", color: "var(--pf-text-strong)", fontSize: "clamp(34px,4.5vw,62px)", lineHeight: .98, fontWeight: 950, letterSpacing: "-.06em" };
const heroText = { maxWidth: 900, margin: "13px 0 0", color: "var(--pf-text-muted)", fontSize: 12.5, fontWeight: 650, lineHeight: 1.7 };
const heroScorecard = { minWidth: 230, padding: "16px 18px", borderRadius: 11, border: "1px solid rgba(37,99,235,.18)", background: "rgba(37,99,235,.055)" };
const heroScoreLabel = { color: "var(--pf-text-muted)", fontSize: 8, fontWeight: 950, letterSpacing: ".12em" };
const heroScoreValue = { marginTop: 6, color: "var(--pf-text-strong)", fontSize: 24, fontWeight: 950, letterSpacing: "-.035em" };
const heroScoreDetail = { marginTop: 6, color: "var(--pf-text-muted)", fontSize: 9.5, fontWeight: 700, lineHeight: 1.45 };

const kpiGrid = { marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(205px,1fr))", gap: 10 };
const kpiButton = { width: "100%", textAlign: "left", color: "var(--pf-text-strong)", cursor: "pointer", fontFamily: "inherit" };
const kpiInspectHint = { marginTop: 8, color: "#2563eb", fontSize: 8.2, fontWeight: 900 };
const kpiCard = { minWidth: 0, minHeight: 138, padding: 15, borderRadius: 12, background: "var(--pf-surface)", border: "1px solid var(--pf-border)", boxShadow: "0 7px 22px rgba(var(--pf-shadow-rgb),.05)" };
const kpiTop = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 };
const kpiLabel = { color: "var(--pf-text-muted)", fontSize: 8.5, fontWeight: 950, textTransform: "uppercase", letterSpacing: ".08em" };
const kpiTag = (accent) => ({ padding: "3px 6px", borderRadius: 5, color: accent, background: `${accent}0D`, border: `1px solid ${accent}20`, fontSize: 7.2, fontWeight: 950, letterSpacing: ".06em" });
const kpiValue = { marginTop: 10, color: "var(--pf-text-strong)", fontSize: 30, lineHeight: 1, fontWeight: 950, letterSpacing: "-.045em" };
const kpiDetail = { marginTop: 8, minHeight: 29, color: "var(--pf-text-muted)", fontSize: 9.3, fontWeight: 650, lineHeight: 1.45 };
const kpiProgressTrack = { height: 4, marginTop: 10, overflow: "hidden", borderRadius: 999, background: "rgba(var(--pf-fg-rgb),.07)" };
const kpiProgressFill = { height: "100%", borderRadius: 999 };

const mainGrid = { marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(390px,1fr))", gap: 12 };
const secondaryGrid = { marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(390px,1fr))", gap: 12 };
const panel = { minWidth: 0, padding: 17, borderRadius: 13, background: "var(--pf-surface)", border: "1px solid var(--pf-border)", boxShadow: "0 9px 26px rgba(var(--pf-shadow-rgb),.055)" };
const sectionEyebrow = { color: "#2563eb", fontSize: 8, fontWeight: 950, letterSpacing: ".12em" };
const sectionTitle = { marginTop: 4, color: "var(--pf-text-strong)", fontSize: 17, fontWeight: 950, letterSpacing: "-.025em" };
const sectionSub = { marginTop: 4, color: "var(--pf-text-muted)", fontSize: 9.6, fontWeight: 650, lineHeight: 1.5 };

const insightList = { marginTop: 12, display: "flex", flexDirection: "column" };
const insightRow = { display: "grid", gridTemplateColumns: "38px minmax(0,1fr)", gap: 11, padding: "11px 0", borderBottom: "1px solid var(--pf-border-soft)" };
const insightIndex = (palette) => ({ width: 32, height: 32, borderRadius: 8, display: "grid", placeItems: "center", color: palette.accent, background: palette.soft, border: `1px solid ${palette.border}`, fontSize: 8.5, fontWeight: 950 });
const insightTitle = { color: "var(--pf-text-strong)", fontSize: 10.7, fontWeight: 900 };
const insightText = { marginTop: 4, color: "var(--pf-text-muted)", fontSize: 9.5, fontWeight: 650, lineHeight: 1.55 };
const donutWrap = { minHeight: 330 };

const horizontalList = { marginTop: 14, display: "flex", flexDirection: "column", gap: 14 };
const horizontalRow = { paddingBottom: 2 };
const horizontalMeta = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 };
const horizontalLabel = { color: "var(--pf-text-strong)", fontSize: 10.2, fontWeight: 900 };
const horizontalDetail = { marginTop: 2, color: "var(--pf-text-muted)", fontSize: 8.5, fontWeight: 650 };
const horizontalValue = { color: "var(--pf-text-strong)", fontSize: 12 };
const horizontalTrack = { height: 6, marginTop: 7, overflow: "hidden", borderRadius: 999, background: "rgba(var(--pf-fg-rgb),.065)" };
const horizontalFill = { height: "100%", borderRadius: 999 };

const miniGrid = { marginTop: 13, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8 };
const logisticsMetaRow = { marginTop: 12, marginBottom: 6, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 7 };
const miniMetric = { minWidth: 0, padding: 10, borderRadius: 9, background: "var(--pf-surface-alt)", border: "1px solid var(--pf-border-soft)", textAlign: "left", color: "var(--pf-text-strong)", fontFamily: "inherit" };
const miniMetricButton = { width: "100%", cursor: "pointer" };
const miniInspectHint = { marginTop: 6, color: "#2563eb", fontSize: 7.5, fontWeight: 900 };
const miniLabel = { color: "var(--pf-text-muted)", fontSize: 8, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".055em" };
const miniValue = { marginTop: 5, color: "var(--pf-text-strong)", fontSize: 20, fontWeight: 950, letterSpacing: "-.035em" };
const miniDetail = { marginTop: 3, color: "var(--pf-text-muted)", fontSize: 8.2, fontWeight: 650, lineHeight: 1.35 };

const trendEmpty = { minHeight: 150, display: "grid", placeItems: "center", textAlign: "center", color: "var(--pf-text-muted)", fontSize: 9.5, fontWeight: 700 };
const trendLabels = { display: "flex", justifyContent: "space-between", gap: 10, color: "var(--pf-text-dim)", fontSize: 8.2, fontWeight: 700 };
const routeList = { marginTop: 13, display: "flex", flexDirection: "column", gap: 10 };
const routeRow = { display: "grid", gridTemplateColumns: "30px minmax(0,1fr)", gap: 9, alignItems: "center" };
const routeRank = { width: 26, height: 26, display: "grid", placeItems: "center", borderRadius: 7, background: "var(--pf-surface-alt)", border: "1px solid var(--pf-border-soft)", color: "var(--pf-text-muted)", fontSize: 8, fontWeight: 950 };
const routeMain = { minWidth: 0 };
const routeTop = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 };
const routeLabel = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--pf-text-strong)", fontSize: 9.5, fontWeight: 850 };
const routeValue = { color: "var(--pf-text-strong)", fontSize: 10 };
const routeTrack = { height: 4, marginTop: 5, overflow: "hidden", borderRadius: 999, background: "rgba(var(--pf-fg-rgb),.065)" };
const routeFill = { height: "100%", borderRadius: 999, background: "#2563eb" };

const directorBoundaryNote = { marginTop: 12, padding: "10px 12px", borderRadius: 9, border: "1px solid var(--pf-border)", background: "var(--pf-surface-alt)", color: "var(--pf-text-muted)", fontSize: 9, fontWeight: 700, lineHeight: 1.5 };



const directorWorkspaceBar = {
  marginTop: 12,
  padding: "11px 13px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  borderRadius: 12,
  border: "1px solid var(--pf-border)",
  background:
    "linear-gradient(135deg,var(--pf-surface),var(--pf-surface-alt))",
  boxShadow:
    "0 7px 20px rgba(var(--pf-shadow-rgb),.045)",
};

const directorWorkspaceTitle = {
  marginTop: 4,
  color: "var(--pf-text-strong)",
  fontSize: 13,
  fontWeight: 900,
};

const directorWorkspaceTabs = {
  display: "flex",
  gap: 5,
  flexWrap: "wrap",
};

const directorExportBriefButton = { minHeight: 35, padding: "0 12px", borderRadius: 8, border: "1px solid rgba(15,118,110,.25)", background: "rgba(15,118,110,.09)", color: "#0f766e", cursor: "pointer", fontFamily: "inherit", fontSize: 9.2, fontWeight: 950, whiteSpace: "nowrap" };

const directorWorkspaceTab = (active) => ({
  minHeight: 36,
  padding: "0 12px",
  borderRadius: 9,
  border: active
    ? "1px solid rgba(37,99,235,.28)"
    : "1px solid var(--pf-border-soft)",
  background: active
    ? "linear-gradient(135deg,#1d4ed8,#2563eb)"
    : "var(--pf-surface-alt)",
  color: active
    ? "#fff"
    : "var(--pf-text-strong)",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 9.5,
  fontWeight: 900,
  boxShadow: active
    ? "0 7px 18px rgba(37,99,235,.18)"
    : "none",
});

const directorVolumeShell = {
  marginTop: 12,
  minWidth: 0,
};

const directorVolumeHero = {
  minHeight: 145,
  padding: "20px clamp(17px,2.5vw,30px)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 18,
  flexWrap: "wrap",
  borderRadius: 14,
  border: "1px solid rgba(15,118,110,.20)",
  background:
    "radial-gradient(circle at 88% 18%,rgba(15,118,110,.14),transparent 30%),radial-gradient(circle at 12% 0%,rgba(37,99,235,.07),transparent 28%),linear-gradient(118deg,var(--pf-surface),var(--pf-surface-alt))",
  boxShadow:
    "0 14px 38px rgba(var(--pf-shadow-rgb),.065)",
};

const directorVolumeTitle = {
  marginTop: 5,
  color: "var(--pf-text-strong)",
  fontSize: "clamp(25px,3vw,40px)",
  fontWeight: 950,
  letterSpacing: "-.045em",
};

const directorVolumeSubtitle = {
  maxWidth: 850,
  marginTop: 7,
  color: "var(--pf-text-muted)",
  fontSize: 10.5,
  lineHeight: 1.55,
  fontWeight: 650,
};

const directorVolumeHeroValue = {
  minWidth: 235,
  padding: "13px 15px",
  display: "grid",
  gap: 4,
  borderRadius: 11,
  border: "1px solid rgba(15,118,110,.18)",
  background: "rgba(15,118,110,.07)",
  color: "var(--pf-text-muted)",
  fontSize: 8.5,
  fontWeight: 850,
  textTransform: "uppercase",
  letterSpacing: ".06em",
};

const volumeControlBar = {
  marginTop: 10,
  padding: 10,
  display: "flex",
  alignItems: "end",
  gap: 8,
  flexWrap: "wrap",
  borderRadius: 11,
  border: "1px solid var(--pf-border)",
  background: "var(--pf-surface)",
};

const volumeControlField = {
  display: "grid",
  gap: 5,
  color: "var(--pf-text-muted)",
  fontSize: 8,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: ".06em",
};

const volumeInput = {
  height: 36,
  minWidth: 145,
  padding: "0 10px",
  borderRadius: 8,
  border: "1px solid var(--pf-border)",
  background: "var(--pf-input)",
  color: "var(--pf-text-strong)",
  outline: "none",
  colorScheme: "var(--pf-color-scheme)",
  fontFamily: "inherit",
  fontSize: 10,
  fontWeight: 750,
};

const volumeApplyButton = {
  minHeight: 36,
  padding: "0 12px",
  borderRadius: 8,
  border: "1px solid rgba(15,118,110,.24)",
  background:
    "linear-gradient(135deg,#0f766e,#0d9488)",
  color: "#fff",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 9.5,
  fontWeight: 900,
};

const volumeSecondaryButton = {
  ...volumeApplyButton,
  color: "var(--pf-text-strong)",
  background: "var(--pf-surface-alt)",
  border: "1px solid var(--pf-border)",
};

const volumeExportButton = {
  ...volumeApplyButton,
  marginLeft: "auto",
  background:
    "linear-gradient(135deg,#1d4ed8,#2563eb)",
  border:
    "1px solid rgba(37,99,235,.26)",
};

const volumeErrorBox = {
  marginTop: 10,
  padding: "9px 11px",
  borderRadius: 9,
  color:
    "color-mix(in srgb,#dc2626 82%,var(--pf-text-strong))",
  background: "rgba(220,38,38,.07)",
  border: "1px solid rgba(220,38,38,.18)",
  fontSize: 9.5,
  fontWeight: 750,
};

const volumeKpiGrid = {
  marginTop: 10,
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(165px,1fr))",
  gap: 8,
};

const volumeKpi = {
  minWidth: 0,
  minHeight: 112,
  padding: 12,
  borderRadius: 10,
  background: "var(--pf-surface)",
  border: "1px solid var(--pf-border)",
  boxShadow:
    "0 6px 18px rgba(var(--pf-shadow-rgb),.04)",
};

const volumeKpiLabel = {
  color: "var(--pf-text-muted)",
  fontSize: 7.7,
  fontWeight: 950,
  letterSpacing: ".08em",
  textTransform: "uppercase",
};

const volumeKpiValue = {
  marginTop: 7,
  color: "var(--pf-text-strong)",
  fontSize: 23,
  lineHeight: 1,
  fontWeight: 950,
  letterSpacing: "-.04em",
};

const volumeKpiDetail = {
  marginTop: 7,
  color: "var(--pf-text-muted)",
  fontSize: 8.5,
  fontWeight: 650,
  lineHeight: 1.4,
};

const volumeAnalyticsGrid = {
  marginTop: 10,
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(360px,1fr))",
  gap: 10,
};

const volumeTrendSvg = {
  width: "100%",
  minHeight: 210,
  marginTop: 8,
};

const volumeRankList = {
  marginTop: 10,
  display: "grid",
  gap: 9,
};

const volumeRankRow = {
  display: "grid",
  gridTemplateColumns: "28px minmax(0,1fr)",
  gap: 8,
  alignItems: "start",
};

const volumeRankNo = {
  width: 25,
  height: 25,
  display: "grid",
  placeItems: "center",
  borderRadius: 7,
  color: "var(--pf-text-muted)",
  background: "var(--pf-surface-alt)",
  border: "1px solid var(--pf-border-soft)",
  fontSize: 7.5,
  fontWeight: 950,
};

const volumeRankMain = {
  minWidth: 0,
};

const volumeRankTop = {
  display: "flex",
  justifyContent: "space-between",
  gap: 9,
  alignItems: "center",
};

const volumeRankLabel = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "var(--pf-text-strong)",
  fontSize: 9.3,
  fontWeight: 850,
};

const volumeRankValue = {
  color: "var(--pf-text-strong)",
  fontSize: 9.5,
  whiteSpace: "nowrap",
};

const volumeRankTrack = {
  height: 4,
  marginTop: 5,
  overflow: "hidden",
  borderRadius: 999,
  background:
    "rgba(var(--pf-fg-rgb),.065)",
};

const volumeRankFill = {
  height: "100%",
  borderRadius: 999,
  background:
    "linear-gradient(90deg,#0f766e,#22c55e)",
};

const volumeRankSub = {
  marginTop: 4,
  color: "var(--pf-text-muted)",
  fontSize: 7.8,
  fontWeight: 650,
};

const volumeBandList = {
  marginTop: 11,
  display: "grid",
  gap: 7,
};

const volumeBandRow = {
  minHeight: 50,
  padding: "9px 10px",
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "center",
  borderRadius: 9,
  background: "var(--pf-surface-alt)",
  border: "1px solid var(--pf-border-soft)",
};

const volumeBandLabel = {
  color: "var(--pf-text-strong)",
  fontSize: 9.3,
  fontWeight: 900,
};

const volumeBandSub = {
  marginTop: 3,
  color: "var(--pf-text-muted)",
  fontSize: 8,
  fontWeight: 650,
};

const volumeBandValue = {
  color: "#0f766e",
  fontSize: 11,
};

const volumeDecisionStrip = {
  marginTop: 10,
  padding: 14,
  borderRadius: 12,
  border: "1px solid var(--pf-border)",
  background:
    "linear-gradient(135deg,var(--pf-surface),var(--pf-surface-alt))",
};

const volumeSignalGrid = {
  marginTop: 10,
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(220px,1fr))",
  gap: 8,
};

const volumeSignalCard = (tone) => {
  const palette =
    insightPalette[tone] ||
    insightPalette.info;

  return {
    minWidth: 0,
    padding: 10,
    display: "grid",
    gap: 5,
    borderRadius: 9,
    color: "var(--pf-text-strong)",
    background: palette.soft,
    border: `1px solid ${palette.border}`,
    fontSize: 9,
    lineHeight: 1.45,
  };
};

const volumeRegisterToolbar = {
  marginTop: 10,
  display: "grid",
  gridTemplateColumns:
    "minmax(260px,1fr) repeat(3,minmax(130px,170px))",
  gap: 7,
};

const volumeSearchInput = {
  ...volumeInput,
  minWidth: 0,
  width: "100%",
};

const volumeSelect = {
  ...volumeInput,
  minWidth: 0,
  width: "100%",
};

const volumeRegisterMeta = {
  marginTop: 8,
  padding: "7px 9px",
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  borderRadius: 8,
  color: "var(--pf-text-muted)",
  background: "var(--pf-surface-alt)",
  border: "1px solid var(--pf-border-soft)",
  fontSize: 8.5,
  fontWeight: 750,
};

const volumeTableWrap = {
  marginTop: 8,
  overflow: "auto",
  maxHeight: "68vh",
  borderRadius: 10,
  border: "1px solid var(--pf-border)",
  background: "var(--pf-surface)",
};

const volumeTable = {
  width: "100%",
  minWidth: 1500,
  borderCollapse: "collapse",
};

const volumeTh = {
  position: "sticky",
  top: 0,
  zIndex: 2,
  padding: "10px 11px",
  textAlign: "left",
  color: "var(--pf-text-muted)",
  background: "var(--pf-surface-alt)",
  borderBottom: "1px solid var(--pf-border)",
  fontSize: 8,
  fontWeight: 950,
  letterSpacing: ".055em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const volumeTd = {
  padding: "10px 11px",
  verticalAlign: "top",
  color: "var(--pf-text)",
  borderBottom: "1px solid var(--pf-border-soft)",
  fontSize: 8.8,
  fontWeight: 650,
  lineHeight: 1.35,
};

const volumeTdStrong = {
  ...volumeTd,
  color: "var(--pf-text-strong)",
  fontWeight: 900,
};

const volumeCellSub = {
  maxWidth: 290,
  marginTop: 3,
  color: "var(--pf-text-muted)",
  fontSize: 7.8,
  lineHeight: 1.35,
};

const volumeStatusPill = {
  display: "inline-flex",
  padding: "3px 6px",
  borderRadius: 999,
  color:
    "color-mix(in srgb,#0f766e 82%,var(--pf-text-strong))",
  background: "rgba(15,118,110,.08)",
  border: "1px solid rgba(15,118,110,.17)",
  fontSize: 7.4,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const volumeEmptyTd = {
  ...volumeTd,
  padding: 28,
  textAlign: "center",
  color: "var(--pf-text-muted)",
  fontWeight: 750,
};

const volumePagination = {
  marginTop: 8,
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap",
};

const volumePageSizes = {
  display: "flex",
  gap: 5,
};

const volumePageSizeButton = (active) => ({
  minWidth: 36,
  height: 32,
  borderRadius: 7,
  border: active
    ? "1px solid rgba(37,99,235,.25)"
    : "1px solid var(--pf-border)",
  background: active
    ? "rgba(37,99,235,.09)"
    : "var(--pf-surface-alt)",
  color: active
    ? "#2563eb"
    : "var(--pf-text-strong)",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 8.5,
  fontWeight: 900,
});

const volumePageNav = {
  display: "flex",
  gap: 6,
};

const volumePageButton = {
  minHeight: 32,
  padding: "0 10px",
  borderRadius: 7,
  border: "1px solid var(--pf-border)",
  background: "var(--pf-surface-alt)",
  color: "var(--pf-text-strong)",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 8.5,
  fontWeight: 850,
};

const directorModalOverlay = { position: "fixed", inset: 0, zIndex: 17000, padding: 20, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(2,6,23,.72)", backdropFilter: "blur(8px)" };
const directorModal = { width: "min(900px,calc(100vw - 40px))", maxHeight: "min(84vh,760px)", overflow: "hidden", display: "flex", flexDirection: "column", borderRadius: 16, background: "linear-gradient(180deg,var(--pf-surface),var(--pf-surface-alt))", border: "1px solid var(--pf-border)", boxShadow: "0 32px 90px rgba(2,6,23,.42)", color: "var(--pf-text-strong)" };
const directorModalHeader = { flexShrink: 0, padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, borderBottom: "1px solid var(--pf-border-soft)" };
const directorModalTitle = { marginTop: 5, fontSize: 22, fontWeight: 950, letterSpacing: "-.025em" };
const directorModalSubtitle = { maxWidth: 680, marginTop: 5, color: "var(--pf-text-muted)", fontSize: 10.5, fontWeight: 650, lineHeight: 1.5 };
const directorModalClose = { width: 36, height: 36, borderRadius: 10, border: "1px solid var(--pf-border)", background: "var(--pf-surface-alt)", color: "var(--pf-text-strong)", cursor: "pointer", fontSize: 22 };
const directorBreakdownGrid = { minHeight: 0, overflow: "auto", padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 9 };
const directorBreakdownCard = { minWidth: 0, padding: 12, borderRadius: 10, background: "var(--pf-surface-alt)", border: "1px solid var(--pf-border-soft)" };
const directorPrivacyNote = { flexShrink: 0, margin: "0 16px 16px", padding: "9px 11px", borderRadius: 9, color: "var(--pf-text-muted)", background: "rgba(37,99,235,.055)", border: "1px solid rgba(37,99,235,.14)", fontSize: 9, fontWeight: 700, lineHeight: 1.5 };
