package com.alsorg.packing.service;

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import com.alsorg.packing.config.TimeZoneConfig;
import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.service.DispatchedItemService.UtlReadContext;

/**
 * Memory-bounded Dispatch register exports.
 *
 * The old React export downloaded every matching entity and then built the whole
 * XLSX in browser memory. This service writes the OpenXML package directly to the
 * HTTP response while PostgreSQL is read in small batches. No export List and no
 * complete workbook byte[] is retained in Java heap.
 *
 * This is deliberately read-only. It does not alter Dispatch, Warehouse, FG,
 * challan, UTL routing, packet, sticker or logistics state.
 */
@Service
public class DispatchRegisterExportService {

    private static final int EXPORT_BATCH_SIZE = 500;

    private static final DateTimeFormatter DATE_ONLY =
            DateTimeFormatter.ofPattern("dd-MMM-yyyy", Locale.ENGLISH);

    private static final DateTimeFormatter GENERATED_AT =
            DateTimeFormatter.ofPattern("dd-MMM-yyyy HH:mm", Locale.ENGLISH);

    private static final String[] HEADERS = {
            "Packing Date",
            "Dispatch Date",
            "PD No.",
            "Client Name",
            "Dwg No.",
            "Item Name",
            "Pkt No.",
            "Description",
            "Plant",
            "Status",
            "Address",
            "Driver Name"
    };

    private static final double[] WIDTHS = {
            16, 16, 18, 28, 18, 32, 24, 44, 16, 24, 46, 24
    };

    private final DispatchedItemService dispatchedItemService;

    public DispatchRegisterExportService(
            DispatchedItemService dispatchedItemService) {
        this.dispatchedItemService = dispatchedItemService;
    }

    public record ExportRequest(
            String search,
            Collection<ItemDispatchStatus> statuses,
            String plant,
            String dateMode,
            String dateFrom,
            String dateTo,
            String timeFrom,
            String timeTo,
            String groupBy,
            boolean completeRegisterAccess,
            Set<String> allowedPlants,
            String ownerUsername,
            UtlReadContext utlReadContext) {
    }

    public void writeCsv(
            OutputStream outputStream,
            ExportRequest request)
            throws IOException {

        BufferedWriter writer = new BufferedWriter(
                new OutputStreamWriter(outputStream, StandardCharsets.UTF_8),
                32 * 1024);

        /* UTF-8 BOM keeps Excel's Windows import path predictable. */
        writer.write('\uFEFF');
        writeCsvRow(writer, Arrays.asList(HEADERS));

        dispatchedItemService.forEachDispatchRegisterBatch(
                request.search(),
                request.statuses(),
                request.plant(),
                request.dateMode(),
                request.dateFrom(),
                request.dateTo(),
                request.timeFrom(),
                request.timeTo(),
                request.completeRegisterAccess(),
                request.allowedPlants(),
                request.ownerUsername(),
                request.utlReadContext(),
                buildRegisterSort(request.groupBy()),
                EXPORT_BATCH_SIZE,
                items -> {
                    for (DispatchedItem item : items) {
                        writeCsvRow(writer, exportValues(item));
                    }
                    writer.flush();
                });

        writer.flush();
    }

    /**
     * Streams only the identifiers for an explicit "Select all matching"
     * action. React still receives the IDs it needs for the existing selection
     * model, but full Dispatch entities, descriptions, addresses and lifecycle
     * metadata are never accumulated merely to build the selection.
     */
    public void writeIdsJson(
            OutputStream outputStream,
            ExportRequest request)
            throws IOException {

        BufferedWriter writer = new BufferedWriter(
                new OutputStreamWriter(outputStream, StandardCharsets.UTF_8),
                32 * 1024);

        writer.write('[');
        final boolean[] first = { true };

        dispatchedItemService.forEachDispatchRegisterBatch(
                request.search(),
                request.statuses(),
                request.plant(),
                request.dateMode(),
                request.dateFrom(),
                request.dateTo(),
                request.timeFrom(),
                request.timeTo(),
                request.completeRegisterAccess(),
                request.allowedPlants(),
                request.ownerUsername(),
                request.utlReadContext(),
                buildRegisterSort(request.groupBy()),
                EXPORT_BATCH_SIZE,
                items -> {
                    for (DispatchedItem item : items) {
                        String id = clean(item == null ? null : item.getZohoItemId());

                        if (id.isBlank()) {
                            continue;
                        }

                        if (!first[0]) {
                            writer.write(',');
                        }

                        writer.write('"');
                        writer.write(jsonEscape(id));
                        writer.write('"');
                        first[0] = false;
                    }

                    writer.flush();
                });

        writer.write(']');
        writer.flush();
    }

