package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowIndentLine;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowIndentLineRepository
        extends JpaRepository<MatFlowIndentLine, UUID> {

    List<MatFlowIndentLine> findByIndent_IdOrderByCreatedAtAsc(
            UUID indentId);

    Optional<MatFlowIndentLine> findByIdAndIndent_Id(
            UUID id,
            UUID indentId);
}