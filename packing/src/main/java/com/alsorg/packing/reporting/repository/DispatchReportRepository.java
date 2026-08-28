package com.alsorg.packing.reporting.repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import com.alsorg.packing.reporting.dto.DispatchReportRow;

@Repository
public class DispatchReportRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public DispatchReportRepository(
            NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<DispatchReportRow> fetchDispatchReport(
            LocalDateTime from,
            LocalDateTime to) {
        StringBuilder sql = new StringBuilder("""
                    with latest_sticker as (
                        select distinct on (sh.packet_item_id)
                            sh.packet_item_id,
                            sh.generated_at,
                            sh.generated_by
                        from sticker_history sh
                        where sh.packet_item_id is not null
                        order by
                            sh.packet_item_id,
                            sh.generated_at desc nulls last,
                            sh.id desc
                    )

                    select
                        d.zoho_item_id,

                        coalesce(
                            nullif(trim(d.pd_no), ''),
                            nullif(trim(pi.pd_no), ''),
                            nullif(trim(mi.pd_no), '')
                        ) as pd_no,

                        coalesce(
                            nullif(trim(d.drawing_no), ''),
                            nullif(trim(pi.drawing_no), ''),
                            nullif(trim(mi.drawing_name), '')
                        ) as drawing_no,

                        coalesce(
                            nullif(trim(d.sku), ''),
                            nullif(trim(pi.sku), '')
                        ) as sku,

                        coalesce(
                            nullif(trim(d.name), ''),
                            nullif(trim(pi.item_name), ''),
                            nullif(trim(mi.item_name), ''),
                            'Unknown Item'
                        ) as item_name,

                        coalesce(
                            nullif(trim(d.description), ''),
                            nullif(trim(pi.description), '')
                        ) as description,

                        coalesce(
                            nullif(trim(d.client_name), ''),
                            nullif(trim(pi.client_name), ''),
                            nullif(trim(mi.client_name), '')
                        ) as client_name,

                        coalesce(
                            nullif(trim(d.client_address), ''),
                            nullif(trim(pi.client_address), ''),
                            nullif(trim(mi.address), '')
                        ) as client_address,

                        coalesce(
                            nullif(trim(d.current_location_code), ''),
                            nullif(trim(d.location), ''),
                            nullif(trim(d.fg_area_code), ''),
                            nullif(trim(d.packed_area_code), ''),
                            nullif(trim(d.warehouse_code), ''),
                            nullif(trim(pi.current_location_code), ''),
                            nullif(trim(pi.location), ''),
                            nullif(trim(pi.warehouse_code), ''),
                            nullif(trim(mi.fg_area_code), ''),
                            nullif(trim(mi.packed_area_code), ''),
                            '-'
                        ) as area,

                        coalesce(
                            nullif(trim(d.plant_code), ''),
                            nullif(trim(pi.plant_code), ''),
                            nullif(trim(mi.plant_code), '')
                        ) as plant_code,

                        coalesce(
                            nullif(trim(pi.floor), ''),
                            nullif(trim(mi.floor), '')
                        ) as floor,

                        coalesce(
                            nullif(trim(pi.packet_number), ''),
                            nullif(trim(d.zoho_item_id), ''),
                            '-'
                        ) as packet_number,

                        coalesce(
                            nullif(trim(pi.item_name), ''),
                            nullif(trim(d.name), ''),
                            nullif(trim(mi.item_name), '')
                        ) as packet_name,

                        coalesce(
                            d.quantity,
                            pi.quantity,
                            1
                        ) as quantity,

                        cast(d.status as varchar) as status,

                        coalesce(
                            d.packed_at,
                            pi.packed_at,
                            ls.generated_at
                        ) as packed_at,

                        coalesce(
                            nullif(trim(d.packed_by), ''),
                            nullif(trim(pi.created_by), ''),
                            nullif(trim(ls.generated_by), ''),
                            nullif(trim(d.created_by), ''),
                            'SYSTEM'
                        ) as packed_by,

                        d.dispatched_at,

                        coalesce(
                            nullif(trim(d.dispatched_by), ''),
                            nullif(trim(d.created_by), ''),
                            'SYSTEM'
                        ) as dispatched_by,

                        d.chalaan_number as challan_number,
                        d.driver_name,
                        d.vehicle_number,

                        coalesce(
                            nullif(trim(d.warehouse_code), ''),
                            nullif(trim(pi.warehouse_code), '')
                        ) as warehouse_code,

                        d.remarks

                    from dispatched_items d

                    left join packet_items pi
                        on pi.id = d.packet_item_id

                    left join master_item mi
                        on mi.id = pi.master_item_id

                    left join latest_sticker ls
                        on ls.packet_item_id = pi.id

                    where upper(
                            coalesce(
                                cast(d.status as varchar),
                                ''
                            )
                          ) = 'DISPATCHED'

                      and d.dispatched_at is not null
                """);

        MapSqlParameterSource params = new MapSqlParameterSource();

        if (from != null) {
            sql.append("""
                        and d.dispatched_at >= :from
                    """);
            params.addValue("from", from);
        }

        if (to != null) {
            sql.append("""
                        and d.dispatched_at <= :to
                    """);
            params.addValue("to", to);
        }

        sql.append("""
                    order by
                        d.dispatched_at desc nulls last,
                        d.chalaan_number desc nulls last,
                        packet_number asc nulls last,
                        item_name asc nulls last
                """);

        return jdbc.query(
                sql.toString(),
                params,
                dispatchRowMapper());
    }

    private RowMapper<DispatchReportRow> dispatchRowMapper() {
        return (rs, rowNum) -> new DispatchReportRow(
                rs.getString("zoho_item_id"),
                rs.getString("pd_no"),
                rs.getString("drawing_no"),
                rs.getString("sku"),
                rs.getString("item_name"),
                rs.getString("description"),
                rs.getString("client_name"),
                rs.getString("client_address"),
                rs.getString("area"),
                rs.getString("plant_code"),
                rs.getString("floor"),
                rs.getString("packet_number"),
                rs.getString("packet_name"),
                getInteger(rs, "quantity"),
                rs.getString("status"),
                getLocalDateTime(rs, "packed_at"),
                rs.getString("packed_by"),
                getLocalDateTime(rs, "dispatched_at"),
                rs.getString("dispatched_by"),
                rs.getString("challan_number"),
                rs.getString("driver_name"),
                rs.getString("vehicle_number"),
                rs.getString("warehouse_code"),
                rs.getString("remarks"));
    }

    private Integer getInteger(
            ResultSet rs,
            String column) throws SQLException {
        Object value = rs.getObject(column);

        if (value == null) {
            return null;
        }

        if (value instanceof Number number) {
            return number.intValue();
        }

        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (Exception exception) {
            return null;
        }
    }

    private LocalDateTime getLocalDateTime(
            ResultSet rs,
            String column) throws SQLException {
        Timestamp timestamp = rs.getTimestamp(column);

        return timestamp == null
                ? null
                : timestamp.toLocalDateTime();
    }
}