    /**
     * Writes a real .xlsx file using only JDK ZIP/XML primitives.
     *
     * Inline-string cells avoid a global shared-strings table, so memory remains
     * essentially constant as row count grows. Two worksheets preserve the
     * existing PackFlow export contract: DISPATCHED and Other Status.
     */
    public void writeXlsx(
            OutputStream outputStream,
            ExportRequest request)
            throws IOException {

        ZipOutputStream zip = new ZipOutputStream(outputStream, StandardCharsets.UTF_8);
        zip.setLevel(6);

        writeFixedEntry(zip, "[Content_Types].xml", contentTypesXml());
        writeFixedEntry(zip, "_rels/.rels", packageRelationshipsXml());
        writeFixedEntry(zip, "docProps/core.xml", corePropertiesXml());
        writeFixedEntry(zip, "docProps/app.xml", appPropertiesXml());
        writeFixedEntry(zip, "xl/workbook.xml", workbookXml());
        writeFixedEntry(zip, "xl/_rels/workbook.xml.rels", workbookRelationshipsXml());
        writeFixedEntry(zip, "xl/styles.xml", stylesXml());

        Collection<ItemDispatchStatus> selected = request.statuses();
        boolean allStatuses = selected == null || selected.isEmpty();

        boolean includeDispatched = allStatuses
                || selected.contains(ItemDispatchStatus.DISPATCHED);

        List<ItemDispatchStatus> otherStatuses = new ArrayList<>();

        if (allStatuses) {
            for (ItemDispatchStatus value : ItemDispatchStatus.values()) {
                if (value != ItemDispatchStatus.DISPATCHED) {
                    otherStatuses.add(value);
                }
            }
        } else {
            for (ItemDispatchStatus value : selected) {
                if (value != null && value != ItemDispatchStatus.DISPATCHED) {
                    otherStatuses.add(value);
                }
            }
        }

        writeWorksheet(
                zip,
                "xl/worksheets/sheet1.xml",
                "ALSORG DISPATCH REGISTER — DISPATCHED",
                "Records whose current status is DISPATCHED",
                request,
                includeDispatched ? List.of(ItemDispatchStatus.DISPATCHED) : null,
                Sort.by(Sort.Order.desc("dispatchedAt"))
                        .and(Sort.by(Sort.Order.asc("zohoItemId"))));

        writeWorksheet(
                zip,
                "xl/worksheets/sheet2.xml",
                "ALSORG DISPATCH REGISTER — OTHER STATUS",
                "Packed, warehouse, ready-to-dispatch, restored and all non-dispatched records",
                request,
                otherStatuses.isEmpty() ? null : otherStatuses,
                Sort.by(Sort.Order.asc("status"), Sort.Order.desc("packedAt"))
                        .and(Sort.by(Sort.Order.asc("zohoItemId"))));

        zip.finish();
        zip.flush();
    }

