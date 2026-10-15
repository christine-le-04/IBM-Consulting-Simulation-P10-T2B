package com.ibm.consulting.sim.shared.infrastructure;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.zip.CRC32;
import static org.assertj.core.api.Assertions.assertThat;

class MigrationVersionHistoryTest {
    @Test void migrationVersionsAreUniqueEvenWithoutDocker() throws Exception {
        var versions = new HashSet<String>();
        var pattern = Pattern.compile("^V([0-9]+)__.*\\.sql$");
        for (var resource : new PathMatchingResourcePatternResolver().getResources("classpath*:db/migration/V*.sql")) {
            var match = pattern.matcher(resource.getFilename());
            assertThat(match.matches()).as(resource.getFilename()).isTrue();
            assertThat(versions.add(match.group(1))).as("Duplicate migration version: " + resource.getFilename()).isTrue();
        }
        assertThat(versions).contains("69", "70", "71", "72", "73", "74", "75");
    }

    @Test void previouslyAppliedAchievementMigrationsRetainTheirDatabaseChecksums() throws Exception {
        // Values from the existing database's Flyway history, not new replacement scripts.
        var applied = Map.of("V69__exclusive_achievements.sql", 515785325,
                "V70__seed_starter_achievements.sql", -2057732765,
                "V71__remove_achievements_earned_without_a_run.sql", 2050876655);
        for (var entry : applied.entrySet()) {
            CRC32 checksum = new CRC32();
            try (var reader = new BufferedReader(new InputStreamReader(
                    new ClassPathResource("db/migration/" + entry.getKey()).getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) checksum.update(line.getBytes(StandardCharsets.UTF_8));
            }
            assertThat((int) checksum.getValue()).as(entry.getKey()).isEqualTo(entry.getValue());
        }
    }
}
