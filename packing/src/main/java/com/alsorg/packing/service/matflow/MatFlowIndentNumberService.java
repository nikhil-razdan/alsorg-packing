package com.alsorg.packing.service.matflow;

import com.alsorg.packing.domain.matflow.MatFlowIndentSequence;
import com.alsorg.packing.repository.matflow.MatFlowIndentSequenceRepository;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Year;
import java.util.Locale;

@Service
public class MatFlowIndentNumberService {

    private final MatFlowIndentSequenceRepository sequenceRepo;

    public MatFlowIndentNumberService(
            MatFlowIndentSequenceRepository sequenceRepo) {

        this.sequenceRepo = sequenceRepo;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public String nextIndentNo() {

        Integer year = Year.now().getValue();

        sequenceRepo.ensureYearExists(year);

        MatFlowIndentSequence sequence =
                sequenceRepo.findByYearForUpdate(year)
                        .orElseThrow(() ->
                                new ResponseStatusException(
                                        HttpStatus.INTERNAL_SERVER_ERROR,
                                        "Unable to initialize MatFlow "
                                                + "indent number sequence."
                                )
                        );

        long nextValue =
                sequence.currentValue == null
                        ? 1L
                        : sequence.currentValue + 1L;

        sequence.currentValue = nextValue;

        sequenceRepo.saveAndFlush(sequence);

        return String.format(
                Locale.ROOT,
                "MIND-%d-%06d",
                year,
                nextValue
        );
    }
}