    private void writeWorksheet(
            ZipOutputStream zip,
            String entryName,
            String title,
            String subtitle,
            ExportRequest request,
            Collection<ItemDispatchStatus> sheetStatuses,
            Sort sort)
            throws IOException {

        zip.putNextEntry(new ZipEntry(entryName));

        BufferedWriter writer = new BufferedWriter(
                new OutputStreamWriter(zip, StandardCharsets.UTF_8),
                32 * 1024);

        writer.write("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>");
        writer.write("<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">");
        writer.write("<sheetViews><sheetView workbookViewId=\"0\"><pane ySplit=\"5\" topLeftCell=\"A6\" activePane=\"bottomLeft\" state=\"frozen\"/></sheetView></sheetViews>");
        writer.write("<cols>");
        for (int i = 0; i < WIDTHS.length; i++) {
            writer.write("<col min=\"");
            writer.write(String.valueOf(i + 1));
            writer.write("\" max=\"");
            writer.write(String.valueOf(i + 1));
            writer.write("\" width=\"");
            writer.write(String.valueOf(WIDTHS[i]));
            writer.write("\" customWidth=\"1\"/>");
        }
        writer.write("</cols><sheetData>");

        writeMergedTitleRow(writer, 1, title, 1);
        writeMergedTitleRow(writer, 2, subtitle, 2);
        writeMergedTitleRow(
                writer,
                3,
                "Generated: " + LocalDateTime.now(TimeZoneConfig.APP_ZONE).format(GENERATED_AT),
                2);
        writeMergedTitleRow(writer, 4, "Filters are applied exactly as in the Dispatch register.", 2);
        writeHeaderRow(writer, 5);

        final int[] excelRowNumber = { 6 };
        final int[] written = { 0 };

        if (sheetStatuses != null) {
            dispatchedItemService.forEachDispatchRegisterBatch(
                    request.search(),
                    sheetStatuses,
                    request.plant(),
                    request.dateMode(),
                    request.dateFrom(),
                    request.dateTo(),
                    request.timeFrom(),
                    request.timeTo(),
                    request.completeRegisterAccess(),
                    request.allowedPlants(),
                    request.ownerUsername(),
                    request.utlReadContext(),
                    sort,
                    EXPORT_BATCH_SIZE,
                    items -> {
                        for (DispatchedItem item : items) {
                            writeDataRow(writer, excelRowNumber[0]++, item);
                            written[0] += 1;
                        }
                        writer.flush();
                    });
        }

        if (written[0] == 0) {
            writer.write("<row r=\"6\">");
            writeInlineStringCell(writer, "A6", "No records matched this sheet.", 2);
            writer.write("</row>");
            excelRowNumber[0] = 7;
        }

        writer.write("</sheetData>");
        writer.write("<mergeCells count=\"4\">");
        writer.write("<mergeCell ref=\"A1:L1\"/><mergeCell ref=\"A2:L2\"/><mergeCell ref=\"A3:L3\"/><mergeCell ref=\"A4:L4\"/>");
        writer.write("</mergeCells>");

        int finalRow = Math.max(5, excelRowNumber[0] - 1);
        writer.write("<autoFilter ref=\"A5:L");
        writer.write(String.valueOf(finalRow));
        writer.write("\"/>");
        writer.write("<pageMargins left=\"0.25\" right=\"0.25\" top=\"0.5\" bottom=\"0.5\" header=\"0.2\" footer=\"0.2\"/>");
        writer.write("<pageSetup orientation=\"landscape\" fitToWidth=\"1\" fitToHeight=\"0\"/>");
        writer.write("</worksheet>");
        writer.flush();

        zip.closeEntry();
    }

    private void writeDataRow(
            BufferedWriter writer,
            int rowNumber,
            DispatchedItem item)
            throws IOException {

        writer.write("<row r=\"");
        writer.write(String.valueOf(rowNumber));
        writer.write("\">");

        List<String> values = exportValues(item);

        for (int i = 0; i < values.size(); i++) {
            String ref = columnName(i + 1) + rowNumber;
            int style = i == 0 || i == 1 ? 4 : (i == 9 ? 5 : 3);
            writeInlineStringCell(writer, ref, values.get(i), style);
        }

        writer.write("</row>");
    }

    private void writeHeaderRow(
            BufferedWriter writer,
            int rowNumber)
            throws IOException {

        writer.write("<row r=\"");
        writer.write(String.valueOf(rowNumber));
        writer.write("\" ht=\"24\" customHeight=\"1\">");

        for (int i = 0; i < HEADERS.length; i++) {
            writeInlineStringCell(
                    writer,
                    columnName(i + 1) + rowNumber,
                    HEADERS[i],
                    3);
        }

        writer.write("</row>");
    }

    private void writeMergedTitleRow(
            BufferedWriter writer,
            int rowNumber,
            String value,
            int style)
            throws IOException {

        writer.write("<row r=\"");
        writer.write(String.valueOf(rowNumber));
        writer.write("\">");
        writeInlineStringCell(writer, "A" + rowNumber, value, style);
        writer.write("</row>");
    }

    private void writeInlineStringCell(
            BufferedWriter writer,
            String reference,
            String value,
            int style)
            throws IOException {

        writer.write("<c r=\"");
        writer.write(reference);
        writer.write("\" t=\"inlineStr\" s=\"");
        writer.write(String.valueOf(style));
        writer.write("\"><is><t xml:space=\"preserve\">");
        writer.write(xmlEscape(clean(value)));
        writer.write("</t></is></c>");
    }

    private List<String> exportValues(
            DispatchedItem item) {

        if (item == null) {
            return List.of("", "", "", "", "", "", "", "", "", "", "", "");
        }

        return List.of(
                date(item.getPackedAt()),
                date(item.getDispatchedAt()),
                clean(item.getPdNo()),
                clean(item.getClientName()),
                clean(item.getDrawingNo()),
                clean(item.getName()),
                clean(item.getSku()),
                firstNonBlank(item.getDescription(), item.getName()),
                clean(item.getPlantCode()),
                item.getStatus() == null ? "" : item.getStatus().name(),
                clean(item.getClientAddress()),
                clean(item.getDriverName()));
    }

    private Sort buildRegisterSort(
            String groupBy) {

        String clean = clean(groupBy).toUpperCase(Locale.ROOT);
        Sort tieBreaker = Sort.by(Sort.Order.asc("zohoItemId"));

        if ("STATUS".equals(clean)) {
            return Sort.by(
                    Sort.Order.asc("status"),
                    Sort.Order.asc("name"),
                    Sort.Order.desc("createdAt"))
                    .and(tieBreaker);
        }

        if ("CLIENT".equals(clean)) {
            return Sort.by(
                    Sort.Order.asc("clientName"),
                    Sort.Order.asc("name"),
                    Sort.Order.desc("createdAt"))
                    .and(tieBreaker);
        }

        if ("PLANT".equals(clean)) {
            return Sort.by(
                    Sort.Order.asc("plantCode"),
                    Sort.Order.asc("name"),
                    Sort.Order.desc("createdAt"))
                    .and(tieBreaker);
        }

        return Sort.by(Sort.Order.desc("createdAt"))
                .and(tieBreaker);
    }

    private void writeCsvRow(
            BufferedWriter writer,
            List<String> values)
            throws IOException {

        for (int index = 0; index < values.size(); index++) {
            if (index > 0) {
                writer.write(',');
            }

            writer.write('"');
            writer.write(csvEscape(values.get(index)));
            writer.write('"');
        }

        writer.newLine();
    }

    private String csvEscape(String value) {
        return clean(value).replace("\"", "\"\"");
    }

    private String date(LocalDateTime value) {
        return value == null ? "" : value.format(DATE_ONLY);
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }

        for (String value : values) {
            String clean = clean(value);
            if (!clean.isBlank()) {
                return clean;
            }
        }

        return "";
    }

