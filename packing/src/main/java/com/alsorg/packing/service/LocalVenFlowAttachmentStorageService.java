package com.alsorg.packing.service;

import com.alsorg.packing.domain.venflow.VenFlowAttachmentType;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

@Service
public class LocalVenFlowAttachmentStorageService
        implements VenFlowAttachmentStorageService {

    private final Path storageRoot;
    private final long maximumFileSize;

    public LocalVenFlowAttachmentStorageService(
            @Value(
                    "${venflow.attachments.storage-dir:"
                            + "./data/venflow-attachments}")
            String storageDirectory,

            @Value(
                    "${venflow.attachments.max-file-size-bytes:"
                            + "15728640}")
            long maximumFileSize) {

        this.storageRoot = Paths
                .get(storageDirectory)
                .toAbsolutePath()
                .normalize();

        this.maximumFileSize = maximumFileSize;

        try {
            Files.createDirectories(
                    this.storageRoot);

        } catch (IOException ex) {
            throw new IllegalStateException(
                    "Unable to initialize VenFlow "
                            + "attachment storage directory: "
                            + this.storageRoot,
                    ex);
        }
    }

    @Override
    public StoredFile store(
            UUID entryId,
            VenFlowAttachmentType type,
            MultipartFile file) {

        if (entryId == null) {
            throw badRequest(
                    "VenFlow entry ID is required.");
        }

        if (type == null) {
            throw badRequest(
                    "Attachment Type is required.");
        }

        if (file == null || file.isEmpty()) {
            throw badRequest(
                    "Attachment file is required.");
        }

        if (file.getSize() > maximumFileSize) {
            throw badRequest(
                    "Attachment file exceeds the maximum "
                            + "allowed size of "
                            + maximumFileSize
                            + " bytes.");
        }

        String originalName = StringUtils.cleanPath(
                Objects.requireNonNullElse(
                        file.getOriginalFilename(),
                        "attachment"));

        if (originalName.contains("..")) {
            throw badRequest(
                    "Invalid attachment file name.");
        }

        String extension =
                extractSafeExtension(originalName);

        String storedFileName =
                UUID.randomUUID()
                        + extension;

        Path relativePath = Paths.get(
                entryId.toString(),
                type.name()
                        .toLowerCase(Locale.ROOT),
                storedFileName);

        Path targetPath = storageRoot
                .resolve(relativePath)
                .normalize();

        assertInsideStorageRoot(targetPath);

        try {
            Files.createDirectories(
                    targetPath.getParent());

            MessageDigest digest =
                    MessageDigest.getInstance(
                            "SHA-256");

            try (InputStream rawInput =
                         file.getInputStream();

                 DigestInputStream digestInput =
                         new DigestInputStream(
                                 rawInput,
                                 digest)) {

                Files.copy(
                        digestInput,
                        targetPath,
                        StandardCopyOption.REPLACE_EXISTING);
            }

            String checksum =
                    HexFormat.of()
                            .formatHex(
                                    digest.digest());

            String storageKey =
                    relativePath.toString()
                            .replace(
                                    File.separatorChar,
                                    '/');

            return new StoredFile(
                    storageKey,
                    storedFileName,
                    file.getSize(),
                    checksum);

        } catch (IOException ex) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Unable to store attachment file.",
                    ex);

        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(
                    "SHA-256 algorithm is unavailable.",
                    ex);
        }
    }

    @Override
    public Resource load(
            String storageKey) {

        if (storageKey == null
                || storageKey.isBlank()) {

            throw badRequest(
                    "Attachment storage key is missing.");
        }

        Path targetPath = storageRoot
                .resolve(storageKey)
                .normalize();

        assertInsideStorageRoot(targetPath);

        if (!Files.exists(targetPath)
                || !Files.isRegularFile(targetPath)) {

            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Attachment physical file was not found.");
        }

        return new FileSystemResource(
                targetPath);
    }

    @Override
    public void delete(
            String storageKey) {

        if (storageKey == null
                || storageKey.isBlank()) {
            return;
        }

        Path targetPath = storageRoot
                .resolve(storageKey)
                .normalize();

        assertInsideStorageRoot(targetPath);

        try {
            Files.deleteIfExists(targetPath);

        } catch (IOException ex) {
            /*
             * This method is used primarily when database persistence
             * fails after physical storage succeeds.
             *
             * Do not hide the original database error because cleanup
             * failure is secondary.
             */
        }
    }

    private void assertInsideStorageRoot(
            Path targetPath) {

        if (!targetPath.startsWith(
                storageRoot)) {

            throw badRequest(
                    "Invalid attachment storage path.");
        }
    }

    private String extractSafeExtension(
            String fileName) {

        int dotIndex =
                fileName.lastIndexOf('.');

        if (dotIndex < 0
                || dotIndex
                == fileName.length() - 1) {

            return "";
        }

        String extension = fileName
                .substring(dotIndex)
                .toLowerCase(Locale.ROOT);

        if (!extension.matches(
                "\\.[a-z0-9]{1,10}")) {

            return "";
        }

        return extension;
    }

    private ResponseStatusException badRequest(
            String message) {

        return new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                message);
    }
}