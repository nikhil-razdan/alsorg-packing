package com.alsorg.packing.service.matflow;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;

/**
 * ADMIN-only destructive MatFlow purge service.
 *
 * This is deliberately separate from the normal deactivate/archive workflow.
 * It permanently removes one PD/Project, Product or BOM together with MatFlow
 * children that reference it. Both the current control BOM tables and the old
 * legacy mf_boms / mf_bom_lines tables are included.
 *
 * Shared masters (Users, Clients, Plants, Materials, Vendors, etc.) are never
 * traversed "upwards" and are therefore not deleted by this service.
 */
@Service
public class MatFlowPermanentDeleteService {

    private static final Logger log = LoggerFactory.getLogger(MatFlowPermanentDeleteService.class);

    private static final String PROJECT_TABLE = "mf_projects";
    private static final String PRODUCT_TABLE = "mf_project_drawings";
    private static final String FILE_TABLE = "mf_production_files";
    private static final String CURRENT_BOM_TABLE = "mf_control_boms";
    private static final String LEGACY_BOM_TABLE = "mf_boms";
    private static final String AUDIT_TABLE = "mf_audit_logs";

    private static final Pattern SQL_IDENTIFIER = Pattern.compile("[A-Za-z_][A-Za-z0-9_]*");

    private final JdbcTemplate jdbcTemplate;
    private final MatFlowAccessService accessService;

    public MatFlowPermanentDeleteService(
            JdbcTemplate jdbcTemplate,
            MatFlowAccessService accessService) {
        this.jdbcTemplate = jdbcTemplate;
        this.accessService = accessService;
    }

    /** Permanently removes an entire PD / Project and all MatFlow descendants. */
    @Transactional
    public void permanentlyDeleteProject(UUID projectId) {
        requireAdmin();
        requireId(projectId, "Project / PD ID");

        Set<Path> physicalFiles = new LinkedHashSet<>();

        try {
            if (!rowExists(PROJECT_TABLE, projectId)) {
                /*
                 * Pre-hierarchy MatFlow used mf_project_drawings itself as the
                 * Project/Product record. Accept that historical UUID as a legacy PD
                 * so ADMIN can clean the old data as requested.
                 */
                if (rowExists(PRODUCT_TABLE, projectId)) {
                    permanentlyDeleteProductInternal(null, projectId, physicalFiles);
                    schedulePhysicalFileDelete(physicalFiles);
                    log.info("ADMIN permanent MatFlow legacy PD/Product delete: actor={}, legacyProductId={}",
                            accessService.actor(), projectId);
                    return;
                }
                throw notFound("Project / PD not found");
            }

            Map<String, Object> project = firstRow(
                    "select id, project_code, plant_code from " + q(PROJECT_TABLE) + " where id = ?",
                    projectId);

            String projectCode = stringValue(project.get("project_code"));
            String plantCode = stringValue(project.get("plant_code"));

            List<UUID> productIds = new ArrayList<>();
            if (columnExists(PRODUCT_TABLE, "project_id")) {
                productIds.addAll(uuidList(
                        "select id from " + q(PRODUCT_TABLE) + " where project_id = ?",
                        projectId));
            }

            /*
             * Catch historical product rows created before the Project FK existed or
             * before it was backfilled. Restrict the fallback by PD + Plant so a
             * similarly named PD in another Plant cannot be touched.
             */
            if (projectCode != null
                    && columnExists(PRODUCT_TABLE, "project_code")
                    && columnExists(PRODUCT_TABLE, "plant_code")) {
                String sql = "select id from " + q(PRODUCT_TABLE)
                        + " where upper(coalesce(project_code,'')) = upper(?)"
                        + " and upper(coalesce(plant_code,'')) = upper(?)";
                productIds.addAll(uuidList(sql, projectCode, plantCode == null ? "" : plantCode));
            }

            productIds = productIds.stream().filter(Objects::nonNull).distinct().toList();
            collectProductImagePaths(productIds, physicalFiles);

            List<UUID> productionFileIds = columnExists(FILE_TABLE, "project_id")
                    ? uuidList("select id from " + q(FILE_TABLE) + " where project_id = ?", projectId)
                    : List.of();
            collectStoragePathsForProductionFiles(productionFileIds, physicalFiles);

            for (UUID productId : productIds) {
                permanentlyDeleteProductInternal(projectId, productId, physicalFiles);
            }

            /* Remove canonical Project file and any retired legacy Product files left behind. */
            for (UUID fileId : productionFileIds) {
                purgeRowById(FILE_TABLE, fileId, new LinkedHashSet<>());
            }

            cleanupLooseUuidReferences(projectId);
            purgeRowById(PROJECT_TABLE, projectId, new LinkedHashSet<>());

            schedulePhysicalFileDelete(physicalFiles);
            log.info("ADMIN permanent MatFlow Project/PD delete: actor={}, projectId={}, projectCode={}",
                    accessService.actor(), projectId, projectCode);

        } catch (ResponseStatusException | AccessDeniedException ex) {
            throw ex;
        } catch (DataAccessException ex) {
            throw deleteConflict("Project / PD", ex);
        }
    }