    private String clean(String value) {
        if (value == null) {
            return "";
        }

        return value
                .replace('\r', ' ')
                .replace('\n', ' ')
                .replace('\t', ' ')
                .trim()
                .replaceAll("\\s+", " ");
    }

    private String jsonEscape(String value) {
        String source = value == null ? "" : value;
        StringBuilder escaped = new StringBuilder(source.length() + 8);

        for (int i = 0; i < source.length(); i++) {
            char ch = source.charAt(i);

            switch (ch) {
                case '"' -> escaped.append("\\\"");
                case '\\' -> escaped.append("\\\\");
                case '\b' -> escaped.append("\\b");
                case '\f' -> escaped.append("\\f");
                case '\n' -> escaped.append("\\n");
                case '\r' -> escaped.append("\\r");
                case '\t' -> escaped.append("\\t");
                default -> {
                    if (ch < 0x20) {
                        escaped.append(String.format("\\u%04x", (int) ch));
                    } else {
                        escaped.append(ch);
                    }
                }
            }
        }

        return escaped.toString();
    }

    private String xmlEscape(String value) {
        return clean(value)
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }

    private String columnName(int column) {
        StringBuilder result = new StringBuilder();
        int value = column;

        while (value > 0) {
            value -= 1;
            result.insert(0, (char) ('A' + (value % 26)));
            value /= 26;
        }

        return result.toString();
    }

