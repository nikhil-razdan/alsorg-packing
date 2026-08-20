package com.alsorg.packing.hrflow.domain.value;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

import java.math.BigDecimal;

@Embeddable
public class HrEducation {

    @Column(name = "education_examination", length = 160)
    private String examination;

    @Column(name = "education_board_university", length = 200)
    private String boardOrUniversity;

    @Column(name = "education_year")
    private Integer year;

    @Column(name = "education_marks_percent", precision = 6, scale = 2)
    private BigDecimal marksPercent;

    public HrEducation() {
    }

    public HrEducation(String examination, String boardOrUniversity, Integer year, BigDecimal marksPercent) {
        this.examination = examination;
        this.boardOrUniversity = boardOrUniversity;
        this.year = year;
        this.marksPercent = marksPercent;
    }

    public String getExamination() { return examination; }
    public void setExamination(String examination) { this.examination = examination; }
    public String getBoardOrUniversity() { return boardOrUniversity; }
    public void setBoardOrUniversity(String boardOrUniversity) { this.boardOrUniversity = boardOrUniversity; }
    public Integer getYear() { return year; }
    public void setYear(Integer year) { this.year = year; }
    public BigDecimal getMarksPercent() { return marksPercent; }
    public void setMarksPercent(BigDecimal marksPercent) { this.marksPercent = marksPercent; }
}
