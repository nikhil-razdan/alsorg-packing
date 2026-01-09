package com.alsorg.packing.config;

import com.alsorg.packing.domain.sticker.StickerSequence;
import com.alsorg.packing.repository.StickerSequenceRepository;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer {

    private final StickerSequenceRepository repository;

    public DataInitializer(StickerSequenceRepository repository) {
        this.repository = repository;
    }

    @PostConstruct
    public void init() {
        repository.findById(1)
            .orElseGet(() -> {
                StickerSequence seq = new StickerSequence();
                seq.setCurrentValue(0L);
                return repository.save(seq);
            });
    }
}
