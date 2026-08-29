import {
	useEffect,
	useState,
} from "react";

import {
	getBackendMessage,
} from "./logisticsAlertUtils";

import {
	updateShiftStatus,
} from "../../api/logisticsApi";

import {
	getCachedShifts,
	invalidateLogisticsResources,
} from "./logisticsReadCache";

import {
	formatShiftDate,
	formatShiftTimeRange,
	isShiftOverSixPm,
} from "./logisticsDateTimeUtils";

import LogisticsPagination from "./LogisticsPagination";
import useLogisticsLiveRefresh from "./useLogisticsLiveRefresh";

const normalizeStatus = (status) =>
	String(status || "WORKING")
		.trim()
		.toUpperCase();

const statusOptions = [
	"WORKING",
	"OFF",
	"ON_LEAVE",
	"COMPLETED",
	"CANCELLED",
];

const getShiftSearchText = (shift) => {
	return [
		shift.driver?.name,
		shift.vehicle?.vehicleNumber,
		formatShiftDate(shift),
		formatShiftTimeRange(shift),
		shift.totalTrips,
		shift.routeCategory,
		normalizeStatus(shift.status),
	]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();
};

function ShiftHistory({
	showAlert = () => { },
	liveRefreshToken = null,
	cacheScope = "",
}) {
	const [loading, setLoading] =
		useState(true);

	const [shifts, setShifts] =
		useState([]);

	const [pageNo, setPageNo] =
		useState(1);

	const [pageSize, setPageSize] =
		useState(25);

	const [selectedIds, setSelectedIds] =
		useState([]);

	const [bulkStatus, setBulkStatus] =
		useState("");

	const [search, setSearch] =
		useState("");

	const loadHistory = async ({
		background = false,
		force = false,
	} = {}) => {
		try {
			if (!background) {
				setLoading(true);
			}

			const data = await getCachedShifts(cacheScope, { force });

			setShifts(
				Array.isArray(data) ? data : []
			);
		} catch (e) {
			if (!background) {
				showAlert(
					getBackendMessage(
						e,
						"Failed to load shift history"
					),
					"error"
				);
			}
		} finally {
			if (!background) {
				setLoading(false);
			}
		}
	};

	useEffect(() => {
		void loadHistory({ force: false });
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useLogisticsLiveRefresh(
		liveRefreshToken,
		async () => {
			await loadHistory({
				background: true,
				force: false,
			});
		}
	);

	const historyRows = shifts.filter((s) => {
		const status = normalizeStatus(s.status);

		return [
			"COMPLETED",
			"CANCELLED",
		].includes(status);
	});

	const searchTerm =
		search.trim().toLowerCase();

	const filteredHistoryRows =
		searchTerm.length === 0
			? historyRows
			: historyRows.filter((s) =>
				getShiftSearchText(s).includes(
					searchTerm
				)
			);

	const totalPages = Math.max(
		1,
		Math.ceil(
			filteredHistoryRows.length / pageSize
		)
	);

	const currentPage = Math.min(
		pageNo,
		totalPages
	);

	const paginatedRows =
		filteredHistoryRows.slice(
			(currentPage - 1) * pageSize,
			currentPage * pageSize
		);

	const visibleIds = paginatedRows.map(
		(s) => s.id
	);

	const allVisibleSelected =
		visibleIds.length > 0 &&
		visibleIds.every((id) =>
			selectedIds.includes(id)
		);

	const toggleOne = (id) => {
		setSelectedIds((prev) =>
			prev.includes(id)
				? prev.filter((x) => x !== id)
				: [...prev, id]
		);
	};

	const toggleAllVisible = () => {
		if (allVisibleSelected) {
			setSelectedIds((prev) =>
				prev.filter(
					(id) => !visibleIds.includes(id)
				)
			);
		} else {
			setSelectedIds((prev) =>
				Array.from(
					new Set([
						...prev,
						...visibleIds,
					])
				)
			);
		}
	};

	const clearSelection = () => {
		setSelectedIds([]);
		setBulkStatus("");
	};

	const bulkChangeStatus = async () => {
		if (selectedIds.length === 0) {
			showAlert(
				"Please select at least one shift",
				"error"
			);
			return;
		}

		if (!bulkStatus) {
			showAlert(
				"Please select a status",
				"error"
			);
			return;
		}

		try {
			const ids = [...selectedIds];

			const results =
				await Promise.allSettled(
					ids.map((id) =>
						updateShiftStatus(
							id,
							bulkStatus
						)
					)
				);

			const failedIds =
				ids.filter(
					(_, index) =>
						results[index]?.status ===
						"rejected"
				);

			const successCount =
				ids.length -
				failedIds.length;

			invalidateLogisticsResources(cacheScope, ["shifts"]);
			await loadHistory({ force: true });

			if (failedIds.length === 0) {
				showAlert(
					[
						"WORKING",
						"OFF",
						"ON_LEAVE",
					].includes(bulkStatus)
						? "Selected shifts moved back to operations"
						: "Selected shifts updated successfully",
					"success"
				);

				clearSelection();
				return;
			}

			setSelectedIds(failedIds);

			showAlert(
				`${successCount} shift${successCount === 1 ? "" : "s"} updated, ${failedIds.length} failed. Failed rows remain selected for retry.`,
				successCount > 0
					? "warning"
					: "error"
			);
		} catch (e) {
			console.error(e);

			showAlert(
				getBackendMessage(
					e,
					"Failed to update selected shifts"
				),
				"error"
			);
		}
	};

	const quickStatusChange =
		async (shift, nextStatus) => {
			try {
				const currentStatus =
					normalizeStatus(shift.status);

				if (currentStatus === nextStatus) {
					return;
				}

				await updateShiftStatus(
					shift.id,
					nextStatus
				);
				invalidateLogisticsResources(cacheScope, ["shifts"]);

				await loadHistory({ force: true });

				showAlert(
					[
						"WORKING",
						"OFF",
						"ON_LEAVE",
					].includes(nextStatus)
						? "Shift moved back to operations"
						: "Shift status updated successfully",
					"success"
				);

			} catch (e) {
				console.error(e);

				showAlert(
					getBackendMessage(
						e,
						"Failed to update shift status"
					),
					"error"
				);
			}
		};

	return (
		<div style={wrap}>
			<div style={header}>
				<div>
					<div style={title}>
						Operations History
					</div>

					<div style={subtitle}>
						Historical logistics operations
					</div>
				</div>
			</div>
			<div style={bulkBar}>
				<input
					value={search}
					onChange={(e) => {
						setSearch(e.target.value);
						setPageNo(1);
						setSelectedIds([]);
					}}
					placeholder="Search driver, vehicle, date, route, status..."
					style={searchInput}
				/>
				<div style={bulkInfo}>
					Selected:{" "}
					<strong>{selectedIds.length}</strong>
				</div>

				<select
					value={bulkStatus}
					onChange={(e) =>
						setBulkStatus(e.target.value)
					}
					style={bulkSelect}
				>
					<option value="">
						Select Status
					</option>

					{statusOptions.map((status) => (
						<option
							key={status}
							value={status}
						>
							{status}
						</option>
					))}
				</select>

				<button
					style={{
						...bulkBtn,
						opacity:
							selectedIds.length === 0 ||
								!bulkStatus
								? 0.55
								: 1,
						cursor:
							selectedIds.length === 0 ||
								!bulkStatus
								? "not-allowed"
								: "pointer",
					}}
					disabled={
						selectedIds.length === 0 ||
						!bulkStatus
					}
					onClick={bulkChangeStatus}
				>
					Bulk Change Status
				</button>

				{selectedIds.length > 0 && (
					<button
						style={clearBtn}
						onClick={clearSelection}
					>
						Clear
					</button>
				)}
			</div>
			<div style={table}>
				<div style={head}>
					<div>
						<input
							type="checkbox"
							checked={allVisibleSelected}
							onChange={toggleAllVisible}
							title="Select all visible history shifts"
						/>
					</div>

					<div>Driver</div>
					<div>Vehicle</div>
					<div>Date</div>
					<div>Trips</div>
					<div>Route</div>
					<div>Status</div>
				</div>

				{loading && (
					<div style={emptyRow}>
						Loading shift history...
					</div>
				)}

				{!loading &&
					paginatedRows.length === 0 && (
						<div style={emptyRow}>
							{search
								? "No shift history matched your search"
								: "No completed or cancelled shift history found"}
						</div>
					)}

				{!loading &&
					paginatedRows.map((s) => (
						<div
							key={s.id}
							style={{
								...row,
								...(isShiftOverSixPm(s)
									? lateShiftRow
									: {}),
							}}
						>
							<div>
								<input
									type="checkbox"
									checked={selectedIds.includes(
										s.id
									)}
									onChange={() =>
										toggleOne(s.id)
									}
								/>
							</div>
							<div>
								{s.driver?.name || "-"}
							</div>

							<div>
								{s.vehicle?.vehicleNumber || "-"}
							</div>

							<div>
								<div style={dateText}>
									{formatShiftDate(s)}
								</div>

								<div
									style={{
										...timeText,
										...(isShiftOverSixPm(s)
											? lateTimeText
											: {}),
									}}
								>
									{formatShiftTimeRange(s)}
								</div>

								{isShiftOverSixPm(s) && (
									<div style={lateBadge}>
										Over Shift
									</div>
								)}
							</div>

							<div>
								{s.totalTrips ?? "-"}
							</div>

							<div>
								{s.routeCategory || "-"}
							</div>

							<div>
								<select
									value={normalizeStatus(s.status)}
									onChange={(e) =>
										quickStatusChange(
											s,
											e.target.value
										)
									}
									style={statusSelect(
										normalizeStatus(s.status)
									)}
								>
									{statusOptions.map((status) => (
										<option
											key={status}
											value={status}
										>
											{status}
										</option>
									))}
								</select>
							</div>
						</div>
					))}
			</div>

			<LogisticsPagination
				pageNo={currentPage}
				setPageNo={setPageNo}
				pageSize={pageSize}
				setPageSize={setPageSize}
				totalItems={filteredHistoryRows.length}
			/>
		</div>
	);
}

const wrap = {
  background: "var(--pf-surface)",
  color: "var(--pf-text-strong)",
  borderRadius: 18,
  padding: 22,
  border: "1px solid var(--pf-border)",
  boxShadow: "var(--pf-card-shadow)",
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 18,
};

const title = {
  color: "var(--pf-text-strong)",
  fontSize: 24,
  fontWeight: 900,
  letterSpacing: "-.015em",
};

const subtitle = {
  color: "var(--pf-text-muted)",
  marginTop: 6,
  fontSize: 12,
  fontWeight: 650,
};

const table = {
  overflowX: "auto",
  overflowY: "hidden",
  borderRadius: 14,
  background: "var(--pf-surface)",
  border: "1px solid var(--pf-border)",
};

const head = {
  minWidth: 940,
  display: "grid",
  gridTemplateColumns: ".35fr 1.05fr 1fr 1.1fr .55fr .85fr 1fr",
  padding: "13px 14px",
  background: "var(--pf-surface-alt)",
  color: "var(--pf-text-muted)",
  fontWeight: 850,
  fontSize: 11,
  borderBottom: "1px solid var(--pf-border)",
};

const row = {
  minWidth: 940,
  display: "grid",
  gridTemplateColumns: ".35fr 1.05fr 1fr 1.1fr .55fr .85fr 1fr",
  padding: "13px 14px",
  color: "var(--pf-text)",
  borderTop: "1px solid var(--pf-border-soft)",
  alignItems: "center",
  fontSize: 12,
};

const emptyRow = {
  padding: 28,
  color: "var(--pf-text-muted)",
  textAlign: "center",
  borderTop: "1px solid var(--pf-border-soft)",
};

const searchInput = {
  flex: "1 1 320px",
  height: 38,
  minWidth: 260,
  borderRadius: 10,
  border: "1px solid var(--pf-border)",
  background: "var(--pf-input)",
  color: "var(--pf-text-strong)",
  padding: "0 12px",
  outline: "none",
  fontWeight: 700,
  colorScheme: "var(--pf-color-scheme)",
};

const dateText = {
  color: "var(--pf-text-strong)",
  fontWeight: 850,
  fontSize: 13,
};

const timeText = {
  color: "var(--pf-text-muted)",
  fontSize: 11,
  marginTop: 4,
};

const lateShiftRow = {
  background: "linear-gradient(90deg,rgba(245,158,11,.10),transparent)",
  borderLeft: "3px solid #f59e0b",
};

const lateTimeText = {
  color: "#d97706",
  fontWeight: 850,
};

const lateBadge = {
  display: "inline-flex",
  marginTop: 6,
  padding: "4px 8px",
  borderRadius: 999,
  background: "rgba(245,158,11,.12)",
  color: "#d97706",
  border: "1px solid rgba(245,158,11,.24)",
  fontSize: 10,
  fontWeight: 900,
};

const bulkBar = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 14,
  padding: 10,
  borderRadius: 13,
  background: "var(--pf-surface-alt)",
  border: "1px solid var(--pf-border-soft)",
};

const bulkInfo = {
  marginRight: "auto",
  color: "var(--pf-text-muted)",
  fontSize: 12,
  fontWeight: 750,
};

const bulkSelect = {
  height: 38,
  borderRadius: 10,
  border: "1px solid var(--pf-border)",
  background: "var(--pf-input)",
  color: "var(--pf-text-strong)",
  padding: "0 12px",
  outline: "none",
  fontWeight: 750,
  colorScheme: "var(--pf-color-scheme)",
};

const bulkBtn = {
  height: 38,
  borderRadius: 10,
  border: "none",
  background: "linear-gradient(135deg,#2563eb,#3b82f6)",
  color: "#fff",
  padding: "0 14px",
  fontWeight: 850,
};

const clearBtn = {
  height: 38,
  borderRadius: 10,
  border: "1px solid var(--pf-border)",
  background: "var(--pf-surface)",
  color: "var(--pf-text)",
  padding: "0 14px",
  fontWeight: 800,
  cursor: "pointer",
};

const statusSelect = (value) => ({
  height: 32,
  borderRadius: 999,
  border: "1px solid var(--pf-border)",
  padding: "0 10px",
  color:
    value === "WORKING"
      ? "#16a34a"
      : value === "COMPLETED"
        ? "#2563eb"
        : value === "CANCELLED"
          ? "#dc2626"
          : value === "OFF" || value === "ON_LEAVE"
            ? "#d97706"
            : "var(--pf-text)",
  background:
    value === "WORKING"
      ? "rgba(34,197,94,.10)"
      : value === "COMPLETED"
        ? "rgba(59,130,246,.10)"
        : value === "CANCELLED"
          ? "rgba(239,68,68,.10)"
          : value === "OFF" || value === "ON_LEAVE"
            ? "rgba(245,158,11,.11)"
            : "var(--pf-surface-alt)",
  fontSize: 12,
  fontWeight: 850,
  outline: "none",
  colorScheme: "var(--pf-color-scheme)",
});

export default ShiftHistory;