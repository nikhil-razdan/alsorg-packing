package com.alsorg.packing.hrflow.service;

import com.alsorg.packing.hrflow.domain.HrCandidate;
import com.alsorg.packing.hrflow.domain.HrDocumentType;
import com.alsorg.packing.hrflow.domain.value.HrEducation;
import com.alsorg.packing.hrflow.domain.value.HrEmployment;
import com.alsorg.packing.hrflow.domain.value.HrFamilyMember;
import com.alsorg.packing.hrflow.domain.value.HrLanguage;
import com.alsorg.packing.hrflow.exception.HrFlowException;
import org.apache.pdfbox.io.MemoryUsageSetting;
import org.apache.pdfbox.multipdf.PDFMergerUtility;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.PDPageContentStream.AppendMode;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Period;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Original ALSORG candidate-form renderer.
 *
 * The approved scanned/printed form remains the visual base, but the live HRFlow
 * values are placed with corrected coordinates, larger readable type, controlled
 * wrapping, width-aware font shrinking and proportional photograph placement.
 *
 * This service exists alongside {@link HrCandidatePdfService}; users can download
 * either ORIGINAL or MODERN PDFs without changing any candidate data or workflow.
 */
@Service
public class HrCandidateClassicPdfService {

    private static final String HR_FORM_TEMPLATES = "hrflow/HR_Module_Form_Templates.zip";
    private static final PDFont REGULAR = PDType1Font.HELVETICA;
    private static final PDFont BOLD = PDType1Font.HELVETICA_BOLD;
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd-MM-yyyy");

    private final HrCryptoService cryptoService;
    private final HrDocumentService documentService;

    public HrCandidateClassicPdfService(
            HrCryptoService cryptoService,
            HrDocumentService documentService
    ) {
        this.cryptoService = cryptoService;
        this.documentService = documentService;
    }

    public boolean supports(String formKey) {
        String key = normalizeKey(formKey);
        return key.equals("PERSONAL_DATA")
                || key.equals("EMPLOYMENT_APPLICATION")
                || key.equals("CANDIDATE_PACK");
    }

    public GeneratedPdf blank(String formKey) {
        String key = normalizeSupported(formKey);
        return new GeneratedPdf(blankFileName(key), loadTemplateBytes(key));
    }

