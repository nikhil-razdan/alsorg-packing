import { useMemo, useState } from "react";

import StatusDonutChart from "./StatusDonutChart";

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
          Aggregate-only executive inspection. User identities, item-level trace rows, deletion/admin records and raw activity remain excluded.
        </div>
      </div>
    </div>
  );
}

export default function DirectorExecutiveDashboard({ stats = {}, logistics = {} }) {
  const [metricDetail, setMetricDetail] = useState(null);
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

  return (
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
        Director dashboard intentionally excludes raw activity logs, user-wise performance,
        trace-level records, admin correction/deletion tools and scheduled-report administration.
      </div>

      <DirectorMetricModal detail={metricDetail} onClose={() => setMetricDetail(null)} />
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


const directorModalOverlay = { position: "fixed", inset: 0, zIndex: 17000, padding: 20, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(2,6,23,.72)", backdropFilter: "blur(8px)" };
const directorModal = { width: "min(900px,calc(100vw - 40px))", maxHeight: "min(84vh,760px)", overflow: "hidden", display: "flex", flexDirection: "column", borderRadius: 16, background: "linear-gradient(180deg,var(--pf-surface),var(--pf-surface-alt))", border: "1px solid var(--pf-border)", boxShadow: "0 32px 90px rgba(2,6,23,.42)", color: "var(--pf-text-strong)" };
const directorModalHeader = { flexShrink: 0, padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, borderBottom: "1px solid var(--pf-border-soft)" };
const directorModalTitle = { marginTop: 5, fontSize: 22, fontWeight: 950, letterSpacing: "-.025em" };
const directorModalSubtitle = { maxWidth: 680, marginTop: 5, color: "var(--pf-text-muted)", fontSize: 10.5, fontWeight: 650, lineHeight: 1.5 };
const directorModalClose = { width: 36, height: 36, borderRadius: 10, border: "1px solid var(--pf-border)", background: "var(--pf-surface-alt)", color: "var(--pf-text-strong)", cursor: "pointer", fontSize: 22 };
const directorBreakdownGrid = { minHeight: 0, overflow: "auto", padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 9 };
const directorBreakdownCard = { minWidth: 0, padding: 12, borderRadius: 10, background: "var(--pf-surface-alt)", border: "1px solid var(--pf-border-soft)" };
const directorPrivacyNote = { flexShrink: 0, margin: "0 16px 16px", padding: "9px 11px", borderRadius: 9, color: "var(--pf-text-muted)", background: "rgba(37,99,235,.055)", border: "1px solid rgba(37,99,235,.14)", fontSize: 9, fontWeight: 700, lineHeight: 1.5 };
