function StatusCorporateChart({
  warehouse = 0,
  readyToDispatch = 0,
  ready = 0,
}) {
  const rows = [
    {
      key: "warehouse",
      label: "Warehouse",
      short: "01",
      value: Number(
        warehouse || 0
      ),
      color: "#38bdf8",
      note: "Stored inventory",
    },
    {
      key: "readyToDispatch",
      label:
        "Ready to Dispatch",
      short: "02",
      value: Number(
        readyToDispatch || 0
      ),
      color: "#f97316",
      note: "Dispatch queue",
    },
    {
      key: "ready",
      label: "Ready",
      short: "03",
      value: Number(
        ready || 0
      ),
      color: "#22c55e",
      note:
        "Processed / ready stock",
    },
  ];

  const total =
    rows.reduce(
      (sum, row) =>
        sum + row.value,
      0
    );

  const max =
    Math.max(
      ...rows.map(
        (row) =>
          row.value
      ),
      1
    );

  if (total <= 0) {
    return (
      <div style={emptyState}>
        No operational flow data available
      </div>
    );
  }

  return (
    <div style={root}>
      <div style={summaryRow}>
        <div>
          <div style={eyebrow}>
            CURRENT FLOW POSITION
          </div>

          <div style={summaryTitle}>
            {total} tracked inventory items
          </div>
        </div>

        <div style={summaryBadge}>
          <span>
            Dispatch-ready
          </span>
          <strong>
            {Number(
              readyToDispatch ||
              0
            )}
          </strong>
        </div>
      </div>

      <div style={flowList}>
        {rows.map(
          (row, index) => {
            const share =
              (
                row.value /
                total
              ) *
              100;

            const relative =
              (
                row.value /
                max
              ) *
              100;

            return (
              <div
                key={row.key}
                style={flowRow}
              >
                <div
                  style={stepBadge(
                    row.color
                  )}
                >
                  {row.short}
                </div>

                <div style={flowMain}>
                  <div style={flowHeader}>
                    <div>
                      <div style={flowLabel}>
                        {row.label}
                      </div>
                      <div style={flowNote}>
                        {row.note}
                      </div>
                    </div>

                    <div style={flowNumbers}>
                      <strong>
                        {row.value}
                      </strong>
                      <span>
                        {share.toFixed(
                          share >= 10
                            ? 0
                            : 1
                        )}
                        %
                      </span>
                    </div>
                  </div>

                  <div style={barTrack}>
                    <div
                      style={{
                        ...barFill,
                        width:
                          `${relative}%`,
                        background:
                          `linear-gradient(90deg,${row.color}88,${row.color})`,
                        boxShadow:
                          `0 0 10px ${row.color}36`,
                      }}
                    />
                  </div>
                </div>

                {index <
                  rows.length -
                  1 && (
                    <div style={connector}>
                      ↓
                    </div>
                  )}
              </div>
            );
          }
        )}
      </div>

      <div style={footer}>
        {rows.map((row) => {
          const share =
            (
              row.value /
              total
            ) *
            100;

          return (
            <div
              key={row.key}
              style={footerMetric}
            >
              <span>
                {row.label}
              </span>
              <strong>
                {share.toFixed(0)}%
              </strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const root = {
  width: "100%",
  height: "100%",
  minHeight: 300,
  padding: 3,
  display: "flex",
  flexDirection: "column",
};

const summaryRow = {
  minHeight: 48,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "3px 4px 9px",
  borderBottom:
    "1px solid rgba(148,163,184,.055)",
};

const eyebrow = {
  color: "#60a5fa",
  fontSize: 7.1,
  fontWeight: 950,
  letterSpacing: ".085em",
};

const summaryTitle = {
  marginTop: 3,
  color: "#dbe4ef",
  fontSize: 9.7,
  fontWeight: 900,
};

const summaryBadge = {
  minWidth: 94,
  padding: "6px 8px",
  borderRadius: 10,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  color: "#f97316",
  background:
    "rgba(249,115,22,.06)",
  border:
    "1px solid rgba(249,115,22,.13)",
  fontSize: 6.8,
  fontWeight: 850,
};

const flowList = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: 5,
  padding: "7px 4px",
};

const flowRow = {
  position: "relative",
  minHeight: 66,
  display: "grid",
  gridTemplateColumns:
    "33px minmax(0,1fr)",
  gap: 9,
  alignItems: "center",
};

const stepBadge = (accent) => ({
  width: 30,
  height: 30,
  borderRadius: 9,
  display: "grid",
  placeItems: "center",
  color: accent,
  background: `${accent}0E`,
  border: `1px solid ${accent}22`,
  fontSize: 7.8,
  fontWeight: 950,
});

const flowMain = {
  minWidth: 0,
};

const flowHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

const flowLabel = {
  color: "#dbe4ef",
  fontSize: 8.8,
  fontWeight: 900,
};

const flowNote = {
  marginTop: 2,
  color: "#475569",
  fontSize: 6.8,
  fontWeight: 700,
};

const flowNumbers = {
  display: "flex",
  alignItems: "baseline",
  gap: 5,
  color: "#64748b",
  fontSize: 7.3,
  fontWeight: 800,
};

const barTrack = {
  height: 6,
  marginTop: 7,
  overflow: "hidden",
  borderRadius: 999,
  background:
    "rgba(148,163,184,.07)",
};

const barFill = {
  height: "100%",
  minWidth: 3,
  borderRadius: 999,
};

const connector = {
  position: "absolute",
  left: 10,
  bottom: -7,
  color: "#334155",
  fontSize: 9,
  fontWeight: 900,
};

const footer = {
  minHeight: 42,
  display: "grid",
  gridTemplateColumns:
    "repeat(3,minmax(0,1fr))",
  gap: 5,
  paddingTop: 7,
  borderTop:
    "1px solid rgba(148,163,184,.055)",
};

const footerMetric = {
  minWidth: 0,
  padding: "6px 7px",
  borderRadius: 8,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 5,
  color: "#536177",
  background:
    "rgba(2,6,23,.20)",
  border:
    "1px solid rgba(148,163,184,.045)",
  fontSize: 6.8,
  fontWeight: 750,
};

const emptyState = {
  width: "100%",
  minHeight: 280,
  display: "grid",
  placeItems: "center",
  color: "#536177",
  fontSize: 8.5,
  fontWeight: 800,
};

export default StatusCorporateChart;
