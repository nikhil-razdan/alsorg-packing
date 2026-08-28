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

/**
 * Independent concurrency-safe sticker counters.
 *
 * Row 1 is the existing ALS counter and is intentionally unchanged.
 * Row 38 is exclusively for WR-38 QR sticker identities.  It initializes at
 * zero and therefore the first generated WR number is ...000001 without
 * consuming or resetting a single ALS number.
 */
@Service
public class StickerSequenceService {

    private static final Logger log = LoggerFactory.getLogger(StickerSequenceService.class);

    private static final int ALS_SEQUENCE_ROW_ID = 1;
    private static final int WR38_SEQUENCE_ROW_ID = 38;

    private static final String ALS_STICKER_PREFIX = "ALS-SNO";
    private static final String WR38_STICKER_PREFIX = "WR-SNO";

    private final StickerSequenceRepository repository;

    public StickerSequenceService(
            StickerSequenceRepository repository) {
        this.repository = repository;
    }

    /**
     * Existing AL-P1/2/3/4 contract. Do not change this format/counter.
     */
    @Transactional
    public String generateNextStickerNumber() {
        return nextNumber(
                ALS_SEQUENCE_ROW_ID,
                ALS_STICKER_PREFIX,
                "ALS");
    }

    /**
     * WR-38-only QR contract. Separate row, separate count, WR prefix.
     */
    @Transactional
    public String generateNextWr38StickerNumber() {
        return nextNumber(
                WR38_SEQUENCE_ROW_ID,
                WR38_STICKER_PREFIX,
                "WR-38");
    }

    @Transactional
    public String generateNextStickerNumberForPlant(
            String plantCode) {
        if (plantCode != null
                && "WR-38".equalsIgnoreCase(plantCode.trim())) {
            return generateNextWr38StickerNumber();
        }
        return generateNextStickerNumber();
    }

    private String nextNumber(
            int sequenceRowId,
            String prefix,
            String label) {

        int currentYear = LocalDate.now(TimeZoneConfig.APP_ZONE)
                .getYear();

        repository.ensureSequenceRowExists(
                sequenceRowId,
                currentYear);

        StickerSequence sequence = repository.findByIdForUpdate(sequenceRowId)
                .orElseThrow(() -> new IllegalStateException(
                        label + " sticker sequence row could not be initialized"));

        Integer storedYear = sequence.getSequenceYear();
        Long storedValue = sequence.getCurrentValue();

        /*
         * Existing behavior is preserved independently for each sequence row.
         * A legacy NULL year adopts the current year without resetting its value;
         * only a confirmed year change starts that sequence again from zero.
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
            nextValue = Math.addExact(safeCurrentValue, 1L);
        } catch (ArithmeticException exception) {
            throw new IllegalStateException(
                    label + " sticker sequence has reached the maximum supported value",
                    exception);
        }

        sequence.setCurrentValue(nextValue);
        sequence.setSequenceYear(currentYear);
        repository.save(sequence);

        String stickerNumber = String.format(
                Locale.ROOT,
                "%s-%d-%06d",
                prefix,
                currentYear,
                nextValue);

        log.debug("Generated {} sticker number {}", label, stickerNumber);
        return stickerNumber;
    }
}
