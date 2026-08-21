package com.alsorg.packing.bomflow.service;

import com.alsorg.packing.bomflow.domain.BomFlowProduct;
import com.alsorg.packing.bomflow.dto.BomFlowProductDtos.ProductResponse;
import com.alsorg.packing.bomflow.repository.BomFlowProductRepository;
import com.alsorg.packing.bomflow.security.BomFlowAccessService;
import com.alsorg.packing.bomflow.service.BomFlowProductFileStorageService.FileSlot;
import com.alsorg.packing.bomflow.service.BomFlowProductFileStorageService.StoredFile;

import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional
public class BomFlowProductAttachmentService {

    private static final long IMAGE_MAX_BYTES = 5L * 1024L * 1024L;
    private static final long DRAWING_MAX_BYTES = 25L * 1024L * 1024L;

    private static final Set<String> IMAGE_EXTENSIONS = Set.of(
            "png",
            "jpg",
            "jpeg",
            "webp");

    private static final Set<String> DRAWING_EXTENSIONS = Set.of(
            "pdf",
            "dwg",
            "dxf",
            "png",
            "jpg",
            "jpeg",
            "webp");

    public record ProductFileDownload(
            String originalFileName,
            String contentType,
            long fileSize,
            Resource resource) {
    }

    private final BomFlowProductRepository productRepository;
    private final BomFlowAccessService access;
    private final BomFlowMapper mapper;
    private final BomFlowProductFileStorageService storage;

    public BomFlowProductAttachmentService(
            BomFlowProductRepository productRepository,
            BomFlowAccessService access,
            BomFlowMapper mapper,
            BomFlowProductFileStorageService storage) {

        this.productRepository = productRepository;
        this.access = access;
        this.mapper = mapper;
        this.storage = storage;
    }

    public ProductResponse uploadProductImage(
            UUID productId,
            MultipartFile file) {

        access.requireEditor();

        BomFlowProduct product = requireProductForUpdate(productId);
        String extension = validateFile(
                file,
                IMAGE_EXTENSIONS,
                IMAGE_MAX_BYTES,
                "Product image",
                true);

        String oldStorageKey = product.productImageStorageKey;

        StoredFile stored = storage.store(
                product.id,
                FileSlot.PRODUCT_IMAGE,
                file,
                extension);

        String actor = access.currentUsername();
        LocalDateTime now = LocalDateTime.now();

        product.productImageOriginalName = cleanFileName(file.getOriginalFilename());
        product.productImageStoredName = stored.storedFileName();
        product.productImageStorageKey = stored.storageKey();
        product.productImageContentType = clean(file.getContentType());
        product.productImageSize = stored.fileSize();
        product.productImageUploadedBy = actor;
        product.productImageUploadedAt = now;
        product.updatedBy = actor;
        product.updatedAt = now;

        try {
            product = productRepository.saveAndFlush(product);
        } catch (RuntimeException ex) {
            storage.delete(stored.storageKey());
            throw ex;
        }

        if (oldStorageKey != null
                && !oldStorageKey.equals(stored.storageKey())) {
            storage.delete(oldStorageKey);
        }

        return mapper.toProductResponse(product);
    }

    public ProductResponse uploadDrawing(
            UUID productId,
            MultipartFile file) {

        access.requireEditor();

        BomFlowProduct product = requireProductForUpdate(productId);
        String extension = validateFile(
                file,
                DRAWING_EXTENSIONS,
                DRAWING_MAX_BYTES,
                "Drawing",
                false);

        String oldStorageKey = product.drawingFileStorageKey;

        StoredFile stored = storage.store(
                product.id,
                FileSlot.DRAWING,
                file,
                extension);

        String actor = access.currentUsername();
        LocalDateTime now = LocalDateTime.now();

        product.drawingFileOriginalName = cleanFileName(file.getOriginalFilename());
        product.drawingFileStoredName = stored.storedFileName();
        product.drawingFileStorageKey = stored.storageKey();
        product.drawingFileContentType = clean(file.getContentType());
        product.drawingFileSize = stored.fileSize();
        product.drawingFileUploadedBy = actor;
        product.drawingFileUploadedAt = now;
        product.updatedBy = actor;
        product.updatedAt = now;

        try {
            product = productRepository.saveAndFlush(product);
        } catch (RuntimeException ex) {
            storage.delete(stored.storageKey());
            throw ex;
        }

        if (oldStorageKey != null
                && !oldStorageKey.equals(stored.storageKey())) {
            storage.delete(oldStorageKey);
        }

        return mapper.toProductResponse(product);
    }

    @Transactional(readOnly = true)
    public ProductFileDownload downloadProductImage(
            UUID productId) {

        access.requireBomFlowAccess();

        BomFlowProduct product = requireProduct(productId);

        if (!hasText(product.productImageStorageKey)) {
            throw notFound("Product image is not available.");
        }

        return new ProductFileDownload(
                safeName(product.productImageOriginalName, "product-image"),
                product.productImageContentType,
                safeSize(product.productImageSize),
                storage.load(product.productImageStorageKey));
    }

