package com.alsorg.packing.service;

import java.io.FileInputStream;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.alsorg.packing.domain.analytics.DriverLog;
import com.alsorg.packing.repository.DriverLogRepository;
import com.google.api.services.sheets.v4.Sheets;
import com.google.api.services.sheets.v4.model.ValueRange;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.auth.http.HttpCredentialsAdapter;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;

@Service
public class GoogleSheetService {

    private final DriverLogRepository repo;

    private static final String APPLICATION_NAME = "Driver Dashboard";
    private static final String SHEET_ID = "1OB8whJWPSVzIoEcOR5ZnWJpSb1JkYBRd6edVxjaEaN8";

    public GoogleSheetService(DriverLogRepository repo) {
        this.repo = repo;
    }

    @Scheduled(fixedRate = 300000)
    public void syncGoogleSheet() {

        try {
            Sheets service = getSheetsService();

            ValueRange response = service.spreadsheets().values()
            		.get(SHEET_ID, "Sheet1!A1:Z100")
                    .execute();

            List<List<Object>> rows = response.getValues();

            if (rows == null || rows.size() < 3) return;

            List<Object> headers = rows.get(0);
            
            System.out.println("HEADERS: " + headers);

            // repo.deleteAll(); 

            for (int i = 2; i < rows.size(); i += 2) { // 🔥 jump in pairs

                List<Object> dateRow = rows.get(i);

                if (dateRow.isEmpty()) continue;

                String date = dateRow.get(0).toString();
                
                if (!date.matches("\\d{2}-\\d{2}-\\d{4}")) {
                    System.out.println("Skipping invalid date row: " + date);
                    continue;
                }

                List<Object> locationRow = (i + 1 < rows.size()) ? rows.get(i + 1) : null;
                System.out.println("ROWS SIZE: " + (rows == null ? "NULL" : rows.size()));
                for (int j = 1; j < headers.size(); j++) {

                    if (j >= dateRow.size()) continue;

                    String driverName = headers.get(j).toString().trim();

                    if (driverName.equalsIgnoreCase("Name") || driverName.isEmpty()) {
                        continue;
                    }
                    
                    System.out.println("HEADERS: " + headers);
                    
                    String cell = dateRow.get(j).toString();

                    if (cell == null || cell.trim().isEmpty()) continue;

                    if (cell.toLowerCase().contains("off") || cell.toLowerCase().contains("leave")) {
                        continue;
                    }

                    DriverLog log = new DriverLog();
                    log.setDriverName(driverName);

                    // ✅ Trips
                    log.setTrips(1);

                    // ✅ Loaders extraction FIXED
                    int loaders = 0;
                    try {
                        java.util.regex.Matcher m = java.util.regex.Pattern
                            .compile("(\\d+)\\s*Loaders?")
                            .matcher(cell);

                        if (m.find()) {
                            loaders = Integer.parseInt(m.group(1));
                        }
                    } catch (Exception ignored) {}

                    log.setLoaders(loaders);

                    // ✅ Location FIX
                    String location = "UNKNOWN";
                    if (locationRow != null && j < locationRow.size()) {
                        location = locationRow.get(j).toString();
                    }

                    log.setLocation(location);

                    try {
                        java.time.format.DateTimeFormatter formatter =
                            java.time.format.DateTimeFormatter.ofPattern("M-d-yyyy");

                        log.setCreatedAt(
                            java.time.LocalDate.parse(date.trim(), formatter).atStartOfDay()
                        );
                    } catch (Exception e) {
                        System.out.println("❌ Date parse failed: " + date);
                        log.setCreatedAt(java.time.LocalDateTime.now());
                    }
                    
                    System.out.println("Saving -> " + driverName + " | " + loaders + " | " + location);
                    repo.save(log);
                }
            }
            System.out.println("✅ Google Sheet Synced Successfully");

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private Sheets getSheetsService() throws Exception {

        String credentialsJson = System.getenv("GOOGLE_CREDS");

        if (credentialsJson == null) {
            throw new RuntimeException("GOOGLE_CREDS env variable not set");
        }

        GoogleCredentials credentials = GoogleCredentials
                .fromStream(new java.io.ByteArrayInputStream(credentialsJson.getBytes()))
                .createScoped(List.of("https://www.googleapis.com/auth/spreadsheets.readonly"));

        return new Sheets.Builder(
                GoogleNetHttpTransport.newTrustedTransport(),
                GsonFactory.getDefaultInstance(),
                new HttpCredentialsAdapter(credentials))
                .setApplicationName(APPLICATION_NAME)
                .build();
    }

    private String getString(List<Object> row, int index) {
        return row.size() > index ? String.valueOf(row.get(index)) : "UNKNOWN";
    }

    private int getInt(List<Object> row, int index) {
        try {
            return row.size() > index ? Integer.parseInt(row.get(index).toString()) : 0;
        } catch (Exception e) {
            return 0;
        }
    }
}