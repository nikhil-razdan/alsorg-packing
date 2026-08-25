import {
	useEffect,
	useMemo,
	useState,
} from "react";

import {
	fetchDashboardTrace,
} from "../../api/dashboardApi";

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const TRACE_FETCH_LIMIT = 1000;

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

const toDateTime = (
	date,
	time,
	endOfDay = false
) => {
	if (!date) return undefined;

	const resolvedTime =
		time ||
		(endOfDay
			? "23:59:59"
			: "00:00:00");

	return `${date}T${resolvedTime.length === 5
			? `${resolvedTime}:00`
			: resolvedTime
		}`;
};

const safeText = (
	value,
	fallback = "—"
) => {
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

		const normalized =
			raw.includes("T")
				? raw
				: raw.replace(" ", "T");

		const localMatch =
			normalized.match(
				/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/
			);

		let date;

		if (
			localMatch &&
			!/[zZ]|[+-]\d{2}:?\d{2}$/.test(
				normalized
			)
		) {
			date = new Date(
				Number(localMatch[1]),
				Number(localMatch[2]) - 1,
				Number(localMatch[3]),
				Number(localMatch[4]),
				Number(localMatch[5]),
				Number(localMatch[6] || 0)
			);
		} else {
			date =
				new Date(normalized);
		}

		if (
			Number.isNaN(
				date.getTime()
			)
		) {
			return raw;
		}

		return date.toLocaleString(
			"en-IN",
			{
				day: "2-digit",
				month: "short",
				year: "numeric",
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
				hour12: true,
			}
		);
	} catch {
		return "—";
	}
};

const getActionDate = (row) =>
	row?.dispatchedAt ||
	row?.generatedAt ||
	row?.packedAt ||
	row?.tripStartedAt ||
	row?.createdAt ||
	row?.updatedAt ||
	"";

const getUser = (row) =>
	row?.dispatchedBy ||
	row?.generatedBy ||
	row?.packedBy ||
	row?.createdBy ||
	row?.updatedBy ||
	"—";

const getCreatedBy = (row) =>
	row?.createdBy ||
	row?.generatedBy ||
	row?.raisedBy ||
	"—";

const getPackedBy = (row) =>
	row?.packedBy ||
	row?.stickerGeneratedBy ||
	row?.generatedBy ||
	"—";

const getDispatchedBy = (row) =>
	row?.dispatchedBy ||
	row?.dispatchBy ||
	row?.tripStartedBy ||
	"—";