    public GeneratedPdf filled(HrCandidate candidate, String formKey) {
        if (candidate == null || candidate.getId() == null) {
            throw HrFlowException.notFound("Candidate was not found.");
        }

        String key = normalizeSupported(formKey);
        Optional<HrDocumentService.DownloadedDocument> photo =
                documentService.latestActiveSystem(candidate.getId(), HrDocumentType.PHOTO);

        try (PDDocument document = loadTemplatePdf(key)) {
            if (key.equals("PERSONAL_DATA")) {
                overlayPersonalData(document, document.getPage(0), candidate, photo.orElse(null));
            } else if (key.equals("EMPLOYMENT_APPLICATION")) {
                requirePages(document, 3, key);
                overlayApplicationPage1(document, document.getPage(0), candidate, photo.orElse(null));
                overlayApplicationPage2(document, document.getPage(1), candidate);
                overlayApplicationPage3(document, document.getPage(2), candidate);
            } else {
                requirePages(document, 4, key);
                overlayPersonalData(document, document.getPage(0), candidate, photo.orElse(null));
                overlayApplicationPage1(document, document.getPage(1), candidate, photo.orElse(null));
                overlayApplicationPage2(document, document.getPage(2), candidate);
                overlayApplicationPage3(document, document.getPage(3), candidate);
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            document.save(out);
            String prefix = safeFilePart(firstNonBlank(
                    candidate.getCandidateNumber(),
                    candidate.getFullName(),
                    "Candidate"
            ));
            return new GeneratedPdf(prefix + "_" + key + "_Original.pdf", out.toByteArray());
        } catch (IOException ex) {
            throw new IllegalStateException("HRFLOW could not generate the original candidate PDF.", ex);
        }
    }

    public GeneratedPdf mergeBlankFullPack(byte[] onboardingPackBytes) {
        if (onboardingPackBytes == null || onboardingPackBytes.length == 0) {
            throw new IllegalStateException("HRFLOW onboarding template pack is empty.");
        }

        GeneratedPdf candidatePack = blank("CANDIDATE_PACK");
        try {
            PDFMergerUtility merger = new PDFMergerUtility();
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            merger.setDestinationStream(out);
            merger.addSource(new ByteArrayInputStream(candidatePack.bytes()));
            merger.addSource(new ByteArrayInputStream(onboardingPackBytes));
            merger.mergeDocuments(MemoryUsageSetting.setupMainMemoryOnly());
            return new GeneratedPdf("HR_Module_Forms_Full_Blank_Original.pdf", out.toByteArray());
        } catch (IOException ex) {
            throw new IllegalStateException("HRFLOW could not build the original blank HR form pack.", ex);
        }
    }

    // ---------------------------------------------------------------------
    // Original Personal Data Form
    // ---------------------------------------------------------------------

    private void overlayPersonalData(
            PDDocument document,
            PDPage page,
            HrCandidate c,
            HrDocumentService.DownloadedDocument photo
    ) throws IOException {
        try (PDPageContentStream cs = append(document, page)) {
            // Main personal details. Values are vertically centered in the source rows.
            textTopFit(cs, page, 252, 124.5f, c.getFullName(), 286, 9.2f, 7.6f, false);
            textTopFit(cs, page, 252, 147.5f, c.getFatherOrHusbandName(), 286, 9.0f, 7.5f, false);
            textTopFit(cs, page, 252, 170.5f, enumText(c.getMaritalStatus()), 286, 9.0f, 7.8f, false);
            textTopFit(cs, page, 252, 193.5f, enumText(c.getGender()), 286, 9.0f, 7.8f, false);
            textTopFit(cs, page, 252, 216.5f, ageAndDob(c.getDateOfBirth()), 286, 8.8f, 7.3f, false);

            wrappedTop(cs, page, 252, 239.5f, c.getWorkExperienceSummary(), 296, 8.2f, 9.4f, 2);
            wrappedTop(cs, page, 252, 263.0f, c.getEducationalQualificationSummary(), 296, 8.2f, 9.4f, 2);

            List<HrEmployment> employments = c.getEmployments();
            HrEmployment first = employments == null || employments.isEmpty() ? null : employments.get(0);
            HrEmployment second = employments == null || employments.size() < 2 ? null : employments.get(1);
            textTopFit(cs, page, 252, 304.5f, first == null ? null : first.getCompanyName(), 296, 8.6f, 7.2f, false);
            textTopFit(cs, page, 252, 326.5f, employerHr(first), 296, 8.2f, 6.9f, false);
            textTopFit(cs, page, 252, 349.5f, second == null ? null : second.getCompanyName(), 296, 8.6f, 7.2f, false);
            textTopFit(cs, page, 252, 371.5f, employerHr(second), 296, 8.2f, 6.9f, false);

            wrappedTop(cs, page, 252, 399.5f,
                    yesNoDetails(c.getPreviousAlsorgExperience(), c.getPreviousAlsorgExperienceDetails()),
                    296, 8.1f, 9.1f, 2);
            wrappedTop(cs, page, 252, 438.5f,
                    yesNoDetails(c.getFamilyMemberWorkedAtAlsorg(), c.getFamilyMemberWorkedAtAlsorgDetails()),
                    296, 8.1f, 9.1f, 2);

            textTopFit(cs, page, 252, 469.0f, c.getPostAppliedFor(), 296, 8.8f, 7.2f, false);
            textTopFit(cs, page, 252, 492.0f, c.getVaccination(), 296, 8.5f, 7.1f, false);
            wrappedTop(cs, page, 252, 516.0f, c.getPresentAddress(), 296, 8.0f, 9.0f, 2);
            wrappedTop(cs, page, 252, 546.0f, c.getPermanentAddress(), 296, 8.0f, 9.0f, 2);
            textTopFit(cs, page, 252, 571.0f, decrypt(c.getAadhaarNo()), 296, 8.6f, 7.2f, false);
            textTopFit(cs, page, 252, 594.0f, c.getMobileNo(), 296, 8.8f, 7.4f, false);
            wrappedTop(cs, page, 252, 616.5f, familySummary(c.getFamilyMembers()), 296, 7.9f, 8.9f, 2);
            textTopFit(cs, page, 252, 641.0f, c.getFamilyContactNo(), 296, 8.5f, 7.1f, false);
            textTopFit(cs, page, 252, 663.0f, c.getReferenceName(), 296, 8.5f, 7.1f, false);

            textTopFit(cs, page, 252, 683.5f, moneyText(c.getSalaryDrawn()), 92, 8.4f, 7.0f, false);
            textTopFit(cs, page, 455, 683.5f, moneyText(c.getSalaryExpected()), 90, 8.4f, 7.0f, false);

            if (c.isDeclarationAccepted()) {
                textTopFit(cs, page, 402, 725.0f,
                        safe(c.getFullName()) + " / e-accepted",
                        150, 7.5f, 6.3f, false);
            }
        }

        // The source form has a large empty photo/reference area in the upper-right.
        drawPhoto(document, page, photo, 405, 103, 130, 96);
    }

    // ---------------------------------------------------------------------
    // Original Employment Application - page 1
    // ---------------------------------------------------------------------

    private void overlayApplicationPage1(
            PDDocument document,
            PDPage page,
            HrCandidate c,
            HrDocumentService.DownloadedDocument photo
    ) throws IOException {
        try (PDPageContentStream cs = append(document, page)) {
            textTopFit(cs, page, 202, 150.5f, c.getPostAppliedFor(), 273, 9.2f, 7.4f, true);

            textTopFit(cs, page, 345, 214.0f, upper(c.getFullName()), 220, 8.8f, 7.0f, false);
            textTopFit(cs, page, 260, 233.0f, ageAndDob(c.getDateOfBirth()), 250, 8.3f, 6.9f, false);
            textTopFit(cs, page, 250, 252.0f, c.getFatherOrHusbandName(), 300, 8.3f, 6.9f, false);
            textTopFit(cs, page, 200, 272.0f, enumText(c.getGender()), 155, 8.3f, 7.0f, false);
            textTopFit(cs, page, 480, 272.0f, enumText(c.getMaritalStatus()), 92, 8.3f, 7.0f, false);

            wrappedTop(cs, page, 300, 292.0f, c.getPresentAddress(), 270, 7.9f, 8.9f, 2);
            wrappedTop(cs, page, 455, 312.0f, c.getPermanentAddress(), 120, 7.2f, 8.1f, 2);

            textTopFit(cs, page, 270, 332.0f, decrypt(c.getAadhaarNo()), 165, 8.0f, 6.8f, false);
            textTopFit(cs, page, 470, 332.0f, decrypt(c.getPanNo()), 105, 8.0f, 6.8f, false);
            textTopFit(cs, page, 245, 352.0f, c.getNationality(), 175, 8.0f, 6.8f, false);
            textTopFit(cs, page, 445, 352.0f, c.getReligion(), 125, 8.0f, 6.8f, false);
            textTopFit(cs, page, 285, 372.0f, decrypt(c.getDrivingLicenseNo()), 280, 7.9f, 6.7f, false);
            textTopFit(cs, page, 280, 392.0f, c.getMobileNo(), 285, 8.3f, 7.0f, false);

            float[] familyY = {463.5f, 482.5f, 501.5f, 520.5f, 539.5f};
            List<HrFamilyMember> family = c.getFamilyMembers();
            for (int i = 0; family != null && i < Math.min(family.size(), familyY.length); i++) {
                HrFamilyMember f = family.get(i);
                textTopFit(cs, page, 113, familyY[i], f.getName(), 132, 7.8f, 6.5f, false);
                textTopFit(cs, page, 260, familyY[i], f.getRelation(), 110, 7.8f, 6.5f, false);
                textTopFit(cs, page, 388, familyY[i], dateText(f.getDateOfBirth()), 105, 7.8f, 6.5f, false);
                textTopFit(cs, page, 515, familyY[i], Boolean.TRUE.equals(f.getDependent()) ? "Y" : "N", 48, 8.2f, 7.0f, true);
            }

            float[] eduY = {666.5f, 685.5f, 704.5f, 723.5f};
            List<HrEducation> educations = c.getEducations();
            for (int i = 0; educations != null && i < Math.min(educations.size(), eduY.length); i++) {
                HrEducation e = educations.get(i);
                textTopFit(cs, page, 111, eduY[i], e.getExamination(), 135, 7.6f, 6.3f, false);
                textTopFit(cs, page, 259, eduY[i], e.getBoardOrUniversity(), 112, 7.6f, 6.3f, false);
                textTopFit(cs, page, 388, eduY[i], e.getYear() == null ? null : String.valueOf(e.getYear()), 100, 7.6f, 6.3f, false);
                textTopFit(cs, page, 515, eduY[i], decimalText(e.getMarksPercent()), 48, 7.6f, 6.3f, false);
            }
        }

        drawPhoto(document, page, photo, 485, 33, 91, 101);
    }

    // ---------------------------------------------------------------------
    // Original Employment Application - page 2
    // ---------------------------------------------------------------------

    private void overlayApplicationPage2(PDDocument document, PDPage page, HrCandidate c) throws IOException {
        try (PDPageContentStream cs = append(document, page)) {
            List<HrEmployment> employments = c.getEmployments();
            HrEmployment first = employments == null || employments.isEmpty() ? null : employments.get(0);
            HrEmployment second = employments == null || employments.size() < 2 ? null : employments.get(1);

            textTopFit(cs, page, 308, 85.0f, first == null ? null : first.getCompanyName(), 265, 8.4f, 6.9f, false);
            textTopFit(cs, page, 308, 112.0f, employerHr(first), 265, 8.0f, 6.6f, false);
            textTopFit(cs, page, 308, 139.0f, second == null ? null : second.getCompanyName(), 265, 8.4f, 6.9f, false);
            textTopFit(cs, page, 308, 166.0f, employerHr(second), 265, 8.0f, 6.6f, false);

            // Move the Yes/No response onto the actual underline rather than below it.
            textTopFit(cs, page, 118, 239.0f,
                    yesNoDetails(c.getPreviousAlsorgExperience(), c.getPreviousAlsorgExperienceDetails()),
                    240, 8.2f, 6.8f, false);

            float[] languageY = {289.0f, 316.0f, 343.0f};
            List<HrLanguage> languages = c.getLanguages();
            for (int i = 0; languages != null && i < Math.min(languages.size(), languageY.length); i++) {
                HrLanguage language = languages.get(i);
                textTopFit(cs, page, 111, languageY[i], language.getLanguage(), 145, 8.0f, 6.6f, false);
                if (Boolean.TRUE.equals(language.getCanRead())) textTop(cs, page, 309, languageY[i], "X", 9.8f, true);
                if (Boolean.TRUE.equals(language.getCanWrite())) textTop(cs, page, 411, languageY[i], "X", 9.8f, true);
                if (Boolean.TRUE.equals(language.getCanSpeak())) textTop(cs, page, 513, languageY[i], "X", 9.8f, true);
            }

            wrappedTop(cs, page, 104, 389.0f, c.getExtracurricularActivities(), 475, 8.0f, 9.2f, 2);
            wrappedTop(cs, page, 104, 444.0f, c.getHobbies(), 475, 8.0f, 9.2f, 2);
            wrappedTop(cs, page, 104, 499.0f, c.getAwardsAppreciations(), 475, 7.9f, 9.1f, 2);

            textTopFit(cs, page, 197, 531.0f, moneyText(c.getSalaryDrawn()), 120, 8.3f, 6.8f, false);
            textTopFit(cs, page, 479, 531.0f, moneyText(c.getSalaryExpected()), 95, 8.3f, 6.8f, false);
            // Corrected upward so the approved salary sits on the source line.
            textTopFit(cs, page, 213, 546.0f, moneyText(c.getSalaryApproved()), 145, 8.3f, 6.8f, false);

            wrappedTop(cs, page, 96, 684.0f, c.getOrganizationChartNote(), 475, 7.9f, 9.0f, 4);
        }
    }

    // ---------------------------------------------------------------------
    // Original Employment Application - page 3
    // ---------------------------------------------------------------------

    private void overlayApplicationPage3(PDDocument document, PDPage page, HrCandidate c) throws IOException {
        try (PDPageContentStream cs = append(document, page)) {
            if (c.isDeclarationAccepted()) {
                textTopFit(cs, page, 112, 171.0f, dateTimeDate(c.getDeclarationAcceptedAt()), 150, 8.2f, 6.9f, false);
                textTopFit(cs, page, 405, 171.0f,
                        safe(c.getFullName()) + " / e-accepted",
                        165, 7.8f, 6.5f, false);
            }

            // The source page prints the word "Date" inside the first office-use
            // value cell. Starting farther right prevents the generated date from
            // colliding with that printed label.
            textTopFit(cs, page, 340, 257.0f, dateTimeDate(c.getUpdatedAt()), 220, 8.2f, 6.8f, false);
            textTopFit(cs, page, 273, 286.0f, dateText(c.getProposedJoiningDate()), 285, 8.3f, 6.9f, false);
            textTopFit(cs, page, 273, 311.0f, c.getDepartment(), 285, 8.3f, 6.9f, false);
            textTopFit(cs, page, 273, 337.0f, firstNonBlank(c.getDesignation(), c.getPostAppliedFor()), 285, 8.3f, 6.9f, false);
            textTopFit(cs, page, 273, 364.0f, c.getAppointedBy(), 285, 8.3f, 6.9f, false);
        }
    }

    // ---------------------------------------------------------------------
    // Template / PDF helpers
    // ---------------------------------------------------------------------

    private PDDocument loadTemplatePdf(String key) throws IOException {
        byte[] bytes = loadTemplateBytes(key);
        PDDocument document = PDDocument.load(bytes);
        int expected = switch (key) {
            case "PERSONAL_DATA" -> 1;
            case "EMPLOYMENT_APPLICATION" -> 3;
            case "CANDIDATE_PACK" -> 4;
            default -> 1;
        };
        requirePages(document, expected, key);
        return document;
    }

    private byte[] loadTemplateBytes(String key) {
        String entryName = key + ".pdf";
        ClassPathResource resource = new ClassPathResource(HR_FORM_TEMPLATES);
        if (!resource.exists()) {
            throw new IllegalStateException(
                    "Missing HRFLOW PDF template resource: src/main/resources/" + HR_FORM_TEMPLATES
            );
        }

        try (InputStream raw = resource.getInputStream();
             ZipInputStream zip = new ZipInputStream(raw)) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                if (!entry.isDirectory() && entryName.equals(entry.getName())) {
                    byte[] bytes = zip.readAllBytes();
                    if (!isPdf(bytes)) {
                        throw new IllegalStateException("HRFLOW template entry is not a valid PDF: " + entryName);
                    }
                    return bytes;
                }
                zip.closeEntry();
            }
        } catch (IOException ex) {
            throw new IllegalStateException(
                    "HRFLOW could not read PDF template " + entryName + " from " + HR_FORM_TEMPLATES + ".",
                    ex
            );
        }

