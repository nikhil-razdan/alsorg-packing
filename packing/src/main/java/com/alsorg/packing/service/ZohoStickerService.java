package com.alsorg.packing.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.config.TimeZoneConfig;
import com.alsorg.packing.domain.common.ApprovalStatus;
import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.domain.sticker.ZohoSticker;
import com.alsorg.packing.domain.sticker.ZohoStickerHistory;
import com.alsorg.packing.integration.zoho.ZohoInventoryClient;
import com.alsorg.packing.integration.zoho.dto.ZohoItemDTO;
import com.alsorg.packing.repository.DispatchedItemRepository;
import com.alsorg.packing.repository.ZohoStickerHistoryRepository;
import com.alsorg.packing.repository.ZohoStickerRepository;
import com.alsorg.packing.service.pdf.PdfStickerService;
import com.alsorg.packing.service.pdf.dto.StickerPdfData;

@Service
@Transactional
public class ZohoStickerService {

    private static final Logger log =
            LoggerFactory.getLogger(ZohoStickerService.class);

    private static final int MAX_ZOHO_ID_LENGTH = 300;
    private static final int MAX_FLOOR_LENGTH = 120;

    private final ZohoStickerRepository stickerRepo;
    private final ZohoStickerHistoryRepository historyRepo;
    private final DispatchedItemRepository dispatchedRepo;
    private final PdfStickerService pdfService;
    private final ZohoInventoryClient zohoClient;
    private final StickerSequenceService sequenceService;
    private final AuditLogService auditLogService;

    @Value("${sticker.storage.path}")
    private String stickerPath;

    public ZohoStickerService(
            ZohoStickerRepository stickerRepo,
            ZohoStickerHistoryRepository historyRepo,
            DispatchedItemRepository dispatchedRepo,
            PdfStickerService pdfService,
            ZohoInventoryClient zohoClient,
            StickerSequenceService sequenceService,
            ZohoStickerHistoryRepository stickerHistoryRepo,
            AuditLogService auditLogService) {

        this.stickerRepo = stickerRepo;

        /*
         * Both injected history parameters historically referred
         * to the same Spring Data repository bean.
         *
         * Keep this constructor shape for backward compatibility.
         */
        this.historyRepo =
                historyRepo != null
                        ? historyRepo
                        : stickerHistoryRepo;

        this.dispatchedRepo = dispatchedRepo;
        this.pdfService = pdfService;
        this.zohoClient = zohoClient;
        this.sequenceService = sequenceService;
        this.auditLogService = auditLogService;
    }

    public byte[] generateStickerForZohoItem(
            String zohoItemId,
            String factoryFloor) throws IOException {

        return generateStickerForZohoItem(
                zohoItemId,
                factoryFloor,
                "SYSTEM");
    }