    @Transactional(readOnly = true)
    public ProductFileDownload downloadDrawing(
            UUID productId) {

        access.requireBomFlowAccess();

        BomFlowProduct product = requireProduct(productId);

        if (!hasText(product.drawingFileStorageKey)) {
            throw notFound("Drawing file is not available.");
        }

        return new ProductFileDownload(
                safeName(product.drawingFileOriginalName, "drawing"),
                product.drawingFileContentType,
                safeSize(product.drawingFileSize),
                storage.load(product.drawingFileStorageKey));
    }

    public ProductResponse deleteProductImage(
            UUID productId) {

        access.requireEditor();

        BomFlowProduct product = requireProductForUpdate(productId);
        String storageKey = product.productImageStorageKey;

        product.productImageOriginalName = null;
        product.productImageStoredName = null;
        product.productImageStorageKey = null;
        product.productImageContentType = null;
        product.productImageSize = null;
        product.productImageUploadedBy = null;
        product.productImageUploadedAt = null;
        product.updatedBy = access.currentUsername();
        product.updatedAt = LocalDateTime.now();

        product = productRepository.saveAndFlush(product);
        storage.delete(storageKey);

        return mapper.toProductResponse(product);
    }

    public ProductResponse deleteDrawing(
            UUID productId) {

        access.requireEditor();

        BomFlowProduct product = requireProductForUpdate(productId);
        String storageKey = product.drawingFileStorageKey;

        product.drawingFileOriginalName = null;
        product.drawingFileStoredName = null;
        product.drawingFileStorageKey = null;
        product.drawingFileContentType = null;
        product.drawingFileSize = null;
        product.drawingFileUploadedBy = null;
        product.drawingFileUploadedAt = null;
        product.updatedBy = access.currentUsername();
        product.updatedAt = LocalDateTime.now();

        product = productRepository.saveAndFlush(product);
        storage.delete(storageKey);

        return mapper.toProductResponse(product);
    }

    private String validateFile(
            MultipartFile file,
            Set<String> allowedExtensions,
            long maxBytes,
            String label,
            boolean requireImageContentType) {

        if (file == null || file.isEmpty()) {
            throw badRequest(label + " file is required.");
        }

        if (file.getSize() > maxBytes) {
            throw badRequest(
                    label + " exceeds the maximum size of "
                            + (maxBytes / (1024L * 1024L))
                            + " MB.");
        }

        String fileName = cleanFileName(file.getOriginalFilename());
        String extension = extension(fileName);

        if (!allowedExtensions.contains(extension)) {
            throw badRequest(
                    label + " type is not supported. Allowed: "
                            + String.join(", ", allowedExtensions));
        }

        if (requireImageContentType) {
            String contentType = clean(file.getContentType());

            if (contentType != null
                    && !contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
                throw badRequest("Product image must be an image file.");
            }
        }

        return extension;
    }

    private String extension(
            String fileName) {

        int index = fileName.lastIndexOf('.');

        if (index < 0 || index == fileName.length() - 1) {
            return "";
        }

        return fileName.substring(index + 1)
                .trim()
                .toLowerCase(Locale.ROOT);
    }

    private String cleanFileName(
            String fileName) {

        String value = clean(fileName);

        if (value == null) {
            return "file";
        }

        value = value.replace('\\', '/');
        int slash = value.lastIndexOf('/');

        if (slash >= 0) {
            value = value.substring(slash + 1);
        }

        value = value.replaceAll("[\\r\\n\\t]", "_");

        return value.length() > 500
                ? value.substring(value.length() - 500)
                : value;
    }

    private String safeName(
            String name,
            String fallback) {

        String value = clean(name);
        return value == null ? fallback : value;
    }

    private long safeSize(
            Long size) {

        return size == null || size < 0 ? 0L : size;
    }

    private BomFlowProduct requireProductForUpdate(
            UUID productId) {

        if (productId == null) {
            throw badRequest("Product ID is required.");
        }

        return productRepository
                .findByIdForUpdate(productId)
                .orElseThrow(() -> notFound(
                        "Product not found: " + productId));
    }

    private BomFlowProduct requireProduct(
            UUID productId) {

        if (productId == null) {
            throw badRequest("Product ID is required.");
        }

        return productRepository
                .findById(productId)
                .orElseThrow(() -> notFound(
                        "Product not found: " + productId));
    }

    private boolean hasText(
            String value) {

        return value != null && !value.trim().isEmpty();
    }

    private String clean(
            String value) {

        if (value == null) {
            return null;
        }

        String cleaned = value.trim();
        return cleaned.isEmpty() ? null : cleaned;
    }

    private ResponseStatusException badRequest(
            String message) {

        return new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                message);
    }

    private ResponseStatusException notFound(
            String message) {

        return new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                message);
    }
}