    private void writeFixedEntry(
            ZipOutputStream zip,
            String name,
            String text)
            throws IOException {

        zip.putNextEntry(new ZipEntry(name));
        zip.write(text.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }

    private String contentTypesXml() {
        return """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
                  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
                  <Default Extension="xml" ContentType="application/xml"/>
                  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
                  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
                  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
                  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
                  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
                  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
                </Types>
                """;
    }

    private String packageRelationshipsXml() {
        return """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
                  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
                  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
                </Relationships>
                """;
    }

    private String workbookXml() {
        return """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
                  <bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12000"/></bookViews>
                  <sheets>
                    <sheet name="Dispatched" sheetId="1" r:id="rId1"/>
                    <sheet name="Other Status" sheetId="2" r:id="rId2"/>
                  </sheets>
                </workbook>
                """;
    }

    private String workbookRelationshipsXml() {
        return """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
                  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
                  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
                </Relationships>
                """;
    }

    private String corePropertiesXml() {
        String timestamp = java.time.OffsetDateTime.now()
                .withOffsetSameInstant(java.time.ZoneOffset.UTC)
                .format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);

        return """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
                  <dc:creator>ALSORG PackFlow</dc:creator>
                  <dc:title>Dispatch Register</dc:title>
                  <dc:subject>Dispatch and inventory status register</dc:subject>
                  <dcterms:created xsi:type="dcterms:W3CDTF">%s</dcterms:created>
                  <dcterms:modified xsi:type="dcterms:W3CDTF">%s</dcterms:modified>
                </cp:coreProperties>
                """.formatted(timestamp, timestamp);
    }

    private String appPropertiesXml() {
        return """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
                  <Application>ALSORG PackFlow</Application>
                  <Company>ALSORG</Company>
                  <TitlesOfParts><vt:vector size="2" baseType="lpstr"><vt:lpstr>Dispatched</vt:lpstr><vt:lpstr>Other Status</vt:lpstr></vt:vector></TitlesOfParts>
                </Properties>
                """;
    }

    private String stylesXml() {
        return """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
                  <fonts count="3">
                    <font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
                    <font><b/><sz val="16"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
                    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
                  </fonts>
                  <fills count="4">
                    <fill><patternFill patternType="none"/></fill>
                    <fill><patternFill patternType="gray125"/></fill>
                    <fill><patternFill patternType="solid"><fgColor rgb="FF2563EB"/><bgColor indexed="64"/></patternFill></fill>
                    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/><bgColor indexed="64"/></patternFill></fill>
                  </fills>
                  <borders count="2">
                    <border><left/><right/><top/><bottom/><diagonal/></border>
                    <border><left style="thin"><color rgb="FFE2E8F0"/></left><right style="thin"><color rgb="FFE2E8F0"/></right><top style="thin"><color rgb="FFE2E8F0"/></top><bottom style="thin"><color rgb="FFE2E8F0"/></bottom><diagonal/></border>
                  </borders>
                  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
                  <cellXfs count="6">
                    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
                    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"><alignment horizontal="left" vertical="center"/></xf>
                    <xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0"><alignment horizontal="left" vertical="center"/></xf>
                    <xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
                    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
                    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
                  </cellXfs>
                  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
                </styleSheet>
                """;
    }
}