    /** Permanently removes one Product, all of its BOMs and Product-specific history. */
    @Transactional
    public void permanentlyDeleteProduct(UUID projectId, UUID productId) {
        requireAdmin();
        requireId(productId, "Product ID");

        Set<Path> physicalFiles = new LinkedHashSet<>();
        try {
            permanentlyDeleteProductInternal(projectId, productId, physicalFiles);
            schedulePhysicalFileDelete(physicalFiles);
            log.info("ADMIN permanent MatFlow Product delete: actor={}, projectId={}, productId={}",
                    accessService.actor(), projectId, productId);
        } catch (ResponseStatusException | AccessDeniedException ex) {
            throw ex;
        } catch (DataAccessException ex) {
            throw deleteConflict("Product", ex);
        }
    }

    /** Permanently removes any BOM revision, including imported legacy BOMs. */
    @Transactional
    public void permanentlyDeleteBom(UUID bomId) {
        requireAdmin();
        requireId(bomId, "BOM ID");

        try {
            BomIdentity identity = resolveBomIdentity(bomId);
            if (identity == null) {
                throw notFound("BOM not found");
            }

            Set<UUID> relatedIds = resolveRelatedBomIds(identity);
            relatedIds.add(bomId);

            for (UUID id : relatedIds) {
                if (rowExists(CURRENT_BOM_TABLE, id)) {
                    purgeRowById(CURRENT_BOM_TABLE, id, new LinkedHashSet<>());
                }
                if (rowExists(LEGACY_BOM_TABLE, id)) {
                    purgeRowById(LEGACY_BOM_TABLE, id, new LinkedHashSet<>());
                }
                cleanupLooseUuidReferences(id);
            }

            repairCurrentBomLatestFlag(identity.productionFileId(), identity.productId());

            log.info("ADMIN permanent MatFlow BOM delete: actor={}, requestedBomId={}, bomNumber={}, relatedRows={}",
                    accessService.actor(), bomId, identity.bomNumber(), relatedIds.size());

        } catch (ResponseStatusException | AccessDeniedException ex) {
            throw ex;
        } catch (DataAccessException ex) {
            throw deleteConflict("BOM", ex);
        }
    }

