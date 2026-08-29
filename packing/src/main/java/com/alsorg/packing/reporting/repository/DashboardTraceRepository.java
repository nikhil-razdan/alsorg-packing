package com.alsorg.packing.reporting.repository;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;

import org.springframework.stereotype.Repository;

import com.alsorg.packing.reporting.dto.DashboardTraceRow;

@Repository
public class DashboardTraceRepository {

    @PersistenceContext
    private EntityManager em;

    public List<DashboardTraceRow> fetchTrace(
            String type,
            LocalDateTime from,
            LocalDateTime to,
            String search,
            int limit,
            int offset
    ) {
        String normalizedType = normalizeType(type);

        if ("custom".equals(normalizedType)) {
            return fetchCustomTrace(
                    from,
                    to,
                    search,
                    limit,
                    offset
            );
        }

        int safeLimit = Math.min(
                Math.max(limit, 1),
                500
        );

        int safeOffset = Math.max(offset, 0);

        StringBuilder sql = new StringBuilder("""
                    with latest_sticker as (
                        select distinct on (sh.packet_item_id)
                            sh.packet_item_id,
                            sh.sticker_number,
                            sh.generated_at,
                            sh.generated_by,
                            sh.print_iteration
                        from sticker_history sh
                        where sh.packet_item_id is not null
                        order by
                            sh.packet_item_id,
                            sh.generated_at desc nulls last
                    ),

                    base as (
                        select
                            mi.id as master_item_id,
                            p.id as packet_id,
                            pi.id as packet_item_id,

                            mi.item_name as master_item_name,
                            coalesce(pi.item_name, mi.item_name) as item_name,

                            /*
                             * PacketItem is the authoritative PackFlow description.
                             * DispatchedItem is a safe legacy/read-model fallback for
                             * older rows whose packet description was not retained.
                             */
                            coalesce(
                                nullif(trim(pi.description), ''),
                                nullif(trim(d.description), '')
                            ) as description,

                            coalesce(pi.client_name, mi.client_name) as client_name,
                            coalesce(pi.client_address, mi.address) as client_address,

                            coalesce(pi.pd_no, mi.pd_no) as pd_no,
                            coalesce(pi.drawing_no, mi.drawing_name) as drawing_no,
                            pi.sku as sku,

                            coalesce(pi.packet_number, p.packet_number::text) as packet_number,

                            coalesce(pi.plant_code, mi.plant_code) as plant_code,
                            coalesce(pi.current_location_code, pi.location, pi.warehouse_code, p.warehouse_code) as current_location_code,
                            coalesce(pi.warehouse_code, p.warehouse_code) as warehouse_code,

                            coalesce(pi.sticker_number, ls.sticker_number, p.sticker_number) as sticker_number,
                            coalesce(pi.print_iteration, ls.print_iteration, p.iteration::bigint) as print_iteration,

                            coalesce(pi.packed_at, ls.generated_at) as packed_at,
                            coalesce(pi.created_by, p.created_by, ls.generated_by) as packed_by,

                            ls.generated_at as generated_at,
                            ls.generated_by as generated_by,

                            d.dispatched_at as dispatched_at,
                            coalesce(d.dispatched_by, d.created_by) as dispatched_by,

                            d.chalaan_number as challan_number,
                            d.driver_name as driver_name,
                            d.vehicle_number as vehicle_number,
                            d.trip_started_at as trip_started_at,
                            d.trip_ended_at as trip_ended_at,
                            d.status as dispatch_status,

                            case
                                when d.zoho_item_id is not null then 'DISPATCH'
                                when coalesce(pi.sticker_number, ls.sticker_number, p.sticker_number) is not null
                                      or pi.packed_at is not null
                                      or ls.generated_at is not null
                                    then 'PACKING'
                                else 'INVENTORY'
                            end as source_type,

                            case
                                when d.status is not null then d.status
                                when coalesce(pi.sticker_number, ls.sticker_number, p.sticker_number) is not null
                                      or pi.packed_at is not null
                                      or ls.generated_at is not null
                                    then 'PACKED'
                                else coalesce(pi.status, p.status, 'PENDING')
                            end as movement_type,

                            trim(concat_ws('; ',
                                case
                                    when mi.id is null
                                        then 'Packet item missing master item'
                                end,
                                case
                                    when p.id is null
                                        then 'Packet item missing packet'
                                end,
                                case
                                    when upper(coalesce(d.status, '')) = 'DISPATCHED'
                                         and (
                                                d.chalaan_number is null
                                                or trim(d.chalaan_number) = ''
                                             )
                                        then 'Dispatched without challan'
                                end,
                                case
                                    when upper(coalesce(d.status, '')) = 'DISPATCHED'
                                         and (
                                                d.driver_name is null
                                                or trim(d.driver_name) = ''
                                                or d.vehicle_number is null
                                                or trim(d.vehicle_number) = ''
                                             )
                                        then 'Dispatched without driver / vehicle'
                                end
                            )) as exception_reason

                        from packet_items pi
                        left join master_item mi
                            on mi.id = pi.master_item_id
                        left join packets p
                            on p.id = pi.packet_id
                        left join latest_sticker ls
                            on ls.packet_item_id = pi.id
                        left join dispatched_items d
                            on d.packet_item_id = pi.id

                        union all

                        select
                            mi.id as master_item_id,
                            null::uuid as packet_id,
                            null::uuid as packet_item_id,

                            mi.item_name as master_item_name,
                            mi.item_name as item_name,
                            null::varchar as description,
                            mi.client_name as client_name,
                            mi.address as client_address,

                            mi.pd_no as pd_no,
                            mi.drawing_name as drawing_no,
                            null::varchar as sku,

                            null::varchar as packet_number,

                            mi.plant_code as plant_code,
                            null::varchar as current_location_code,
                            null::varchar as warehouse_code,

                            null::varchar as sticker_number,
                            null::bigint as print_iteration,

                            null::timestamp as packed_at,
                            null::varchar as packed_by,

                            null::timestamp as generated_at,
                            null::varchar as generated_by,

                            null::timestamp as dispatched_at,
                            null::varchar as dispatched_by,

                            null::varchar as challan_number,
                            null::varchar as driver_name,
                            null::varchar as vehicle_number,
                            null::timestamp as trip_started_at,
                            null::timestamp as trip_ended_at,
                            null::varchar as dispatch_status,

                            'EXCEPTION' as source_type,
                            'MASTER_WITHOUT_PACKET' as movement_type,

                            'Master item without packet' as exception_reason

                        from master_item mi
                        where not exists (
                            select 1
                            from packet_items pi
                            where pi.master_item_id = mi.id
                        )

                        union all

                        select
                            null::uuid as master_item_id,
                            p.id as packet_id,
                            null::uuid as packet_item_id,

                            null::varchar as master_item_name,
                            null::varchar as item_name,
                            null::varchar as description,
                            null::varchar as client_name,
                            null::varchar as client_address,

                            null::varchar as pd_no,
                            null::varchar as drawing_no,
                            null::varchar as sku,

                            p.packet_number::text as packet_number,

                            null::varchar as plant_code,
                            p.warehouse_code as current_location_code,
                            p.warehouse_code as warehouse_code,

                            p.sticker_number as sticker_number,
                            p.iteration::bigint as print_iteration,

                            null::timestamp as packed_at,
                            p.created_by as packed_by,

                            null::timestamp as generated_at,
                            null::varchar as generated_by,

                            null::timestamp as dispatched_at,
                            null::varchar as dispatched_by,

                            p.challan_number as challan_number,
                            null::varchar as driver_name,
                            null::varchar as vehicle_number,
                            null::timestamp as trip_started_at,
                            null::timestamp as trip_ended_at,
                            null::varchar as dispatch_status,

                            'EXCEPTION' as source_type,
                            'PACKET_WITHOUT_ITEM' as movement_type,

                            'Packet without packet item' as exception_reason

                        from packets p
                        where not exists (
                            select 1
                            from packet_items pi
                            where pi.packet_id = p.id
                        )
                    )

                    select
                        b.source_type,
                        b.movement_type,

                        b.master_item_id,
                        b.packet_id,
                        b.packet_item_id,

                        b.master_item_name,
                        b.item_name,
                        b.description,
                        b.packet_number,

                        b.pd_no,
                        b.drawing_no,
                        b.sku,

                        b.client_name,
                        b.client_address,

                        b.plant_code,
                        b.current_location_code,
                        b.warehouse_code,

                        coalesce(b.dispatch_status, b.movement_type) as status,

                        b.sticker_number,
                        b.print_iteration,

                        b.packed_at,
                        b.packed_by,

                        b.dispatched_at,
                        b.dispatched_by,

                        b.challan_number,
                        b.driver_name,
                        b.vehicle_number,

                        b.trip_started_at,
                        b.trip_ended_at,

                        b.generated_by,
                        b.generated_at,

                        nullif(trim(coalesce(b.exception_reason, '')), '') as exception_reason

                    from base b
                    where 1 = 1
                """);

        appendTypeFilter(sql, normalizedType);

        if (from != null) {
            sql.append("""
                and coalesce(
                    b.dispatched_at,
                    b.generated_at,
                    b.packed_at,
                    b.trip_started_at,
                    timestamp '1900-01-01'
                ) >= :from
            """);
        }

        if (to != null) {
            sql.append("""
                and coalesce(
                    b.dispatched_at,
                    b.generated_at,
                    b.packed_at,
                    b.trip_started_at,
                    timestamp '1900-01-01'
                ) <= :to
            """);
        }

        if (search != null && !search.isBlank()) {
            sql.append("""
                and lower(concat_ws(' ',
                    b.source_type,
                    b.movement_type,
                    b.master_item_id::text,
                    b.packet_id::text,
                    b.packet_item_id::text,
                    b.master_item_name,
                    b.item_name,
                    b.description,
                    b.packet_number,
                    b.pd_no,
                    b.drawing_no,
                    b.sku,
                    b.client_name,
                    b.client_address,
                    b.plant_code,
                    b.current_location_code,
                    b.warehouse_code,
                    b.sticker_number,
                    b.challan_number,
                    b.driver_name,
                    b.vehicle_number,
                    b.generated_by,
                    b.packed_by,
                    b.dispatched_by,
                    b.exception_reason
                )) like :search
            """);
        }

        sql.append("""
            order by
                coalesce(
                    b.dispatched_at,
                    b.generated_at,
                    b.packed_at,
                    b.trip_started_at,
                    timestamp '1900-01-01'
                ) desc nulls last
            limit :limit
            offset :offset
        """);

        Query query = em.createNativeQuery(sql.toString());

        bindCommonParameters(query, from, to, search, safeLimit, safeOffset);

        @SuppressWarnings("unchecked")
        List<Object[]> rows = query.getResultList();

        return rows.stream()
                .map(this::mapRow)
                .toList();
    }

