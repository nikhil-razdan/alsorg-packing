package com.alsorg.packing.service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Locale;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.alsorg.packing.domain.sticker.StickerSequence;
import com.alsorg.packing.repository.StickerSequenceRepository;

@Service
public class StickerSequenceService {

    private static final int SEQUENCE_ROW_ID = 1;

    private static final ZoneId APP_ZONE = ZoneId.of("Asia/Kolkata");

    private static final String STICKER_PREFIX = "ALS-SNO";

    private final StickerSequenceRepository repository;

    public StickerSequenceService(
            StickerSequenceRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public String generateNextStickerNumber() {

        /*
         * Use the application timezone instead of the
         * hosting server's default timezone.
         */
        int currentYear = LocalDate.now(APP_ZONE)
                .getYear();

        /*
         * Normally the migration creates this row.
         *
         * This remains as a defensive fallback and is safe
         * under simultaneous requests because PostgreSQL
         * uses ON CONFLICT DO NOTHING.
         */
        repository.ensureSequenceRowExists(
                SEQUENCE_ROW_ID,
                currentYear);

        /*
         * Hard database lock prevents duplicate sequence values.
         */
        StickerSequence sequence = repository.findByIdForUpdate(
                SEQUENCE_ROW_ID)
                .orElseThrow(() -> new IllegalStateException(
                        "Sticker sequence row could not be initialized"));

        Integer storedYear = sequence.getSequenceYear();

        Long storedValue = sequence.getCurrentValue();

        /*
         * Backward-compatible handling for an older database row.
         *
         * When sequenceYear is NULL, preserve the current counter.
         * This means your existing value such as 10147 is not reset.
         */
        if (storedYear == null) {

            sequence.setSequenceYear(
                    currentYear);

        } else if (storedYear.intValue() != currentYear) {

            /*
             * The calendar year changed.
             *
             * Reset to zero here so the first generated number
             * in the new year becomes 000001.
             */
            sequence.setSequenceYear(
                    currentYear);

            sequence.setCurrentValue(
                    0L);

            storedValue = 0L;
        }

        long safeCurrentValue = storedValue == null
                ? 0L
                : Math.max(
                        storedValue,
                        0L);

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

        sequence.setCurrentValue(
                nextValue);

        sequence.setSequenceYear(
                currentYear);

        /*
         * Keep the explicit save from your existing implementation.
         * The row lock remains held until the surrounding transaction
         * completes.
         */
        repository.save(
                sequence);

        /*
         * %06d means minimum six digits, not maximum six digits.
         *
         * It automatically expands:
         *
         * 1 -> 000001
         * 10147 -> 010147
         * 999999 -> 999999
         * 1000000 -> 1000000
         */
        String stickerNumber = String.format(
                Locale.ROOT,
                "%s-%d-%06d",
                STICKER_PREFIX,
                currentYear,
                nextValue);

        System.out.println(
                ">>> GENERATED STICKER NUMBER: "
                        + stickerNumber);

        return stickerNumber;
    }
}