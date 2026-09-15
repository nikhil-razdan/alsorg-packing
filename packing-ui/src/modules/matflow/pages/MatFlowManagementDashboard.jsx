import { useCallback, useEffect, useState } from "react";
import { Box, Button, Card, Chip, LinearProgress, Typography } from "@mui/material";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import { useNavigate } from "react-router-dom";
import { matflowApi, readMatFlowError } from "../api/matflowApi";
import { ErrorBox, LoadingBlock, PageHero, SummaryCard, pageSx, panelSx, secondaryBtnSx, useMatFlow } from "../matflowUi";

const tone = (health) => health === "RED" ? "danger" : health === "AMBER" ? "warning" : "success";
const chipSx = (health) => ({
  height: 24, borderRadius: 1.2, fontWeight: 900, fontSize: 10,
  color: health === "RED" ? "var(--mf-danger-text)" : health === "AMBER" ? "var(--mf-warning-text)" : "var(--mf-success-text)",
  background: health === "RED" ? "var(--mf-danger-soft)" : health === "AMBER" ? "var(--mf-warning-soft)" : "var(--mf-success-soft)",
  border: "1px solid", borderColor: health === "RED" ? "var(--mf-danger-border)" : health === "AMBER" ? "var(--mf-warning-border)" : "var(--mf-success-border)",
});

export function MatFlowDashboardPage() {
  const { selectedPlantParam } = useMatFlow();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [dashboard, engineering] = await Promise.all([
        matflowApi.dashboard({ plantCode: selectedPlantParam }),
        matflowApi.engineeringKpis({ plantCode: selectedPlantParam }),
      ]);
      setData(dashboard?.data || null); setKpis(engineering?.data || null);
    } catch (e) { setError(readMatFlowError(e, "Unable to load MatFlow dashboard.")); }
    finally { setLoading(false); }
  }, [selectedPlantParam]);

  useEffect(() => { load(); }, [load]);
  if (loading) return <LoadingBlock />;

  const files = Number(data?.totalProductionFiles || 0);
  const released = Number(data?.productionReleased || 0);
  const releasePct = files ? Math.round(released * 100 / files) : 0;

  return (
    <Box sx={pageSx}>
      <PageHero badge="LIVE CONTROL" title="MatFlow — Production Control" subtitle="Designer → PPC → Engineering → Production Release. Downstream factory execution stays intentionally open until the process is validated." actions={<Button startIcon={<RefreshOutlinedIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>} />
      {error && <ErrorBox>{error}</ErrorBox>}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", lg: "repeat(5,1fr)" }, gap: 1.2 }}>
        <SummaryCard label="Production Files" value={files} helper="One file / one digital identity" />
        <SummaryCard label="Healthy" value={data?.green || 0} helper="No active control blocker" tone="success" />
        <SummaryCard label="Controlled Risk" value={data?.amber || 0} helper="Can proceed with limitations" tone="warning" />
        <SummaryCard label="Blocked" value={data?.red || 0} helper="Critical action required" tone="danger" />
        <SummaryCard label="Released" value={released} helper="Validated PPC Gate 2 handoff" tone="info" />
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "1.4fr 1fr" }, gap: 1.4 }}>
        <Card sx={{ ...panelSx, p: 2 }}>
          <Typography sx={{ fontWeight: 950, fontSize: 16, color: "var(--mf-text)" }}>Control Tower</Typography>
          <Typography sx={{ mt: .3, color: "var(--mf-text-muted)", fontSize: 11 }}>Where each Production File currently sits.</Typography>
          <Box sx={{ mt: 1.6, display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(5,1fr)" }, gap: 1 }}>
            {[ ["Design", data?.design], ["PPC Gate 1", data?.ppcGate1], ["Engineering", data?.engineering], ["PPC Gate 2", data?.ppcGate2], ["Released", data?.productionReleased] ].map(([label,value]) => (
              <Box key={label} sx={{ p: 1.4, border: "1px solid var(--mf-border)", borderRadius: 2, background: "var(--mf-surface)" }}>
                <Typography sx={{ fontSize: 10, fontWeight: 850, color: "var(--mf-text-muted)" }}>{label}</Typography>
                <Typography sx={{ mt: .4, fontSize: 24, fontWeight: 950, color: "var(--mf-text)" }}>{value || 0}</Typography>
              </Box>
            ))}
          </Box>
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: .65 }}><Typography sx={{ fontSize: 11, fontWeight: 850, color: "var(--mf-text-secondary)" }}>Overall files reaching Production Release</Typography><Typography sx={{ fontSize: 11, fontWeight: 900, color: "var(--mf-text)" }}>{releasePct}%</Typography></Box>
            <LinearProgress variant="determinate" value={releasePct} sx={{ height: 8, borderRadius: 5 }} />
          </Box>
        </Card>

        <Card sx={{ ...panelSx, p: 2 }}>
          <Typography sx={{ fontWeight: 950, fontSize: 16, color: "var(--mf-text)" }}>Engineering Pulse</Typography>
          <Box sx={{ mt: 1.3, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
            <SummaryCard label="In Engineering" value={kpis?.filesInEngineering || 0} />
            <SummaryCard label="Open Queries" value={kpis?.openQueries || 0} tone={kpis?.openQueries ? "danger" : "success"} />
            <SummaryCard label="FTR" value={`${Number(kpis?.firstTimeRightPercent || 0).toFixed(1)}%`} helper="Released without recorded revision/release return" />
            <SummaryCard label="Pending Tasks" value={kpis?.pendingTasks || 0} tone={kpis?.pendingTasks ? "warning" : "success"} />
          </Box>
        </Card>
      </Box>

      <Card sx={{ ...panelSx, p: 0, overflow: "hidden" }}>
        <Box sx={{ p: 1.8, borderBottom: "1px solid var(--mf-border)" }}>
          <Typography sx={{ fontWeight: 950, color: "var(--mf-text)" }}>Files needing attention</Typography>
          <Typography sx={{ mt: .25, fontSize: 11, color: "var(--mf-text-muted)" }}>Management should work the exceptions, not manually move routine files.</Typography>
        </Box>
        {(data?.attentionFiles || []).length === 0 ? <Box sx={{ p: 3, textAlign: "center", color: "var(--mf-text-muted)" }}>No active control exceptions.</Box> : (data?.attentionFiles || []).map((row) => (
          <Box key={row.productionFileId} onClick={() => navigate(`/matflow/work?fileId=${row.productionFileId}`)} sx={{ px: 1.8, py: 1.25, display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.1fr 1fr .8fr .8fr 1.4fr" }, gap: 1, alignItems: "center", borderBottom: "1px solid var(--mf-border)", cursor: "pointer", "&:hover": { background: "var(--mf-hover)" } }}>
            <Box><Typography sx={{ fontSize: 12, fontWeight: 950, color: "var(--mf-text)" }}>{row.productionFileNo}</Typography><Typography sx={{ fontSize: 10, color: "var(--mf-text-muted)" }}>{row.projectCode} · {row.productName}</Typography></Box>
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: "var(--mf-text-secondary)" }}>{String(row.stage || "").replaceAll("_", " ")}</Typography>
            <Chip label={row.health} size="small" sx={chipSx(row.health)} />
            <Typography sx={{ fontSize: 11, color: "var(--mf-text-secondary)" }}>{row.currentOwner || "—"}</Typography>
            <Typography sx={{ fontSize: 10.5, color: "var(--mf-text-muted)" }}>{(row.blockers || []).join(" · ") || "No detail"}</Typography>
          </Box>
        ))}
      </Card>
    </Box>
  );
}
