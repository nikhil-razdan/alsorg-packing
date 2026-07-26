package com.alsorg.packing.service.bomflow;

import com.alsorg.packing.domain.bomflow.BomFlowSequence;
import com.alsorg.packing.repository.bomflow.BomFlowSequenceRepository;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Year;
import java.util.Locale;

@Service
@Transactional
public class BomFlowNumberService {

    private final BomFlowSequenceRepository sequenceRepo;

    public BomFlowNumberService(
            BomFlowSequenceRepository sequenceRepo) {

        this.sequenceRepo = sequenceRepo;
    }

    public String nextBomNo(
            String plantCode) {

        String normalizedPlant = normalizePlantCode(
                plantCode);

        int currentYear = Year.now().getValue();

        sequenceRepo.ensureSequenceExists(
                normalizedPlant,
                currentYear);

        BomFlowSequence sequence = sequenceRepo.findForUpdate(
                normalizedPlant,
                currentYear)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.INTERNAL_SERVER_ERROR,
                        "Unable to initialize "
                                + "BOM number sequence."));

        long nextValue = sequence.currentValue + 1L;

        sequence.currentValue = nextValue;

        sequenceRepo.saveAndFlush(
                sequence);

        return String.format(
                Locale.ROOT,
                "BOM-%s-%d-%06d",
                normalizedPlant,
                currentYear,
                nextValue);
    }

    private String normalizePlantCode(
            String plantCode) {

        if (plantCode == null
                || plantCode.isBlank()) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Plant Code is required.");
        }

        String normalized = plantCode.trim()
                .toUpperCase(Locale.ROOT)
                .replaceAll(
                        "[^A-Z0-9]",
                        "");

        if (normalized.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Plant Code does not contain "
                            + "a valid alphanumeric value.");
        }

        if (normalized.length() > 20) {
            normalized = normalized.substring(0, 20);
        }

        return normalized;
    }
}