    private List<DashboardTraceRow> fetchCustomTrace(
            LocalDateTime from,
            LocalDateTime to,
            String search,
            int limit,
            int offset
    ) {
        int safeLimit = Math.min(
                Math.max(limit, 1),
                500
        );

        int safeOffset = Math.max(offset, 0);

        StringBuilder sql = new StringBuilder("""
                    select
                        'CUSTOM_CHALLAN' as source_type,
                        coalesce(c.challan_type, c.movement_mode, 'CUSTOM_CHALLAN') as movement_type,

                        null::uuid as master_item_id,
                        null::uuid as packet_id,
                        ci.id as packet_item_id,

                        null::varchar as master_item_name,
                        ci.description as item_name,
                        nullif(trim(ci.description), '') as description,
                        null::varchar as packet_number,

                        c.pd_no as pd_no,
                        ci.drawing_no as drawing_no,
                        null::varchar as sku,

                        c.client_name as client_name,
                        c.client_address as client_address,

                        null::varchar as plant_code,
                        concat_ws(' → ', c.from_location, c.to_location) as current_location_code,
                        null::varchar as warehouse_code,

                        coalesce(c.movement_mode, 'CUSTOM') as status,

                        null::varchar as sticker_number,
                        null::bigint as print_iteration,

                        null::timestamp as packed_at,
                        null::varchar as packed_by,

                        null::timestamp as dispatched_at,
                        null::varchar as dispatched_by,

                        c.challan_number as challan_number,
                        null::varchar as driver_name,
                        null::varchar as vehicle_number,

                        null::timestamp as trip_started_at,
                        null::timestamp as trip_ended_at,

                        c.generated_by as generated_by,
                        c.generated_at as generated_at,

                        nullif(trim(concat_ws('; ',
                            case
                                when ci.description is null
                                     or trim(ci.description) = ''
                                    then 'Custom challan item missing description'
                            end,
                            case
                                when c.to_location is null
                                     or trim(c.to_location) = ''
                                    then 'Custom challan missing destination'
                            end
                        )), '') as exception_reason

                    from custom_challans c
                    left join custom_challan_items ci
                        on ci.challan_number = c.challan_number
                    where 1 = 1
                """);

        if (from != null) {
            sql.append(" and c.generated_at >= :from ");
        }

        if (to != null) {
            sql.append(" and c.generated_at <= :to ");
        }

        if (search != null && !search.isBlank()) {
            sql.append("""
                and lower(concat_ws(' ',
                    c.challan_number,
                    c.client_name,
                    c.client_address,
                    c.from_location,
                    c.to_location,
                    c.generated_by,
                    c.pd_no,
                    c.project_name,
                    c.purpose,
                    ci.description,
                    ci.drawing_no,
                    ci.remarks
                )) like :search
            """);
        }

        sql.append("""
            order by c.generated_at desc nulls last
            limit :limit
            offset :offset
        """);

        Query query = em.createNativeQuery(sql.toString());

        bindCommonParameters(query, from, to, search, safeLimit, safeOffset);

        @SuppressWarnings("unchecked")
        List<Object[]> rows = query.getResultList();

        return rows.stream()
                .map(this::mapRow)
                .toList();
    }