    private void permanentlyDeleteProductInternal(
            UUID expectedProjectId,
            UUID productId,
            Set<Path> physicalFiles) {

        if (!rowExists(PRODUCT_TABLE, productId)) {
            throw notFound("Product not found");
        }

        UUID actualProjectId = null;
        if (columnExists(PRODUCT_TABLE, "project_id")) {
            actualProjectId = nullableUuid(
                    "select project_id from " + q(PRODUCT_TABLE) + " where id = ?",
                    productId);
        }

        if (expectedProjectId != null
                && actualProjectId != null
                && !expectedProjectId.equals(actualProjectId)) {
            throw notFound("Product does not belong to the selected Project / PD");
        }

        collectProductImagePaths(List.of(productId), physicalFiles);

        List<UUID> legacyProductFileIds = columnExists(FILE_TABLE, "product_id")
                ? uuidList("select id from " + q(FILE_TABLE) + " where product_id = ?", productId)
                : List.of();
        collectStoragePathsForProductionFiles(legacyProductFileIds, physicalFiles);

        Set<UUID> bomIds = new LinkedHashSet<>();
        if (tableExists(CURRENT_BOM_TABLE) && columnExists(CURRENT_BOM_TABLE, "project_drawing_id")) {
            bomIds.addAll(uuidList(
                    "select id from " + q(CURRENT_BOM_TABLE) + " where project_drawing_id = ?",
                    productId));
        }
        if (tableExists(LEGACY_BOM_TABLE) && columnExists(LEGACY_BOM_TABLE, "project_drawing_id")) {
            bomIds.addAll(uuidList(
                    "select id from " + q(LEGACY_BOM_TABLE) + " where project_drawing_id = ?",
                    productId));
        }

        for (UUID bomId : bomIds) {
            BomIdentity identity = resolveBomIdentity(bomId);
            Set<UUID> related = identity == null
                    ? new LinkedHashSet<>(Set.of(bomId))
                    : resolveRelatedBomIds(identity);
            related.add(bomId);
            for (UUID relatedId : related) {
                if (rowExists(CURRENT_BOM_TABLE, relatedId)) {
                    purgeRowById(CURRENT_BOM_TABLE, relatedId, new LinkedHashSet<>());
                }
                if (rowExists(LEGACY_BOM_TABLE, relatedId)) {
                    purgeRowById(LEGACY_BOM_TABLE, relatedId, new LinkedHashSet<>());
                }
                cleanupLooseUuidReferences(relatedId);
            }
        }

        for (UUID fileId : legacyProductFileIds) {
            purgeRowById(FILE_TABLE, fileId, new LinkedHashSet<>());
        }

        cleanupLooseProductReferences(productId);
        cleanupLooseUuidReferences(productId);
        purgeRowById(PRODUCT_TABLE, productId, new LinkedHashSet<>());
    }

    /**
     * Recursively removes rows that carry real database foreign keys to a row.
     * Only child tables inside the MatFlow mf_* namespace are traversed.
     */
    private void purgeRowById(
            String table,
            Object id,
            Set<String> activePath) {

        if (id == null || !tableExists(table) || !columnExists(table, "id") || !rowExists(table, id)) {
            return;
        }

        String pathKey = table + ":" + id;
        if (!activePath.add(pathKey)) {
            throw conflict("Cannot permanently delete because a cyclical MatFlow database reference was detected at " + table);
        }

        for (ForeignReference reference : foreignReferencesTo(table)) {
            if (!reference.childTable().startsWith("mf_") || !tableExists(reference.childTable())) {
                continue;
            }

            if (columnExists(reference.childTable(), "id")) {
                List<Object> childIds = objectList(
                        "select id from " + q(reference.childTable())
                                + " where " + q(reference.childColumn()) + " = ?",
                        id);
                for (Object childId : childIds) {
                    if (childId != null && !Objects.equals(childId, id)) {
                        purgeRowById(reference.childTable(), childId, activePath);
                    }
                }
            }

            jdbcTemplate.update(
                    "delete from " + q(reference.childTable())
                            + " where " + q(reference.childColumn()) + " = ?",
                    id);
        }

        if (id instanceof UUID uuid) {
            cleanupLooseUuidReferences(uuid);
        }

        jdbcTemplate.update(
                "delete from " + q(table) + " where id = ?",
                id);

        activePath.remove(pathKey);
    }

