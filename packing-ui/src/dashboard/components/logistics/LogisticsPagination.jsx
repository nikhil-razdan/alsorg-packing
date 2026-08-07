import React from "react";

import "./logisticsScrollbars.css";

function buildPageItems(
  currentPage,
  totalPages,
  siblingCount = 1
) {
  if (totalPages <= 7) {
    return Array.from(
      { length: totalPages },
      (_, index) => index + 1
    );
  }

  const pages = new Set([
    1,
    totalPages,
    currentPage,
  ]);

  for (
    let offset = 1;
    offset <= siblingCount;
    offset += 1
  ) {
    pages.add(currentPage - offset);
    pages.add(currentPage + offset);
  }

  const validPages = Array.from(pages)
    .filter(
      (page) =>
        page >= 1 &&
        page <= totalPages
    )
    .sort((a, b) => a - b);

  const result = [];

  validPages.forEach((page, index) => {
    const previous =
      validPages[index - 1];

    if (
      index > 0 &&
      page - previous > 1
    ) {
      result.push(
        `ellipsis-${previous}-${page}`
      );
    }

    result.push(page);
  });

  return result;
}

function LogisticsPagination({
  pageNo = 1,
  setPageNo,
  pageSize = 25,
  setPageSize,
  totalItems = 0,
  label = "records",
  pageSizeOptions = [
    10,
    25,
    50,
    100,
  ],
  compact = false,
  siblingCount = 1,
}) {
  const safeTotalItems =
    Math.max(
      0,
      Number(totalItems || 0)
    );

  const safePageSize =
    Math.max(
      1,
      Number(pageSize || 1)
    );

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        safeTotalItems /
        safePageSize
      )
    );

  const currentPage =
    Math.min(
      totalPages,
      Math.max(
        1,
        Number(pageNo || 1)
      )
    );

  if (safeTotalItems === 0) {
    return null;
  }

  const start =
    (
      currentPage - 1
    ) *
    safePageSize +
    1;

  const end =
    Math.min(
      currentPage *
      safePageSize,
      safeTotalItems
    );

  const pageItems =
    buildPageItems(
      currentPage,
      totalPages,
      siblingCount
    );

  const goToPage = (
    nextPage
  ) => {
    if (
      typeof setPageNo !==
      "function"
    ) {
      return;
    }

    setPageNo(
      Math.min(
        totalPages,
        Math.max(
          1,
          Number(
            nextPage || 1
          )
        )
      )
    );
  };

  const changePageSize = (
    event
  ) => {
    const nextSize =
      Number(
        event.target.value
      );

    if (
      typeof setPageSize ===
      "function" &&
      Number.isFinite(
        nextSize
      ) &&
      nextSize > 0
    ) {
      setPageSize(nextSize);
    }

    if (
      typeof setPageNo ===
      "function"
    ) {
      setPageNo(1);
    }
  };

  return (
    <div
      className="logistics-scroll-scope"
      style={{
        ...paginationShell,
        ...(compact
          ? paginationShellCompact
          : {}),
      }}
    >
      <div style={infoArea}>
        <div style={rangeText}>
          Showing{" "}
          <strong>
            {start}–{end}
          </strong>{" "}
          of{" "}
          <strong>
            {safeTotalItems}
          </strong>{" "}
          {label}
        </div>

        <div style={pageMeta}>
          Page{" "}
          <strong>
            {currentPage}
          </strong>{" "}
          of{" "}
          <strong>
            {totalPages}
          </strong>
        </div>
      </div>

      <div
        style={{
          ...controlsArea,
          ...(compact
            ? controlsAreaCompact
            : {}),
        }}
      >
        <label
          style={{
            ...rowsControl,
            ...(compact
              ? rowsControlCompact
              : {}),
          }}
        >
          <span style={rowsLabel}>
            Rows
          </span>

          <select
            value={
              safePageSize
            }
            onChange={
              changePageSize
            }
            style={{
              ...pageSizeSelect,
              ...(compact
                ? pageSizeSelectCompact
                : {}),
            }}
            aria-label="Rows per page"
          >
            {pageSizeOptions.map(
              (size) => (
                <option
                  key={size}
                  value={size}
                >
                  {size}
                </option>
              )
            )}
          </select>
        </label>

        <div style={divider} />

        <nav
          style={pageButtons}
          aria-label="Pagination"
        >
          <PageButton
            title="First page"
            disabled={
              currentPage === 1
            }
            onClick={() =>
              goToPage(1)
            }
            compact={compact}
          >
            «
          </PageButton>

          <PageButton
            title="Previous page"
            disabled={
              currentPage === 1
            }
            onClick={() =>
              goToPage(
                currentPage -
                1
              )
            }
            compact={compact}
          >
            ‹
          </PageButton>

          {pageItems.map(
            (item) => {
              if (
                typeof item !==
                "number"
              ) {
                return (
                  <span
                    key={item}
                    style={
                      ellipsisText
                    }
                  >
                    …
                  </span>
                );
              }

              return (
                <PageButton
                  key={item}
                  active={
                    item ===
                    currentPage
                  }
                  title={`Page ${item}`}
                  onClick={() =>
                    goToPage(
                      item
                    )
                  }
                  compact={compact}
                >
                  {item}
                </PageButton>
              );
            }
          )}

          <PageButton
            title="Next page"
            disabled={
              currentPage ===
              totalPages
            }
            onClick={() =>
              goToPage(
                currentPage +
                1
              )
            }
            compact={compact}
          >
            ›
          </PageButton>

          <PageButton
            title="Last page"
            disabled={
              currentPage ===
              totalPages
            }
            onClick={() =>
              goToPage(
                totalPages
              )
            }
            compact={compact}
          >
            »
          </PageButton>
        </nav>
      </div>
    </div>
  );
}

