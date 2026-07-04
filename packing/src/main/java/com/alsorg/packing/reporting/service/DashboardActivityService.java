package com.alsorg.packing.reporting.service;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import com.alsorg.packing.reporting.dto.DashboardActivityRow;

@Service
public class DashboardActivityService {

    private static final ZoneId APP_ZONE =
            ZoneId.of("Asia/Kolkata");

    private static final DateTimeFormatter ISO_OFFSET_FORMATTER =
            DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private final JdbcTemplate jdbc;

    public DashboardActivityService(
            JdbcTemplate jdbc
    ) {
        this.jdbc = jdbc;
    }

    public List<DashboardActivityRow> getRecentActivity(
            int limit
    ) {
        int safeLimit =
                Math.min(
                        Math.max(limit, 1),
                        50
                );

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
                """,
                (rs, rowNum) -> {
                    LocalDateTime createdAt =
                            rs.getObject(
                                    "created_at",
                                    LocalDateTime.class
                            );

                    return new DashboardActivityRow(
                            rs.getLong("id"),
                            rs.getString("zoho_item_id"),
                            rs.getString("item_name"),
                            rs.getString("action"),
                            rs.getString("performed_by"),
                            rs.getString("role"),
                            rs.getString("from_status"),
                            rs.getString("to_status"),
                            rs.getString("remarks"),
                            toIsoIst(createdAt)
                    );
                },
                safeLimit
        );
    }

    private String toIsoIst(
            LocalDateTime value
    ) {
        if (value == null) {
            return null;
        }

        /*
         * DB stores LocalDateTime.
         * We treat stored value as India local time and return +05:30.
         */
        return value
                .atZone(APP_ZONE)
                .toOffsetDateTime()
                .format(ISO_OFFSET_FORMATTER);
    }
}