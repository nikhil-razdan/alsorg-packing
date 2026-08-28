package com.alsorg.packing.reporting.repository;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;

import org.springframework.stereotype.Repository;

import com.alsorg.packing.reporting.dto.MasterItemReportRow;

@Repository
public class MasterItemReportRepository {

    @PersistenceContext
    private EntityManager em;

    public List<MasterItemReportRow> fetchMasterItems(
            String status,
            String search,
            String plantCode,
            String client,
            LocalDateTime from,
            LocalDateTime to,
            int limit,
            int offset) {
        int safeLimit = Math.min(
                Math.max(limit, 1),
                1000);

        int safeOffset = Math.max(offset, 0);
        String normalizedStatus = normalizeStatus(status);

        StringBuilder sql = new StringBuilder(
                """
                    with latest_packed_user as (
                        select distinct on (pi.master_item_id)
                            pi.master_item_id,
                            coalesce(pi.created_by, sh.generated_by, 'SYSTEM') as packed_by
                        from packet_items pi
                        left join sticker_history sh
                            on sh.packet_item_id = pi.id
                        where pi.master_item_id is not null
                          and (
                                pi.packed_at is not null
                                or pi.sticker_number is not null
                                or sh.id is not null
                          )
                        order by
                            pi.master_item_id,
                            coalesce(pi.packed_at, sh.generated_at) desc nulls last
                    ),

                    latest_dispatch_user as (
                        select distinct on (pi.master_item_id)
                            pi.master_item_id,
                            coalesce(d.dispatched_by, d.created_by, 'SYSTEM') as dispatched_by
                        from packet_items pi
                        join dispatched_items d
                            on d.packet_item_id = pi.id
                        where pi.master_item_id is not null
                          and d.dispatched_at is not null
                        order by
                            pi.master_item_id,
                            d.dispatched_at desc nulls last
                    ),

                    base as (
                        select
                            mi.id as master_item_id,
                            mi.created_at,
                            mi.item_name,
                            mi.pd_no,
                            mi.drawing_name,
                            mi.client_name,
                            mi.address as client_address,
                            mi.floor,
                            mi.plant_code,
                            mi.packed_area_code,
                            mi.fg_area_code,
                            mi.allowed_warehouse_codes,
                            mi.total_packets as expected_packets,
                            count(distinct pi.packet_id) as actual_packets,
                            count(distinct pi.id) as packet_items,
                            count(distinct case
                                when pi.sticker_number is not null
                                  or pi.packed_at is not null
                                  or sh.id is not null
                                then pi.id
                            end) as packed_packet_items,
                            count(distinct case
                                when pi.id is not null
                                  and pi.sticker_number is null
                                  and pi.packed_at is null
                                  and sh.id is null
                                then pi.id
                            end) as pending_packet_items,
                            count(distinct case
                                when upper(coalesce(cast(d.status as varchar), '')) = 'DISPATCHED'
                                then pi.id
                            end) as dispatched_packet_items,
                            count(distinct sh.id) as sticker_count,
                            count(distinct case
                                when d.chalaan_number is not null
                                  and trim(d.chalaan_number) <> ''
                                then d.chalaan_number
                            end) as challan_count,
                            min(coalesce(pi.packed_at, sh.generated_at)) as first_packed_at,
                            max(coalesce(pi.packed_at, sh.generated_at)) as last_packed_at,
                            min(d.dispatched_at) as first_dispatched_at,
                            max(d.dispatched_at) as last_dispatched_at,
                            lpu.packed_by as last_packed_by,
                            ldu.dispatched_by as last_dispatched_by
                        from master_item mi
                        left join packet_items pi
                            on pi.master_item_id = mi.id
                        left join sticker_history sh
                            on sh.packet_item_id = pi.id
                        left join dispatched_items d
                            on d.packet_item_id = pi.id
                        left join latest_packed_user lpu
                            on lpu.master_item_id = mi.id
                        left join latest_dispatch_user ldu
                            on ldu.master_item_id = mi.id
                        group by
                            mi.id,
                            mi.created_at,
                            mi.item_name,
                            mi.pd_no,
                            mi.drawing_name,
                            mi.client_name,
                            mi.address,
                            mi.floor,
                            mi.plant_code,
                            mi.packed_area_code,
                            mi.fg_area_code,
                            mi.allowed_warehouse_codes,
                            mi.total_packets,
                            lpu.packed_by,
                            ldu.dispatched_by
                    ),

                    final_rows as (
                        select
                            b.*,
                            case
                                when b.packet_items = 0 then 0
                                else round(
                                    (
                                        b.packed_packet_items::numeric
                                        / nullif(b.packet_items, 0)
                                    ) * 100,
                                    2
                                )
                            end as packing_progress,
                            case
                                when b.packet_items = 0
                                    then 'NO_PACKETS'
                                when b.packet_items = b.packed_packet_items
                                    then 'FULLY_PACKED'
                                when b.packed_packet_items > 0
                                    then 'PARTIALLY_PACKED'
                                else 'UNPACKED'
                            end as packing_status,
                            case
                                when b.dispatched_packet_items > 0
                                    then 'DISPATCHED'
                                when b.packed_packet_items > 0
                                    then 'PACKED'
                                when b.packet_items > 0
                                    then 'CREATED'
                                else 'NO_PACKETS'
                            end as latest_status,
                            nullif(trim(concat_ws('; ',
                                case
                                    when b.packet_items = 0
                                        then 'Master item has no packet items'
                                end,
                                case
                                    when b.expected_packets is not null
                                         and b.expected_packets <> b.actual_packets
                                        then 'Expected packet count does not match actual packets'
                                end,
                                case
                                    when b.packet_items > 0
                                         and b.actual_packets = 0
                                        then 'Packet items exist but packet link missing'
                                end
                            )), '') as exception_reason
                        from base b
                    )

                    select
                        f.master_item_id,
                        f.item_name,
                        f.pd_no,
                        f.drawing_name,
                        f.client_name,
                        f.client_address,
                        f.floor,
                        f.plant_code,
                        f.packed_area_code,
                        f.fg_area_code,
                        f.allowed_warehouse_codes,
                        f.expected_packets,
                        f.actual_packets,
                        f.packet_items,
                        f.packed_packet_items,
                        f.pending_packet_items,
                        f.dispatched_packet_items,
                        f.sticker_count,
                        f.challan_count,
                        f.packing_progress,
                        f.packing_status,
                        f.latest_status,
                        f.created_at,
                        f.first_packed_at,
                        f.last_packed_at,
                        f.first_dispatched_at,
                        f.last_dispatched_at,
                        f.last_packed_by,
                        f.last_dispatched_by,
                        f.exception_reason
                    from final_rows f
                    where 1 = 1
                """);

        appendStatusFilter(sql, normalizedStatus);

        if (from != null) {
            sql.append(" and f.created_at >= :from ");
        }

        if (to != null) {
            sql.append(" and f.created_at <= :to ");
        }

        if (plantCode != null && !plantCode.isBlank()) {
            sql.append("""
                        and upper(coalesce(f.plant_code, '')) = :plantCode
                    """);
        }

        if (client != null && !client.isBlank()) {
            sql.append("""
                        and lower(coalesce(f.client_name, '')) like :client
                    """);
        }

        if (search != null && !search.isBlank()) {
            sql.append("""
                        and lower(concat_ws(' ',
                            f.master_item_id::text,
                            f.item_name,
                            f.pd_no,
                            f.drawing_name,
                            f.client_name,
                            f.client_address,
                            f.floor,
                            f.plant_code,
                            f.packed_area_code,
                            f.fg_area_code,
                            f.allowed_warehouse_codes,
                            f.packing_status,
                            f.latest_status,
                            f.last_packed_by,
                            f.last_dispatched_by,
                            f.exception_reason
                        )) like :search
                    """);
        }

        sql.append("""
                    order by
                        f.created_at desc nulls last,
                        f.item_name asc nulls last
                    limit :limit
                    offset :offset
                """);

        Query query = em.createNativeQuery(sql.toString());

        if (from != null) {
            query.setParameter("from", from);
        }

        if (to != null) {
            query.setParameter("to", to);
        }

        if (plantCode != null && !plantCode.isBlank()) {
            query.setParameter(
                    "plantCode",
                    plantCode.trim().toUpperCase());
        }

        if (client != null && !client.isBlank()) {
            query.setParameter(
                    "client",
                    "%" + client.trim().toLowerCase() + "%");
        }

        if (search != null && !search.isBlank()) {
            query.setParameter(
                    "search",
                    "%" + search.trim().toLowerCase() + "%");
        }

        query.setParameter("limit", safeLimit);
        query.setParameter("offset", safeOffset);

        @SuppressWarnings("unchecked")
        List<Object[]> rows = query.getResultList();

        return rows.stream()
                .map(this::mapRow)
                .toList();
    }

