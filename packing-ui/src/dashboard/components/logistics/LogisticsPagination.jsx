import { useEffect } from "react";

import {
  Box,
  Button,
  MenuItem,
  TextField,
} from "@mui/material";

function LogisticsPagination({
  pageNo,
  setPageNo,
  pageSize,
  setPageSize,
  totalItems,
}) {
  const totalPages = Math.max(
    1,
    Math.ceil(totalItems / pageSize)
  );

  useEffect(() => {
    if (pageNo > totalPages) {
      setPageNo(totalPages);
    }
  }, [pageNo, totalPages, setPageNo]);

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        mt: 4,
        gap: 2,
        flexWrap: "wrap",
      }}
    >
      {/* LEFT SIDE */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
        }}
      >
        <Box
          sx={{
            color: "#94a3b8",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          Show
        </Box>

        <TextField
          select
          size="small"
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPageNo(1);
          }}
          sx={{
            width: 110,

            "& .MuiOutlinedInput-root": {
              height: 36,
              borderRadius: "12px",
              background:
                "rgba(255,255,255,.04)",
              color: "#fff",

              "& fieldset": {
                borderColor:
                  "rgba(255,255,255,.08)",
              },

              "&:hover fieldset": {
                borderColor:
                  "rgba(59,130,246,.35)",
              },
            },

            "& .MuiSvgIcon-root": {
              color: "#94a3b8",
            },
          }}
        >
          <MenuItem value={25}>25</MenuItem>
          <MenuItem value={50}>50</MenuItem>
        </TextField>

        <Box
          sx={{
            color: "#94a3b8",
            fontSize: 14,
          }}
        >
          items per page
        </Box>
      </Box>

      {/* CENTER PAGINATION */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 3,
        }}
      >
        <Button
          disabled={pageNo === 1}
          onClick={() =>
            setPageNo((p) => Math.max(1, p - 1))
          }
          sx={{
            minWidth: 100,
            height: 30,
            borderRadius: "12px",
            background:
              "linear-gradient(180deg,#1e293b,#0f172a)",
            color: "#fff",
            border:
              "1px solid rgba(255,255,255,.08)",

            fontSize: 10,
            fontWeight: 500,

            "&:disabled": {
              opacity: 0.45,
              color: "#94a3b8",
            },
          }}
        >
          ◀ Previous
        </Button>

        <Box
          sx={{
            px: 2.5,
            height: 30,
            display: "flex",
            alignItems: "center",
            borderRadius: "12px",
            background:
              "linear-gradient(180deg,#0f172a,#111827)",
            color: "#cbd5e1",
            border:
              "1px solid rgba(255,255,255,.06)",

            fontSize: 10,
            fontWeight: 500,
          }}
        >
          Page

          <Box
            component="span"
            sx={{
              mx: 1,
              color: "#60a5fa",
            }}
          >
            {pageNo}
          </Box>

          of {totalPages}
        </Box>

        <Button
          disabled={pageNo === totalPages}
          onClick={() =>
            setPageNo((p) =>
              Math.min(totalPages, p + 1)
            )
          }
          sx={{
            minWidth: 100,
            height: 30,
            borderRadius: "12px",
            background:
              "linear-gradient(180deg,#2563eb,#1d4ed8)",
            color: "#fff",

            fontSize: 10,
            fontWeight: 500,

            "&:disabled": {
              opacity: 0.45,
              color: "#cbd5e1",
            },
          }}
        >
          Next ▶
        </Button>
      </Box>

      {/* RIGHT SIDE COUNT */}
      <Box
        sx={{
          color: "#94a3b8",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        Total: {totalItems}
      </Box>
    </Box>
  );
}

export default LogisticsPagination;