    private void bindCommonParameters(
            Query query,
            LocalDateTime from,
            LocalDateTime to,
            String search,
            int limit,
            int offset
    ) {
        if (from != null) {
            query.setParameter("from", from);
        }

        if (to != null) {
            query.setParameter("to", to);
        }

        if (search != null && !search.isBlank()) {
            query.setParameter(
                    "search",
                    "%" + search.trim().toLowerCase() + "%"
            );
        }

        query.setParameter("limit", limit);
        query.setParameter("offset", offset);
    }

    private void appendTypeFilter(
            StringBuilder sql,
            String type
    ) {
        switch (type) {
            case "packed" -> sql.append("""
                and (
                    b.packed_at is not null
                    or b.sticker_number is not null
                    or b.generated_at is not null
                )
            """);

            case "generated" -> sql.append("""
                and b.generated_at is not null
            """);

            case "pending" -> sql.append("""
                and b.packet_item_id is not null
                and b.dispatched_at is null
                and b.sticker_number is null
                and b.packed_at is null
                and b.generated_at is null
            """);

            case "dispatched" -> sql.append("""
                and upper(coalesce(b.dispatch_status, '')) = 'DISPATCHED'
            """);

            case "challaned" -> sql.append("""
                and b.challan_number is not null
                and trim(b.challan_number) <> ''
            """);

            case "errored" -> sql.append("""
                and nullif(trim(coalesce(b.exception_reason, '')), '') is not null
            """);

            default -> {
            }
        }
    }

