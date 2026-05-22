import { createTheme } from "@mui/material/styles";

const theme = createTheme({
	palette: {
	  primary: {
	    main: "#4f46e5", // modern indigo
	  },
	  secondary: {
	    main: "#06b6d4",
	  },
	  background: {
	    default: "#eef2f7",
	    paper: "#ffffff",
	  },
	  text: {
	    primary: "#1f2937",
	    secondary: "#6b7280",
	  },
	},
  typography: {
    fontFamily: ["Roboto", "Helvetica", "Arial", "sans-serif"].join(","),
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