        throw new IllegalStateException(
                "HRFLOW PDF template entry is missing from " + HR_FORM_TEMPLATES + ": " + entryName
        );
    }

    private boolean isPdf(byte[] bytes) {
        return bytes != null
                && bytes.length >= 5
                && bytes[0] == '%'
                && bytes[1] == 'P'
                && bytes[2] == 'D'
                && bytes[3] == 'F'
                && bytes[4] == '-';
    }

    private void requirePages(PDDocument document, int expected, String key) throws IOException {
        if (document.getNumberOfPages() < expected) {
            int actual = document.getNumberOfPages();
            document.close();
            throw new IllegalStateException(
                    "HRFLOW " + key + " template must contain at least " + expected + " page(s), but contains " + actual + "."
            );
        }
    }

    private PDPageContentStream append(PDDocument document, PDPage page) throws IOException {
        return new PDPageContentStream(document, page, AppendMode.APPEND, true, true);
    }

    private void textTop(
            PDPageContentStream cs,
            PDPage page,
            float x,
            float top,
            String value,
            float fontSize,
            boolean bold
    ) throws IOException {
        String text = pdfSafe(value);
        if (text == null) return;
        cs.beginText();
        cs.setFont(bold ? BOLD : REGULAR, fontSize);
        cs.newLineAtOffset(x, page.getMediaBox().getHeight() - top - fontSize);
        cs.showText(text);
        cs.endText();
    }

    private void textTopFit(
            PDPageContentStream cs,
            PDPage page,
            float x,
            float top,
            String value,
            float maxWidth,
            float preferredSize,
            float minimumSize,
            boolean bold
    ) throws IOException {
        String text = pdfSafe(value);
        if (text == null) return;
        PDFont font = bold ? BOLD : REGULAR;
        float size = preferredSize;
        while (size > minimumSize && width(font, size, text) > maxWidth) {
            size -= 0.25f;
        }
        String fitted = text;
        if (width(font, size, fitted) > maxWidth) {
            fitted = ellipsize(font, size, fitted, maxWidth);
        }
        textTop(cs, page, x, top, fitted, size, bold);
    }

    private void wrappedTop(
            PDPageContentStream cs,
            PDPage page,
            float x,
            float top,
            String value,
            float maxWidth,
            float fontSize,
            float leading,
            int maxLines
    ) throws IOException {
        String text = pdfSafe(value);
        if (text == null) return;
        List<String> lines = wrap(text, REGULAR, fontSize, maxWidth, maxLines);
        for (int i = 0; i < lines.size(); i++) {
            textTop(cs, page, x, top + (i * leading), lines.get(i), fontSize, false);
        }
    }

    private List<String> wrap(
            String text,
            PDFont font,
            float fontSize,
            float maxWidth,
            int maxLines
    ) throws IOException {
        List<String> result = new ArrayList<>();
        StringBuilder line = new StringBuilder();
        String[] words = text.split("\\s+");
        int index = 0;

        while (index < words.length && result.size() < maxLines) {
            String word = words[index];
            String candidate = line.length() == 0 ? word : line + " " + word;
            if (width(font, fontSize, candidate) <= maxWidth || line.length() == 0) {
                line.setLength(0);
                line.append(candidate);
                index++;
            } else {
                result.add(line.toString());
                line.setLength(0);
            }
        }

        if (line.length() > 0 && result.size() < maxLines) {
            result.add(line.toString());
        }

        if (index < words.length && !result.isEmpty()) {
            int last = result.size() - 1;
            result.set(last, ellipsize(font, fontSize, result.get(last) + " ...", maxWidth));
        }
        return result;
    }

    private float width(PDFont font, float fontSize, String text) throws IOException {
        return font.getStringWidth(text) / 1000f * fontSize;
    }

    private String ellipsize(PDFont font, float fontSize, String value, float maxWidth) throws IOException {
        String text = value == null ? "" : value.trim();
        if (width(font, fontSize, text) <= maxWidth) return text;
        String suffix = "...";
        while (!text.isEmpty() && width(font, fontSize, text + suffix) > maxWidth) {
            text = text.substring(0, text.length() - 1).trim();
        }
        return text + suffix;
    }

    private void drawPhoto(
            PDDocument document,
            PDPage page,
            HrDocumentService.DownloadedDocument photo,
            float x,
            float top,
            float boxWidth,
            float boxHeight
    ) {
        if (photo == null || photo.bytes() == null || photo.bytes().length == 0) return;
        String contentType = safe(photo.contentType()).toLowerCase(Locale.ROOT);
        if (!contentType.startsWith("image/")) return;

        try {
            PDImageXObject image = PDImageXObject.createFromByteArray(document, photo.bytes(), photo.fileName());
            float scale = Math.min(boxWidth / image.getWidth(), boxHeight / image.getHeight());
            float width = image.getWidth() * scale;
            float height = image.getHeight() * scale;
            float y = page.getMediaBox().getHeight() - top - height;
            float drawX = x + (boxWidth - width) / 2f;
            float drawY = y - (boxHeight - height) / 2f;
            try (PDPageContentStream cs = append(document, page)) {
                cs.drawImage(image, drawX, drawY, width, height);
            }
        } catch (Exception ignored) {
            // A bad/non-image upload must not make the official PDF unavailable.
        }
    }

    // ---------------------------------------------------------------------
    // Data formatting
    // ---------------------------------------------------------------------

    private String normalizeSupported(String value) {
        String key = normalizeKey(value);
        if (!supports(key)) {
            throw HrFlowException.badRequest(
                    "Original candidate PDF supports PERSONAL_DATA, EMPLOYMENT_APPLICATION or CANDIDATE_PACK."
            );
        }
        return key;
    }

    private String normalizeKey(String value) {
        String key = value == null ? "" : value.trim().toUpperCase(Locale.ROOT)
                .replace('-', '_')
                .replace(' ', '_');
        return switch (key) {
            case "PERSONAL", "PERSONAL_DATA_FORM" -> "PERSONAL_DATA";
            case "APPLICATION", "EMPLOYMENT", "EMPLOYMENT_APPLICATION_FORM" -> "EMPLOYMENT_APPLICATION";
            case "CANDIDATE", "CANDIDATE_FORMS" -> "CANDIDATE_PACK";
            default -> key;
        };
    }

    private String blankFileName(String key) {
        return switch (key) {
            case "PERSONAL_DATA" -> "HR_Personal_Data_Form_Blank_Original.pdf";
            case "EMPLOYMENT_APPLICATION" -> "HR_Employment_Application_Blank_Original.pdf";
            default -> "HR_Candidate_Form_Pack_Blank_Original.pdf";
        };
    }

    private String decrypt(String stored) {
        return stored == null ? null : cryptoService.decryptNullable(stored);
    }

    private String ageAndDob(LocalDate dob) {
        if (dob == null) return null;
        int years = Math.max(0, Period.between(dob, LocalDate.now()).getYears());
        return years + " / " + dateText(dob);
    }

    private String dateText(LocalDate value) {
        return value == null ? null : DATE.format(value);
    }

    private String dateTimeDate(LocalDateTime value) {
        return value == null ? null : DATE.format(value.toLocalDate());
    }

    private String enumText(Object value) {
        return value == null ? null : String.valueOf(value).replace('_', ' ');
    }

    private String upper(String value) {
        String v = clean(value);
        return v == null ? null : v.toUpperCase(Locale.ROOT);
    }

    private String yesNoDetails(Boolean value, String details) {
        String extra = clean(details);
        if (value == null) return extra;
        String prefix = value ? "Yes" : "No";
        return extra == null ? prefix : prefix + " - " + extra;
    }

    private String employerHr(HrEmployment employment) {
        if (employment == null) return null;
        String name = clean(employment.getHrName());
        String contact = clean(employment.getHrContact());
        if (name == null) return contact;
        if (contact == null) return name;
        return name + " / " + contact;
    }

    private String familySummary(List<HrFamilyMember> family) {
        if (family == null || family.isEmpty()) return null;
        List<String> parts = new ArrayList<>();
        for (HrFamilyMember member : family) {
            if (member == null) continue;
            String name = clean(member.getName());
            String relation = clean(member.getRelation());
            if (name == null && relation == null) continue;
            parts.add(firstNonBlank(name, "-") + (relation == null ? "" : " (" + relation + ")"));
            if (parts.size() >= 3) break;
        }
        return parts.isEmpty() ? null : String.join(", ", parts);
    }

    private String moneyText(BigDecimal value) {
        if (value == null) return null;
        return value.stripTrailingZeros().toPlainString();
    }

    private String decimalText(BigDecimal value) {
        return value == null ? null : value.stripTrailingZeros().toPlainString();
    }

    private String pdfSafe(String value) {
        String v = clean(value);
        if (v == null) return null;
        v = v.replace('\u2018', '\'').replace('\u2019', '\'')
                .replace('\u201c', '"').replace('\u201d', '"')
                .replace('\u2013', '-').replace('\u2014', '-')
                .replace('\u00a0', ' ');
        StringBuilder out = new StringBuilder(v.length());
        for (char ch : v.toCharArray()) {
            out.append(ch >= 32 && ch <= 126 ? ch : '?');
        }
        return out.toString();
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String clean(String value) {
        if (value == null) return null;
        String v = value.trim();
        return v.isEmpty() ? null : v;
    }

    private String firstNonBlank(String... values) {
        if (values == null) return null;
        for (String value : values) {
            String clean = clean(value);
            if (clean != null) return clean;
        }
        return null;
    }

    private String safeFilePart(String value) {
        String v = safe(value).replaceAll("[^A-Za-z0-9._-]+", "_");
        return v.isBlank() ? "Candidate" : v;
    }

    public record GeneratedPdf(String fileName, byte[] bytes) {}
}
