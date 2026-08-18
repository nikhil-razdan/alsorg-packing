package com.alsorg.packing.reporting.service;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import com.alsorg.packing.reporting.dto.PackingVolumeRow;

@Service
public class PackingVolumeReportService {

    private final JdbcTemplate jdbc;
    private final DimensionVolumeCalculator volumeCalculator;

    public PackingVolumeReportService(
            JdbcTemplate jdbc,
            DimensionVolumeCalculator volumeCalculator
    ) {
        this.jdbc = jdbc;
        this.volumeCalculator = volumeCalculator;
    }

    /**
     * Returns one row per packet item packed in the selected range.
     *
     * packet_items is the authoritative source because this is where PackFlow
     * stores the packet dimensions, packed_at and packed_by values entered / set
     * during the packing workflow.
     */
    public List<PackingVolumeRow> getPackingVolumeReport(
            LocalDateTime from,
            LocalDateTime to
    ) {
        if (from != null && to != null && from.isAfter(to)) {
            throw new IllegalArgumentException("'from' must be before or equal to 'to'");
        }

        StringBuilder sql = new StringBuilder("""
                select
                    pi.id as packet_item_id,
                    coalesce(
                        nullif(trim(pi.zoho_item_id), ''),
                        pi.id::text
                    ) as report_item_id,
                    pi.pd_no,
                    pi.drawing_no,
                    pi.sku,
                    pi.item_name,
                    pi.description,
                    pi.client_name,
                    pi.client_address,
                    pi.plant_code,
                    pi.floor,
                    pi.packet_number,
                    coalesce(pi.quantity, 1) as quantity,
                    pi.dimensions,
                    pi.packed_at,
                    coalesce(
                        nullif(trim(pi.packed_by), ''),
                        nullif(trim(pi.created_by), ''),
                        'SYSTEM'
                    ) as packed_by,
                    pi.status,
                    pi.sticker_number
                from packet_items pi
                where pi.packed_at is not null
                """);

        List<Object> args = new ArrayList<>();

        if (from != null) {
            sql.append(" and pi.packed_at >= ? ");
            args.add(Timestamp.valueOf(from));
        }

        if (to != null) {
            sql.append(" and pi.packed_at <= ? ");
            args.add(Timestamp.valueOf(to));
        }

        sql.append(" order by pi.packed_at desc, pi.id asc ");

        return jdbc.query(
                sql.toString(),
                (rs, rowNum) -> {
                    String dimensions = rs.getString("dimensions");

                    return new PackingVolumeRow(
                            readUuid(rs.getObject("packet_item_id")),
                            rs.getString("report_item_id"),
                            rs.getString("pd_no"),
                            rs.getString("drawing_no"),
                            rs.getString("sku"),
                            rs.getString("item_name"),
                            rs.getString("description"),
                            rs.getString("client_name"),
                            rs.getString("client_address"),
                            rs.getString("plant_code"),
                            rs.getString("floor"),
                            rs.getString("packet_number"),
                            rs.getObject("quantity", Integer.class),
                            dimensions,
                            volumeCalculator.calculateCbm(dimensions),
                            rs.getTimestamp("packed_at") == null
                                    ? null
                                    : rs.getTimestamp("packed_at").toLocalDateTime(),
                            rs.getString("packed_by"),
                            rs.getString("status"),
                            rs.getString("sticker_number")
                    );
                },
                args.toArray()
        );
    }

    private UUID readUuid(Object value) {
        if (value == null) {
            return null;
        }

        if (value instanceof UUID uuid) {
            return uuid;
        }

        try {
            return UUID.fromString(String.valueOf(value));
        } catch (Exception e) {
            return null;
        }
    }
}
