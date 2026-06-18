import React from "react";
import { useNavigate } from "react-router-dom";
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
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { hasModuleAccess } from "../utils/moduleAccess";

export default function ModuleHub() {
  const navigate = useNavigate();

  const username = localStorage.getItem("username") || "User";

  const cards = [
    {
      key: "PACKFLOW",
      title: "PackFlow",
      subtitle:
        "Inventory, packing, warehouse, dispatch, logistics and operational tracking.",
      icon: <Inventory2OutlinedIcon fontSize="large" />,
      path: "/packflow/dashboard",
      tags: ["Inventory", "Warehouse", "Dispatch", "Logistics"],
      visible: hasModuleAccess("PACKFLOW"),
    },
    {
      key: "BOMFLOW",
      title: "BOMFlow",
      subtitle:
        "Product BOM creation, material costing, labour costing, rate master and cost control.",
      icon: <AccountTreeOutlinedIcon fontSize="large" />,
      path: "/bomflow/dashboard",
      tags: ["Product Master", "BOM Builder", "Rate Master", "Costing"],
      visible: hasModuleAccess("BOMFLOW"),
    },
  ].filter((card) => card.visible);

  const logout = () => {
    localStorage.clear();
    navigate("/login", { replace: true });
  };

  return (
    <Box sx={pageSx}>
      <Box sx={containerSx}>
        <Box sx={headerSx}>
          <Box>
            <Typography variant="h3" sx={titleSx}>
              Alsorg Operations Suite
            </Typography>

            <Typography sx={subtitleSx}>
              Welcome, {username}. Select the module you want to open.
            </Typography>
          </Box>

          <Button variant="outlined" onClick={logout} sx={logoutBtnSx}>
            Logout
          </Button>
        </Box>

        {cards.length === 0 ? (
          <Card sx={emptyCardSx}>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              No module access assigned
            </Typography>

            <Typography sx={{ mt: 1, color: "#64748b" }}>
              Please contact Admin to assign PackFlow or BOMFlow access.
            </Typography>
          </Card>
        ) : (
          <Grid container spacing={3}>
            {cards.map((card) => (
              <Grid item xs={12} md={6} key={card.key}>
                <Card sx={moduleCardSx}>
                  <CardContent sx={{ p: 4 }}>
                    <Box sx={iconBoxSx}>{card.icon}</Box>

                    <Typography variant="h4" sx={cardTitleSx}>
                      {card.title}
                    </Typography>

                    <Typography sx={cardSubtitleSx}>
                      {card.subtitle}
                    </Typography>

                    <Box sx={tagWrapSx}>
                      {card.tags.map((tag) => (
                        <Chip key={tag} label={tag} size="small" />
                      ))}
                    </Box>

                    <Button
                      variant="contained"
                      size="large"
                      endIcon={<ArrowForwardIcon />}
                      onClick={() => navigate(card.path)}
                      sx={openBtnSx}
                    >
                      Open {card.title}
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    </Box>
  );
}

const pageSx = {
  minHeight: "100vh",
  p: { xs: 2, md: 4 },
  background:
    "radial-gradient(circle at top left, rgba(37,99,235,.14), transparent 28%), linear-gradient(135deg, #f8fafc 0%, #eef2ff 48%, #f8fafc 100%)",
};

const containerSx = {
  maxWidth: 1200,
  mx: "auto",
};

const headerSx = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 2,
  mb: 4,
};

const titleSx = {
  fontWeight: 950,
  letterSpacing: "-0.045em",
  color: "#0f172a",
};

const subtitleSx = {
  mt: 1,
  color: "#64748b",
  fontSize: 18,
};

const logoutBtnSx = {
  borderRadius: 999,
  px: 3,
  fontWeight: 800,
  textTransform: "none",
};

const emptyCardSx = {
  borderRadius: 4,
  p: 4,
  border: "1px solid rgba(148,163,184,.28)",
};

const moduleCardSx = {
  height: "100%",
  borderRadius: 5,
  border: "1px solid rgba(148,163,184,.28)",
  boxShadow: "0 24px 80px rgba(15,23,42,.10)",
  transition: "all .25s ease",
  "&:hover": {
    transform: "translateY(-4px)",
    boxShadow: "0 30px 90px rgba(15,23,42,.16)",
  },
};

const iconBoxSx = {
  width: 68,
  height: 68,
  borderRadius: 4,
  display: "grid",
  placeItems: "center",
  mb: 2.5,
  color: "#1d4ed8",
  background:
    "linear-gradient(135deg, rgba(37,99,235,.12), rgba(79,70,229,.18))",
};

const cardTitleSx = {
  fontWeight: 950,
  color: "#111827",
  mb: 1,
};

const cardSubtitleSx = {
  color: "#64748b",
  lineHeight: 1.7,
  minHeight: 58,
  mb: 2,
};

const tagWrapSx = {
  display: "flex",
  flexWrap: "wrap",
  gap: 1,
  mb: 3,
};

const openBtnSx = {
  borderRadius: 999,
  px: 3,
  py: 1.2,
  fontWeight: 850,
  textTransform: "none",
};