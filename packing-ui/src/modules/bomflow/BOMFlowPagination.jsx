import {
	useEffect,
	useMemo,
	useState,
} from "react";

import {
	Box,
	MenuItem,
	Pagination,
	TextField,
	Typography,
} from "@mui/material";

const DEFAULT_OPTIONS = [5, 10, 20, 50];

export function useBomFlowPagination(
	items,
	{
		initialPageSize = 10,
		resetKey = "",
	} = {}
) {
	const safeItems = Array.isArray(items) ? items : [];
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(initialPageSize);

	const total = safeItems.length;
	const pageCount = Math.max(1, Math.ceil(total / pageSize));

	useEffect(() => {
		setPage(1);
	}, [resetKey]);

	useEffect(() => {
		setPage((current) => Math.min(Math.max(1, current), pageCount));
	}, [pageCount]);

	const pageItems = useMemo(() => {
		const start = (page - 1) * pageSize;
		return safeItems.slice(start, start + pageSize);
	}, [safeItems, page, pageSize]);

	const setPageSizeSafe = (nextSize) => {
		const parsed = Number(nextSize);
		if (!Number.isFinite(parsed) || parsed <= 0) return;
		setPageSize(parsed);
		setPage(1);
	};

	return {
		page,
		setPage,
		pageSize,
		setPageSize: setPageSizeSafe,
		pageCount,
		total,
		pageItems,
		from: total === 0 ? 0 : (page - 1) * pageSize + 1,
		to: Math.min(total, page * pageSize),
	};
}

export default function BOMFlowPagination({
	page,
	pageCount,
	pageSize,
	total,
	from,
	to,
	onPageChange,
	onPageSizeChange,
	label = "records",
	pageSizeOptions = DEFAULT_OPTIONS,
	compact = false,
}) {
	if (!total) return null;

	const options = Array.from(
		new Set(
			[...pageSizeOptions, pageSize]
				.map(Number)
				.filter((value) => Number.isFinite(value) && value > 0)
		)
	).sort((a, b) => a - b);

	return (
		<Box sx={{
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: "12px",
			flexWrap: "wrap",
			px: compact ? "10px" : "14px",
			py: compact ? "9px" : "11px",
			borderTop: "1px solid rgba(255,255,255,.065)",
			background: "linear-gradient(180deg,rgba(2,6,23,.16),rgba(2,6,23,.34))",
		}}>
			<Box sx={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
				<Typography sx={{
					color: "rgba(255,255,255,.58)",
					fontSize: compact ? 10.5 : 11,
					fontWeight: 750,
					whiteSpace: "nowrap",
				}}>
					Showing <Box component="span" sx={{ color: "#fff", fontWeight: 900 }}>{from}–{to}</Box> of{" "}
					<Box component="span" sx={{ color: "#fff", fontWeight: 900 }}>{total}</Box> {label}
				</Typography>

				<TextField
					select
					size="small"
					SelectProps={{
						MenuProps: {
							PaperProps: {
								sx: {
									mt: "5px",
									borderRadius: "10px",
									background: "#0f172a",
									color: "#e2e8f0",
									border: "1px solid rgba(255,255,255,.08)",
									boxShadow: "0 18px 45px rgba(2,6,23,.50)",
									"& .MuiMenuItem-root": {
										fontSize: 11,
										fontWeight: 750,
										"&:hover": { background: "rgba(59,130,246,.12)" },
										"&.Mui-selected": {
											background: "rgba(59,130,246,.18)",
										},
									},
								},
							},
						},
					}}
					value={pageSize}
					onChange={(event) => onPageSizeChange(Number(event.target.value))}
					aria-label={`${label} per page`}
					sx={{
						width: 92,
						"& .MuiOutlinedInput-root": {
							height: 32,
							borderRadius: "8px",
							color: "#e2e8f0",
							background: "rgba(255,255,255,.035)",
							fontSize: 10.5,
							fontWeight: 800,
							"& fieldset": { borderColor: "rgba(255,255,255,.08)" },
							"&:hover fieldset": { borderColor: "rgba(96,165,250,.32)" },
							"&.Mui-focused fieldset": { borderColor: "rgba(96,165,250,.65)" },
						},
						"& .MuiSvgIcon-root": { color: "#94a3b8" },
					}}
				>
					{options.map((option) => (
						<MenuItem key={option} value={option}>
							{option} / page
						</MenuItem>
					))}
				</TextField>
			</Box>

			<Pagination
				page={page}
				count={pageCount}
				onChange={(_, value) => onPageChange(value)}
				size={compact ? "small" : "medium"}
				shape="rounded"
				siblingCount={1}
				boundaryCount={1}
				showFirstButton={pageCount > 5}
				showLastButton={pageCount > 5}
				sx={{
					"& .MuiPagination-ul": { gap: "3px" },
					"& .MuiPaginationItem-root": {
						minWidth: compact ? 28 : 31,
						height: compact ? 28 : 31,
						borderRadius: "8px",
						color: "rgba(255,255,255,.68)",
						border: "1px solid rgba(255,255,255,.06)",
						background: "rgba(255,255,255,.025)",
						fontSize: 11,
						fontWeight: 850,
						transition: "all .18s ease",
						"&:hover": {
							color: "#fff",
							borderColor: "rgba(96,165,250,.28)",
							background: "rgba(59,130,246,.10)",
						},
						"&.Mui-selected": {
							color: "#fff",
							background: "linear-gradient(135deg,#2563eb,#3b82f6)",
							borderColor: "rgba(96,165,250,.55)",
							boxShadow: "0 6px 16px rgba(37,99,235,.24)",
							"&:hover": {
								background: "linear-gradient(135deg,#1d4ed8,#2563eb)",
							},
						},
					},
				}}
			/>
		</Box>
	);
}
