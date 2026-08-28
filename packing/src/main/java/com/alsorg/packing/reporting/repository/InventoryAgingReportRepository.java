package com.alsorg.packing.reporting.repository;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.alsorg.packing.config.TimeZoneConfig;
import com.alsorg.packing.reporting.dto.InventoryAgingRow;

@Repository
public class InventoryAgingReportRepository {

    private final JdbcTemplate jdbc;

    public InventoryAgingReportRepository(
            JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<InventoryAgingRow> fetchInventoryAging() {
        LocalDateTime now = LocalDateTime.now(TimeZoneConfig.APP_ZONE);

        /*
         * Select only the fields required by InventoryAgingRow. The previous
         * repository loaded every matching DispatchedItem entity into Hibernate
         * and then transformed it in Java, which becomes expensive as the
         * operational register grows.
         */
        return jdbc.query(
                """
                select
                    d.zoho_item_id,
                    d.name,
                    d.client_name,
                    cast(d.status as varchar) as status,
                    coalesce(d.stored_at, d.packed_at) as aging_start
                from dispatched_items d
                where upper(coalesce(cast(d.status as varchar), '')) in (
                    'IN_WAREHOUSE',
                    'READY_TO_STORE',
                    'WAREHOUSE_REQUESTED',
                    'READY_TO_DISPATCH',
                    'READY'
                )
                order by
                    coalesce(d.stored_at, d.packed_at) asc nulls last,
                    d.zoho_item_id asc
                """,
                (rs, rowNum) -> {
                    Timestamp timestamp = rs.getTimestamp("aging_start");
                    LocalDateTime start = timestamp == null
                            ? null
                            : timestamp.toLocalDateTime();

                    long days = start == null
                            ? 0L
                            : Math.max(ChronoUnit.DAYS.between(start, now), 0L);

                    String zohoItemId = rs.getString("zoho_item_id");
                    String itemName = rs.getString("name");
                    String status = rs.getString("status");

                    return new InventoryAgingRow(
                            zohoItemId,
                            itemName,
                            rs.getString("client_name"),
                            zohoItemId,
                            itemName,
                            status == null || status.isBlank() ? "UNKNOWN" : status,
                            start,
                            days);
                });
    }
}
