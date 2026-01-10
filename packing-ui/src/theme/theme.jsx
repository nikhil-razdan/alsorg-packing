import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: {
      main: "#2F4F4F", // Alsorg charcoal
    },
    secondary: {
      main: "#A9A9A9",
    },
    background: {
      default: "#F4F6F8",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#333333",
      secondary: "#666666",
    },
  },
  typography: {
    fontFamily: `"Roboto", "Helvetica", "Arial", sans-serif`,
    h2: {
      fontWeight: 600,
      color: "#2F4F4F",
    },
    h3: {
      fontWeight: 600,
      color: "#2F4F4F",
    },
  },
});

export default theme;
