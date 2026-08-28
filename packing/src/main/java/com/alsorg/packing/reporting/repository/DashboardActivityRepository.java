package com.alsorg.packing.reporting.repository;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.alsorg.packing.config.TimeZoneConfig;
import com.alsorg.packing.reporting.dto.DashboardActivityRow;

@Repository
public class DashboardActivityRepository {

    private static final DateTimeFormatter ISO_OFFSET_FORMATTER =
            DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private final JdbcTemplate jdbc;

    public DashboardActivityRepository(
            JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<DashboardActivityRow> fetchRecent(
            int limit,
            int offset) {
        int safeLimit = Math.min(Math.max(limit, 1), 50);
        int safeOffset = Math.max(offset, 0);

        return jdbc.query(
                """
                select
                    al.id,
                    al.zoho_item_id,
                    al.action,
                    al.performed_by,
                    al.role,
                    al.from_status,
                    al.to_status,
                    al.remarks,
                    al.created_at,
                    coalesce(
                        pi.item_name,
                        d.name,
                        pi.client_name,
                        d.client_name,
                        al.zoho_item_id,
                        'Unknown Item'
                    ) as item_name
                from activity_logs al
                left join packet_items pi
                    on pi.id::text = al.zoho_item_id
                left join dispatched_items d
                    on d.zoho_item_id = al.zoho_item_id
                order by
                    al.created_at desc nulls last,
                    al.id desc
                limit ?
                offset ?
                """,
                (rs, rowNum) -> new DashboardActivityRow(
                        rs.getLong("id"),
                        rs.getString("zoho_item_id"),
                        rs.getString("item_name"),
                        rs.getString("action"),
                        rs.getString("performed_by"),
                        rs.getString("role"),
                        rs.getString("from_status"),
                        rs.getString("to_status"),
                        rs.getString("remarks"),
                        toIsoIst(readLocalDateTime(rs.getObject("created_at")))),
                safeLimit,
                safeOffset);
    }

    private LocalDateTime readLocalDateTime(Object value) {
        if (value == null) {
            return null;
        }

        if (value instanceof LocalDateTime localDateTime) {
            return localDateTime;
        }

        if (value instanceof Timestamp timestamp) {
            return timestamp.toLocalDateTime();
        }

        try {
            return LocalDateTime.parse(String.valueOf(value).replace(" ", "T"));
        } catch (Exception exception) {
            return null;
        }
    }

    private String toIsoIst(LocalDateTime value) {
        if (value == null) {
            return null;
        }

        return value
                .atZone(TimeZoneConfig.APP_ZONE)
                .toOffsetDateTime()
                .format(ISO_OFFSET_FORMATTER);
    }
}
