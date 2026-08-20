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
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Period;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Vector PDF renderer for HRFlow candidate forms.
 *
 * This intentionally does NOT stamp tiny text over the legacy scanned forms.
 * The form is re-typeset as a clean A4 document while preserving the same HR
 * fields and the same Personal Data + Employment Application structure.
 *
 * Only candidate PDFs use this renderer. Onboarding forms continue to use the
 * approved HR master templates through HrCandidateService/HrOnboardingService.
 */
@Service
public class HrCandidatePdfService {

    private static final PDRectangle A4 = PDRectangle.A4;
    private static final PDFont REGULAR = PDType1Font.HELVETICA;
    private static final PDFont BOLD = PDType1Font.HELVETICA_BOLD;
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd-MM-yyyy");
    private static final DecimalFormat MONEY = new DecimalFormat("#,##0.##");

    private static final float MARGIN = 36f;
    private static final float CONTENT_W = A4.getWidth() - (MARGIN * 2f);

    // Print-safe neutral/blue palette.
    private static final int[] NAVY = {27, 45, 70};
    private static final int[] BLUE = {39, 101, 181};
    private static final int[] BLUE_SOFT = {236, 243, 252};
    private static final int[] INK = {30, 41, 59};
    private static final int[] MUTED = {96, 110, 128};
    private static final int[] BORDER = {205, 215, 226};
    private static final int[] SURFACE = {248, 250, 252};
    private static final int[] WHITE = {255, 255, 255};
    private static final int[] SUCCESS_SOFT = {237, 248, 241};
    private static final int[] SUCCESS = {32, 126, 79};

    private final HrCryptoService cryptoService;
    private final HrDocumentService documentService;

    public HrCandidatePdfService(
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
        return generate(null, normalizeSupported(formKey), true);
    }

    public GeneratedPdf filled(HrCandidate candidate, String formKey) {
        if (candidate == null || candidate.getId() == null) {
            throw HrFlowException.notFound("Candidate was not found.");
        }
        return generate(candidate, normalizeSupported(formKey), false);
    }