    private void appendStatusFilter(
            StringBuilder sql,
            String status) {
        switch (status) {
            case "FULLY_PACKED" ->
                sql.append(" and f.packing_status = 'FULLY_PACKED' ");

            case "PARTIALLY_PACKED" ->
                sql.append(" and f.packing_status = 'PARTIALLY_PACKED' ");

            case "UNPACKED" ->
                sql.append(" and f.packing_status = 'UNPACKED' ");

            case "NO_PACKETS" ->
                sql.append(" and f.packing_status = 'NO_PACKETS' ");

            case "DISPATCHED" ->
                sql.append(" and f.dispatched_packet_items > 0 ");

            case "EXCEPTIONS" ->
                sql.append(" and f.exception_reason is not null ");

            default -> {
            }
        }
    }

    private String normalizeStatus(
            String value) {
        if (value == null || value.isBlank()) {
            return "ALL";
        }

        return switch (value.trim()
                .replace("-", "_")
                .replace(" ", "_")
                .toUpperCase()) {
            case "FULLY_PACKED" -> "FULLY_PACKED";
            case "PARTIALLY_PACKED", "PARTIAL" -> "PARTIALLY_PACKED";
            case "UNPACKED" -> "UNPACKED";
            case "NO_PACKETS", "WITHOUT_PACKETS" -> "NO_PACKETS";
            case "DISPATCHED" -> "DISPATCHED";
            case "EXCEPTION", "EXCEPTIONS", "ERROR", "ERRORS" -> "EXCEPTIONS";
            default -> "ALL";
        };
    }

