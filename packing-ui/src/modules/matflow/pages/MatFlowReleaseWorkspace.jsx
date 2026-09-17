import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Button, Card, TextField, Typography } from "@mui/material";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import { useNavigate } from "react-router-dom";
import { matflowApi, readMatFlowError } from "../api/matflowApi";
import {
  EmptyState,
  ErrorBox,
  LoadingBlock,
  MatFlowProductIdentity,
  PageHero,
  getMatFlowDepartmentAccess,
  fieldSx,
  pageSx,
  panelSx,
  readable,
  secondaryBtnSx,
  useMatFlow,
} from "../matflowUi";

const releaseAccent = (row) => {
  if (Number(row?.openQueries || 0) > 0) return "var(--mf-warning-text)";
  if (String(row?.stage || "").toUpperCase() === "PRODUCTION_RELEASED") return "var(--mf-success-text)";
  return "var(--mf-primary)";
};

export function MatFlowReleasePage() {
  const { selectedPlantParam, roles } = useMatFlow();
  const nav = useNavigate();
  const access = useMemo(() => getMatFlowDepartmentAccess(roles), [roles]);
  const canOpenWork = access.design || access.engineering || access.ppc || access.management;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      /*
       * Keep the release boundary exactly where it already is. Files with an open
       * Design ↔ Engineering issue stay in ENGINEERING_QUERY and therefore do not
       * appear here until the existing gate rules allow them back to PPC Gate 2.
       */
      const [ready, released] = await Promise.all([
        matflowApi.listProductionFiles({ stage: "PPC_GATE_2", plantCode: selectedPlantParam }),
        matflowApi.listProductionFiles({ stage: "PRODUCTION_RELEASED", plantCode: selectedPlantParam }),
      ]);
      setRows([...(ready.data || []), ...(released.data || [])]);
    } catch (requestError) {
      setError(readMatFlowError(requestError));
    } finally {
      setLoading(false);
    }
  }, [selectedPlantParam]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredRows = useMemo(() => {
    const term = String(search || "").trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => [
      row.productName,
      row.projectCode,
      row.productionFileNo,
      row.projectName,
      row.clientName,
      row.drawingNo,
      row.currentOwner,
    ].some((value) => String(value || "").toLowerCase().includes(term)));
  }, [rows, search]);

  if (loading) return <LoadingBlock />;

  return (
    <Box sx={{ ...pageSx, display: "grid", gap: 1.1 }}>
      <PageHero
        badge="STABLE HANDOFF BOUNDARY"
        title="Production Release"
        subtitle="PPC Gate 2 and released Products. Issue conversations remain visible without changing PPC authority."
        actions={(
          <Button startIcon={<RefreshOutlinedIcon />} onClick={load} sx={secondaryBtnSx}>
            Refresh
          </Button>
        )}
      />

      {error && <ErrorBox>{error}</ErrorBox>}

      <Card sx={{ ...panelSx, p: 1.1, boxShadow: "none" }}>
        <TextField
          fullWidth
          size="small"
          label="Search Product Name / PD No. / Client / File / Drawing"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          sx={fieldSx}
        />
      </Card>

      <Card sx={{ ...panelSx, p: 0, overflow: "hidden", boxShadow: "none" }}>
        {!filteredRows.length ? (
          <EmptyState>No files at PPC Gate 2 or Production Released match the current search.</EmptyState>
        ) : filteredRows.map((row) => {
          const fileId = row.id || row.productionFileId;
          const accent = releaseAccent(row);
          return (
            <Box
              key={fileId}
              sx={{
                px: 1.35,
                py: 1,
                borderBottom: "1px solid var(--mf-border)",
                borderLeft: `3px solid ${accent}`,
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1.55fr .75fr .9fr minmax(150px,1fr) auto" },
                gap: 0.9,
                alignItems: "center",
                background: "var(--mf-panel-solid)",
                "&:last-child": { borderBottom: 0 },
                "&:hover": { background: "var(--mf-table-hover)" },
              }}
            >
              <MatFlowProductIdentity
                productName={row.productName}
                projectCode={row.projectCode}
                productionFileNo={row.productionFileNo}
                drawingNo={row.drawingNo}
                projectName={row.projectName}
                showProjectName
                size="md"
              />

              <Box>
                <Typography sx={{ fontSize: 9.1, color: "var(--mf-text-muted)", fontWeight: 800 }}>STAGE</Typography>
                <Typography sx={{ mt: 0.15, fontSize: 10.5, fontWeight: 850, color: row.stage === "PRODUCTION_RELEASED" ? "var(--mf-success-text)" : "var(--mf-text-secondary)" }}>
                  {readable(row.stage)}
                </Typography>
              </Box>

              <Box>
                <Typography sx={{ fontSize: 9.1, color: "var(--mf-text-muted)", fontWeight: 800 }}>PPC / OWNER</Typography>
                <Typography sx={{ mt: 0.15, fontSize: 10.3, color: "var(--mf-text-secondary)" }}>
                  {row.ppcOwner || row.currentOwner || "—"}
                </Typography>
              </Box>

              <Box>
                <Typography sx={{ fontSize: 9.1, color: "var(--mf-text-muted)", fontWeight: 800 }}>ISSUE CHAT</Typography>
                <Typography sx={{ mt: 0.15, fontSize: 9.7, color: Number(row.openQueries || 0) > 0 ? "var(--mf-warning-text)" : "var(--mf-text-muted)", fontWeight: Number(row.openQueries || 0) > 0 ? 850 : 650 }}>
                  {Number(row.openQueries || 0) > 0
                    ? `${row.openQueries} open issue${Number(row.openQueries) === 1 ? "" : "s"}`
                    : "Conversation history available"}
                </Typography>
              </Box>

              <Box sx={{ display: "flex", gap: 0.55, justifyContent: { xs: "flex-start", md: "flex-end" }, flexWrap: "wrap" }}>
                {canOpenWork && (
                  <Button
                    size="small"
                    startIcon={<ForumOutlinedIcon />}
                    onClick={() => nav(`/matflow/work?fileId=${fileId}&tab=queries`)}
                    sx={secondaryBtnSx}
                  >
                    Issues
                  </Button>
                )}
                {canOpenWork && (
                  <Button
                    size="small"
                    endIcon={<OpenInNewOutlinedIcon />}
                    onClick={() => nav(`/matflow/work?fileId=${fileId}`)}
                    sx={secondaryBtnSx}
                  >
                    Open
                  </Button>
                )}
              </Box>
            </Box>
          );
        })}
      </Card>
    </Box>
  );
}
