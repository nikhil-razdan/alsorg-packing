import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Button, Card, TextField, Typography } from "@mui/material";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import { useNavigate } from "react-router-dom";
import { matflowApi, readMatFlowError } from "../api/matflowApi";
import {
  EmptyState,
  ErrorBox,
  LoadingBlock,
  MatFlowProductIdentity,
  MatFlowStatusChip,
  PageHero,
  fieldSx,
  pageSx,
  panelSx,
  readable,
  secondaryBtnSx,
  useMatFlow,
} from "../matflowUi";

export function MatFlowReleasePage() {
  const { selectedPlantParam } = useMatFlow();
  const nav = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
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
        subtitle="PPC Gate 2 and released Products, identified by Product Name + PD No."
        actions={(
          <Button startIcon={<RefreshOutlinedIcon />} onClick={load} sx={secondaryBtnSx}>
            Refresh
          </Button>
        )}
      />

      {error && <ErrorBox>{error}</ErrorBox>}

      <Card sx={{ ...panelSx, p: 1.25 }}>
        <TextField
          fullWidth
          size="small"
          label="Search Product Name / PD No. / File / Drawing"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          sx={fieldSx}
        />
      </Card>

      <Card sx={{ ...panelSx, p: 0, overflow: "hidden" }}>
        {!filteredRows.length ? (
          <EmptyState>No files at PPC Gate 2 or Production Released match the current search.</EmptyState>
        ) : filteredRows.map((row) => (
          <Box
            key={row.id || row.productionFileId}
            sx={{
              px: 1.5,
              py: 1.2,
              borderBottom: "1px solid var(--mf-border)",
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1.45fr .8fr .9fr .8fr 1.25fr auto" },
              gap: 1,
              alignItems: "center",
              "&:last-child": { borderBottom: 0 },
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
            <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: "var(--mf-text-secondary)" }}>
              {readable(row.stage)}
            </Typography>
            <Typography sx={{ fontSize: 10.5, color: "var(--mf-text-secondary)" }}>
              {row.currentOwner || "—"}
            </Typography>
            <MatFlowStatusChip status={row.releaseHealth} />
            <Typography sx={{ fontSize: 10, color: "var(--mf-text-muted)" }}>
              {row.stage === "PRODUCTION_RELEASED" ? "Future workflow: not configured" : "Awaiting PPC Gate 2"}
            </Typography>
            <Button
              size="small"
              endIcon={<OpenInNewOutlinedIcon />}
              onClick={() => nav(`/matflow/work?fileId=${row.id || row.productionFileId}`)}
              sx={secondaryBtnSx}
            >
              Open
            </Button>
          </Box>
        ))}
      </Card>
    </Box>
  );
}
