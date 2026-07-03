import {
	useEffect,
	useMemo,
	useState,
} from "react";

import {
	fetchDashboardTrace,
} from "../../api/dashboardApi";

const toNumber = (value) =>
	Number(value || 0);

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

const safeText = (value, fallback = "—") => {
	const text =
		String(value ?? "")
			.trim();

	return text || fallback;
};

const formatDateTime = (value) => {
	if (!value) {
		return "—";
	}

	try {
		const raw =
			String(value).trim();

		const date =
			new Date(raw);

		if (Number.isNaN(date.getTime())) {
			return raw;
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

const getActionDate = (row) => {
	return (
		row?.dispatchedAt ||
		row?.generatedAt ||
		row?.packedAt ||
		row?.tripStartedAt ||
		""
	);
};

const getUser = (row) => {
	return (
		row?.dispatchedBy ||
		row?.generatedBy ||
		row?.packedBy ||
		"—"
	);
};

const getBadgeTone = (row) => {
	const source =
		String(row?.sourceType || "")
			.toUpperCase();

	const status =
		String(row?.status || row?.movementType || "")
			.toUpperCase();

	if (row?.exceptionReason) {
		return "#f97316";
	}

	if (
		source.includes("DISPATCH") ||
		status.includes("DISPATCH")
	) {
		return "#8b5cf6";
	}

	if (
		source.includes("PACK") ||
		status.includes("PACK")
	) {
		return "#22c55e";
	}

	if (
		status.includes("PENDING") ||
		status.includes("CREATED")
	) {
		return "#f59e0b";
	}

	return "#38bdf8";
};

function InventoryCommandCenter({
	stats,
}) {
	const [type, setType] =
		useState("all");

	const [fromDate, setFromDate] =
		useState(monthStartDate());

	const [toDate, setToDate] =
		useState(todayDate());

	const [search, setSearch] =
		useState("");

	const [rows, setRows] =
		useState([]);

	const [loading, setLoading] =
		useState(false);

	const [error, setError] =
		useState("");

	const currentInventoryExceptions =
		toNumber(stats.masterItemsWithoutPackets) +
		toNumber(stats.packetsWithoutPacketItems) +
		toNumber(stats.packetItemsWithoutMaster) +
		toNumber(stats.duplicateCurrentStickers) +
		toNumber(stats.readyItemsStillInPkd);

	const legacyDispatchExceptions =
		toNumber(stats.dispatchedWithoutPacketItem) +
		toNumber(stats.dispatchedWithoutChallan) +
		toNumber(stats.dispatchedWithoutDriver);

	const packetCompletionRate =
		toNumber(stats.packetItems) === 0
			? 0
			: Math.round(
					(
						toNumber(stats.packetItemsWithSticker) /
						toNumber(stats.packetItems)
					) * 100
			  );

	const dispatchConversion =
		toNumber(stats.packetItems) === 0
			? 0
			: Math.round(
					(
						toNumber(stats.dispatchedItems) /
						toNumber(stats.packetItems)
					) * 100
			  );

	const healthScore =
		toNumber(stats.packetItems) === 0
			? 100
			: Math.max(
					0,
					Math.min(
						100,
						Math.round(
							(
								(
									toNumber(stats.packetItems) -
									currentInventoryExceptions
								) /
								toNumber(stats.packetItems)
							) * 100
						)
					)
			  );

	const loadTrace = async (
		overrideType = type
	) => {
		try {
			setLoading(true);
			setError("");

			const data =
				await fetchDashboardTrace({
					type: overrideType,
					from: toStartDateTime(fromDate),
					to: toEndDateTime(toDate),
					search: search.trim(),
					limit: 250,
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
					"Failed to load inventory traceability"
			);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadTrace(type);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [type]);

	const chips =
		useMemo(
			() => [
				{
					key: "all",
					label: "All Flow",
					value: toNumber(stats.packetItems),
				},
				{
					key: "packed",
					label: "Packed",
					value: toNumber(stats.packedItems),
				},
				{
					key: "generated",
					label: "Stickers",
					value: toNumber(stats.stickersGenerated),
				},
				{
					key: "pending",
					label: "Pending",
					value: toNumber(stats.pendingItems),
				},
				{
					key: "dispatched",
					label: "Dispatched",
					value: toNumber(stats.dispatchedItems),
				},
				{
					key: "challaned",
					label: "Challaned",
					value: toNumber(stats.normalDispatchChallans),
				},
				{
					key: "custom",
					label: "Custom Challans",
					value: toNumber(stats.customChallans),
				},
				{
					key: "errored",
					label: "Exceptions",
					value:
						currentInventoryExceptions +
						legacyDispatchExceptions,
				},
			],
			[
				stats,
				currentInventoryExceptions,
				legacyDispatchExceptions,
			]
		);

	const insightRows =
		useMemo(
			() => [
				{
					label: "Packet Completion",
					value: `${packetCompletionRate}%`,
					subtle: `${toNumber(
						stats.packetItemsWithSticker
					)} of ${toNumber(stats.packetItems)} packet items packed`,
					accent: "#22c55e",
				},
				{
					label: "Dispatch Conversion",
					value: `${dispatchConversion}%`,
					subtle: `${toNumber(
						stats.dispatchedItems
					)} packet/item rows dispatched`,
					accent: "#8b5cf6",
				},
				{
					label: "Health Score",
					value: `${healthScore}%`,
					subtle: `${currentInventoryExceptions} current inventory exceptions`,
					accent: healthScore >= 90 ? "#22c55e" : "#f97316",
				},
				{
					label: "Legacy Dispatch Gaps",
					value: legacyDispatchExceptions,
					subtle: "Old dispatch rows needing mapping cleanup",
					accent: "#f59e0b",
				},
			],
			[
				packetCompletionRate,
				dispatchConversion,
				healthScore,
				currentInventoryExceptions,
				legacyDispatchExceptions,
				stats,
			]
		);

	return (
		<div style={wrap}>
			<div style={top}>
				<div>
					<div style={eyebrow}>
						INVENTORY COMMAND CENTER
					</div>

					<div style={title}>
						Item, Packet, Sticker & Challan Traceability
					</div>

					<div style={subtitle}>
						Track every item from master item creation to packet packing,
						sticker generation, challan dispatch, user action and exceptions.
					</div>
				</div>

				<div style={healthBox}>
					<span>Inventory Health</span>
					<strong>{healthScore}%</strong>
				</div>
			</div>

			<div style={insightGrid}>
				{insightRows.map((item) => (
					<div
						key={item.label}
						style={insightCard(item.accent)}
					>
						<div style={insightLabel}>
							{item.label}
						</div>

						<div style={insightValue}>
							{item.value}
						</div>

						<div style={insightSubtle}>
							{item.subtle}
						</div>
					</div>
				))}
			</div>

			<div style={chipRow}>
				{chips.map((chip) => (
					<button
						key={chip.key}
						type="button"
						onClick={() =>
							setType(chip.key)
						}
						style={chipButton(
							type === chip.key
						)}
					>
						<span>{chip.label}</span>
						<strong>{chip.value}</strong>
					</button>
				))}
			</div>

			<div style={filterPanel}>
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
					value={search}
					onChange={(e) =>
						setSearch(e.target.value)
					}
					placeholder="Search item, client, PD, DWG, sticker, challan, user, vehicle..."
					style={searchInput}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							loadTrace();
						}
					}}
				/>

				<button
					type="button"
					onClick={() => loadTrace()}
					disabled={loading}
					style={primaryButton}
				>
					{loading ? "Loading..." : "Apply"}
				</button>
			</div>

			{error && (
				<div style={errorBox}>
					{error}
				</div>
			)}

			<div style={tableTop}>
				<div>
					<div style={tableTitle}>
						Traceability Register
					</div>

					<div style={tableSubtitle}>
						Showing {rows.length} rows. Use filters for exact item,
						client, PD, drawing, challan or sticker tracking.
					</div>
				</div>

				<div style={tableCount}>
					{type.toUpperCase()}
				</div>
			</div>

			<div style={tableWrap}>
				<table style={table}>
					<thead>
						<tr>
							<th style={th}>Flow</th>
							<th style={th}>Item / Packet</th>
							<th style={th}>Client</th>
							<th style={th}>PD / DWG</th>
							<th style={th}>Sticker</th>
							<th style={th}>Challan</th>
							<th style={th}>User</th>
							<th style={th}>Date</th>
							<th style={th}>Location / Vehicle</th>
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
									Loading traceability data...
								</td>
							</tr>
						)}

						{!loading && rows.length === 0 && (
							<tr>
								<td
									colSpan={10}
									style={empty}
								>
									No traceability rows found.
								</td>
							</tr>
						)}

						{!loading &&
							rows.map((row, index) => {
								const accent =
									getBadgeTone(row);

								return (
									<tr
										key={
											row.packetItemId ||
											row.packetId ||
											row.masterItemId ||
											`${row.challanNumber}-${index}`
										}
									>
										<td style={td}>
											<div style={flowBadge(accent)}>
												{safeText(
													row.sourceType
												)}
											</div>

											<div style={smallMuted}>
												{safeText(
													row.status ||
														row.movementType
												)}
											</div>
										</td>

										<td style={tdStrong}>
											<div>
												{safeText(
													row.itemName ||
														row.masterItemName
												)}
											</div>

											<div style={smallMuted}>
												Packet:{" "}
												{safeText(
													row.packetNumber
												)}
											</div>
										</td>

										<td style={td}>
											<div>
												{safeText(
													row.clientName
												)}
											</div>

											<div style={smallMuted}>
												{safeText(
													row.clientAddress
												)}
											</div>
										</td>

										<td style={td}>
											<div>
												PD:{" "}
												<b>
													{safeText(
														row.pdNo
													)}
												</b>
											</div>

											<div style={smallMuted}>
												DWG:{" "}
												{safeText(
													row.drawingNo
												)}
											</div>
										</td>

										<td style={td}>
											<div style={mono}>
												{safeText(
													row.stickerNumber
												)}
											</div>

											<div style={smallMuted}>
												Print:{" "}
												{safeText(
													row.printIteration
												)}
											</div>
										</td>

										<td style={td}>
											<div style={mono}>
												{safeText(
													row.challanNumber
												)}
											</div>

											<div style={smallMuted}>
												{safeText(
													row.driverName
												)}
											</div>
										</td>

										<td style={td}>
											{safeText(
												getUser(row)
											)}
										</td>

										<td style={td}>
											{formatDateTime(
												getActionDate(row)
											)}
										</td>

										<td style={td}>
											<div>
												{safeText(
													row.currentLocationCode ||
														row.warehouseCode ||
														row.plantCode
												)}
											</div>

											<div style={smallMuted}>
												{safeText(
													row.vehicleNumber
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
	);
}

const wrap = {
	padding: 22,
	borderRadius: 28,
	background:
		"linear-gradient(180deg, rgba(15,23,42,.90), rgba(15,23,42,.76))",
	border: "1px solid rgba(255,255,255,.08)",
	boxShadow: "0 24px 60px rgba(2,6,23,.40)",
	backdropFilter: "blur(20px)",
};

const top = {
	display: "flex",
	justifyContent: "space-between",
	gap: 18,
	alignItems: "flex-start",
	marginBottom: 18,
	flexWrap: "wrap",
};

const eyebrow = {
	color: "#93c5fd",
	fontSize: 11,
	fontWeight: 900,
	letterSpacing: ".14em",
};

const title = {
	marginTop: 6,
	color: "#fff",
	fontSize: 26,
	fontWeight: 950,
};

const subtitle = {
	marginTop: 7,
	maxWidth: 920,
	color: "rgba(255,255,255,.62)",
	fontSize: 13,
	lineHeight: 1.6,
	fontWeight: 650,
};

const healthBox = {
	minWidth: 150,
	padding: "14px 16px",
	borderRadius: 20,
	background:
		"linear-gradient(135deg, rgba(34,197,94,.16), rgba(59,130,246,.10))",
	border: "1px solid rgba(34,197,94,.24)",
	display: "flex",
	flexDirection: "column",
	gap: 5,
	color: "rgba(255,255,255,.68)",
	fontSize: 12,
	fontWeight: 800,
};

const insightGrid = {
	display: "grid",
	gridTemplateColumns:
		"repeat(auto-fit,minmax(210px,1fr))",
	gap: 12,
	marginBottom: 16,
};

const insightCard = (accent) => ({
	padding: 16,
	borderRadius: 20,
	background:
		`radial-gradient(circle at top right, ${accent}22, transparent 42%), rgba(255,255,255,.035)`,
	border: `1px solid ${accent}33`,
});

const insightLabel = {
	color: "rgba(255,255,255,.58)",
	fontSize: 11,
	fontWeight: 900,
	letterSpacing: ".08em",
	textTransform: "uppercase",
};

const insightValue = {
	marginTop: 8,
	color: "#fff",
	fontSize: 30,
	fontWeight: 950,
};

const insightSubtle = {
	marginTop: 5,
	color: "rgba(255,255,255,.52)",
	fontSize: 12,
	fontWeight: 650,
};

const chipRow = {
	display: "flex",
	flexWrap: "wrap",
	gap: 10,
	marginBottom: 16,
};

const chipButton = (active) => ({
	height: 42,
	padding: "0 14px",
	borderRadius: 999,
	border: active
		? "1px solid rgba(96,165,250,.48)"
		: "1px solid rgba(255,255,255,.08)",
	background: active
		? "linear-gradient(135deg,#2563eb,#3b82f6)"
		: "rgba(255,255,255,.035)",
	color: "#fff",
	display: "inline-flex",
	alignItems: "center",
	gap: 10,
	cursor: "pointer",
	fontWeight: 850,
	boxShadow: active
		? "0 12px 26px rgba(37,99,235,.28)"
		: "none",
});

const filterPanel = {
	display: "flex",
	gap: 10,
	flexWrap: "wrap",
	padding: 12,
	borderRadius: 18,
	background: "rgba(255,255,255,.035)",
	border: "1px solid rgba(255,255,255,.07)",
	marginBottom: 16,
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

const searchInput = {
	...input,
	flex: 1,
	minWidth: 320,
};

const primaryButton = {
	height: 40,
	borderRadius: 12,
	border: "none",
	padding: "0 18px",
	background:
		"linear-gradient(135deg,#2563eb,#3b82f6)",
	color: "#fff",
	fontWeight: 950,
	cursor: "pointer",
};

const errorBox = {
	padding: 14,
	borderRadius: 16,
	background: "rgba(239,68,68,.10)",
	border: "1px solid rgba(239,68,68,.24)",
	color: "#fecaca",
	fontWeight: 800,
	marginBottom: 16,
};

const tableTop = {
	display: "flex",
	justifyContent: "space-between",
	gap: 14,
	alignItems: "center",
	marginBottom: 10,
	flexWrap: "wrap",
};

const tableTitle = {
	color: "#fff",
	fontSize: 18,
	fontWeight: 950,
};

const tableSubtitle = {
	marginTop: 4,
	color: "rgba(255,255,255,.52)",
	fontSize: 12,
	fontWeight: 650,
};

const tableCount = {
	padding: "8px 12px",
	borderRadius: 999,
	background: "rgba(96,165,250,.12)",
	color: "#93c5fd",
	border: "1px solid rgba(96,165,250,.22)",
	fontSize: 12,
	fontWeight: 950,
};

const tableWrap = {
	maxHeight: "64vh",
	overflow: "auto",
	borderRadius: 20,
	border: "1px solid rgba(255,255,255,.08)",
};

const table = {
	width: "100%",
	minWidth: 1450,
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
	letterSpacing: ".05em",
	textTransform: "uppercase",
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

const flowBadge = (accent) => ({
	display: "inline-flex",
	padding: "5px 9px",
	borderRadius: 999,
	background: `${accent}1F`,
	border: `1px solid ${accent}44`,
	color: accent,
	fontSize: 11,
	fontWeight: 950,
});

const smallMuted = {
	marginTop: 4,
	color: "rgba(255,255,255,.48)",
	fontSize: 11,
	fontWeight: 650,
	maxWidth: 230,
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
};

const mono = {
	fontFamily:
		"ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
	fontWeight: 850,
	color: "#bfdbfe",
};

const exceptionText = {
	color: "#fdba74",
	fontWeight: 800,
	lineHeight: 1.4,
	maxWidth: 220,
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

export default InventoryCommandCenter;