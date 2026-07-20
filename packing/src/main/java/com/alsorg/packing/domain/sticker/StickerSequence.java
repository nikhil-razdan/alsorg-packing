package com.alsorg.packing.domain.sticker;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "sticker_sequence")
public class StickerSequence {

    /*
     * This table intentionally uses one fixed row:
     * id = 1
     *
     * Do not add @GeneratedValue.
     */
    @Id
    @Column(name = "id", nullable = false)
    private Integer id = 1;

    /*
     * The year to which currentValue belongs.
     *
     * Example:
     * sequenceYear = 2026
     * currentValue = 10147
     */
    @Column(name = "sequence_year", nullable = false)
    private Integer sequenceYear;

    /*
     * Long keeps the sequence safe beyond six digits.
     */
    @Column(name = "current_value", nullable = false)
    private Long currentValue = 0L;

    public Integer getId() {
        return id;
    }

    public void setId(
            Integer id) {
        this.id = id;
    }

    public Integer getSequenceYear() {
        return sequenceYear;
    }

    public void setSequenceYear(
            Integer sequenceYear) {
        this.sequenceYear = sequenceYear;
    }

    public Long getCurrentValue() {
        return currentValue;
    }

    public void setCurrentValue(
            Long currentValue) {
        this.currentValue = currentValue;
    }
}