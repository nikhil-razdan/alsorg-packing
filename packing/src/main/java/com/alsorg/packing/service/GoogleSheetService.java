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
                    .get(SHEET_ID, "Sheet1")
                    .execute();

            List<List<Object>> rows = response.getValues();

            if (rows == null || rows.size() < 3) return;

            List<Object> headers = rows.get(0);

            repo.deleteAll(); // clear old

            for (int i = 2; i < rows.size(); i++) {

                List<Object> row = rows.get(i);

                if (row.isEmpty()) continue;

                for (int j = 1; j < headers.size(); j++) {

                    if (j >= row.size()) continue;

                    String driverName = headers.get(j).toString();
                    String cell = row.get(j).toString();

                    if (cell == null || cell.trim().isEmpty()) continue;

                    if (cell.toLowerCase().contains("off") || cell.toLowerCase().contains("leave")) {
                        continue;
                    }

                    DriverLog log = new DriverLog();
                    log.setDriverName(driverName);
                    log.setTrips(1);

                    // loaders extract
                    int loaders = 0;
                    try {
                        if (cell.contains("Loaders")) {
                            String num = cell.replaceAll("[^0-9]", "");
                            loaders = Integer.parseInt(num);
                        }
                    } catch (Exception ignored) {}

                    log.setLoaders(loaders);

                    // location (next row)
                    String location = "UNKNOWN";
                    if (i + 1 < rows.size()) {
                        List<Object> locRow = rows.get(i + 1);
                        if (j < locRow.size()) {
                            location = locRow.get(j).toString();
                        }
                    }

                    log.setLocation(location);
                    log.setCreatedAt(LocalDateTime.now());

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