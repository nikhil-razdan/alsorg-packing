import { useCallback, useEffect, useState } from "react";
import { Box, Button, Card, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import { matflowApi, readMatFlowError } from "../api/matflowApi";
import {
  ErrorBox,
  LoadingBlock,
  PageHero,
  EmptyState,
  MATFLOW_LIST_CARD_OPTIONS,
  MatFlowViewToggle,
  MatFlowListGrid,
  pageSx,
  panelSx,
  fieldSx,
  primaryBtnSx,
  secondaryBtnSx,
  dialogPaperSx,
  dialogTitleSx,
  dialogContentSx,
  dialogActionsSx,
  useMatFlowViewMode,
} from "../matflowUi";

const blank = { materialCode: "", materialName: "", category: "", specification: "", uom: "NOS", active: true };

export function MatFlowMaterialsPage() {
  const [viewMode, setViewMode] = useMatFlowViewMode("materials", "LIST");
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await matflowApi.listMaterials({ search, active: true });
      setRows(response.data || []);
    } catch (requestError) {
      setError(readMatFlowError(requestError));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    try {
      await matflowApi.createMaterial(form);
      setOpen(false);
      setForm(blank);
      await load();
    } catch (requestError) {
      setError(readMatFlowError(requestError));
    }
  };

  if (loading && !rows.length) return <LoadingBlock />;

  return (
    <Box sx={pageSx}>
      <PageHero
        badge="ENGINEERING MASTER"
        title="Materials"
        subtitle="Lean engineering material master for BOM preparation. Inventory/procurement movement is intentionally outside this rebuild."
        actions={(
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            <MatFlowViewToggle value={viewMode} onChange={setViewMode} options={MATFLOW_LIST_CARD_OPTIONS} />
            <Button startIcon={<RefreshOutlinedIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>
            <Button startIcon={<AddOutlinedIcon />} onClick={() => setOpen(true)} sx={primaryBtnSx}>New Material</Button>
          </Box>
        )}
      />

      {error && <ErrorBox>{error}</ErrorBox>}

      <Card sx={{ ...panelSx, p: 1.4 }}>
        <TextField fullWidth size="small" label="Search code, material or category" value={search} onChange={(e) => setSearch(e.target.value)} sx={fieldSx} />
      </Card>

      {!rows.length ? (
        <Card sx={{ ...panelSx, p: 0 }}><EmptyState>No materials found.</EmptyState></Card>
      ) : viewMode === "CARD" ? (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))", xl: "repeat(3,minmax(0,1fr))" }, gap: 1 }}>
          {rows.map((row) => (
            <Card key={row.id} sx={{ ...panelSx, p: 1.35, display: "grid", gap: 0.8, boxShadow: "none" }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "flex-start" }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 9.2, fontWeight: 900, color: "var(--mf-primary-text)", letterSpacing: ".04em" }}>{row.materialCode}</Typography>
                  <Typography sx={{ mt: 0.15, fontSize: 13, fontWeight: 950, color: "var(--mf-text)" }}>{row.materialName}</Typography>
                </Box>
                <Typography sx={{ fontSize: 9.5, fontWeight: 850, color: "var(--mf-text-secondary)" }}>{row.uom}</Typography>
              </Box>
              <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0,.75fr) minmax(0,1.25fr)", gap: 0.75 }}>
                <Box>
                  <Typography sx={{ fontSize: 8.5, color: "var(--mf-text-muted)" }}>CATEGORY</Typography>
                  <Typography sx={{ mt: 0.1, fontSize: 10.2, fontWeight: 800, color: "var(--mf-text-secondary)" }}>{row.category || "—"}</Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 8.5, color: "var(--mf-text-muted)" }}>SPECIFICATION</Typography>
                  <Typography sx={{ mt: 0.1, fontSize: 10.2, color: "var(--mf-text-secondary)" }}>{row.specification || "—"}</Typography>
                </Box>
              </Box>
            </Card>
          ))}
        </Box>
      ) : (
        <MatFlowListGrid
          columns={[
            { key: "code", label: "Material Code", width: "210px" },
            { key: "name", label: "Material", width: "minmax(300px,1.4fr)" },
            { key: "category", label: "Category", width: "170px" },
            { key: "specification", label: "Specification", width: "minmax(300px,1.5fr)" },
            { key: "uom", label: "UOM", width: "100px" },
          ]}
          rows={rows}
          minWidth={1080}
          getRowKey={(row) => row.id}
          renderCell={(row, column) => {
            if (column.key === "code") return <Typography sx={{ fontSize: 10.3, fontWeight: 950, color: "var(--mf-text)" }}>{row.materialCode || "—"}</Typography>;
            if (column.key === "name") return <Typography sx={{ fontSize: 10.6, fontWeight: 900, color: "var(--mf-text)" }}>{row.materialName || "Unnamed material"}</Typography>;
            if (column.key === "category") return <Typography sx={{ fontSize: 9.8, fontWeight: 800, color: "var(--mf-text-secondary)" }}>{row.category || "—"}</Typography>;
            if (column.key === "specification") return <Typography noWrap sx={{ fontSize: 9.7, color: "var(--mf-text-secondary)" }}>{row.specification || "—"}</Typography>;
            return <Typography sx={{ fontSize: 10, fontWeight: 900, color: "var(--mf-text)" }}>{row.uom || "—"}</Typography>;
          }}
        />
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle sx={dialogTitleSx}>Create Material</DialogTitle>
        <DialogContent sx={dialogContentSx}>
          <Box sx={{ pt: .5, display: "grid", gap: 1.2 }}>
            <TextField label="Material Code" value={form.materialCode} onChange={(e) => setForm({ ...form, materialCode: e.target.value })} sx={fieldSx} />
            <TextField label="Material Name" value={form.materialName} onChange={(e) => setForm({ ...form, materialName: e.target.value })} sx={fieldSx} />
            <TextField label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} sx={fieldSx} />
            <TextField label="Specification" multiline minRows={2} value={form.specification} onChange={(e) => setForm({ ...form, specification: e.target.value })} sx={fieldSx} />
            <TextField label="UOM" value={form.uom} onChange={(e) => setForm({ ...form, uom: e.target.value })} sx={fieldSx} />
          </Box>
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button onClick={() => setOpen(false)} sx={secondaryBtnSx}>Cancel</Button>
          <Button onClick={save} sx={primaryBtnSx}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