const getBadgeTone = (row) => {
	const source =
		String(
			row?.sourceType || ""
		).toUpperCase();

	const status =
		String(
			row?.status ||
			row?.movementType ||
			""
		).toUpperCase();

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

const formatFieldLabel = (value) =>
	String(value || "")
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.replaceAll("_", " ")
		.replace(/\b\w/g, (char) =>
			char.toUpperCase()
		);

const valueForDisplay = (value) => {
	if (
		value === null ||
		value === undefined ||
		value === ""
	) {
		return "—";
	}

	if (typeof value === "object") {
		try {
			return JSON.stringify(
				value,
				null,
				2
			);
		} catch {
			return String(value);
		}
	}

	return String(value);
};

function TraceRowDetailModal({
	row,
	onClose,
}) {
	if (!row) return null;

	const accent =
		getBadgeTone(row);

	const fields =
		Object.entries(row)
			.sort(([a], [b]) =>
				a.localeCompare(b)
			);

	return (
		<div
			style={detailOverlay}
			onMouseDown={(event) => {
				if (
					event.target ===
					event.currentTarget
				) {
					onClose?.();
				}
			}}
		>
			<div style={detailModal}>
				<div style={detailHeader}>
					<div style={detailHeaderIdentity}>
						<div
							style={detailIcon(
								accent
							)}
						>
							⌖
						</div>

						<div style={{ minWidth: 0 }}>
							<div style={detailEyebrow}>
								TRACEABILITY RECORD
							</div>

							<div style={detailTitle}>
								{safeText(
									row.itemName ||
									row.masterItemName ||
									row.packetNumber,
									"Inventory Record"
								)}
							</div>

							<div style={detailSubtitle}>
								{safeText(
									row.sourceType
								)}{" "}
								•{" "}
								{safeText(
									row.status ||
									row.movementType
								)}{" "}
								•{" "}
								{formatDateTime(
									getActionDate(row)
								)}
							</div>
						</div>
					</div>

					<button
						type="button"
						onClick={onClose}
						style={closeButton}
					>
						×
					</button>
				</div>

				<div style={detailSummaryGrid}>
					<div style={summaryTile}>
						<span>Created By</span>
						<strong>
							{safeText(
								getCreatedBy(row)
							)}
						</strong>
					</div>

					<div style={summaryTile}>
						<span>Packed By</span>
						<strong>
							{safeText(
								getPackedBy(row)
							)}
						</strong>
					</div>

					<div style={summaryTile}>
						<span>Dispatched By</span>
						<strong>
							{safeText(
								getDispatchedBy(row)
							)}
						</strong>
					</div>

					<div style={summaryTile}>
						<span>Action Date / Time</span>
						<strong>
							{formatDateTime(
								getActionDate(row)
							)}
						</strong>
					</div>
				</div>

				<div style={detailFields}>
					{fields.map(
						([key, value]) => (
							<div
								key={key}
								style={detailField}
							>
								<div
									style={
										detailFieldLabel
									}
								>
									{formatFieldLabel(
										key
									)}
								</div>

								<div
									style={
										detailFieldValue
									}
								>
									{valueForDisplay(
										value
									)}
								</div>
							</div>
						)
					)}
				</div>
			</div>
		</div>
	);
}

function InventoryCommandCenter({
	stats,
	initialType = "all",
	initialSearch = "",
}) {
	const [type, setType] =
		useState(initialType || "all");

	const [fromDate, setFromDate] =
		useState(monthStartDate());

	const [toDate, setToDate] =
		useState(todayDate());

	const [fromTime, setFromTime] =
		useState("");

	const [toTime, setToTime] =
		useState("");

	const [search, setSearch] =
		useState(initialSearch || "");

	const [rows, setRows] =
		useState([]);

	const [loading, setLoading] =
		useState(false);

	const [error, setError] =
		useState("");

	const [page, setPage] =
		useState(0);

	const [pageSize, setPageSize] =
		useState(DEFAULT_PAGE_SIZE);

	const [selectedRow, setSelectedRow] =
		useState(null);

	const currentInventoryExceptions =
		toNumber(
			stats.masterItemsWithoutPackets
		) +
		toNumber(
			stats.packetsWithoutPacketItems
		) +
		toNumber(
			stats.packetItemsWithoutMaster
		) +
		toNumber(
			stats.duplicateCurrentStickers
		) +
		toNumber(
			stats.readyItemsStillInPkd
		);

	const legacyDispatchExceptions =
		toNumber(
			stats.dispatchedWithoutPacketItem
		) +
		toNumber(
			stats.dispatchedWithoutChallan
		) +
		toNumber(
			stats.dispatchedWithoutDriver
		);

	const packetCompletionRate =
		toNumber(stats.packetItems) === 0
			? 0
			: Math.round(
				(
					toNumber(
						stats.packetItemsWithSticker
					) /
					toNumber(
						stats.packetItems
					)
				) * 100
			);

	const dispatchConversion =
		toNumber(stats.packetItems) === 0
			? 0
			: Math.round(
				(
					toNumber(
						stats.dispatchedItems
					) /
					toNumber(
						stats.packetItems
					)
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
								toNumber(
									stats.packetItems
								) -
								currentInventoryExceptions
							) /
							toNumber(
								stats.packetItems
							)
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
					type:
						overrideType,
					from:
						toDateTime(
							fromDate,
							fromTime,
							false
						),
					to:
						toDateTime(
							toDate,
							toTime,
							true
						),
					search:
						search.trim(),
					limit:
						TRACE_FETCH_LIMIT,
					offset: 0,
				});

			const nextRows =
				Array.isArray(data)
					? data
					: Array.isArray(
						data?.content
					)
						? data.content
						: [];

			setRows(nextRows);
			setPage(0);
		} catch (e) {
			console.error(e);

			setRows([]);
			setPage(0);

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

	useEffect(() => {
		setType(initialType || "all");
		setSearch(initialSearch || "");
		setPage(0);
	}, [
		initialType,
		initialSearch,
	]);

	const chips = useMemo(
		() => [
			{
				key: "all",
				label: "All Flow",
				value: toNumber(
					stats.packetItems
				),
			},
			{
				key: "packed",
				label: "Packed",
				value: toNumber(
					stats.packedItems
				),
			},
			{
				key: "generated",
				label: "Stickers",
				value: toNumber(
					stats.stickersGenerated
				),
			},
			{
				key: "pending",
				label: "Pending",
				value: toNumber(
					stats.pendingItems
				),
			},
			{
				key: "dispatched",
				label: "Dispatched",
				value: toNumber(
					stats.dispatchedItems
				),
			},
			{
				key: "challaned",
				label: "Challaned",
				value: toNumber(
					stats.normalDispatchChallans
				),
			},
			{
				key: "custom",
				label: "Custom Challans",
				value: toNumber(
					stats.customChallans
				),
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

	const insightRows = useMemo(
		() => [
			{
				label:
					"Packet Completion",
				value:
					`${packetCompletionRate}%`,
				subtle:
					`${toNumber(
						stats.packetItemsWithSticker
					)} of ${toNumber(
						stats.packetItems
					)} packet items packed`,
				accent: "#22c55e",
			},
			{
				label:
					"Dispatch Conversion",
				value:
					`${dispatchConversion}%`,
				subtle:
					`${toNumber(
						stats.dispatchedItems
					)} packet/item rows dispatched`,
				accent: "#8b5cf6",
			},
			{
				label: "Health Score",
				value:
					`${healthScore}%`,
				subtle:
					`${currentInventoryExceptions} current inventory exceptions`,
				accent:
					healthScore >= 90
						? "#22c55e"
						: "#f97316",
			},
			{
				label:
					"Legacy Dispatch Gaps",
				value:
					legacyDispatchExceptions,
				subtle:
					"Old dispatch rows needing mapping cleanup",
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

	const totalPages =
		Math.max(
			1,
			Math.ceil(
				rows.length /
				pageSize
			)
		);

	const safePage =
		Math.min(
			page,
			totalPages - 1
		);

	const paginatedRows =
		useMemo(() => {
			const start =
				safePage *
				pageSize;

			return rows.slice(
				start,
				start + pageSize
			);
		}, [
			rows,
			safePage,
			pageSize,
		]);

	useEffect(() => {
		setPage(0);
	}, [pageSize]);

	return (
		<div style={wrap}>
			<style>{`
				.packflow-trace-scroll::-webkit-scrollbar {
					width: 10px;
					height: 10px;
				}
				.packflow-trace-scroll::-webkit-scrollbar-track {
					background: rgba(var(--pf-surface-rgb),.92);
					border-radius: 999px;
				}
				.packflow-trace-scroll::-webkit-scrollbar-thumb {
					background: linear-gradient(90deg,#2563eb,#60a5fa);
					border-radius: 999px;
					border: 2px solid rgba(var(--pf-surface-rgb),.95);
				}
				.packflow-trace-scroll::-webkit-scrollbar-thumb:hover {
					background: linear-gradient(90deg,#3b82f6,#93c5fd);
				}
			`}</style>

			<div style={top}>
				<div>
					<div style={eyebrow}>
						INVENTORY COMMAND CENTER
					</div>

					<div style={title}>
						Item, Packet, Sticker & Challan Traceability
					</div>

					<div style={subtitle}>
						Track every item from creation to packing, sticker generation,
						dispatch, user action and data exceptions. Click any row to inspect
						the complete backend record.
					</div>
				</div>

				<div style={healthBox}>
					<span>
						Inventory Health
					</span>

					<strong>
						{healthScore}%
					</strong>
				</div>
			</div>

			<div style={insightGrid}>
				{insightRows.map(
					(item) => (
						<div
							key={item.label}
							style={insightCard(
								item.accent
							)}
						>
							<div
								style={insightLabel}
							>
								{item.label}
							</div>

							<div
								style={insightValue}
							>
								{item.value}
							</div>

							<div
								style={insightSubtle}
							>
								{item.subtle}
							</div>
						</div>
					)
				)}
			</div>

			<div style={chipRow}>
				{chips.map((chip) => (
					<button
						key={chip.key}
						type="button"
						onClick={() =>
							setType(
								chip.key
							)
						}
						style={chipButton(
							type === chip.key
						)}
					>
						<span>
							{chip.label}
						</span>

						<strong>
							{chip.value}
						</strong>
					</button>
				))}
			</div>

			<div style={filterPanel}>
				<label style={fieldWrap}>
					<span>From Date</span>
					<input
						type="date"
						value={fromDate}
						onChange={(e) =>
							setFromDate(
								e.target.value
							)
						}
						style={input}
					/>
				</label>

				<label style={fieldWrap}>
					<span>From Time</span>
					<input
						type="time"
						value={fromTime}
						onChange={(e) =>
							setFromTime(
								e.target.value
							)
						}
						style={input}
					/>
				</label>

				<label style={fieldWrap}>
					<span>To Date</span>
					<input
						type="date"
						value={toDate}
						onChange={(e) =>
							setToDate(
								e.target.value
							)
						}
						style={input}
					/>
				</label>

				<label style={fieldWrap}>
					<span>To Time</span>
					<input
						type="time"
						value={toTime}
						onChange={(e) =>
							setToTime(
								e.target.value
							)
						}
						style={input}
					/>
				</label>

				<label style={searchFieldWrap}>
					<span>Smart Search</span>
					<input
						value={search}
						onChange={(e) =>
							setSearch(
								e.target.value
							)
						}
						placeholder="Item, client, PD, DWG, sticker, challan, user, vehicle..."
						style={searchInput}
						onKeyDown={(e) => {
							if (
								e.key ===
								"Enter"
							) {
								loadTrace();
							}
						}}
					/>
				</label>

				<button
					type="button"
					onClick={() =>
						loadTrace()
					}
					disabled={loading}
					style={primaryButton}
				>
					{loading
						? "Loading..."
						: "Apply"}
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

					<div
						style={
							tableSubtitle
						}
					>
						Loaded {rows.length} rows • page {safePage + 1} of {totalPages}.
						Click a record for complete field-level details.
					</div>
				</div>

				<div style={tableCount}>
					{type.toUpperCase()}
				</div>
			</div>

			<div
				style={tableWrap}
				className="packflow-trace-scroll"
			>
				<table style={table}>
					<thead>
						<tr>
							<th style={th}>Flow</th>
							<th style={th}>Item / Packet</th>
							<th style={th}>Client</th>
							<th style={th}>PD / DWG</th>
							<th style={th}>Sticker</th>
							<th style={th}>Challan</th>
							<th style={th}>Lifecycle Actors</th>
							<th style={th}>Date / Time</th>
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

						{!loading &&
							rows.length ===
							0 && (
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
							paginatedRows.map(
								(row, index) => {
									const accent =
										getBadgeTone(
											row
										);

									const key =
										row.packetItemId ||
										row.packetId ||
										row.masterItemId ||
										row.id ||
										`${row.challanNumber}-${index}`;

									return (
										<tr
											key={key}
											onClick={() =>
												setSelectedRow(
													row
												)
											}
											style={
												clickableRow
											}
										>
											<td
												style={td}
											>
												<div
													style={flowBadge(
														accent
													)}
												>
													{safeText(
														row.sourceType
													)}
												</div>

												<div
													style={smallMuted}
												>
													{safeText(
														row.status ||
														row.movementType
													)}
												</div>
											</td>

											<td
												style={tdStrong}
											>
												<div>
													{safeText(
														row.itemName ||
														row.masterItemName
													)}
												</div>

												<div
													style={smallMuted}
												>
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

												<div
													style={smallMuted}
												>
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

												<div
													style={smallMuted}
												>
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

												<div
													style={smallMuted}
												>
													Print:{" "}
													{safeText(
														row.printIteration
													)}
												</div>
											</td>

											<td style={td}>
												<div style={mono}>
													{safeText(
														row.challanNumber ||
														row.chalaanNumber
													)}
												</div>

												<div
													style={smallMuted}
												>
													Driver:{" "}
													{safeText(
														row.driverName
													)}
												</div>
											</td>

											<td style={td}>
												<div
													style={actorLine}
												>
													<span>
														Created
													</span>
													<strong>
														{safeText(
															getCreatedBy(
																row
															)
														)}
													</strong>
												</div>

												{(
													row.packedBy ||
													row.stickerGeneratedBy ||
													String(
														row.status ||
														""
													).toUpperCase().includes(
														"PACK"
													)
												) && (
														<div
															style={actorLine}
														>
															<span>
																Packed
															</span>
															<strong>
																{safeText(
																	getPackedBy(
																		row
																	)
																)}
															</strong>
														</div>
													)}

												{(
													row.dispatchedBy ||
													row.dispatchBy ||
													row.dispatchedAt ||
													String(
														row.status ||
														""
													).toUpperCase().includes(
														"DISPATCH"
													)
												) && (
														<div
															style={actorLine}
														>
															<span>
																Dispatched
															</span>
															<strong>
																{safeText(
																	getDispatchedBy(
																		row
																	)
																)}
															</strong>
														</div>
													)}
											</td>

											<td style={td}>
												<div>
													{formatDateTime(
														getActionDate(
															row
														)
													)}
												</div>

												<div
													style={smallMuted}
												>
													Created:{" "}
													{formatDateTime(
														row.createdAt
													)}
												</div>

												{row.packedAt && (
													<div
														style={smallMuted}
													>
														Packed:{" "}
														{formatDateTime(
															row.packedAt
														)}
													</div>
												)}

												{row.dispatchedAt && (
													<div
														style={smallMuted}
													>
														Dispatch:{" "}
														{formatDateTime(
															row.dispatchedAt
														)}
													</div>
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

												<div
													style={smallMuted}
												>
													Vehicle:{" "}
													{safeText(
														row.vehicleNumber
													)}
												</div>
											</td>

											<td style={td}>
												{row.exceptionReason ? (
													<div
														style={
															exceptionText
														}
													>
														{row.exceptionReason}
													</div>
												) : (
													<span
														style={okText}
													>
														Clear
													</span>
												)}

												<div
													style={rowHint}
												>
													Open details ↗
												</div>
											</td>
										</tr>
									);
								}
							)}
					</tbody>
				</table>
			</div>

			<div style={pager}>
				<div style={pagerMeta}>
					{rows.length > 0
						? `Showing ${safePage *
						pageSize +
						1
						}–${Math.min(
							(safePage + 1) *
							pageSize,
							rows.length
						)} of ${rows.length}`
						: "No rows"}
				</div>

				<div style={pagerControls}>
					<select
						value={pageSize}
						onChange={(event) =>
							setPageSize(
								Number(
									event.target.value
								) ||
								DEFAULT_PAGE_SIZE
							)
						}
						style={pageSizeSelect}
					>
						{PAGE_SIZE_OPTIONS.map(
							(value) => (
								<option
									key={value}
									value={value}
								>
									{value} / page
								</option>
							)
						)}
					</select>

					<button
						type="button"
						disabled={
							safePage === 0
						}
						onClick={() =>
							setPage(0)
						}
						style={pagerButton(
							safePage === 0
						)}
					>
						«
					</button>

					<button
						type="button"
						disabled={
							safePage === 0
						}
						onClick={() =>
							setPage(
								(current) =>
									Math.max(
										0,
										current -
										1
									)
							)
						}
						style={pagerButton(
							safePage === 0
						)}
					>
						‹
					</button>

					<div
						style={
							pageIndicator
						}
					>
						{safePage + 1} /{" "}
						{totalPages}
					</div>

					<button
						type="button"
						disabled={
							safePage >=
							totalPages - 1
						}
						onClick={() =>
							setPage(
								(current) =>
									Math.min(
										totalPages -
										1,
										current +
										1
									)
							)
						}
						style={pagerButton(
							safePage >=
							totalPages -
							1
						)}
					>
						›
					</button>

					<button
						type="button"
						disabled={
							safePage >=
							totalPages - 1
						}
						onClick={() =>
							setPage(
								totalPages -
								1
							)
						}
						style={pagerButton(
							safePage >=
							totalPages -
							1
						)}
					>
						»
					</button>
				</div>
			</div>

			<TraceRowDetailModal
				row={selectedRow}
				onClose={() =>
					setSelectedRow(null)
				}
			/>
		</div>
	);
}

const wrap = {
	padding: 22,
	colorScheme: "var(--pf-color-scheme)",
	borderRadius: 28,
	background:
		"linear-gradient(180deg, rgba(var(--pf-surface-rgb),.90), rgba(var(--pf-surface-rgb),.76))",
	border:
		"1px solid rgba(var(--pf-fg-rgb),.08)",
	boxShadow:
		"0 14px 34px rgba(var(--pf-shadow-rgb),.10)",
	backdropFilter:
		"blur(20px)",
};

const top = {
	display: "flex",
	justifyContent:
		"space-between",
	gap: 18,
	alignItems:
		"flex-start",
	marginBottom: 18,
	flexWrap: "wrap",
};

const eyebrow = {
	color: "#2563eb",
	fontSize: 11,
	fontWeight: 900,
	letterSpacing: ".14em",
};

const title = {
	marginTop: 6,
	color: "var(--pf-text-strong)",
	fontSize: 26,
	fontWeight: 950,
};

const subtitle = {
	marginTop: 7,
	maxWidth: 920,
	color:
		"rgba(var(--pf-fg-rgb),.62)",
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
	border:
		"1px solid rgba(34,197,94,.24)",
	display: "flex",
	flexDirection: "column",
	gap: 5,
	color:
		"rgba(var(--pf-fg-rgb),.68)",
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
		`radial-gradient(circle at top right, ${accent}22, transparent 42%), rgba(var(--pf-fg-rgb),.035)`,
	border:
		`1px solid ${accent}33`,
});

const insightLabel = {
	color:
		"rgba(var(--pf-fg-rgb),.58)",
	fontSize: 11,
	fontWeight: 900,
	letterSpacing: ".08em",
	textTransform: "uppercase",
};

const insightValue = {
	marginTop: 8,
	color: "var(--pf-text-strong)",
	fontSize: 30,
	fontWeight: 950,
};

const insightSubtle = {
	marginTop: 5,
	color:
		"rgba(var(--pf-fg-rgb),.52)",
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
		: "1px solid rgba(var(--pf-fg-rgb),.08)",
	background: active
		? "linear-gradient(135deg,#2563eb,#3b82f6)"
		: "rgba(var(--pf-fg-rgb),.035)",
	color: active ? "#fff" : "var(--pf-text)",
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
	display: "grid",
	gridTemplateColumns:
		"repeat(4,minmax(118px,.55fr)) minmax(240px,1.7fr) auto",
	gap: 10,
	alignItems: "end",
	padding: 12,
	borderRadius: 18,
	background:
		"rgba(var(--pf-fg-rgb),.035)",
	border:
		"1px solid rgba(var(--pf-fg-rgb),.07)",
	marginBottom: 16,
};

const fieldWrap = {
	minWidth: 0,
	display: "flex",
	flexDirection: "column",
	gap: 5,
	color: "var(--pf-text-muted)",
	fontSize: 9,
	fontWeight: 900,
	textTransform: "uppercase",
	letterSpacing: ".05em",
};

const searchFieldWrap = {
	...fieldWrap,
	minWidth: 280,
};

const input = {
	width: "100%",
	height: 40,
	borderRadius: 12,
	border:
		"1px solid rgba(var(--pf-fg-rgb),.10)",
	background: "var(--pf-input)",
	color: "var(--pf-text-strong)",
	padding: "0 12px",
	outline: "none",
	fontWeight: 800,
	colorScheme: "var(--pf-color-scheme)",
	boxSizing: "border-box",
};

const searchInput = {
	...input,
	minWidth: 0,
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
	background:
		"rgba(239,68,68,.10)",
	border:
		"1px solid rgba(239,68,68,.24)",
	color: "color-mix(in srgb,#dc2626 78%,var(--pf-text-strong))",
	fontWeight: 800,
	marginBottom: 16,
};

const tableTop = {
	display: "flex",
	justifyContent:
		"space-between",
	gap: 14,
	alignItems: "center",
	marginBottom: 10,
	flexWrap: "wrap",
};

const tableTitle = {
	color: "var(--pf-text-strong)",
	fontSize: 18,
	fontWeight: 950,
};

const tableSubtitle = {
	marginTop: 4,
	color:
		"rgba(var(--pf-fg-rgb),.52)",
	fontSize: 12,
	fontWeight: 650,
};

const tableCount = {
	padding: "8px 12px",
	borderRadius: 999,
	background:
		"rgba(96,165,250,.12)",
	color: "#2563eb",
	border:
		"1px solid rgba(96,165,250,.22)",
	fontSize: 12,
	fontWeight: 950,
};

const tableWrap = {
	maxHeight: "58vh",
	overflow: "auto",
	borderRadius: 20,
	border:
		"1px solid rgba(var(--pf-fg-rgb),.08)",
	scrollbarWidth: "thin",
	scrollbarColor:
		"#3b82f6 rgba(var(--pf-surface-rgb),.92)",
};

const table = {
	width: "100%",
	minWidth: 1640,
	borderCollapse: "collapse",
	fontSize: 12,
};

const th = {
	position: "sticky",
	top: 0,
	zIndex: 2,
	padding: "13px 12px",
	textAlign: "left",
	background: "var(--pf-surface-alt)",
	color: "var(--pf-text-muted)",
	fontWeight: 950,
	letterSpacing: ".05em",
	textTransform: "uppercase",
	borderBottom:
		"1px solid rgba(var(--pf-fg-rgb),.08)",
};

const td = {
	padding: "13px 12px",
	color:
		"rgba(var(--pf-fg-rgb),.82)",
	borderBottom:
		"1px solid rgba(var(--pf-fg-rgb),.045)",
	verticalAlign: "top",
};

const tdStrong = {
	...td,
	color: "var(--pf-text-strong)",
	fontWeight: 850,
};

const clickableRow = {
	cursor: "pointer",
};

const flowBadge = (accent) => ({
	display: "inline-flex",
	padding: "5px 9px",
	borderRadius: 999,
	background: `${accent}1F`,
	border:
		`1px solid ${accent}44`,
	color: accent,
	fontSize: 11,
	fontWeight: 950,
});

const smallMuted = {
	marginTop: 4,
	color:
		"rgba(var(--pf-fg-rgb),.48)",
	fontSize: 10,
	fontWeight: 650,
	maxWidth: 240,
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
};

const mono = {
	fontFamily:
		"ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
	fontWeight: 850,
	color: "color-mix(in srgb,#2563eb 78%,var(--pf-text-strong))",
};

const actorLine = {
	display: "grid",
	gridTemplateColumns:
		"66px minmax(0,1fr)",
	gap: 5,
	alignItems: "baseline",
	marginBottom: 4,
	fontSize: 9.5,
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

const rowHint = {
	marginTop: 6,
	color: "#60a5fa",
	fontSize: 9,
	fontWeight: 900,
};

const empty = {
	padding: 28,
	textAlign: "center",
	color: "var(--pf-text-muted)",
	fontWeight: 800,
};

const pager = {
	marginTop: 12,
	padding: 10,
	borderRadius: 15,
	display: "flex",
	justifyContent:
		"space-between",
	alignItems: "center",
	gap: 10,
	flexWrap: "wrap",
	background:
		"rgba(var(--pf-fg-rgb),.025)",
	border:
		"1px solid rgba(var(--pf-fg-rgb),.06)",
};

const pagerMeta = {
	color: "var(--pf-text-muted)",
	fontSize: 11,
	fontWeight: 800,
};

const pagerControls = {
	display: "flex",
	alignItems: "center",
	gap: 5,
};

const pageSizeSelect = {
	height: 32,
	padding: "0 8px",
	borderRadius: 10,
	border:
		"1px solid rgba(96,165,250,.16)",
	background: "var(--pf-input)",
	color: "color-mix(in srgb,#2563eb 78%,var(--pf-text-strong))",
	colorScheme: "var(--pf-color-scheme)",
	fontWeight: 850,
	outline: "none",
};

const pagerButton = (disabled) => ({
	minWidth: 34,
	height: 32,
	padding: "0 9px",
	borderRadius: 10,
	border:
		"1px solid rgba(96,165,250,.14)",
	background:
		"rgba(59,130,246,.07)",
	color: "color-mix(in srgb,#2563eb 78%,var(--pf-text-strong))",
	opacity: disabled ? 0.35 : 1,
	cursor: disabled
		? "not-allowed"
		: "pointer",
	fontWeight: 950,
});

const pageIndicator = {
	minWidth: 62,
	height: 32,
	display: "grid",
	placeItems: "center",
	borderRadius: 10,
	background:
		"rgba(148,163,184,.045)",
	border:
		"1px solid rgba(148,163,184,.08)",
	color: "var(--pf-text)",
	fontSize: 11,
	fontWeight: 900,
};

const detailOverlay = {
	position: "fixed",
	inset: 0,
	zIndex: 16000,
	padding: 18,
	display: "grid",
	placeItems: "center",
	background:
		"rgba(var(--pf-surface-rgb),.84)",
	backdropFilter:
		"blur(14px)",
};

const detailModal = {
	width: "min(1080px,100%)",
	maxHeight:
		"min(880px,calc(100vh - 36px))",
	display: "flex",
	flexDirection: "column",
	overflow: "hidden",
	borderRadius: 26,
	background:
		"radial-gradient(circle at top right,rgba(59,130,246,.13),transparent 30%),linear-gradient(180deg,var(--pf-surface),var(--pf-surface-alt))",
	border:
		"1px solid rgba(96,165,250,.18)",
	boxShadow:
		"0 30px 84px rgba(var(--pf-shadow-rgb),.24)",
	color: "var(--pf-text-strong)",
};

const detailHeader = {
	flexShrink: 0,
	padding: "18px 20px",
	display: "flex",
	justifyContent:
		"space-between",
	gap: 16,
	borderBottom:
		"1px solid rgba(148,163,184,.08)",
};

const detailHeaderIdentity = {
	minWidth: 0,
	display: "flex",
	alignItems: "center",
	gap: 13,
};

const detailIcon = (accent) => ({
	width: 46,
	height: 46,
	flexShrink: 0,
	borderRadius: 14,
	display: "grid",
	placeItems: "center",
	background: `${accent}18`,
	border: `1px solid ${accent}35`,
	color: accent,
	fontSize: 18,
	fontWeight: 950,
});

const detailEyebrow = {
	color: "#2563eb",
	fontSize: 9,
	fontWeight: 950,
	letterSpacing: ".09em",
};

const detailTitle = {
	marginTop: 4,
	fontSize: 21,
	fontWeight: 950,
};

const detailSubtitle = {
	marginTop: 4,
	color: "var(--pf-text-muted)",
	fontSize: 11,
	fontWeight: 700,
};

const closeButton = {
	width: 36,
	height: 36,
	borderRadius: 10,
	border:
		"1px solid rgba(148,163,184,.10)",
	background:
		"rgba(var(--pf-fg-rgb),.04)",
	color: "var(--pf-text-strong)",
	fontSize: 20,
	cursor: "pointer",
};

const detailSummaryGrid = {
	flexShrink: 0,
	display: "grid",
	gridTemplateColumns:
		"repeat(4,minmax(0,1fr))",
	gap: 8,
	padding: "12px 20px",
};

const summaryTile = {
	minWidth: 0,
	padding: 11,
	borderRadius: 13,
	background:
		"rgba(var(--pf-fg-rgb),.035)",
	border:
		"1px solid rgba(148,163,184,.065)",
	display: "flex",
	flexDirection: "column",
	gap: 5,
	color: "var(--pf-text-muted)",
	fontSize: 9,
	fontWeight: 850,
};

const detailFields = {
	minHeight: 0,
	overflowY: "auto",
	display: "grid",
	gridTemplateColumns:
		"repeat(3,minmax(0,1fr))",
	gap: 8,
	padding: "0 20px 20px",
	scrollbarWidth: "thin",
	scrollbarColor:
		"#3b82f6 rgba(var(--pf-surface-rgb),.72)",
};

const detailField = {
	minWidth: 0,
	padding: 11,
	borderRadius: 12,
	background:
		"rgba(var(--pf-surface-rgb),.34)",
	border:
		"1px solid rgba(148,163,184,.055)",
};

const detailFieldLabel = {
	color: "var(--pf-text-muted)",
	fontSize: 8,
	fontWeight: 950,
	textTransform: "uppercase",
	letterSpacing: ".05em",
};

const detailFieldValue = {
	marginTop: 5,
	color: "var(--pf-text)",
	fontSize: 10.5,
	fontWeight: 750,
	whiteSpace: "pre-wrap",
	overflowWrap: "anywhere",
	lineHeight: 1.5,
};

export default InventoryCommandCenter;
