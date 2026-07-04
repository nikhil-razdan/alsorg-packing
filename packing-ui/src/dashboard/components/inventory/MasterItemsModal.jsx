import {
	useEffect,
	useMemo,
	useState,
} from "react";

import {
	fetchMasterItemReport,
} from "../../api/dashboardApi";

const pad = (value) =>
	String(value).padStart(2, "0");

const todayDate = () => {
	const date = new Date();

	return `${date.getFullYear()}-${pad(
		date.getMonth() + 1
	)}-${pad(date.getDate())}`;
};

const monthStartDate = () => {
	const date = new Date();

	return `${date.getFullYear()}-${pad(
		date.getMonth() + 1
	)}-01`;
};

const toStartDateTime = (date) =>
	date ? `${date}T00:00:00` : undefined;

const toEndDateTime = (date) =>
	date ? `${date}T23:59:59` : undefined;

const safe = (value, fallback = "—") => {
	const text =
		String(value ?? "").trim();

	return text || fallback;
};

const toNumber = (value) =>
	Number(value || 0);

const formatDateTime = (value) => {
	if (!value) {
		return "—";
	}

	try {
		const date =
			new Date(value);

		if (Number.isNaN(date.getTime())) {
			return String(value);
		}

		return date.toLocaleString("en-IN", {
			day: "2-digit",
			month: "short",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return "—";
	}
};

const statusColor = (status) => {
	const text =
		String(status || "")
			.toUpperCase();

	if (text === "FULLY_PACKED") return "#22c55e";
	if (text === "PARTIALLY_PACKED") return "#f59e0b";
	if (text === "DISPATCHED") return "#8b5cf6";
	if (text === "NO_PACKETS") return "#ef4444";
	if (text === "UNPACKED") return "#f97316";

	return "#38bdf8";
};

function MasterItemsModal({
	open,
	onClose,
}) {
	const [rows, setRows] =
		useState([]);

	const [loading, setLoading] =
		useState(false);

	const [error, setError] =
		useState("");

	const [status, setStatus] =
		useState("ALL");

	const [fromDate, setFromDate] =
		useState("");

	const [toDate, setToDate] =
		useState("");

	const [search, setSearch] =
		useState("");

	const [plantCode, setPlantCode] =
		useState("");

	const [client, setClient] =
		useState("");

	const loadData = async () => {
		try {
			setLoading(true);
			setError("");

			const data =
				await fetchMasterItemReport({
					status,
					search: search.trim(),
					plantCode: plantCode.trim(),
					client: client.trim(),
					from: toStartDateTime(fromDate),
					to: toEndDateTime(toDate),
					limit: 700,
					offset: 0,
				});

			setRows(
				Array.isArray(data)
					? data
					: []
			);
		} catch (e) {
			console.error(e);

			setRows([]);
			setError(
				e.message ||
					"Unable to load master items"
			);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (open) {
			loadData();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open, status]);

	const summary =
		useMemo(() => {
			const total = rows.length;

			const fully =
				rows.filter(
					(row) =>
						row.packingStatus ===
						"FULLY_PACKED"
				).length;

			const partial =
				rows.filter(
					(row) =>
						row.packingStatus ===
						"PARTIALLY_PACKED"
				).length;

			const unpacked =
				rows.filter(
					(row) =>
						row.packingStatus ===
						"UNPACKED"
				).length;

			const noPackets =
				rows.filter(
					(row) =>
						row.packingStatus ===
						"NO_PACKETS"
				).length;

			const exceptions =
				rows.filter(
					(row) =>
						Boolean(row.exceptionReason)
				).length;

			return {
				total,
				fully,
				partial,
				unpacked,
				noPackets,
				exceptions,
			};
		}, [rows]);

	const clearFilters = () => {
		setStatus("ALL");
		setFromDate("");
		setToDate("");
		setSearch("");
		setPlantCode("");
		setClient("");
	};

	if (!open) {
		return null;
	}

	return (
		<div style={overlay}>
			<div style={modal}>
				<div style={header}>
					<div>
						<div style={eyebrow}>
							MASTER ITEM REGISTER
						</div>

						<div style={title}>
							Master Items Created Till Now
						</div>

						<div style={subtitle}>
							Parent item level visibility with packet count,
							packing progress, client, PD, drawing, users,
							challans and data exceptions.
						</div>
					</div>

					<button
						type="button"
						onClick={onClose}
						style={closeBtn}
					>
						×
					</button>
				</div>

				<div style={summaryGrid}>
					<SummaryBox
						label="Total"
						value={summary.total}
						accent="#60a5fa"
					/>

					<SummaryBox
						label="Fully Packed"
						value={summary.fully}
						accent="#22c55e"
					/>

					<SummaryBox
						label="Partial"
						value={summary.partial}
						accent="#f59e0b"
					/>

					<SummaryBox
						label="Unpacked"
						value={summary.unpacked}
						accent="#f97316"
					/>

					<SummaryBox
						label="No Packets"
						value={summary.noPackets}
						accent="#ef4444"
					/>

					<SummaryBox
						label="Exceptions"
						value={summary.exceptions}
						accent="#fb7185"
					/>
				</div>

				<div style={filters}>
					<select
						value={status}
						onChange={(e) =>
							setStatus(e.target.value)
						}
						style={input}
					>
						<option value="ALL">
							All Master Items
						</option>

						<option value="FULLY_PACKED">
							Fully Packed
						</option>

						<option value="PARTIALLY_PACKED">
							Partially Packed
						</option>

						<option value="UNPACKED">
							Unpacked
						</option>

						<option value="NO_PACKETS">
							No Packets
						</option>

						<option value="DISPATCHED">
							Dispatched
						</option>

						<option value="EXCEPTIONS">
							Exceptions
						</option>
					</select>

					<input
						type="date"
						value={fromDate}
						onChange={(e) =>
							setFromDate(e.target.value)
						}
						style={input}
					/>

					<input
						type="date"
						value={toDate}
						onChange={(e) =>
							setToDate(e.target.value)
						}
						style={input}
					/>

					<input
						value={plantCode}
						onChange={(e) =>
							setPlantCode(e.target.value)
						}
						placeholder="Plant"
						style={smallInput}
					/>

					<input
						value={client}
						onChange={(e) =>
							setClient(e.target.value)
						}
						placeholder="Client"
						style={smallInput}
					/>

					<input
						value={search}
						onChange={(e) =>
							setSearch(e.target.value)
						}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								loadData();
							}
						}}
						placeholder="Search item, PD, DWG, client, floor, user..."
						style={searchInput}
					/>

					<button
						type="button"
						onClick={loadData}
						disabled={loading}
						style={primaryBtn}
					>
						{loading ? "Loading..." : "Apply"}
					</button>

					<button
						type="button"
						onClick={clearFilters}
						style={ghostBtn}
					>
						Clear
					</button>
				</div>

				{error && (
					<div style={errorBox}>
						{error}
					</div>
				)}

				<div style={tableWrap}>
					<table style={table}>
						<thead>
							<tr>
								<th style={th}>Master Item</th>
								<th style={th}>Client</th>
								<th style={th}>PD / Drawing</th>
								<th style={th}>Plant / Floor</th>
								<th style={th}>Packets</th>
								<th style={th}>Progress</th>
								<th style={th}>Sticker / Challan</th>
								<th style={th}>Users</th>
								<th style={th}>Dates</th>
								<th style={th}>Exception</th>
							</tr>
						</thead>

						<tbody>
							{loading && (
								<tr>
									<td
										colSpan={10}
										style={empty}
									>
										Loading master items...
									</td>
								</tr>
							)}

							{!loading && rows.length === 0 && (
								<tr>
									<td
										colSpan={10}
										style={empty}
									>
										No master item found.
									</td>
								</tr>
							)}

							{!loading &&
								rows.map((row) => {
									const accent =
										statusColor(
											row.packingStatus
										);

									const progress =
										Math.round(
											toNumber(
												row.packingProgress
											)
										);

									return (
										<tr
											key={
												row.masterItemId
											}
										>
											<td style={tdStrong}>
												<div>
													{safe(
														row.itemName
													)}
												</div>

												<div style={muted}>
													ID:{" "}
													{safe(
														row.masterItemId
													)}
												</div>
											</td>

											<td style={td}>
												<div>
													{safe(
														row.clientName
													)}
												</div>

												<div style={muted}>
													{safe(
														row.clientAddress
													)}
												</div>
											</td>

											<td style={td}>
												<div>
													PD:{" "}
													<b>
														{safe(
															row.pdNo
														)}
													</b>
												</div>

												<div style={muted}>
													DWG:{" "}
													{safe(
														row.drawingName
													)}
												</div>
											</td>

											<td style={td}>
												<div>
													{safe(
														row.plantCode
													)}
												</div>

												<div style={muted}>
													Floor:{" "}
													{safe(
														row.floor
													)}
												</div>
											</td>

											<td style={td}>
												<div>
													Expected:{" "}
													<b>
														{safe(
															row.expectedPackets
														)}
													</b>
												</div>

												<div style={muted}>
													Actual:{" "}
													{safe(
														row.actualPackets
													)}{" "}
													• Items:{" "}
													{safe(
														row.packetItems
													)}
												</div>
											</td>

											<td style={td}>
												<div style={statusBadge(accent)}>
													{safe(
														row.packingStatus
													)}
												</div>

												<div style={progressTrack}>
													<div
														style={progressFill(
															accent,
															progress
														)}
													/>
												</div>

												<div style={muted}>
													{progress}% packed
												</div>
											</td>

											<td style={td}>
												<div>
													Stickers:{" "}
													<b>
														{safe(
															row.stickerCount
														)}
													</b>
												</div>

												<div style={muted}>
													Challans:{" "}
													{safe(
														row.challanCount
													)}
												</div>
											</td>

											<td style={td}>
												<div>
													Packed:{" "}
													{safe(
														row.lastPackedBy
													)}
												</div>

												<div style={muted}>
													Dispatch:{" "}
													{safe(
														row.lastDispatchedBy
													)}
												</div>
											</td>

											<td style={td}>
												<div>
													Created:{" "}
													{formatDateTime(
														row.createdAt
													)}
												</div>

												<div style={muted}>
													Last Packed:{" "}
													{formatDateTime(
														row.lastPackedAt
													)}
												</div>

												<div style={muted}>
													Last Dispatch:{" "}
													{formatDateTime(
														row.lastDispatchedAt
													)}
												</div>
											</td>

											<td style={td}>
												{row.exceptionReason ? (
													<div style={exceptionText}>
														{row.exceptionReason}
													</div>
												) : (
													<span style={okText}>
														Clear
													</span>
												)}
											</td>
										</tr>
									);
								})}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}

function SummaryBox({
	label,
	value,
	accent,
}) {
	return (
		<div style={summaryBox(accent)}>
			<div style={summaryLabel}>
				{label}
			</div>

			<div style={summaryValue}>
				{value}
			</div>
		</div>
	);
}

const overlay = {
	position: "fixed",
	inset: 0,
	zIndex: 9999,
	background: "rgba(2,6,23,.76)",
	backdropFilter: "blur(14px)",
	padding: 24,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
};

const modal = {
	width: "min(1680px, 100%)",
	maxHeight: "92vh",
	overflow: "hidden",
	borderRadius: 30,
	background:
		"linear-gradient(180deg, rgba(15,23,42,.98), rgba(8,17,31,.94))",
	border: "1px solid rgba(255,255,255,.10)",
	boxShadow: "0 34px 90px rgba(0,0,0,.55)",
	color: "#fff",
	padding: 22,
	display: "flex",
	flexDirection: "column",
};

const header = {
	display: "flex",
	justifyContent: "space-between",
	gap: 18,
	marginBottom: 16,
};

const eyebrow = {
	color: "#93c5fd",
	fontSize: 11,
	fontWeight: 950,
	letterSpacing: ".16em",
};

const title = {
	marginTop: 6,
	color: "#fff",
	fontSize: 26,
	fontWeight: 950,
};

const subtitle = {
	marginTop: 6,
	color: "rgba(255,255,255,.58)",
	fontSize: 13,
	fontWeight: 650,
	maxWidth: 860,
	lineHeight: 1.6,
};

const closeBtn = {
	width: 38,
	height: 38,
	borderRadius: 999,
	border: "1px solid rgba(255,255,255,.12)",
	background: "rgba(255,255,255,.06)",
	color: "#fff",
	fontSize: 24,
	cursor: "pointer",
};

const summaryGrid = {
	display: "grid",
	gridTemplateColumns:
		"repeat(auto-fit,minmax(150px,1fr))",
	gap: 12,
	marginBottom: 14,
};

const summaryBox = (accent) => ({
	padding: 14,
	borderRadius: 18,
	background:
		`radial-gradient(circle at top right, ${accent}22, transparent 44%), rgba(255,255,255,.035)`,
	border: `1px solid ${accent}33`,
});

const summaryLabel = {
	color: "rgba(255,255,255,.55)",
	fontSize: 11,
	fontWeight: 900,
	textTransform: "uppercase",
	letterSpacing: ".08em",
};

const summaryValue = {
	marginTop: 7,
	color: "#fff",
	fontSize: 26,
	fontWeight: 950,
};

const filters = {
	display: "flex",
	gap: 10,
	flexWrap: "wrap",
	padding: 12,
	borderRadius: 18,
	background: "rgba(255,255,255,.035)",
	border: "1px solid rgba(255,255,255,.07)",
	marginBottom: 14,
};

const input = {
	height: 40,
	borderRadius: 12,
	border: "1px solid rgba(255,255,255,.10)",
	background: "#0f172a",
	color: "#fff",
	padding: "0 12px",
	outline: "none",
	fontWeight: 800,
	colorScheme: "dark",
};

const smallInput = {
	...input,
	width: 120,
};

const searchInput = {
	...input,
	flex: 1,
	minWidth: 320,
};

const primaryBtn = {
	height: 40,
	borderRadius: 12,
	border: "none",
	background: "linear-gradient(135deg,#2563eb,#3b82f6)",
	color: "#fff",
	fontWeight: 950,
	padding: "0 18px",
	cursor: "pointer",
};

const ghostBtn = {
	...primaryBtn,
	background: "rgba(255,255,255,.06)",
	border: "1px solid rgba(255,255,255,.10)",
};

const errorBox = {
	padding: 12,
	borderRadius: 14,
	background: "rgba(239,68,68,.12)",
	border: "1px solid rgba(239,68,68,.25)",
	color: "#fecaca",
	fontWeight: 800,
	marginBottom: 12,
};

const tableWrap = {
	flex: 1,
	overflow: "auto",
	borderRadius: 20,
	border: "1px solid rgba(255,255,255,.08)",
};

const table = {
	width: "100%",
	minWidth: 1560,
	borderCollapse: "collapse",
	fontSize: 12,
};

const th = {
	position: "sticky",
	top: 0,
	zIndex: 2,
	padding: "13px 12px",
	textAlign: "left",
	background: "#0b1220",
	color: "#94a3b8",
	fontWeight: 950,
	textTransform: "uppercase",
	letterSpacing: ".05em",
	borderBottom: "1px solid rgba(255,255,255,.08)",
};

const td = {
	padding: "13px 12px",
	color: "rgba(255,255,255,.82)",
	borderBottom: "1px solid rgba(255,255,255,.045)",
	verticalAlign: "top",
};

const tdStrong = {
	...td,
	color: "#fff",
	fontWeight: 850,
};

const muted = {
	marginTop: 4,
	color: "rgba(255,255,255,.45)",
	fontSize: 11,
	fontWeight: 650,
	maxWidth: 250,
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
};

const statusBadge = (accent) => ({
	display: "inline-flex",
	padding: "5px 9px",
	borderRadius: 999,
	background: `${accent}1F`,
	border: `1px solid ${accent}44`,
	color: accent,
	fontSize: 11,
	fontWeight: 950,
});

const progressTrack = {
	marginTop: 8,
	width: 110,
	height: 7,
	borderRadius: 999,
	background: "rgba(255,255,255,.08)",
	overflow: "hidden",
};

const progressFill = (accent, value) => ({
	height: "100%",
	width: `${Math.max(0, Math.min(100, value))}%`,
	background: accent,
	borderRadius: 999,
});

const exceptionText = {
	color: "#fdba74",
	fontWeight: 800,
	lineHeight: 1.4,
	maxWidth: 260,
};

const okText = {
	color: "#4ade80",
	fontWeight: 900,
};

const empty = {
	padding: 28,
	textAlign: "center",
	color: "#94a3b8",
	fontWeight: 800,
};

export default MasterItemsModal;