    private MasterItemReportRow mapRow(
            Object[] row) {
        return new MasterItemReportRow(
                asUuid(row[0]),
                asString(row[1]),
                asString(row[2]),
                asString(row[3]),
                asString(row[4]),
                asString(row[5]),
                asString(row[6]),
                asString(row[7]),
                asString(row[8]),
                asString(row[9]),
                asString(row[10]),
                asInteger(row[11]),
                asLong(row[12]),
                asLong(row[13]),
                asLong(row[14]),
                asLong(row[15]),
                asLong(row[16]),
                asLong(row[17]),
                asLong(row[18]),
                asDouble(row[19]),
                asString(row[20]),
                asString(row[21]),
                asDateTime(row[22]),
                asDateTime(row[23]),
                asDateTime(row[24]),
                asDateTime(row[25]),
                asDateTime(row[26]),
                asString(row[27]),
                asString(row[28]),
                asString(row[29]));
    }

    private UUID asUuid(Object value) {
        if (value == null) {
            return null;
        }

        if (value instanceof UUID uuid) {
            return uuid;
        }

        try {
            return UUID.fromString(String.valueOf(value));
        } catch (Exception exception) {
            return null;
        }
    }

    private String asString(Object value) {
        if (value == null) {
            return null;
        }

        String text = String.valueOf(value).trim();
        return text.isBlank() ? null : text;
    }

    private Long asLong(Object value) {
        if (value == null) {
            return 0L;
        }

        if (value instanceof Number number) {
            return number.longValue();
        }

        try {
            return Long.parseLong(String.valueOf(value));
        } catch (Exception exception) {
            return 0L;
        }
    }

    private Integer asInteger(Object value) {
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

    private Double asDouble(Object value) {
        if (value == null) {
            return 0D;
        }

        if (value instanceof Number number) {
            return number.doubleValue();
        }

        try {
            return Double.parseDouble(String.valueOf(value));
        } catch (Exception exception) {
            return 0D;
        }
    }

    private LocalDateTime asDateTime(Object value) {
        if (value == null) {
            return null;
        }

        if (value instanceof LocalDateTime dateTime) {
            return dateTime;
        }

        if (value instanceof Timestamp timestamp) {
            return timestamp.toLocalDateTime();
        }

        try {
            return LocalDateTime.parse(String.valueOf(value));
        } catch (Exception exception) {
            return null;
        }
    }
}
