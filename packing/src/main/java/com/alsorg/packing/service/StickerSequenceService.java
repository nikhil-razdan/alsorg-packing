package com.alsorg.packing.service;

import java.time.Year;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.alsorg.packing.domain.sticker.StickerSequence;
import com.alsorg.packing.repository.StickerSequenceRepository;

@Service
public class StickerSequenceService {

    private final StickerSequenceRepository repository;

    public StickerSequenceService(StickerSequenceRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public String generateNextStickerNumber() {

        // 🔒 HARD DB LOCK (prevents duplicate numbers)
        StickerSequence seq = repository.findByIdForUpdate(1)
                .orElseThrow(() ->
                        new IllegalStateException("Sticker sequence not initialized"));

        long nextValue = seq.getCurrentValue() + 1;
        seq.setCurrentValue(nextValue);

        repository.save(seq);

        int year = Year.now().getValue();

        String stickerNumber =
                String.format("ALS-SNO-%d-%06d", year, nextValue);

        System.out.println(">>> GENERATED STICKER NUMBER: " + stickerNumber);

        return stickerNumber;
    }
}
