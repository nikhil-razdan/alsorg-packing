package com.alsorg.packing.config;

import java.time.LocalDate;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.alsorg.packing.repository.StickerSequenceRepository;

/**
 * Ensures the fixed sticker-sequence row exists.
 *
 * The repository uses INSERT ... ON CONFLICT DO NOTHING, so startup remains
 * safe when multiple application instances initialize at the same time.
 */
@Component
public class DataInitializer implements ApplicationRunner {

    private static final int SEQUENCE_ROW_ID = 1;

    private final StickerSequenceRepository repository;

    public DataInitializer(
            StickerSequenceRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional
    public void run(
            ApplicationArguments args) {

        int currentYear = LocalDate.now(
                        TimeZoneConfig.APP_ZONE)
                .getYear();

        repository.ensureSequenceRowExists(
                SEQUENCE_ROW_ID,
                currentYear);
    }
}
