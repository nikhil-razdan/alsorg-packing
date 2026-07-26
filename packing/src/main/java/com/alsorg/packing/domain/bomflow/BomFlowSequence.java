package com.alsorg.packing.domain.bomflow;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;

@Entity
@Table(
        name = "bom_flow_sequences",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_bom_flow_sequence_plant_year",
                        columnNames = {
                                "plant_code",
                                "sequence_year"
                        })
        })
public class BomFlowSequence {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(
            name = "plant_code",
            nullable = false,
            length = 100)
    public String plantCode;

    @Column(
            name = "sequence_year",
            nullable = false)
    public Integer sequenceYear;

    @Column(
            name = "current_value",
            nullable = false)
    public Long currentValue = 0L;

    @Version
    @Column(
            name = "row_version",
            nullable = false)
    public Long rowVersion;

    @PrePersist
    public void prePersist() {
        if (currentValue == null) {
            currentValue = 0L;
        }
    }
}