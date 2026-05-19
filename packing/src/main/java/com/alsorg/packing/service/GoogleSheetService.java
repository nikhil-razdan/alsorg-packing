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
    private static final String RANGE = "Sheet1!A:D";

    // 🔥 IMPORTANT → put your downloaded JSON key path here
    private static final String CREDENTIALS_PATH = "D:/Nikhil/2025/alsorg-packing/idyllic-kiln-496808-s0-2025c20a3acc.json";

    public GoogleSheetService(DriverLogRepository repo) {
        this.repo = repo;
    }

    @Scheduled(fixedRate = 300000) // every 5 min
    public void syncGoogleSheet() {

        try {

            Sheets service = getSheetsService();

            ValueRange response = service.spreadsheets().values()
                    .get(SHEET_ID, RANGE)
                    .execute();

            List<List<Object>> rows = response.getValues();

            if (rows == null || rows.size() <= 1) return;

            for (int i = 1; i < rows.size(); i++) {

                List<Object> row = rows.get(i);

                DriverLog log = new DriverLog();

                log.setDriverName(getString(row, 0));
                log.setTrips(getInt(row, 1));
                log.setLoaders(getInt(row, 2));
                log.setLocation(getString(row, 3));

                log.setCreatedAt(LocalDateTime.now());
                log.setSource("GOOGLE_SHEET");

                repo.save(log);
            }

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private Sheets getSheetsService() throws Exception {

        GoogleCredentials credentials = GoogleCredentials
                .fromStream(new FileInputStream(CREDENTIALS_PATH))
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