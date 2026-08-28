package com.alsorg.packing.domain.sticker;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "sticker_sequence")
public class StickerSequence {

    @Id
    @Column(name = "id", nullable = false)
    private Integer id = 1;

    @Column(name = "sequence_year", nullable = false)
    private Integer sequenceYear;

    @Column(name = "current_value", nullable = false)
    private Long currentValue = 0L;

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }
    public Integer getSequenceYear() { return sequenceYear; }
    public void setSequenceYear(Integer sequenceYear) { this.sequenceYear = sequenceYear; }
    public Long getCurrentValue() { return currentValue; }
    public void setCurrentValue(Long currentValue) { this.currentValue = currentValue; }
}