    private List<ForeignReference> foreignReferencesTo(String parentTable) {
        if (!validIdentifier(parentTable)) return List.of();

        String sql = """
                select distinct child.relname as child_table,
                       child_att.attname as child_column
                  from pg_constraint fk
                  join pg_class child on child.oid = fk.conrelid
                  join pg_namespace child_ns on child_ns.oid = child.relnamespace
                  join pg_class parent on parent.oid = fk.confrelid
                  join pg_namespace parent_ns on parent_ns.oid = parent.relnamespace
                  join lateral unnest(fk.conkey) with ordinality ck(attnum, ord) on true
                  join lateral unnest(fk.confkey) with ordinality pk(attnum, ord) on pk.ord = ck.ord
                  join pg_attribute child_att on child_att.attrelid = child.oid and child_att.attnum = ck.attnum
                  join pg_attribute parent_att on parent_att.attrelid = parent.oid and parent_att.attnum = pk.attnum
                 where fk.contype = 'f'
                   and parent_ns.nspname = current_schema()
                   and child_ns.nspname = current_schema()
                   and parent.relname = ?
                   and parent_att.attname = 'id'
                """;

        return jdbcTemplate.query(
                sql,
                (rs, rowNum) -> new ForeignReference(
                        rs.getString("child_table"),
                        rs.getString("child_column")),
                parentTable);
    }

    private BomIdentity resolveBomIdentity(UUID bomId) {
        Map<String, Object> row = null;

        if (rowExists(CURRENT_BOM_TABLE, bomId)) {
            row = firstRow(
                    "select id, bom_number, production_file_id, project_drawing_id, revision_no"
                            + " from " + q(CURRENT_BOM_TABLE) + " where id = ?",
                    bomId);
        } else if (rowExists(LEGACY_BOM_TABLE, bomId)) {
            String productionSelect = columnExists(LEGACY_BOM_TABLE, "production_file_id")
                    ? "production_file_id"
                    : "null::uuid as production_file_id";
            String productSelect = columnExists(LEGACY_BOM_TABLE, "project_drawing_id")
                    ? "project_drawing_id"
                    : "null::uuid as project_drawing_id";
            row = firstRow(
                    "select id, bom_number, " + productionSelect + ", " + productSelect + ", revision_no"
                            + " from " + q(LEGACY_BOM_TABLE) + " where id = ?",
                    bomId);
        }

        if (row == null || row.isEmpty()) return null;
        return new BomIdentity(
                uuidValue(row.get("id")),
                stringValue(row.get("bom_number")),
                uuidValue(row.get("production_file_id")),
                uuidValue(row.get("project_drawing_id")),
                intValue(row.get("revision_no")));
    }

    private Set<UUID> resolveRelatedBomIds(BomIdentity identity) {
        Set<UUID> ids = new LinkedHashSet<>();
        if (identity == null) return ids;
        if (identity.id() != null) ids.add(identity.id());

        for (String table : List.of(CURRENT_BOM_TABLE, LEGACY_BOM_TABLE)) {
            if (!tableExists(table) || !columnExists(table, "id")) continue;

            if (identity.bomNumber() != null && columnExists(table, "bom_number")) {
                ids.addAll(uuidList(
                        "select id from " + q(table) + " where upper(bom_number) = upper(?)",
                        identity.bomNumber()));
            }

            if (identity.productId() != null
                    && identity.revisionNo() != null
                    && columnExists(table, "project_drawing_id")
                    && columnExists(table, "revision_no")) {
                ids.addAll(uuidList(
                        "select id from " + q(table)
                                + " where project_drawing_id = ? and revision_no = ?",
                        identity.productId(),
                        identity.revisionNo()));
            }
        }
        return ids;
    }

    private void repairCurrentBomLatestFlag(UUID productionFileId, UUID productId) {
        if (productionFileId == null
                || productId == null
                || !tableExists(CURRENT_BOM_TABLE)
                || !columnExists(CURRENT_BOM_TABLE, "latest_revision")) {
            return;
        }

        jdbcTemplate.update(
                "update " + q(CURRENT_BOM_TABLE)
                        + " set latest_revision = false"
                        + " where production_file_id = ? and project_drawing_id = ?",
                productionFileId,
                productId);

        List<UUID> remaining = uuidList(
                "select id from " + q(CURRENT_BOM_TABLE)
                        + " where production_file_id = ? and project_drawing_id = ?"
                        + " order by revision_no desc, created_at desc nulls last limit 1",
                productionFileId,
                productId);

        if (!remaining.isEmpty()) {
            jdbcTemplate.update(
                    "update " + q(CURRENT_BOM_TABLE) + " set latest_revision = true where id = ?",
                    remaining.get(0));
        }
    }

