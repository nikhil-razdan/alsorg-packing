package com.alsorg.packing.reporting.repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import com.alsorg.packing.reporting.dto.MasterChallanRow;
import com.alsorg.packing.reporting.dto.MasterItemListRow;
import com.alsorg.packing.reporting.dto.MasterItemPageResponse;
import com.alsorg.packing.reporting.dto.MasterPacketItemRow;
import com.alsorg.packing.reporting.dto.MasterPacketRow;

@Repository
public class MasterItemDashboardRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public MasterItemDashboardRepository(
            NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final String BASE_MASTER_SQL = """
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
                        mi.created_at,

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
                            when upper(coalesce(d.status, '')) = 'DISPATCHED'
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
                        mi.created_at,
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
                        end as completion_percent,

                        case
                            when b.packet_items = 0 then 'NO_PACKETS'
                            when b.packed_packet_items = b.packet_items then 'FULLY_PACKED'
                            when b.packed_packet_items > 0 then 'PARTIALLY_PACKED'
                            else 'UNPACKED'
                        end as packing_status
                    from base b
                )
                select *
                from final_rows
            """;

    public MasterItemPageResponse findMasterItems(
            String search,
            String packingStatus,
            String plantCode,
            String clientName,
            LocalDateTime from,
            LocalDateTime to,
            int page,
            int size) {
        MapSqlParameterSource params = new MapSqlParameterSource();

        StringBuilder where = new StringBuilder(" where 1 = 1 ");

        if (search != null && !search.isBlank()) {
            params.addValue(
                    "search",
                    "%" + search.trim().toLowerCase() + "%");

            where.append("""
                        and (
                            lower(coalesce(item_name, '')) like :search
                            or lower(coalesce(pd_no, '')) like :search
                            or lower(coalesce(drawing_name, '')) like :search
                            or lower(coalesce(client_name, '')) like :search
                            or lower(coalesce(client_address, '')) like :search
                            or lower(coalesce(floor, '')) like :search
                            or lower(coalesce(plant_code, '')) like :search
                        )
                    """);
        }

        if (packingStatus != null
                && !packingStatus.isBlank()
                && !"ALL".equalsIgnoreCase(packingStatus)) {
            String normalizedStatus = packingStatus
                    .trim()
                    .toUpperCase();

            if ("DISPATCHED".equals(normalizedStatus)) {
                where.append("""
                            and (
                                dispatched_packet_items > 0
                                or challan_count > 0
                            )
                        """);
            } else if ("EXCEPTIONS".equals(normalizedStatus)) {
                where.append("""
                            and (
                                packet_items = 0
                                or (
                                    expected_packets is not null
                                    and expected_packets <> actual_packets
                                )
                            )
                        """);
            } else {
                params.addValue(
                        "packingStatus",
                        normalizedStatus);

                where.append("""
                            and packing_status = :packingStatus
                        """);
            }
        }

        if (plantCode != null && !plantCode.isBlank()) {
            params.addValue(
                    "plantCode",
                    plantCode.trim().toUpperCase());

            where.append("""
                        and upper(coalesce(plant_code, '')) = :plantCode
                    """);
        }

        if (clientName != null && !clientName.isBlank()) {
            params.addValue(
                    "clientName",
                    "%" + clientName.trim().toLowerCase() + "%");

            where.append("""
                        and lower(coalesce(client_name, '')) like :clientName
                    """);
        }

        if (from != null) {
            params.addValue("fromDate", from);

            where.append("""
                        and created_at >= :fromDate
                    """);
        }

        if (to != null) {
            params.addValue("toDate", to);

            where.append("""
                        and created_at < :toDate
                    """);
        }

        int safePage = Math.max(page, 0);

        int safeSize = Math.min(Math.max(size, 10), 100);

        params.addValue(
                "limit",
                safeSize);

        params.addValue(
                "offset",
                safePage * safeSize);

        String dataSql = BASE_MASTER_SQL
                + where
                + """
                            order by
                                coalesce(last_dispatched_at, last_packed_at, created_at) desc nulls last,
                                item_name asc nulls last
                            limit :limit
                            offset :offset
                        """;

        String countSql = "select count(*) from ("
                + BASE_MASTER_SQL
                + where
                + ") x";

        List<MasterItemListRow> rows = jdbc.query(
                dataSql,
                params,
                masterMapper());

        Long total = jdbc.queryForObject(
                countSql,
                params,
                Long.class);

        return new MasterItemPageResponse(
                rows,
                total == null ? 0 : total,
                safePage,
                safeSize);
    }

    public Optional<MasterItemListRow> findMasterItem(
            UUID masterItemId) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue(
                        "masterItemId",
                        masterItemId);

        String sql = BASE_MASTER_SQL
                + """
                            where master_item_id = :masterItemId
                        """;

        List<MasterItemListRow> rows = jdbc.query(
                sql,
                params,
                masterMapper());

        return rows.stream().findFirst();
    }

    public List<MasterPacketRow> fetchPackets(
            UUID masterItemId) {
        String sql = """
                    select
                        p.id as packet_id,
                        p.packet_number,
                        p.sticker_number,
                        p.status,
                        p.factory_floor,
                        p.warehouse_code,
                        p.gate_pass_number,
                        p.challan_number,
                        p.created_at,
                        p.created_by,

                        count(distinct pi.id) as packet_items,

                        count(distinct case
                            when pi.sticker_number is not null
                              or pi.packed_at is not null
                              or sh.id is not null
                            then pi.id
                        end) as packed_items,

                        count(distinct case
                            when upper(coalesce(d.status, '')) = 'DISPATCHED'
                            then pi.id
                        end) as dispatched_items

                    from packet_items pi
                    join packets p
                        on p.id = pi.packet_id
                    left join sticker_history sh
                        on sh.packet_item_id = pi.id
                    left join dispatched_items d
                        on d.packet_item_id = pi.id
                    where pi.master_item_id = :masterItemId
                    group by
                        p.id,
                        p.packet_number,
                        p.sticker_number,
                        p.status,
                        p.factory_floor,
                        p.warehouse_code,
                        p.gate_pass_number,
                        p.challan_number,
                        p.created_at,
                        p.created_by
                    order by
                        p.packet_number asc nulls last,
                        p.created_at asc nulls last
                """;

        return jdbc.query(
                sql,
                new MapSqlParameterSource()
                        .addValue(
                                "masterItemId",
                                masterItemId),
                packetMapper());
    }

    public List<MasterPacketItemRow> fetchPacketItems(
            UUID masterItemId) {
        String sql = """
                    select
                        pi.id as packet_item_id,
                        pi.packet_id,
                        pi.packet_number,
                        pi.item_name,
                        pi.sku,
                        pi.pd_no,
                        pi.drawing_no,
                        pi.description,
                        pi.quantity,
                        pi.status,
                        pi.sticker_number,
                        pi.print_iteration,
                        pi.packed_at,
                        pi.created_by,
                        pi.warehouse_code,
                        pi.current_location_code,
                        pi.plant_code,

                        (
                            select count(*)
                            from sticker_history sh
                            where sh.packet_item_id = pi.id
                        ) as sticker_history_count,

                        (
                            select max(sh.generated_at)
                            from sticker_history sh
                            where sh.packet_item_id = pi.id
                        ) as last_sticker_generated_at,

                        (
                            select sh.generated_by
                            from sticker_history sh
                            where sh.packet_item_id = pi.id
                            order by sh.generated_at desc nulls last
                            limit 1
                        ) as last_sticker_generated_by,

                        d.chalaan_number,
                        d.dispatched_at,
                        coalesce(d.dispatched_by, d.created_by, 'SYSTEM') as dispatched_by,
                        d.status as dispatch_status,
                        d.driver_name,
                        d.vehicle_number,
                        d.trip_started_at,
                        d.trip_ended_at

                    from packet_items pi
                    left join dispatched_items d
                        on d.packet_item_id = pi.id
                    where pi.master_item_id = :masterItemId
                    order by
                        pi.packet_number asc nulls last,
                        pi.packed_at desc nulls last,
                        pi.item_name asc nulls last
                """;

        return jdbc.query(
                sql,
                new MapSqlParameterSource()
                        .addValue(
                                "masterItemId",
                                masterItemId),
                packetItemMapper());
    }

    public List<MasterChallanRow> fetchChallans(
            UUID masterItemId) {
        String sql = """
                    select
                        d.chalaan_number,
                        count(*) as item_count,
                        min(d.dispatched_at) as first_dispatched_at,
                        max(d.dispatched_at) as last_dispatched_at,
                        max(coalesce(d.dispatched_by, d.created_by, 'SYSTEM')) as dispatched_by,
                        max(d.driver_name) as driver_name,
                        max(d.vehicle_number) as vehicle_number,
                        min(d.trip_started_at) as trip_started_at,
                        max(d.trip_ended_at) as trip_ended_at
                    from packet_items pi
                    join dispatched_items d
                        on d.packet_item_id = pi.id
                    where pi.master_item_id = :masterItemId
                      and d.chalaan_number is not null
                      and trim(d.chalaan_number) <> ''
                    group by d.chalaan_number
                    order by max(d.dispatched_at) desc nulls last
                """;

        return jdbc.query(
                sql,
                new MapSqlParameterSource()
                        .addValue(
                                "masterItemId",
                                masterItemId),
                challanMapper());
    }

    private RowMapper<MasterItemListRow> masterMapper() {
        return (rs, rowNum) -> new MasterItemListRow(
                getUuid(rs, "master_item_id"),
                rs.getString("item_name"),
                rs.getString("pd_no"),
                rs.getString("drawing_name"),
                rs.getString("client_name"),
                rs.getString("client_address"),
                rs.getString("floor"),
                rs.getString("plant_code"),
                getInteger(rs, "expected_packets"),
                rs.getLong("actual_packets"),
                rs.getLong("packet_items"),
                rs.getLong("packed_packet_items"),
                rs.getLong("pending_packet_items"),
                rs.getLong("dispatched_packet_items"),
                rs.getLong("sticker_count"),
                rs.getLong("challan_count"),
                rs.getDouble("completion_percent"),
                rs.getString("packing_status"),
                getLocalDateTime(rs, "created_at"),
                getLocalDateTime(rs, "first_packed_at"),
                getLocalDateTime(rs, "last_packed_at"),
                getLocalDateTime(rs, "first_dispatched_at"),
                getLocalDateTime(rs, "last_dispatched_at"),
                rs.getString("last_packed_by"),
                rs.getString("last_dispatched_by"));
    }

    private RowMapper<MasterPacketRow> packetMapper() {
        return (rs, rowNum) -> {
            UUID packetId = getUuid(rs, "packet_id");

            String stickerPreviewUrl = packetId == null
                    ? null
                    : "/api/reports/dashboard/packets/"
                            + packetId
                            + "/sticker/preview";

            String stickerDownloadUrl = packetId == null
                    ? null
                    : "/api/reports/dashboard/packets/"
                            + packetId
                            + "/sticker/download";

            return new MasterPacketRow(
                    packetId,
                    getInteger(rs, "packet_number"),
                    rs.getString("sticker_number"),
                    rs.getString("status"),
                    rs.getString("factory_floor"),
                    rs.getString("warehouse_code"),
                    rs.getString("gate_pass_number"),
                    rs.getString("challan_number"),
                    getLocalDateTime(rs, "created_at"),
                    rs.getString("created_by"),
                    rs.getLong("packet_items"),
                    rs.getLong("packed_items"),
                    rs.getLong("dispatched_items"),
                    stickerPreviewUrl,
                    stickerDownloadUrl);
        };
    }

    private RowMapper<MasterPacketItemRow> packetItemMapper() {
        return (rs, rowNum) -> new MasterPacketItemRow(
                getUuid(rs, "packet_item_id"),
                getUuid(rs, "packet_id"),
                rs.getString("packet_number"),
                rs.getString("item_name"),
                rs.getString("sku"),
                rs.getString("pd_no"),
                rs.getString("drawing_no"),
                rs.getString("description"),
                getInteger(rs, "quantity"),
                rs.getString("status"),
                rs.getString("sticker_number"),
                getLongObject(rs, "print_iteration"),
                getLocalDateTime(rs, "packed_at"),
                rs.getString("created_by"),
                rs.getString("warehouse_code"),
                rs.getString("current_location_code"),
                rs.getString("plant_code"),
                rs.getLong("sticker_history_count"),
                getLocalDateTime(rs, "last_sticker_generated_at"),
                rs.getString("last_sticker_generated_by"),
                rs.getString("chalaan_number"),
                getLocalDateTime(rs, "dispatched_at"),
                rs.getString("dispatched_by"),
                rs.getString("dispatch_status"),
                rs.getString("driver_name"),
                rs.getString("vehicle_number"),
                getLocalDateTime(rs, "trip_started_at"),
                getLocalDateTime(rs, "trip_ended_at"));
    }

    private RowMapper<MasterChallanRow> challanMapper() {
        return (rs, rowNum) -> {
            String challanNumber = rs.getString("chalaan_number");

            String encoded = challanNumber == null
                    ? null
                    : java.net.URLEncoder.encode(
                            challanNumber,
                            java.nio.charset.StandardCharsets.UTF_8);

            String previewUrl = encoded == null
                    ? null
                    : "/api/reports/dashboard/challans/"
                            + encoded
                            + "/preview";

            String downloadUrl = encoded == null
                    ? null
                    : "/api/reports/dashboard/challans/"
                            + encoded
                            + "/download";

            return new MasterChallanRow(
                    challanNumber,
                    rs.getLong("item_count"),
                    getLocalDateTime(rs, "first_dispatched_at"),
                    getLocalDateTime(rs, "last_dispatched_at"),
                    rs.getString("dispatched_by"),
                    rs.getString("driver_name"),
                    rs.getString("vehicle_number"),
                    getLocalDateTime(rs, "trip_started_at"),
                    getLocalDateTime(rs, "trip_ended_at"),
                    previewUrl,
                    downloadUrl);
        };
    }

    private UUID getUuid(
            ResultSet rs,
            String column) throws SQLException {
        Object value = rs.getObject(column);

        if (value == null) {
            return null;
        }

        if (value instanceof UUID uuid) {
            return uuid;
        }

        return UUID.fromString(
                String.valueOf(value));
    }

    private Integer getInteger(
            ResultSet rs,
            String column) throws SQLException {
        int value = rs.getInt(column);

        return rs.wasNull()
                ? null
                : value;
    }

    private Long getLongObject(
            ResultSet rs,
            String column) throws SQLException {
        long value = rs.getLong(column);

        return rs.wasNull()
                ? null
                : value;
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