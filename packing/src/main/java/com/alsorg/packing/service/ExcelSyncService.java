package com.alsorg.packing.service;

import java.io.File;

import org.apache.poi.sl.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.alsorg.packing.domain.analytics.DriverLog;
import com.alsorg.packing.repository.DriverLogRepository;

@Service
public class ExcelSyncService {

    private final DriverLogRepository repo;

    public ExcelSyncService(DriverLogRepository repo) {
        this.repo = repo;
    }

    @Scheduled(fixedRate = 120000)
    public void syncExcel() {

        try {

            File file = new File("C:/data/driver.xlsx");

            if (!file.exists()) return;

            XSSFWorkbook wb = new XSSFWorkbook(file);
            XSSFSheet sheet = wb.getSheetAt(0);

            repo.deleteAll(); // 🔥 prevent duplicates

            for (Row row : sheet) {

                if (row.getRowNum() == 0) continue;

                DriverLog log = new DriverLog();

                log.setDriverName(row.getCell(0).toString());
                log.setTrips((int) row.getCell(1).getNumericCellValue());
                log.setLoaders((int) row.getCell(2).getNumericCellValue());
                log.setCreatedAt(java.time.LocalDateTime.now());

                log.setSource("EXCEL");

                repo.save(log);
            }

            wb.close();

        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}