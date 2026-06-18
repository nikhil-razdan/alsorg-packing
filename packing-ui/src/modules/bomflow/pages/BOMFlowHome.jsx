import React from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Typography,
} from "@mui/material";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import PriceChangeOutlinedIcon from "@mui/icons-material/PriceChangeOutlined";
import EngineeringOutlinedIcon from "@mui/icons-material/EngineeringOutlined";
import CalculateOutlinedIcon from "@mui/icons-material/CalculateOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { useNavigate } from "react-router-dom";

const modules = [
  {
    title: "Product Master",
    subtitle:
      "Create product details, drawing number, collection, size, category and product photo.",
    icon: <Inventory2OutlinedIcon />,
    status: "Ready to Start",
    action: "Create Product",
    path: "/bomflow/products",
    enabled: false,
  },
  {
    title: "BOM Builder",
    subtitle:
      "Create section-wise BOM for metal, wood, hardware, stone, glass, upholstery, paint and labour.",
    icon: <RuleOutlinedIcon />,
    status: "Planned",
    action: "Open BOM Builder",
    path: "/bomflow/bom-builder",
    enabled: false,
  },
  {
    title: "Rate Master",
    subtitle:
      "Maintain material rates, vendor rates, purchase register rates, bill copies and effective dates.",
    icon: <PriceChangeOutlinedIcon />,
    status: "Planned",
    action: "Open Rate Master",
    path: "/bomflow/rate-master",
    enabled: false,
  },
  {
    title: "Labour Master",
    subtitle:
      "Maintain process-wise labour rates, departments, working time and labour calculation rules.",
    icon: <EngineeringOutlinedIcon />,
    status: "Planned",
    action: "Open Labour Master",
    path: "/bomflow/labour-master",
    enabled: false,
  },
  {
    title: "Costing Engine",
    subtitle:
      "Calculate direct material, direct labour, overheads, prime cost and final product costing.",
    icon: <CalculateOutlinedIcon />,
    status: "Planned",
    action: "View Costing",
    path: "/bomflow/costing",
    enabled: false,
  },
  {
    title: "Reports",
    subtitle:
      "Export Price Sheet, Direct Material, Direct Labour, Change Log, PDF approval and summaries.",
    icon: <AssessmentOutlinedIcon />,
    status: "Planned",
    action: "View Reports",
    path: "/bomflow/reports",
    enabled: false,
  },
];

export default function BOMFlowHome() {
  const navigate = useNavigate();

  return (
    <Box sx={pageSx}>
      <Box sx={containerSx}>
        <Box sx={heroSx}>
          <Chip label="BOMFlow Module" sx={heroBadgeSx} />

          <Typography variant="h3" sx={heroTitleSx}>
            BOMFlow
          </Typography>

          <Typography sx={heroSubtitleSx}>
            Product BOM, material costing, labour costing, rate master,
            workflow control, version history and Excel/PDF export.
          </Typography>

          <Box sx={heroChipWrapSx}>
            <Chip label="Product Master" sx={heroChipSx} />
            <Chip label="BOM Builder" sx={heroChipSx} />
            <Chip label="Rate Master" sx={heroChipSx} />
            <Chip label="Costing Engine" sx={heroChipSx} />
            <Chip label="Reports" sx={heroChipSx} />
          </Box>
        </Box>

        <Grid container spacing={2.5}>
          {modules.map((item) => (
            <Grid item xs={12} sm={6} lg={4} key={item.title}>
              <Card sx={moduleCardSx(item.enabled)}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={cardTopSx}>
                    <Box sx={moduleIconSx}>{item.icon}</Box>

                    <Chip
                      size="small"
                      label={item.status}
                      color={item.enabled ? "success" : "default"}
                      variant={item.enabled ? "filled" : "outlined"}
                    />
                  </Box>

                  <Typography variant="h6" sx={moduleTitleSx}>
                    {item.title}
                  </Typography>

                  <Typography sx={moduleSubtitleSx}>
                    {item.subtitle}
                  </Typography>

                  <Button
                    fullWidth
                    variant={item.enabled ? "contained" : "outlined"}
                    disabled={!item.enabled}
                    endIcon={<ArrowForwardIcon />}
                    onClick={() => navigate(item.path)}
                    sx={moduleBtnSx}
                  >
                    {item.enabled ? item.action : "Coming Soon"}
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Box>
  );
}

const pageSx = {
  minHeight: "100vh",
  background:
    "linear-gradient(135deg, #f8fafc 0%, #eef2ff 45%, #f9fafb 100%)",
  p: { xs: 2, md: 4 },
};

const containerSx = {
  maxWidth: 1300,
  mx: "auto",
};

const heroSx = {
  mb: 4,
  p: { xs: 3, md: 4 },
  borderRadius: 4,
  background:
    "linear-gradient(135deg, #111827 0%, #1e3a8a 55%, #312e81 100%)",
  color: "white",
  boxShadow: "0 24px 70px rgba(15,23,42,.22)",
};

const heroBadgeSx = {
  mb: 2,
  color: "white",
  borderColor: "rgba(255,255,255,.35)",
  background: "rgba(255,255,255,.12)",
};

const heroTitleSx = {
  fontWeight: 950,
  letterSpacing: "-0.045em",
  mb: 1,
};

const heroSubtitleSx = {
  fontSize: { xs: 16, md: 19 },
  maxWidth: 900,
  color: "rgba(255,255,255,.84)",
  lineHeight: 1.7,
};

const heroChipWrapSx = {
  mt: 3,
  display: "flex",
  gap: 1.2,
  flexWrap: "wrap",
};

const heroChipSx = {
  color: "white",
  border: "1px solid rgba(255,255,255,.25)",
  background: "rgba(255,255,255,.12)",
  fontWeight: 700,
};

const moduleCardSx = (enabled) => ({
  height: "100%",
  borderRadius: 4,
  border: "1px solid rgba(148,163,184,.28)",
  boxShadow: "0 18px 55px rgba(15,23,42,.08)",
  overflow: "hidden",
  opacity: enabled ? 1 : 0.78,
});

const cardTopSx = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 2,
  mb: 2,
};

const moduleIconSx = {
  width: 52,
  height: 52,
  borderRadius: 3,
  display: "grid",
  placeItems: "center",
  background:
    "linear-gradient(135deg, rgba(37,99,235,.12), rgba(79,70,229,.16))",
  color: "#1d4ed8",
};

const moduleTitleSx = {
  fontWeight: 850,
  color: "#111827",
  mb: 1,
};

const moduleSubtitleSx = {
  color: "#64748b",
  lineHeight: 1.65,
  minHeight: 78,
  mb: 2.5,
};

const moduleBtnSx = {
  borderRadius: 999,
  py: 1.15,
  fontWeight: 800,
  textTransform: "none",
};