    private void collectProductImagePaths(List<UUID> productIds, Set<Path> paths) {
        if (productIds == null
                || productIds.isEmpty()
                || !tableExists(PRODUCT_TABLE)
                || !columnExists(PRODUCT_TABLE, "product_image_storage_path")) {
            return;
        }

        for (UUID productId : productIds) {
            stringList(
                    "select product_image_storage_path from " + q(PRODUCT_TABLE)
                            + " where id = ? and product_image_storage_path is not null",
                    productId)
                    .forEach(value -> addPath(paths, value));
        }
    }

    /** Finds revision/attachment tables generically by production_file_id + storage_path. */
    private void collectStoragePathsForProductionFiles(List<UUID> fileIds, Set<Path> paths) {
        if (fileIds == null || fileIds.isEmpty()) return;

        String sql = """
                select distinct a.table_name
                  from information_schema.columns a
                  join information_schema.columns b
                    on b.table_schema = a.table_schema
                   and b.table_name = a.table_name
                 where a.table_schema = current_schema()
                   and a.column_name = 'production_file_id'
                   and b.column_name = 'storage_path'
                """;

        List<String> tables = jdbcTemplate.query(sql, (rs, rowNum) -> rs.getString(1));
        for (String table : tables) {
            if (!validIdentifier(table) || !table.startsWith("mf_")) continue;
            for (UUID fileId : fileIds) {
                stringList(
                        "select storage_path from " + q(table)
                                + " where production_file_id = ? and storage_path is not null",
                        fileId)
                        .forEach(value -> addPath(paths, value));
            }
        }
    }

    private void cleanupLooseProductReferences(UUID productId) {
        deleteLooseUuidColumn("project_drawing_id", productId, Set.of(PRODUCT_TABLE));
        deleteLooseUuidColumn("product_id", productId, Set.of(PRODUCT_TABLE));
    }

    /** Cleans generic audit/notification UUID pointers that are not always declared as FKs. */
    private void cleanupLooseUuidReferences(UUID id) {
        if (id == null) return;

        if (tableExists(AUDIT_TABLE) && columnExists(AUDIT_TABLE, "entity_id")) {
            jdbcTemplate.update("delete from " + q(AUDIT_TABLE) + " where entity_id = ?", id);
        }

        deleteLooseUuidColumn("reference_id", id, Set.of());
    }

    private void deleteLooseUuidColumn(String columnName, UUID id, Set<String> excludedTables) {
        if (!validIdentifier(columnName) || id == null) return;

        String sql = """
                select table_name
                  from information_schema.columns
                 where table_schema = current_schema()
                   and column_name = ?
                   and data_type = 'uuid'
                """;

        List<String> tables = jdbcTemplate.query(sql, (rs, rowNum) -> rs.getString(1), columnName);
        for (String table : tables) {
            if (!validIdentifier(table)
                    || !table.startsWith("mf_")
                    || excludedTables.contains(table)) {
                continue;
            }
            jdbcTemplate.update(
                    "delete from " + q(table) + " where " + q(columnName) + " = ?",
                    id);
        }
    }