    private String normalizeType(String type) {
        if (type == null || type.isBlank()) {
            return "all";
        }

        String clean = type.trim().toLowerCase();

        return switch (clean) {
            case "all",
                 "packed",
                 "generated",
                 "pending",
                 "dispatched",
                 "challaned",
                 "errored",
                 "custom" -> clean;

            case "error",
                 "errors",
                 "exception",
                 "exceptions" -> "errored";

            case "custom_challan",
                 "custom-challan",
                 "custom_challans",
                 "custom-challans" -> "custom";

            default -> "all";
        };
    }

    private DashboardTraceRow mapRow(Object[] row) {
        return new DashboardTraceRow(
                asString(row[0]),
                asString(row[1]),

                asUuid(row[2]),
                asUuid(row[3]),
                asUuid(row[4]),

                asString(row[5]),
                asString(row[6]),
                asString(row[7]),
                asString(row[8]),

                asString(row[9]),
                asString(row[10]),
                asString(row[11]),

                asString(row[12]),
                asString(row[13]),

                asString(row[14]),
                asString(row[15]),
                asString(row[16]),

                asString(row[17]),

                asString(row[18]),
                asLong(row[19]),

                asDateTime(row[20]),
                asString(row[21]),

                asDateTime(row[22]),
                asString(row[23]),

                asString(row[24]),
                asString(row[25]),
                asString(row[26]),

                asDateTime(row[27]),
                asDateTime(row[28]),

                asString(row[29]),
                asDateTime(row[30]),

                asString(row[31])
        );
    }

    private String asString(Object value) {
        if (value == null) {
            return null;
        }

        String text = String.valueOf(value).trim();

        return text.isBlank() ? null : text;
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
        } catch (Exception e) {
            return null;
        }
    }

    private Long asLong(Object value) {
        if (value == null) {
            return null;
        }

        if (value instanceof Number number) {
            return number.longValue();
        }

        try {
            return Long.parseLong(String.valueOf(value));
        } catch (Exception e) {
            return null;
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

        if (value instanceof java.sql.Date date) {
            return date.toLocalDate().atStartOfDay();
        }

        if (value instanceof LocalDate date) {
            return date.atStartOfDay();
        }

        try {
            return LocalDateTime.parse(String.valueOf(value));
        } catch (Exception ignored) {
        }

        return null;
    }
}
