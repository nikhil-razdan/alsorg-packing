package com.alsorg.packing.domain.matflow;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "mat_flow_requisition_sequence")
public class MatFlowRequisitionSequence {

    @Id
    @Column(name = "sequence_year")
    public Integer year;

    @Column(
            name = "current_value",
            nullable = false
    )
    public Long currentValue = 0L;

    @Version
    @Column(
            name = "row_version",
            nullable = false
    )
    public Long rowVersion;

    @PrePersist
    public void prePersist() {
        if (currentValue == null) {
            currentValue = 0L;
        }
    }
}