package com.alsorg.packing.service;

import java.time.LocalDate;
import java.util.Locale;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.alsorg.packing.config.TimeZoneConfig;
import com.alsorg.packing.domain.sticker.StickerSequence;
import com.alsorg.packing.repository.StickerSequenceRepository;

@Service
public class StickerSequenceService {

    private static final Logger log = LoggerFactory.getLogger(StickerSequenceService.class);

    private static final int SEQUENCE_ROW_ID = 1;
    private static final String STICKER_PREFIX = "ALS-SNO";

    private final StickerSequenceRepository repository;

    public StickerSequenceService(
            StickerSequenceRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public String generateNextStickerNumber() {
        int currentYear = LocalDate.now(TimeZoneConfig.APP_ZONE)
                .getYear();

        /*
         * Defensive, concurrency-safe initialization. The database row is normally
         * created by migration/startup initialization, but ON CONFLICT DO NOTHING
         * keeps first-use safe too.
         */
        repository.ensureSequenceRowExists(
                SEQUENCE_ROW_ID,
                currentYear);

        StickerSequence sequence = repository.findByIdForUpdate(
                        SEQUENCE_ROW_ID)
                .orElseThrow(() -> new IllegalStateException(
                        "Sticker sequence row could not be initialized"));

        Integer storedYear = sequence.getSequenceYear();
        Long storedValue = sequence.getCurrentValue();

        /*
         * Preserve a legacy counter when sequenceYear was historically NULL.
         * Only a confirmed calendar-year transition resets the counter.
         */
        if (storedYear == null) {
            sequence.setSequenceYear(currentYear);
        } else if (storedYear.intValue() != currentYear) {
            sequence.setSequenceYear(currentYear);
            sequence.setCurrentValue(0L);
            storedValue = 0L;
        }

        long safeCurrentValue = storedValue == null
                ? 0L
                : Math.max(storedValue, 0L);

        final long nextValue;

        try {
            nextValue = Math.addExact(
                    safeCurrentValue,
                    1L);
        } catch (ArithmeticException exception) {
            throw new IllegalStateException(
                    "Sticker sequence has reached the maximum supported value",
                    exception);
        }

        sequence.setCurrentValue(nextValue);
        sequence.setSequenceYear(currentYear);
        repository.save(sequence);

        String stickerNumber = String.format(
                Locale.ROOT,
                "%s-%d-%06d",
                STICKER_PREFIX,
                currentYear,
                nextValue);

        log.debug("Generated sticker number {}", stickerNumber);

        return stickerNumber;
    }
}
