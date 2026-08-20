package com.alsorg.packing.hrflow.domain.value;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class HrLanguage {

    @Column(name = "language_name", length = 100)
    private String language;

    @Column(name = "language_can_read")
    private Boolean canRead;

    @Column(name = "language_can_write")
    private Boolean canWrite;

    @Column(name = "language_can_speak")
    private Boolean canSpeak;

    public HrLanguage() {
    }

    public HrLanguage(String language, Boolean canRead, Boolean canWrite, Boolean canSpeak) {
        this.language = language;
        this.canRead = canRead;
        this.canWrite = canWrite;
        this.canSpeak = canSpeak;
    }

    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }
    public Boolean getCanRead() { return canRead; }
    public void setCanRead(Boolean canRead) { this.canRead = canRead; }
    public Boolean getCanWrite() { return canWrite; }
    public void setCanWrite(Boolean canWrite) { this.canWrite = canWrite; }
    public Boolean getCanSpeak() { return canSpeak; }
    public void setCanSpeak(Boolean canSpeak) { this.canSpeak = canSpeak; }
}