    private void schedulePhysicalFileDelete(Set<Path> paths) {
        if (paths == null || paths.isEmpty()) return;
        Set<Path> snapshot = new LinkedHashSet<>(paths);

        Runnable delete = () -> snapshot.forEach(path -> {
            try {
                if (path != null) Files.deleteIfExists(path);
            } catch (Exception ex) {
                log.warn("MatFlow DB purge committed but attachment cleanup failed for {}", path, ex);
            }
        });

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    delete.run();
                }
            });
        } else {
            delete.run();
        }
    }

    private void addPath(Set<Path> paths, String rawPath) {
        if (paths == null || rawPath == null || rawPath.isBlank()) return;
        try {
            paths.add(Path.of(rawPath).toAbsolutePath().normalize());
        } catch (Exception ex) {
            log.warn("Ignoring invalid stored MatFlow attachment path during permanent delete: {}", rawPath);
        }
    }

    private void requireAdmin() {
        /* Service-side defense-in-depth in addition to controller @PreAuthorize. */
        if (!accessService.hasAnyRole("ADMIN")) {
            throw new AccessDeniedException("Only ADMIN can permanently delete MatFlow records");
        }
    }

    private void requireId(UUID id, String label) {
        if (id == null) throw badRequest(label + " is required");
    }

    private boolean tableExists(String table) {
        if (!validIdentifier(table)) return false;
        Integer count = jdbcTemplate.queryForObject(
                "select count(*) from information_schema.tables"
                        + " where table_schema = current_schema() and table_name = ?",
                Integer.class,
                table);
        return count != null && count > 0;
    }

    private boolean columnExists(String table, String column) {
        if (!validIdentifier(table) || !validIdentifier(column) || !tableExists(table)) return false;
        Integer count = jdbcTemplate.queryForObject(
                "select count(*) from information_schema.columns"
                        + " where table_schema = current_schema() and table_name = ? and column_name = ?",
                Integer.class,
                table,
                column);
        return count != null && count > 0;
    }

    private boolean rowExists(String table, Object id) {
        if (id == null || !tableExists(table) || !columnExists(table, "id")) return false;
        Integer count = jdbcTemplate.queryForObject(
                "select count(*) from " + q(table) + " where id = ?",
                Integer.class,
                id);
        return count != null && count > 0;
    }

    private Map<String, Object> firstRow(String sql, Object... args) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, args);
        return rows.isEmpty() ? Map.of() : rows.get(0);
    }

    private List<UUID> uuidList(String sql, Object... args) {
        return jdbcTemplate.query(sql, (rs, rowNum) -> rs.getObject(1, UUID.class), args);
    }

    private UUID nullableUuid(String sql, Object... args) {
        List<UUID> rows = uuidList(sql, args);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private List<Object> objectList(String sql, Object... args) {
        return jdbcTemplate.query(sql, (rs, rowNum) -> rs.getObject(1), args);
    }

    private List<String> stringList(String sql, Object... args) {
        return jdbcTemplate.query(sql, (rs, rowNum) -> rs.getString(1), args);
    }

    private String q(String identifier) {
        if (!validIdentifier(identifier)) {
            throw new IllegalArgumentException("Unsafe SQL identifier: " + identifier);
        }
        return '"' + identifier + '"';
    }

    private boolean validIdentifier(String value) {
        return value != null && SQL_IDENTIFIER.matcher(value).matches();
    }

    private UUID uuidValue(Object value) {
        if (value == null) return null;
        if (value instanceof UUID uuid) return uuid;
        try {
            return UUID.fromString(String.valueOf(value));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private Integer intValue(Object value) {
        if (value == null) return null;
        if (value instanceof Number number) return number.intValue();
        try {
            return Integer.valueOf(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private String stringValue(Object value) {
        if (value == null) return null;
        String clean = String.valueOf(value).trim();
        return clean.isBlank() ? null : clean;
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private ResponseStatusException notFound(String message) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, message);
    }

    private ResponseStatusException conflict(String message) {
        return new ResponseStatusException(HttpStatus.CONFLICT, message);
    }

    private ResponseStatusException deleteConflict(String type, DataAccessException ex) {
        log.error("ADMIN permanent MatFlow {} delete failed", type, ex);
        return new ResponseStatusException(
                HttpStatus.CONFLICT,
                type + " could not be permanently deleted because dependent database data still exists. No database changes were committed.");
    }

    private record ForeignReference(String childTable, String childColumn) {}

    private record BomIdentity(
            UUID id,
            String bomNumber,
            UUID productionFileId,
            UUID productId,
            Integer revisionNo) {}
}