    /**
     * Used by the HR Forms screen to build one full blank pack without falling
     * back to the old scanned candidate pages. The onboarding/legal PDF bytes
     * remain unchanged and are simply appended after the redesigned candidate
     * pack.
     */
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
            return new GeneratedPdf("HR_Module_Forms_Full_Blank_Modern.pdf", out.toByteArray());
        } catch (IOException ex) {
            throw new IllegalStateException("HRFLOW could not build the full blank HR form pack.", ex);
        }
    }

    private GeneratedPdf generate(HrCandidate candidate, String key, boolean blank) {
        Optional<HrDocumentService.DownloadedDocument> photo = Optional.empty();
        if (!blank && candidate != null) {
            photo = documentService.latestActiveSystem(candidate.getId(), HrDocumentType.PHOTO);
        }

        try (PDDocument document = new PDDocument()) {
            if (key.equals("PERSONAL_DATA")) {
                addPersonalDataPage(document, candidate, photo.orElse(null), blank, 1, 1);
            } else if (key.equals("EMPLOYMENT_APPLICATION")) {
                addApplicationPersonalPage(document, candidate, photo.orElse(null), blank, 1, 3);
                addApplicationExperiencePage(document, candidate, blank, 2, 3);
                addApplicationDeclarationPage(document, candidate, blank, 3, 3);
            } else {
                addPersonalDataPage(document, candidate, photo.orElse(null), blank, 1, 4);
                addApplicationPersonalPage(document, candidate, photo.orElse(null), blank, 2, 4);
                addApplicationExperiencePage(document, candidate, blank, 3, 4);
                addApplicationDeclarationPage(document, candidate, blank, 4, 4);
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            document.save(out);

            String prefix = blank
                    ? "HR"
                    : safeFilePart(firstNonBlank(candidate.getCandidateNumber(), candidate.getFullName(), "Candidate"));
            String fileName = switch (key) {
                case "PERSONAL_DATA" -> prefix + "_Personal_Data_Form_Modern.pdf";
                case "EMPLOYMENT_APPLICATION" -> prefix + "_Employment_Application_Modern.pdf";
                default -> prefix + "_CANDIDATE_PACK_Modern.pdf";
            };
            return new GeneratedPdf(fileName, out.toByteArray());
        } catch (IOException ex) {
            throw new IllegalStateException("HRFLOW could not generate the redesigned candidate PDF.", ex);
        }
    }

    // ---------------------------------------------------------------------
    // Page 1 - Personal Data Form
    // ---------------------------------------------------------------------

    private void addPersonalDataPage(
            PDDocument document,
            HrCandidate c,
            HrDocumentService.DownloadedDocument photo,
            boolean blank,
            int pageNo,
            int totalPages
    ) throws IOException {
        PDPage page = new PDPage(A4);
        document.addPage(page);

        try (PDPageContentStream cs = new PDPageContentStream(document, page)) {
            drawPageChrome(cs, page, "PERSONAL DATA FORM",
                    "Candidate profile and recruitment particulars",
                    c, blank, pageNo, totalPages);
            drawPhotoBox(document, cs, page, photo, 462, 32, 97, 92, blank);

            section(cs, page, 128, "01  PERSONAL DETAILS", "Core information used across the HR lifecycle.");
            field(cs, page, 36, 153, 338, 47, "Full name", value(c, c == null ? null : c.getFullName()), true);
            field(cs, page, 380, 153, 179, 47, "Post applied for", value(c, c == null ? null : c.getPostAppliedFor()), true);

            field(cs, page, 36, 206, 338, 47, "Father's / Husband's name", value(c, c == null ? null : c.getFatherOrHusbandName()), false);
            field(cs, page, 380, 206, 179, 47, "Age / Date of birth", value(c, c == null ? null : ageAndDob(c.getDateOfBirth())), false);

            field(cs, page, 36, 259, 165, 47, "Gender", value(c, c == null ? null : enumText(c.getGender())), false);
            field(cs, page, 207, 259, 165, 47, "Marital status", value(c, c == null ? null : enumText(c.getMaritalStatus())), false);
            field(cs, page, 378, 259, 181, 47, "Mobile number", value(c, c == null ? null : c.getMobileNo()), false);

            field(cs, page, 36, 312, 338, 47, "Email", value(c, c == null ? null : c.getEmail()), false);
            field(cs, page, 380, 312, 179, 47, "Vaccination status", value(c, c == null ? null : c.getVaccination()), false);

            section(cs, page, 373, "02  ADDRESS & IDENTITY", "Contact, address and identity information.");
            field(cs, page, 36, 398, 256, 61, "Present address", value(c, c == null ? null : c.getPresentAddress()), false);
            field(cs, page, 298, 398, 261, 61, "Permanent address", value(c, c == null ? null : c.getPermanentAddress()), false);

            field(cs, page, 36, 465, 165, 47, "Aadhaar number", sensitive(c, c == null ? null : c.getAadhaarNo()), false);
            field(cs, page, 207, 465, 165, 47, "Family contact number", value(c, c == null ? null : c.getFamilyContactNo()), false);
            field(cs, page, 378, 465, 181, 47, "Reference name", value(c, c == null ? null : c.getReferenceName()), false);

            section(cs, page, 526, "03  EXPERIENCE & EDUCATION", "Summary information and Alsorg history.");
            field(cs, page, 36, 551, 256, 62, "Work experience", value(c, c == null ? null : c.getWorkExperienceSummary()), false);
            field(cs, page, 298, 551, 261, 62, "Educational qualification", value(c, c == null ? null : c.getEducationalQualificationSummary()), false);

            field(cs, page, 36, 619, 256, 55, "Past experience in Alsorg",
                    value(c, c == null ? null : yesNoDetails(c.getPreviousAlsorgExperience(), c.getPreviousAlsorgExperienceDetails())), false);
            field(cs, page, 298, 619, 261, 55, "Family / blood relation at Alsorg",
                    value(c, c == null ? null : yesNoDetails(c.getFamilyMemberWorkedAtAlsorg(), c.getFamilyMemberWorkedAtAlsorgDetails())), false);

            field(cs, page, 36, 680, 165, 47, "Salary drawn", value(c, c == null ? null : moneyText(c.getSalaryDrawn())), false);
            field(cs, page, 207, 680, 165, 47, "Salary expected", value(c, c == null ? null : moneyText(c.getSalaryExpected())), false);
            field(cs, page, 378, 680, 181, 47, "Family details", value(c, c == null ? null : familySummary(c.getFamilyMembers())), false);

            signatureBand(cs, page, 741, c, blank);
            footer(cs, page, c, blank, pageNo, totalPages);
        }
    }

    // ---------------------------------------------------------------------
    // Employment Application - page 1
    // ---------------------------------------------------------------------

    private void addApplicationPersonalPage(
            PDDocument document,
            HrCandidate c,
            HrDocumentService.DownloadedDocument photo,
            boolean blank,
            int pageNo,
            int totalPages
    ) throws IOException {
        PDPage page = new PDPage(A4);
        document.addPage(page);

        try (PDPageContentStream cs = new PDPageContentStream(document, page)) {
            drawPageChrome(cs, page, "EMPLOYMENT APPLICATION",
                    "Personal, identity, family and education details",
                    c, blank, pageNo, totalPages);
            drawPhotoBox(document, cs, page, photo, 462, 32, 97, 92, blank);

            section(cs, page, 128, "01  APPLICANT DETAILS", "For managerial / administrative and other applicable posts.");
            field(cs, page, 36, 153, 338, 47, "Name of applicant", value(c, c == null ? null : upper(c.getFullName())), true);
            field(cs, page, 380, 153, 179, 47, "Post applied for", value(c, c == null ? null : c.getPostAppliedFor()), true);

            field(cs, page, 36, 206, 338, 47, "Father's / Husband's name", value(c, c == null ? null : c.getFatherOrHusbandName()), false);
            field(cs, page, 380, 206, 179, 47, "Age / Date of birth", value(c, c == null ? null : ageAndDob(c.getDateOfBirth())), false);

            field(cs, page, 36, 259, 165, 47, "Gender", value(c, c == null ? null : enumText(c.getGender())), false);
            field(cs, page, 207, 259, 165, 47, "Marital status", value(c, c == null ? null : enumText(c.getMaritalStatus())), false);
            field(cs, page, 378, 259, 181, 47, "Mobile / phone", value(c, c == null ? null : c.getMobileNo()), false);

            field(cs, page, 36, 312, 256, 57, "Present address", value(c, c == null ? null : c.getPresentAddress()), false);
            field(cs, page, 298, 312, 261, 57, "Permanent address (as per Aadhaar)", value(c, c == null ? null : c.getPermanentAddress()), false);

            field(cs, page, 36, 375, 165, 47, "Aadhaar card no.", sensitive(c, c == null ? null : c.getAadhaarNo()), false);
            field(cs, page, 207, 375, 165, 47, "PAN card no.", sensitive(c, c == null ? null : c.getPanNo()), false);
            field(cs, page, 378, 375, 181, 47, "Driving licence no.", sensitive(c, c == null ? null : c.getDrivingLicenseNo()), false);

            field(cs, page, 36, 428, 165, 47, "Nationality", value(c, c == null ? null : c.getNationality()), false);
            field(cs, page, 207, 428, 165, 47, "Religion", value(c, c == null ? null : c.getReligion()), false);
            field(cs, page, 378, 428, 181, 47, "Email", value(c, c == null ? null : c.getEmail()), false);

            section(cs, page, 489, "02  FAMILY DETAILS", "Includes spouse, children and dependants, if any.");
            drawFamilyTable(cs, page, 36, 514, c, blank);

            section(cs, page, 645, "03  EDUCATIONAL QUALIFICATIONS", "Most relevant qualifications first.");
            drawEducationTable(cs, page, 36, 670, c, blank);

            footer(cs, page, c, blank, pageNo, totalPages);
        }
    }

    // ---------------------------------------------------------------------
    // Employment Application - page 2
    // ---------------------------------------------------------------------

    private void addApplicationExperiencePage(PDDocument document, HrCandidate c, boolean blank, int pageNo, int totalPages) throws IOException {
        PDPage page = new PDPage(A4);
        document.addPage(page);

        try (PDPageContentStream cs = new PDPageContentStream(document, page)) {
            drawPageChrome(cs, page, "EMPLOYMENT APPLICATION",
                    "Employment history, skills and additional information",
                    c, blank, pageNo, totalPages);

            section(cs, page, 116, "04  LAST TWO COMPANY DETAILS", "Previous employment and verification contacts.");
            drawEmploymentTable(cs, page, 36, 141, c, blank);

            section(cs, page, 286, "05  ALSORG HISTORY", "Prior employment or family relationship with Alsorg.");
            field(cs, page, 36, 311, 256, 53, "Past experience in Alsorg",
                    value(c, c == null ? null : yesNoDetails(c.getPreviousAlsorgExperience(), c.getPreviousAlsorgExperienceDetails())), false);
            field(cs, page, 298, 311, 261, 53, "Family / blood relation at Alsorg",
                    value(c, c == null ? null : yesNoDetails(c.getFamilyMemberWorkedAtAlsorg(), c.getFamilyMemberWorkedAtAlsorgDetails())), false);

            section(cs, page, 379, "06  LANGUAGES KNOWN", "Reading, writing and speaking proficiency.");
            drawLanguageTable(cs, page, 36, 404, c, blank);

            section(cs, page, 544, "07  ADDITIONAL INFORMATION", "Activities, interests and recognitions.");
            field(cs, page, 36, 569, 256, 52, "Extracurricular activities", value(c, c == null ? null : c.getExtracurricularActivities()), false);
            field(cs, page, 298, 569, 261, 52, "Hobbies", value(c, c == null ? null : c.getHobbies()), false);
            field(cs, page, 36, 627, 523, 52, "Awards / appreciations for good work", value(c, c == null ? null : c.getAwardsAppreciations()), false);

            field(cs, page, 36, 685, 165, 47, "Salary drawn", value(c, c == null ? null : moneyText(c.getSalaryDrawn())), false);
            field(cs, page, 207, 685, 165, 47, "Salary expected", value(c, c == null ? null : moneyText(c.getSalaryExpected())), false);
            field(cs, page, 378, 685, 181, 47, "Salary approval (HR)", value(c, c == null ? null : moneyText(c.getSalaryApproved())), false);

            field(cs, page, 36, 738, 523, 63, "Organization chart / position in previous company",
                    value(c, c == null ? null : c.getOrganizationChartNote()), false);

            footer(cs, page, c, blank, pageNo, totalPages);
        }
    }

    // ---------------------------------------------------------------------
    // Employment Application - page 3
    // ---------------------------------------------------------------------

    private void addApplicationDeclarationPage(PDDocument document, HrCandidate c, boolean blank, int pageNo, int totalPages) throws IOException {
        PDPage page = new PDPage(A4);
        document.addPage(page);

        try (PDPageContentStream cs = new PDPageContentStream(document, page)) {
            drawPageChrome(cs, page, "EMPLOYMENT APPLICATION",
                    "Declaration and HR office use",
                    c, blank, pageNo, totalPages);

            section(cs, page, 126, "08  APPLICANT DECLARATION", "Electronic acceptance is recorded by HRFlow.");
            panel(cs, page, 36, 152, 523, 132, WHITE, BORDER);
            wrappedText(cs, page,
                    "I hereby affirm that to the best of my knowledge and belief, the information given above is true. " +
                            "In case any information is proved to be wrong or suppressed, I shall be liable to be terminated from service.",
                    52, 177, 491, 11.0f, 15f, 6, INK, false);

            String declarationState = c != null && c.isDeclarationAccepted() ? "ACCEPTED" : (blank ? "" : "PENDING");
            int[] stateBg = c != null && c.isDeclarationAccepted() ? SUCCESS_SOFT : SURFACE;
            int[] stateColor = c != null && c.isDeclarationAccepted() ? SUCCESS : MUTED;
            badge(cs, page, 52, 244, 92, 23, declarationState, stateBg, stateColor);

            field(cs, page, 36, 299, 165, 55, "Date", value(c, c == null ? null : dateTimeDate(c.getDeclarationAcceptedAt())), false);
            field(cs, page, 207, 299, 352, 55, "Signature of applicant",
                    value(c, c == null || !c.isDeclarationAccepted() ? null : safe(c.getFullName()) + " / e-accepted"), true);

            section(cs, page, 374, "09  FOR OFFICE USE", "HR-controlled recruitment and joining particulars.");
            field(cs, page, 36, 399, 256, 50, "Record updated on", value(c, c == null ? null : dateTimeDate(c.getUpdatedAt())), false);
            field(cs, page, 298, 399, 261, 50, "Proposed date of joining", value(c, c == null ? null : dateText(c.getProposedJoiningDate())), false);

            field(cs, page, 36, 455, 256, 50, "Department", value(c, c == null ? null : c.getDepartment()), false);
            field(cs, page, 298, 455, 261, 50, "Designation", value(c, c == null ? null : firstNonBlank(c.getDesignation(), c.getPostAppliedFor())), false);

            field(cs, page, 36, 511, 256, 50, "Appointed by", value(c, c == null ? null : c.getAppointedBy()), false);
            field(cs, page, 298, 511, 261, 50, "HR owner", value(c, c == null ? null : c.getHrOwner()), false);

            field(cs, page, 36, 567, 256, 50, "Salary approval", value(c, c == null ? null : moneyText(c.getSalaryApproved())), false);
            field(cs, page, 298, 567, 261, 50, "Recruitment stage", value(c, c == null ? null : enumText(c.getStage())), false);

            section(cs, page, 635, "10  APPROVALS", "Signatures / approval marks may be completed by authorised HR personnel.");
            signatureBox(cs, page, 36, 660, 256, 66, "Manager / Supervisor Sign");
            signatureBox(cs, page, 298, 660, 261, 66, "HRD Head Sign");

            panel(cs, page, 36, 744, 523, 51, BLUE_SOFT, BORDER);
            text(cs, page, "HRFlow generated record", 50, 761, 9.0f, BLUE, true);
            wrappedText(cs, page,
                    "Candidate-entered data is reproduced from the HRFlow record. HR-controlled fields remain authoritative in the application.",
                    50, 776, 495, 7.8f, 10f, 2, MUTED, false);

            footer(cs, page, c, blank, pageNo, totalPages);
        }
    }

    // ---------------------------------------------------------------------
    // Tables
    // ---------------------------------------------------------------------

    private void drawFamilyTable(PDPageContentStream cs, PDPage page, float x, float top, HrCandidate c, boolean blank) throws IOException {
        float[] widths = {163, 127, 125, 108};
        String[] headers = {"Name", "Relation", "Date of birth", "Dependent"};
        tableHeader(cs, page, x, top, widths, headers, 22);

        List<HrFamilyMember> rows = c == null || c.getFamilyMembers() == null ? List.of() : c.getFamilyMembers();
        for (int i = 0; i < 4; i++) {
            HrFamilyMember row = i < rows.size() ? rows.get(i) : null;
            String[] values = row == null
                    ? new String[] {"", "", "", ""}
                    : new String[] {
                    safe(row.getName()), safe(row.getRelation()), dateText(row.getDateOfBirth()),
                    Boolean.TRUE.equals(row.getDependent()) ? "Yes" : "No"
            };
            tableRow(cs, page, x, top + 22 + (i * 27), widths, values, 27, 8.0f);
        }
        if (!blank && rows.size() > 4) {
            text(cs, page, "+" + (rows.size() - 4) + " additional family record(s) retained in HRFlow", x + 4, top + 137, 6.8f, MUTED, false);
        }
    }

    private void drawEducationTable(PDPageContentStream cs, PDPage page, float x, float top, HrCandidate c, boolean blank) throws IOException {
        float[] widths = {145, 188, 82, 108};
        String[] headers = {"Examination / Qualification", "Board / University", "Year", "Marks (%)"};
        tableHeader(cs, page, x, top, widths, headers, 22);

        List<HrEducation> rows = c == null || c.getEducations() == null ? List.of() : c.getEducations();
        for (int i = 0; i < 4; i++) {
            HrEducation row = i < rows.size() ? rows.get(i) : null;
            String[] values = row == null
                    ? new String[] {"", "", "", ""}
                    : new String[] {
                    safe(row.getExamination()), safe(row.getBoardOrUniversity()),
                    row.getYear() == null ? "" : String.valueOf(row.getYear()),
                    row.getMarksPercent() == null ? "" : row.getMarksPercent().stripTrailingZeros().toPlainString()
            };
            tableRow(cs, page, x, top + 22 + (i * 27), widths, values, 27, 8.0f);
        }
        if (!blank && rows.size() > 4) {
            text(cs, page, "+" + (rows.size() - 4) + " additional qualification(s) retained in HRFlow", x + 4, top + 137, 6.8f, MUTED, false);
        }
    }

    private void drawEmploymentTable(PDPageContentStream cs, PDPage page, float x, float top, HrCandidate c, boolean blank) throws IOException {
        float[] widths = {97, 74, 78, 105, 72, 97};
        String[] headers = {"Company", "Designation", "Period", "HR name / contact", "Last salary", "Reason for leaving"};
        tableHeader(cs, page, x, top, widths, headers, 24);

        List<HrEmployment> rows = c == null || c.getEmployments() == null ? List.of() : c.getEmployments();
        for (int i = 0; i < 2; i++) {
            HrEmployment row = i < rows.size() ? rows.get(i) : null;
            String[] values = row == null
                    ? new String[] {"", "", "", "", "", ""}
                    : new String[] {
                    safe(row.getCompanyName()), safe(row.getDesignation()), employmentPeriod(row),
                    employerHr(row), moneyText(row.getLastSalary()), safe(row.getReasonForLeaving())
            };
            tableRow(cs, page, x, top + 24 + (i * 53), widths, values, 53, 7.3f);
        }
        if (!blank && rows.size() > 2) {
            text(cs, page, "+" + (rows.size() - 2) + " additional employment record(s) retained in HRFlow", x + 4, top + 136, 6.8f, MUTED, false);
        }
    }

    private void drawLanguageTable(PDPageContentStream cs, PDPage page, float x, float top, HrCandidate c, boolean blank) throws IOException {
        float[] widths = {250, 91, 91, 91};
        String[] headers = {"Language", "Read", "Write", "Speak"};
        tableHeader(cs, page, x, top, widths, headers, 22);

        List<HrLanguage> rows = c == null || c.getLanguages() == null ? List.of() : c.getLanguages();
        for (int i = 0; i < 4; i++) {
            HrLanguage row = i < rows.size() ? rows.get(i) : null;
            String[] values = row == null
                    ? new String[] {"", "", "", ""}
                    : new String[] {
                    safe(row.getLanguage()), mark(row.getCanRead()), mark(row.getCanWrite()), mark(row.getCanSpeak())
            };
            tableRow(cs, page, x, top + 22 + (i * 27), widths, values, 27, 8.2f);
        }
    }

    // ---------------------------------------------------------------------
    // Drawing primitives
    // ---------------------------------------------------------------------

    private void drawPageChrome(
            PDPageContentStream cs,
            PDPage page,
            String title,
            String subtitle,
            HrCandidate c,
            boolean blank,
            int pageNo,
            int totalPages
    ) throws IOException {
        fillRectTop(cs, page, 0, 0, A4.getWidth(), 8, BLUE);
        text(cs, page, "ALSORG", MARGIN, 33, 12.5f, NAVY, true);
        text(cs, page, "HRFLOW", MARGIN + 58, 33, 8.5f, BLUE, true);
        text(cs, page, title, MARGIN, 57, 18.0f, NAVY, true);
        text(cs, page, subtitle, MARGIN, 78, 8.2f, MUTED, false);

        if (!blank && c != null) {
            badge(cs, page, MARGIN, 92, 138, 22,
                    firstNonBlank(c.getCandidateNumber(), "Candidate"), BLUE_SOFT, BLUE);
            badge(cs, page, MARGIN + 146, 92, 118, 22,
                    enumText(c.getStage()), SURFACE, MUTED);
            badge(cs, page, MARGIN + 272, 92, 150, 22,
                    enumText(c.getApplicationType()), SURFACE, MUTED);
        } else {
            badge(cs, page, MARGIN, 92, 110, 22, "BLANK FORM", BLUE_SOFT, BLUE);
        }

        lineTop(cs, page, MARGIN, 118, A4.getWidth() - MARGIN, 118, BORDER, 0.7f);
    }

    private void section(PDPageContentStream cs, PDPage page, float top, String title, String subtitle) throws IOException {
        fillRectTop(cs, page, MARGIN, top, 4, 26, BLUE);
        text(cs, page, title, MARGIN + 12, top + 4, 10.3f, NAVY, true);
        text(cs, page, subtitle, MARGIN + 12, top + 17, 7.1f, MUTED, false);
    }

    private void field(
            PDPageContentStream cs,
            PDPage page,
            float x,
            float top,
            float width,
            float height,
            String label,
            String value,
            boolean strong
    ) throws IOException {
        panel(cs, page, x, top, width, height, WHITE, BORDER);
        text(cs, page, label, x + 9, top + 8, 7.1f, MUTED, true);
        String clean = pdfSafe(value);
        if (clean == null || clean.isBlank()) return;

        float valueTop = top + 22;
        float fontSize = strong ? 10.0f : 9.2f;
        int maxLines = height >= 58 ? 3 : 2;
        wrappedText(cs, page, clean, x + 9, valueTop, width - 18, fontSize,
                fontSize + 2.1f, maxLines, INK, strong);
    }

    private void signatureBand(PDPageContentStream cs, PDPage page, float top, HrCandidate c, boolean blank) throws IOException {
        panel(cs, page, 36, top, 523, 48, SURFACE, BORDER);
        text(cs, page, "Applicant signature", 50, top + 9, 7.0f, MUTED, true);
        String signature = c != null && c.isDeclarationAccepted()
                ? safe(c.getFullName()) + " / e-accepted"
                : "";
        text(cs, page, pdfSafe(signature), 50, top + 23, 9.3f, INK, true);
        text(cs, page, "Acceptance date", 390, top + 9, 7.0f, MUTED, true);
        text(cs, page, c == null ? "" : dateTimeDate(c.getDeclarationAcceptedAt()), 390, top + 23, 9.0f, INK, false);
        if (!blank && c != null && c.isDeclarationAccepted()) {
            badge(cs, page, 250, top + 13, 96, 22, "E-ACCEPTED", SUCCESS_SOFT, SUCCESS);
        }
    }

    private void signatureBox(PDPageContentStream cs, PDPage page, float x, float top, float width, float height, String label) throws IOException {
        panel(cs, page, x, top, width, height, WHITE, BORDER);
        text(cs, page, label, x + 10, top + 10, 7.5f, MUTED, true);
        lineTop(cs, page, x + 12, top + height - 15, x + width - 12, top + height - 15, BORDER, 0.8f);
    }

    private void drawPhotoBox(
            PDDocument document,
            PDPageContentStream cs,
            PDPage page,
            HrDocumentService.DownloadedDocument photo,
            float x,
            float top,
            float width,
            float height,
            boolean blank
    ) throws IOException {
        panel(cs, page, x, top, width, height, SURFACE, BORDER);
        if (photo == null || photo.bytes() == null || photo.bytes().length == 0
                || !safe(photo.contentType()).toLowerCase(Locale.ROOT).startsWith("image/")) {
            text(cs, page, blank ? "PHOTO" : "Photo not uploaded", x + 13, top + 44, blank ? 9.0f : 7.0f, MUTED, true);
            return;
        }

        try {
            PDImageXObject image = PDImageXObject.createFromByteArray(document, photo.bytes(), photo.fileName());
            float pad = 5f;
            float maxW = width - (pad * 2f);
            float maxH = height - (pad * 2f);
            float scale = Math.min(maxW / image.getWidth(), maxH / image.getHeight());
            float drawW = image.getWidth() * scale;
            float drawH = image.getHeight() * scale;
            float drawX = x + (width - drawW) / 2f;
            float drawY = page.getMediaBox().getHeight() - top - height + (height - drawH) / 2f;
            cs.drawImage(image, drawX, drawY, drawW, drawH);
        } catch (Exception ignored) {
            text(cs, page, "Photo unavailable", x + 13, top + 44, 7.0f, MUTED, true);
        }
    }

    private void tableHeader(PDPageContentStream cs, PDPage page, float x, float top, float[] widths, String[] headers, float height) throws IOException {
        float cursor = x;
        for (int i = 0; i < widths.length; i++) {
            panel(cs, page, cursor, top, widths[i], height, BLUE_SOFT, BORDER);
            wrappedText(cs, page, headers[i], cursor + 6, top + 7, widths[i] - 12,
                    7.2f, 8.2f, 2, NAVY, true);
            cursor += widths[i];
        }
    }

    private void tableRow(PDPageContentStream cs, PDPage page, float x, float top, float[] widths, String[] values, float height, float fontSize) throws IOException {
        float cursor = x;
        for (int i = 0; i < widths.length; i++) {
            panel(cs, page, cursor, top, widths[i], height, WHITE, BORDER);
            wrappedText(cs, page, i < values.length ? values[i] : "", cursor + 6, top + 8,
                    widths[i] - 12, fontSize, fontSize + 1.8f, height >= 45 ? 4 : 2, INK, false);
            cursor += widths[i];
        }
    }

    private void panel(PDPageContentStream cs, PDPage page, float x, float top, float width, float height, int[] fill, int[] border) throws IOException {
        fillRectTop(cs, page, x, top, width, height, fill);
        strokeRectTop(cs, page, x, top, width, height, border, 0.7f);
    }

    private void badge(PDPageContentStream cs, PDPage page, float x, float top, float width, float height, String label, int[] fill, int[] color) throws IOException {
        String clean = pdfSafe(label);
        if (clean == null || clean.isBlank()) return;
        fillRectTop(cs, page, x, top, width, height, fill);
        strokeRectTop(cs, page, x, top, width, height, BORDER, 0.5f);
        String fitted = fitSingleLine(clean, BOLD, 7.3f, width - 14);
        text(cs, page, fitted, x + 7, top + 7, 7.3f, color, true);
    }

    private void footer(PDPageContentStream cs, PDPage page, HrCandidate c, boolean blank, int pageNo, int totalPages) throws IOException {
        float top = 815f;
        lineTop(cs, page, MARGIN, top, A4.getWidth() - MARGIN, top, BORDER, 0.6f);
        String left = blank
                ? "ALSORG HRFlow - Controlled HR form"
                : "Candidate: " + firstNonBlank(c == null ? null : c.getCandidateNumber(), c == null ? null : c.getFullName(), "-");
        text(cs, page, left, MARGIN, top + 8, 6.8f, MUTED, false);
        textRight(cs, page, "Page " + pageNo + " of " + totalPages, A4.getWidth() - MARGIN, top + 8, 6.8f, MUTED, false);
    }

    private void text(PDPageContentStream cs, PDPage page, String value, float x, float top, float fontSize, int[] color, boolean bold) throws IOException {
        String clean = pdfSafe(value);
        if (clean == null || clean.isBlank()) return;
        cs.beginText();
        cs.setFont(bold ? BOLD : REGULAR, fontSize);
        setFill(cs, color);
        cs.newLineAtOffset(x, page.getMediaBox().getHeight() - top - fontSize);
        cs.showText(clean);
        cs.endText();
    }

    private void textRight(PDPageContentStream cs, PDPage page, String value, float rightX, float top, float fontSize, int[] color, boolean bold) throws IOException {
        String clean = pdfSafe(value);
        if (clean == null || clean.isBlank()) return;
        PDFont font = bold ? BOLD : REGULAR;
        float width = font.getStringWidth(clean) / 1000f * fontSize;
        text(cs, page, clean, rightX - width, top, fontSize, color, bold);
    }

    private void wrappedText(
            PDPageContentStream cs,
            PDPage page,
            String value,
            float x,
            float top,
            float maxWidth,
            float fontSize,
            float leading,
            int maxLines,
            int[] color,
            boolean bold
    ) throws IOException {
        String clean = pdfSafe(value);
        if (clean == null || clean.isBlank()) return;
        PDFont font = bold ? BOLD : REGULAR;
        List<String> lines = wrap(clean, font, fontSize, maxWidth, maxLines);
        for (int i = 0; i < lines.size(); i++) {
            text(cs, page, lines.get(i), x, top + (i * leading), fontSize, color, bold);
        }
    }

    private List<String> wrap(String text, PDFont font, float fontSize, float maxWidth, int maxLines) throws IOException {
        List<String> result = new ArrayList<>();
        String[] words = text.trim().split("\\s+");
        StringBuilder line = new StringBuilder();
        int wordIndex = 0;

        while (wordIndex < words.length && result.size() < maxLines) {
            String word = words[wordIndex];
            String candidate = line.length() == 0 ? word : line + " " + word;
            float width = font.getStringWidth(candidate) / 1000f * fontSize;
            if (width <= maxWidth || line.length() == 0) {
                line.setLength(0);
                line.append(candidate);
                wordIndex++;
            } else {
                result.add(line.toString());
                line.setLength(0);
            }
        }

        if (line.length() > 0 && result.size() < maxLines) {
            result.add(line.toString());
        }

        if (wordIndex < words.length && !result.isEmpty()) {
            int last = result.size() - 1;
            String base = result.get(last);
            String ellipsis = "...";
            while (!base.isEmpty()
                    && font.getStringWidth(base + ellipsis) / 1000f * fontSize > maxWidth) {
                base = base.substring(0, base.length() - 1).trim();
            }
            result.set(last, base + ellipsis);
        }
        return result;
    }

    private String fitSingleLine(String text, PDFont font, float fontSize, float maxWidth) throws IOException {
        String clean = pdfSafe(text);
        if (clean == null) return "";
        if (font.getStringWidth(clean) / 1000f * fontSize <= maxWidth) return clean;
        String base = clean;
        while (!base.isEmpty()
                && font.getStringWidth(base + "...") / 1000f * fontSize > maxWidth) {
            base = base.substring(0, base.length() - 1).trim();
        }
        return base + "...";
    }

    private void fillRectTop(PDPageContentStream cs, PDPage page, float x, float top, float width, float height, int[] color) throws IOException {
        setFill(cs, color);
        cs.addRect(x, page.getMediaBox().getHeight() - top - height, width, height);
        cs.fill();
    }

    private void strokeRectTop(PDPageContentStream cs, PDPage page, float x, float top, float width, float height, int[] color, float lineWidth) throws IOException {
        setStroke(cs, color);
        cs.setLineWidth(lineWidth);
        cs.addRect(x, page.getMediaBox().getHeight() - top - height, width, height);
        cs.stroke();
    }

    private void lineTop(PDPageContentStream cs, PDPage page, float x1, float top1, float x2, float top2, int[] color, float lineWidth) throws IOException {
        setStroke(cs, color);
        cs.setLineWidth(lineWidth);
        cs.moveTo(x1, page.getMediaBox().getHeight() - top1);
        cs.lineTo(x2, page.getMediaBox().getHeight() - top2);
        cs.stroke();
    }

    private void setFill(PDPageContentStream cs, int[] rgb) throws IOException {
        cs.setNonStrokingColor(rgb[0], rgb[1], rgb[2]);
    }

    private void setStroke(PDPageContentStream cs, int[] rgb) throws IOException {
        cs.setStrokingColor(rgb[0], rgb[1], rgb[2]);
    }

    // ---------------------------------------------------------------------
    // Data formatting / mapping
    // ---------------------------------------------------------------------

    private String normalizeSupported(String value) {
        String key = normalizeKey(value);
        if (!supports(key)) {
            throw HrFlowException.badRequest(
                    "Candidate PDF supports PERSONAL_DATA, EMPLOYMENT_APPLICATION or CANDIDATE_PACK."
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

    private String value(HrCandidate c, String raw) {
        return c == null ? "" : safe(raw);
    }

    private String sensitive(HrCandidate c, String stored) {
        if (c == null || stored == null || stored.isBlank()) return "";
        return safe(cryptoService.decryptNullable(stored));
    }

    private String ageAndDob(LocalDate dob) {
        if (dob == null) return "";
        int years = Math.max(0, Period.between(dob, LocalDate.now()).getYears());
        return years + " years / " + dateText(dob);
    }

    private String dateText(LocalDate value) {
        return value == null ? "" : DATE.format(value);
    }

    private String dateTimeDate(LocalDateTime value) {
        return value == null ? "" : DATE.format(value.toLocalDate());
    }

    private String enumText(Object value) {
        return value == null ? "" : String.valueOf(value).replace('_', ' ');
    }

    private String upper(String value) {
        String clean = clean(value);
        return clean == null ? "" : clean.toUpperCase(Locale.ROOT);
    }

    private String yesNoDetails(Boolean value, String details) {
        String extra = clean(details);
        if (value == null) return safe(extra);
        String prefix = value ? "Yes" : "No";
        return extra == null ? prefix : prefix + " - " + extra;
    }

    private String employerHr(HrEmployment employment) {
        if (employment == null) return "";
        String name = clean(employment.getHrName());
        String contact = clean(employment.getHrContact());
        if (name == null) return safe(contact);
        if (contact == null) return name;
        return name + " / " + contact;
    }

    private String employmentPeriod(HrEmployment employment) {
        if (employment == null) return "";
        String from = dateText(employment.getFromDate());
        String to = dateText(employment.getToDate());
        if (from.isBlank()) return to;
        if (to.isBlank()) return from;
        return from + " - " + to;
    }

    private String familySummary(List<HrFamilyMember> family) {
        if (family == null || family.isEmpty()) return "";
        return family.stream()
                .limit(3)
                .map(f -> firstNonBlank(f.getName(), "-")
                        + (clean(f.getRelation()) == null ? "" : " (" + f.getRelation() + ")"))
                .reduce((a, b) -> a + ", " + b)
                .orElse("");
    }

    private String moneyText(BigDecimal value) {
        return value == null ? "" : "INR " + MONEY.format(value);
    }

    private String mark(Boolean value) {
        return Boolean.TRUE.equals(value) ? "Yes" : "";
    }

    private String pdfSafe(String value) {
        String clean = clean(value);
        if (clean == null) return null;
        clean = clean.replace('\u2018', '\'').replace('\u2019', '\'')
                .replace('\u201c', '"').replace('\u201d', '"')
                .replace('\u2013', '-').replace('\u2014', '-')
                .replace('\u00a0', ' ');
        StringBuilder out = new StringBuilder(clean.length());
        for (char ch : clean.toCharArray()) {
            out.append(ch >= 32 && ch <= 126 ? ch : '?');
        }
        return out.toString();
    }

    private String clean(String value) {
        if (value == null) return null;
        String clean = value.trim();
        return clean.isEmpty() ? null : clean;
    }

    private String safe(String value) {
        return value == null ? "" : value;
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
        String clean = safe(value).trim().replaceAll("[^A-Za-z0-9._-]+", "_");
        return clean.isBlank() ? "Candidate" : clean;
    }

    public record GeneratedPdf(String fileName, byte[] bytes) {}
}