function PageButton({
  children,
  active = false,
  disabled = false,
  onClick,
  title,
  compact = false,
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      aria-current={
        active
          ? "page"
          : undefined
      }
      style={{
        ...pageButton,
        ...(compact
          ? pageButtonCompact
          : {}),
        ...(active
          ? activePageButton
          : {}),
        ...(disabled
          ? disabledPageButton
          : {}),
      }}
    >
      {children}
    </button>
  );
}

const paginationShell = {
  marginTop: 16,
  padding: "12px 14px",
  minHeight: 62,
  borderRadius: 16,
  display: "flex",
  alignItems: "center",
  justifyContent:
    "space-between",
  gap: 14,
  flexWrap: "wrap",
  color: "#e2e8f0",
  background:
    "radial-gradient(circle at 8% 0%,rgba(59,130,246,.11),transparent 34%),linear-gradient(180deg,rgba(15,23,42,.94),rgba(2,6,23,.72))",
  border:
    "1px solid rgba(148,163,184,.10)",
  boxShadow:
    "0 14px 34px rgba(2,6,23,.22)",
};

const paginationShellCompact = {
  marginTop: 12,
  padding: "9px 10px",
  minHeight: 50,
  borderRadius: 13,
  gap: 9,
  boxShadow:
    "0 10px 24px rgba(2,6,23,.18)",
};

const infoArea = {
  display: "flex",
  flexDirection: "column",
  gap: 3,
  minWidth: 0,
};

const rangeText = {
  color: "#cbd5e1",
  fontSize: 11,
  fontWeight: 700,
  lineHeight: 1.35,
};

const pageMeta = {
  color: "#64748b",
  fontSize: 9.5,
  fontWeight: 750,
};

const controlsArea = {
  display: "flex",
  alignItems: "center",
  justifyContent:
    "flex-end",
  gap: 10,
  flexWrap: "wrap",
};

const controlsAreaCompact = {
  gap: 7,
};

const rowsControl = {
  height: 36,
  display: "flex",
  alignItems: "center",
  gap: 7,
  padding: "0 8px 0 10px",
  borderRadius: 11,
  color: "#94a3b8",
  background:
    "rgba(255,255,255,.035)",
  border:
    "1px solid rgba(255,255,255,.065)",
};

const rowsControlCompact = {
  height: 31,
  padding: "0 6px 0 8px",
  borderRadius: 9,
};

const rowsLabel = {
  color: "#7f8ea3",
  fontSize: 9.5,
  fontWeight: 850,
  textTransform: "uppercase",
  letterSpacing: ".05em",
};

const pageSizeSelect = {
  height: 28,
  minWidth: 56,
  borderRadius: 8,
  border:
    "1px solid rgba(96,165,250,.17)",
  outline: "none",
  color: "#e2e8f0",
  background: "#0f172a",
  padding: "0 7px",
  fontSize: 10.5,
  fontWeight: 850,
  cursor: "pointer",
  colorScheme: "dark",
};

const pageSizeSelectCompact = {
  height: 25,
  minWidth: 50,
  fontSize: 9.5,
};

const divider = {
  width: 1,
  height: 28,
  background:
    "rgba(148,163,184,.11)",
};

const pageButtons = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  flexWrap: "wrap",
};

const pageButton = {
  minWidth: 34,
  height: 34,
  padding: "0 8px",
  borderRadius: 10,
  border:
    "1px solid rgba(148,163,184,.10)",
  background:
    "linear-gradient(180deg,rgba(30,41,59,.86),rgba(15,23,42,.88))",
  color: "#cbd5e1",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 10.5,
  fontWeight: 900,
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,.025)",
  transition:
    "transform .16s ease,border-color .16s ease,background .16s ease",
};

const pageButtonCompact = {
  minWidth: 30,
  height: 30,
  padding: "0 6px",
  borderRadius: 9,
  fontSize: 9.5,
};

const activePageButton = {
  color: "#fff",
  border:
    "1px solid rgba(96,165,250,.50)",
  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",
  boxShadow:
    "0 8px 18px rgba(37,99,235,.26)",
};

const disabledPageButton = {
  opacity: 0.32,
  cursor: "not-allowed",
  boxShadow: "none",
};

const ellipsisText = {
  minWidth: 18,
  color: "#64748b",
  textAlign: "center",
  fontSize: 13,
  fontWeight: 900,
  userSelect: "none",
};

export default LogisticsPagination;