    /**
     * Backward-compatible Zoho sticker generator.
     *
     * The legacy two-argument method still attributes to SYSTEM.
     * Authenticated controllers should use this overload and pass
     * the actor resolved from Spring Security.
     */
    public byte[] generateStickerForZohoItem(
            String zohoItemId,
            String factoryFloor,
            String actor) throws IOException {

        String cleanZohoItemId =
                requireZohoItemId(zohoItemId);

        String cleanFloor =
                cleanLimited(
                        factoryFloor,
                        MAX_FLOOR_LENGTH);

        String cleanActor =
                safeActor(actor);

        long iteration =
                historyRepo.countByZohoItemId(cleanZohoItemId)
                        + 1L;

        ZohoItemDTO item =
                zohoClient.fetchItemDetails(
                        cleanZohoItemId);

        if (item == null) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Zoho item not found: "
                            + cleanZohoItemId);
        }

        String stickerNumber =
                sequenceService.generateNextStickerNumber();

        StickerPdfData pdf =
                new StickerPdfData();

        pdf.setPrintIteration(
                iteration > Integer.MAX_VALUE
                        ? Integer.MAX_VALUE
                        : (int) iteration);

        pdf.setStickerNumber(stickerNumber);
        pdf.setBarcodeText(stickerNumber);

        pdf.setItemName(
                item.getName());

        pdf.setDescription(
                item.getDescription());

        pdf.setLocation(
                item.getLocation());

        pdf.setFloor(
                cleanFloor != null
                        ? cleanFloor
                        : item.getFloor());

        pdf.setClientName(
                item.getClientName());

        pdf.setClientAddress(
                item.getClientAddress());

        pdf.setPdNo(
                item.getPdNo());

        pdf.setDrawingNo(
                item.getDrawingNo());

        pdf.setRemarks(
                item.getRemarks());

        pdf.setDimensions(
                item.getDimensions());

        pdf.setWeight(
                item.getWeight());

        pdf.setQuantity(1);

        pdf.setDate(
                LocalDate.now(
                                TimeZoneConfig.APP_ZONE)
                        .format(
                                DateTimeFormatter.ofPattern(
                                        "dd-MM-yyyy")));

        byte[] pdfBytes =
                pdfService.generateSticker(pdf);

        if (pdfBytes == null
                || pdfBytes.length == 0) {

            throw new IllegalStateException(
                    "Sticker PDF generation returned no data");
        }

        Path output =
                resolveStickerWritePath(
                        "STICKER_"
                                + sanitizeFilenamePart(
                                        stickerNumber)
                                + ".pdf");

        Files.createDirectories(
                output.getParent());

        Files.write(
                output,
                pdfBytes,
                StandardOpenOption.CREATE,
                StandardOpenOption.TRUNCATE_EXISTING,
                StandardOpenOption.WRITE);

        LocalDateTime now =
                LocalDateTime.now(
                        TimeZoneConfig.APP_ZONE);

        /*
         * =====================================================
         * CURRENT ZOHO STICKER RECORD
         * =====================================================
         */
        ZohoSticker sticker =
                stickerRepo
                        .findById(
                                cleanZohoItemId)
                        .orElseGet(
                                ZohoSticker::new);

        sticker.setZohoItemId(
                cleanZohoItemId);

        sticker.setStickerNumber(
                stickerNumber);

        sticker.setGeneratedAt(
                now);

        sticker.setFilePath(
                output.toString());

        stickerRepo.save(sticker);

        /*
         * =====================================================
         * AUDIT LOG
         * =====================================================
         */
        auditLogService.log(
                cleanZohoItemId,
                "Sticker generated (Iteration "
                        + iteration
                        + ")",
                cleanActor,
                "SYSTEM".equals(cleanActor)
                        ? "SYSTEM"
                        : "PACKING");

        /*
         * =====================================================
         * ZOHO STICKER HISTORY
         *
         * IMPORTANT:
         * ZohoStickerHistory uses Long as its primary key.
         * The database/JPA entity generates the ID.
         * =====================================================
         */
        ZohoStickerHistory history =
                new ZohoStickerHistory();

        history.setZohoItemId(
                cleanZohoItemId);

        history.setStickerNumber(
                stickerNumber);

        history.setFilePath(
                output.toString());

        history.setGeneratedAt(
                now);

        history.setGeneratedBy(
                cleanActor);

        history.setGeneratedRole(
                "SYSTEM".equals(cleanActor)
                        ? "SYSTEM"
                        : "PACKING");

        history.setReason(
                "GENERATED");

        historyRepo.save(history);

        /*
         * =====================================================
         * LEGACY ZOHO -> DISPATCH OPERATIONAL ROW
         * =====================================================
         *
         * Preserve the existing PackFlow workflow:
         *
         * Create the operational Dispatch row only when one
         * does not already exist.
         *
         * Never overwrite an existing row's lifecycle state.
         * =====================================================
         */
        DispatchedItem dispatchedItem =
                dispatchedRepo
                        .findByIdForLifecycleUpdate(
                                cleanZohoItemId)
                        .orElse(null);

        if (dispatchedItem == null) {

            dispatchedItem =
                    new DispatchedItem();

            dispatchedItem.setZohoItemId(
                    cleanZohoItemId);

            dispatchedItem.setName(
                    item.getName());

            dispatchedItem.setSku(
                    item.getSku());

            dispatchedItem.setClientName(
                    item.getClientName());

            dispatchedItem.setPackedAt(
                    now);

            dispatchedItem.setStatus(
                    ItemDispatchStatus.ON_FLOOR);

            dispatchedItem.setFloorLocation(
                    cleanFloor);

            dispatchedItem.setFactoryFloor(
                    cleanFloor);

            dispatchedItem.setMovedToFloorAt(
                    now);

            dispatchedItem.setStock(
                    1);

            dispatchedItem.setApprovalStatus(
                    ApprovalStatus.NONE);

            dispatchedItem.setCreatedBy(
                    cleanActor);

            dispatchedItem.setCreatedAt(
                    now);

            dispatchedRepo.save(
                    dispatchedItem);
        }

        log.debug(
                "Legacy Zoho sticker generated: zohoItemId={}, sticker={}",
                cleanZohoItemId,
                stickerNumber);

        return pdfBytes;
    }

    /*
     * =========================================================
     * CURRENT STICKER PDF
     * =========================================================
     */

    @Transactional(readOnly = true)
    public byte[] getStickerPdfForZohoItem(
            String zohoItemId) {

        String cleanId =
                requireZohoItemId(
                        zohoItemId);

        ZohoSticker sticker =
                stickerRepo
                        .findById(cleanId)
                        .orElseThrow(() ->
                                new ResponseStatusException(
                                        HttpStatus.NOT_FOUND,
                                        "Sticker not generated yet for: "
                                                + cleanId));

        return readStoredStickerFile(
                sticker.getFilePath());
    }

    /*
     * =========================================================
     * HISTORICAL STICKER PDF
     * =========================================================
     *
     * IMPORTANT FIX:
     *
     * ZohoStickerHistoryRepository extends:
     *
     * JpaRepository<ZohoStickerHistory, Long>
     *
     * Therefore its findById(...) requires Long,
     * NOT UUID.
     * =========================================================
     */

    @Transactional(readOnly = true)
    public byte[] downloadStickerFromHistory(
            String historyId) {

        Long id =
                parseHistoryId(
                        historyId);

        ZohoStickerHistory history =
                historyRepo
                        .findById(id)
                        .orElseThrow(() ->
                                new ResponseStatusException(
                                        HttpStatus.NOT_FOUND,
                                        "Sticker history not found"));

        return readStoredStickerFile(
                history.getFilePath());
    }

    private Long parseHistoryId(
            String historyId) {

        String clean =
                historyId == null
                        ? ""
                        : historyId.trim();

        if (clean.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Sticker history ID is required");
        }

        final long id;

        try {
            id =
                    Long.parseLong(
                            clean);
        } catch (NumberFormatException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid sticker history ID");
        }

        if (id <= 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid sticker history ID");
        }

        return id;
    }

    /*
     * =========================================================
     * FILE READING
     * =========================================================
     */

    private byte[] readStoredStickerFile(
            String storedPath) {

        Path file =
                resolveExistingStickerFile(
                        storedPath);

        try {
            return Files.readAllBytes(
                    file);

        } catch (IOException exception) {

            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to read sticker PDF",
                    exception);
        }
    }

    /*
     * =========================================================
     * SAFE WRITE PATH
     * =========================================================
     */

    private Path resolveStickerWritePath(
            String filename) {

        Path root =
                storageRoot();

        Path candidate =
                root.resolve(filename)
                        .normalize();

        if (!candidate.startsWith(root)) {
            throw new IllegalStateException(
                    "Sticker output path escaped configured storage root");
        }

        return candidate;
    }

    /*
     * =========================================================
     * SAFE EXISTING FILE RESOLUTION
     * =========================================================
     */

    private Path resolveExistingStickerFile(
            String storedPath) {

        if (storedPath == null
                || storedPath.isBlank()) {

            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Sticker file path is missing");
        }

        Path root =
                storageRoot();

        Path rootReal =
                realRoot(root);

        Path direct =
                Paths.get(storedPath)
                        .toAbsolutePath()
                        .normalize();

        Path validated =
                validateExistingFileUnderRoot(
                        direct,
                        root,
                        rootReal);

        if (validated != null) {
            return validated;
        }

        /*
         * Legacy fallback:
         *
         * Some historical DB rows may contain an old absolute
         * path. If the same filename now exists inside the
         * configured sticker root, allow that file.
         */
        Path filename =
                Paths.get(storedPath)
                        .getFileName();

        if (filename != null) {

            validated =
                    validateExistingFileUnderRoot(
                            root.resolve(filename)
                                    .normalize(),
                            root,
                            rootReal);
        }

        if (validated != null) {
            return validated;
        }

        throw new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Sticker file not found");
    }

    private Path validateExistingFileUnderRoot(
            Path candidate,
            Path root,
            Path rootReal) {

        if (candidate == null
                || !candidate
                        .normalize()
                        .startsWith(root)) {

            return null;
        }

        if (!Files.isRegularFile(
                candidate)) {

            return null;
        }

        try {

            Path real =
                    candidate.toRealPath();

            return real.startsWith(
                    rootReal)
                            ? real
                            : null;

        } catch (IOException exception) {

            return null;
        }
    }

    private Path realRoot(
            Path root) {

        try {

            Files.createDirectories(
                    root);

            return root.toRealPath();

        } catch (IOException exception) {

            throw new IllegalStateException(
                    "Sticker storage path is unavailable",
                    exception);
        }
    }

    private Path storageRoot() {

        if (stickerPath == null
                || stickerPath.isBlank()) {

            throw new IllegalStateException(
                    "sticker.storage.path is not configured");
        }

        Path root =
                Paths.get(stickerPath)
                        .toAbsolutePath()
                        .normalize();

        /*
         * Prevent accidentally configuring:
         *
         * Windows filesystem root
         * Linux /
         *
         * as the sticker storage directory.
         */
        if (root.getParent() == null) {

            throw new IllegalStateException(
                    "Filesystem root cannot be used as sticker storage");
        }

        return root;
    }

    /*
     * =========================================================
     * INPUT VALIDATION
     * =========================================================
     */

    private String requireZohoItemId(
            String value) {

        String clean =
                value == null
                        ? ""
                        : value.trim();

        if (clean.isBlank()) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Zoho item id is required");
        }

        if (clean.length()
                > MAX_ZOHO_ID_LENGTH) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Zoho item id is too long");
        }

        return clean;
    }

    private String cleanLimited(
            String value,
            int maxLength) {

        if (value == null) {
            return null;
        }

        String clean =
                value.trim();

        if (clean.isBlank()) {
            return null;
        }

        if (clean.length()
                > maxLength) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Value is too long");
        }

        return clean;
    }

    private String safeActor(
            String value) {

        String clean =
                value == null
                        ? ""
                        : value.trim();

        return clean.isBlank()
                ? "SYSTEM"
                : clean;
    }

    private String sanitizeFilenamePart(
            String value) {

        return value == null
                ? "sticker"
                : value.replaceAll(
                        "[^A-Za-z0-9._-]",
                        "_");
    }
}