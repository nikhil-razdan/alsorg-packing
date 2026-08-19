package com.alsorg.packing.config;

import java.util.List;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import com.alsorg.packing.service.ClientMasterService;

/**
 * Idempotent initial import of the client names supplied in
 * "Clients Name Details.xlsx" on 19-Aug-2026.
 *
 * The source workbook contains names only, so no address data is invented.
 * ClientMasterService applies normalized-name duplicate protection, therefore
 * repeated workbook rows are safely ignored on every application restart.
 */
@Component
public class ClientMasterSeedRunner implements ApplicationRunner {

    private static final String SOURCE = "XLSX_SEED_2026-08-19";

    private static final List<String> CLIENT_NAMES = List.of(
            "Mr. Kamal Jain",
            "Mr. Bhatia",
            "Mr. Rajiv Patel",
            "Mr. Kundu Residence",
            "Mr. B 32",
            "Mr. Nma",
            "Mrs. Begha Bhatia",
            "Mr. 209 Janwara",
            "Mr. Neeraj Jain",
            "Mr. Vishnu Gupta",
            "Mr. Aneesh Goel",
            "Mrs. Soumya Narayan",
            "Mrs. Mamta Residence",
            "Mr. Trevoc Gallery",
            "Mr. Pankaj Aggarwal",
            "Mr. BMW Showroom",
            "Mr. Tarun Nayar",
            "Mr. BGJ Jamnagar",
            "Mr. Shiv Kumar Gupta",
            "Mr. Rohit Aggarwal",
            "Mr. Abhishek Mittal",
            "Mr. Sajal Sir",
            "Mr. Rajdeep Mann",
            "Mrs. Natasha Koccher(LTDF Office)",
            "Mr. Aggarwal Villa",
            "Caitriona Block-A",
            "Caitriona Block-B",
            "Caitriona Block-C",
            "Caitriona Block-D",
            "Caitriona Block-F",
            "Caitriona Block-E",
            "Caitriona Block-I",
            "Mr. Jaquar",
            "Mr. Brijesh Thakkar",
            "Mr. Anil Gupta",
            "Mrs. Savitri",
            "Mr. Ajay Kakkar",
            "Ms. Muskan Khanna",
            "Mrs. Pooja Lamba",
            "Mrs. Geetha",
            "Mr. Ankit Garg",
            "Mr. Prem Manjali",
            "Mr. Rahul Chugh",
            "Colaba House",
            "Mr. Nipul Dadhania",
            "Mr. Megha Bhatia",
            "Ms. Garg Residence",
            "Ms. SKG",
            "Ms. Mainis Farm",
            "Ms. Ambience Mall",
            "RRD",
            "Mr. Ashok Mann",
            "Mr. Rajeev Rattan",
            "Mr. Dheeraj Kohli",
            "Mrs. Ishita Jain",
            "Mr. Vivek Nagpal",
            "Mr. Naveen Reddy",
            "Ms. Indore Showroom",
            "Mr. Bajaj Nagar",
            "Ms. Pagaria",
            "Mr. Ramesh Aggarwal",
            "Mr. Jitender Singh",
            "Mr. Kapoor Villa",
            "Mr. Aayush",
            "Ms. Ava Décorgeous",
            "Mr. Tushar Malthora",
            "Mrs. Nikita",
            "Mr. Baived Kanodia",
            "Mrs. Sonali Rastogi",
            "Mr. Kapil Bharti",
            "Mr. Avadh Paloma",
            "Mr. Hitesh Bansal",
            "Mr. Rajesh Bhandari");

    private final ClientMasterService clientMasterService;

    public ClientMasterSeedRunner(
            ClientMasterService clientMasterService) {
        this.clientMasterService = clientMasterService;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            clientMasterService.seedNames(
                    CLIENT_NAMES,
                    SOURCE,
                    "SYSTEM");
        } catch (RuntimeException exception) {
            /*
             * Client master initialization must never make PackFlow unavailable.
             * A migration/configuration issue can be fixed independently and the
             * admin can also maintain the shared master through its UI.
             */
            System.err.println(
                    "Client Master XLSX seed skipped: "
                            + exception.getMessage());
        }
    }
}
