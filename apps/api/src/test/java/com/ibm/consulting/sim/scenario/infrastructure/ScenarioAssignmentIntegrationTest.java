package com.ibm.consulting.sim.scenario.infrastructure;

import com.ibm.consulting.sim.identity.domain.User;
import com.ibm.consulting.sim.identity.domain.UserDirectoryPage;
import com.ibm.consulting.sim.identity.domain.UserDirectoryQuery;
import com.ibm.consulting.sim.identity.domain.UserRepository;
import com.ibm.consulting.sim.identity.domain.UserRole;
import com.ibm.consulting.sim.scenario.application.ScenarioAssignmentService;
import com.ibm.consulting.sim.scenario.application.ScenarioAssignmentView;
import com.ibm.consulting.sim.scenario.domain.Scenario;
import com.ibm.consulting.sim.scenario.domain.ScenarioAssignment;
import com.ibm.consulting.sim.scenario.domain.ScenarioAssignmentRepository;
import com.ibm.consulting.sim.scenario.domain.ScenarioCatalogPage;
import com.ibm.consulting.sim.scenario.domain.ScenarioCatalogQuery;
import com.ibm.consulting.sim.scenario.domain.ScenarioRepository;
import com.ibm.consulting.sim.shared.infrastructure.observability.AuditLogger;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataAccessException;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Callable;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

/**
 * Runs the real Flyway migrations (V1–V64) on Postgres, so Hibernate's schema
 * validation also proves the {@link ScenarioAssignment} mapping matches V64.
 * Every scenario and user is created with a unique token, so the seeded demo
 * scenarios never affect the assertions.
 */
@DataJpaTest
@Import({JpaScenarioRepository.class, JpaScenarioAssignmentRepository.class})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class ScenarioAssignmentIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(
            DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired EntityManager entityManager;
    @Autowired ScenarioRepository scenarioRepository;
    @Autowired ScenarioAssignmentRepository assignmentRepository;
    @Autowired PlatformTransactionManager transactionManager;

    @Test
    void consultantQueriesOnlyReturnLiveScenariosInTheirAssignedLineages() {
        String token = token();
        User ada = inTransaction(() -> persistUser("Ada", UserRole.LEARNER));
        User bob = inTransaction(() -> persistUser("Bob", UserRole.LEARNER));
        Scenario assignedLive = inTransaction(() -> persistScenario("Assigned live " + token, "Assigned " + token, true));
        Scenario unassignedLive = inTransaction(() -> persistScenario("Unassigned live " + token, "Unassigned " + token, true));
        Scenario assignedDraft = inTransaction(() -> persistScenario("Assigned draft " + token, "Draft " + token, false));
        Scenario assignedArchived = inTransaction(() -> {
            Scenario scenario = persistScenario("Assigned archived " + token, "Archived " + token, true);
            scenario.archive();
            return scenario;
        });
        inTransaction(() -> assignmentRepository.saveAll(List.of(
                ScenarioAssignment.assign(assignedLive.getScenarioLineageId(), ada.getId(), null),
                ScenarioAssignment.assign(assignedDraft.getScenarioLineageId(), ada.getId(), null),
                ScenarioAssignment.assign(assignedArchived.getScenarioLineageId(), ada.getId(), null))));

        // Plain list: only Ada's live, assigned scenario.
        assertThat(inTransaction(() -> scenarioRepository.findAllActiveAssignedTo(ada.getId())))
                .extracting(Scenario::getId).containsExactly(assignedLive.getId());
        assertThat(inTransaction(() -> scenarioRepository.findAllActiveAssignedTo(bob.getId()))).isEmpty();

        // Paged catalogue: the subquery must keep both the page and its count correct.
        ScenarioCatalogPage adaPage = inTransaction(() -> scenarioRepository.findCatalog(
                new ScenarioCatalogQuery(token, null, null, 0, 24).forAssignee(ada.getId())));
        assertThat(adaPage.items()).extracting(Scenario::getId).containsExactly(assignedLive.getId());
        assertThat(adaPage.totalElements()).isEqualTo(1);

        ScenarioCatalogPage bobPage = inTransaction(() -> scenarioRepository.findCatalog(
                new ScenarioCatalogQuery(token, null, null, 0, 24).forAssignee(bob.getId())));
        assertThat(bobPage.items()).isEmpty();
        assertThat(bobPage.totalElements()).isZero();

        // Without an assignee filter (staff), every live scenario is still found.
        ScenarioCatalogPage staffPage = inTransaction(() -> scenarioRepository.findCatalog(
                new ScenarioCatalogQuery(token, null, null, 0, 24)));
        assertThat(staffPage.items()).extracting(Scenario::getId)
                .containsExactlyInAnyOrder(assignedLive.getId(), unassignedLive.getId());

        // Industry facets follow the same rule.
        assertThat(inTransaction(() -> scenarioRepository.findCatalogIndustriesAssignedTo(ada.getId())))
                .containsExactly("Assigned " + token);
        assertThat(inTransaction(() -> scenarioRepository.findCatalogIndustriesAssignedTo(bob.getId()))).isEmpty();
    }

    @Test
    void assignmentsFollowTheLineageToANewlyPublishedRevision() {
        String token = token();
        User ada = inTransaction(() -> persistUser("Ada", UserRole.LEARNER));
        Scenario original = inTransaction(() -> persistScenario("Revised " + token, "Revised " + token, true));
        inTransaction(() -> assignmentRepository.saveAll(List.of(
                ScenarioAssignment.assign(original.getScenarioLineageId(), ada.getId(), null))));

        Scenario revision = inTransaction(() -> {
            Scenario managed = entityManager.find(Scenario.class, original.getId());
            managed.archive();
            // One live revision per lineage is enforced by a unique index, so retire v1 first.
            entityManager.flush();
            Scenario next = managed.createRevision(2);
            next.publish();
            entityManager.persist(next);
            entityManager.flush();
            return next;
        });

        assertThat(inTransaction(() -> scenarioRepository.findAllActiveAssignedTo(ada.getId())))
                .extracting(Scenario::getId).containsExactly(revision.getId());
    }

    @Test
    void aConsultantCanOnlyBeAssignedOncePerScenario() {
        User ada = inTransaction(() -> persistUser("Ada", UserRole.LEARNER));
        Scenario scenario = inTransaction(() -> persistScenario("Duplicate " + token(), "Duplicate", true));
        inTransaction(() -> assignmentRepository.saveAll(List.of(
                ScenarioAssignment.assign(scenario.getScenarioLineageId(), ada.getId(), null))));

        assertThatThrownBy(() -> inTransaction(() -> {
            assignmentRepository.saveAll(List.of(ScenarioAssignment.assign(scenario.getScenarioLineageId(), ada.getId(), null)));
            entityManager.flush();
            return null;
        })).isInstanceOfAny(DataAccessException.class, PersistenceException.class);
    }

    @Test
    void deletingAUserRemovesTheirAssignments() {
        User ada = inTransaction(() -> persistUser("Ada", UserRole.LEARNER));
        Scenario scenario = inTransaction(() -> persistScenario("Cascade " + token(), "Cascade", true));
        inTransaction(() -> assignmentRepository.saveAll(List.of(
                ScenarioAssignment.assign(scenario.getScenarioLineageId(), ada.getId(), null))));

        inTransaction(() -> entityManager.createNativeQuery("delete from users where id = :id")
                .setParameter("id", ada.getId()).executeUpdate());

        assertThat(inTransaction(() -> assignmentRepository.findByLineageId(scenario.getScenarioLineageId()))).isEmpty();
    }

    @Test
    void theServiceReplacesAssignmentsInTheDatabaseAndDrivesTheStartRule() {
        User ada = inTransaction(() -> persistUser("Ada", UserRole.LEARNER));
        User bob = inTransaction(() -> persistUser("Bob", UserRole.LEARNER));
        User author = inTransaction(() -> persistUser("Author", UserRole.SCENARIO_AUTHOR));
        Scenario scenario = inTransaction(() -> persistScenario("Service " + token(), "Service", true));
        ScenarioAssignmentService service = new ScenarioAssignmentService(
                assignmentRepository, scenarioRepository, new EntityManagerUserRepository(), mock(AuditLogger.class));

        inTransaction(() -> service.replaceAssignments(scenario.getId(), List.of(ada.getId(), bob.getId()), author.getId()));
        ScenarioAssignmentView afterSecondSave = inTransaction(
                () -> service.replaceAssignments(scenario.getId(), List.of(bob.getId()), author.getId()));

        assertThat(afterSecondSave.scenarioLineageId()).isEqualTo(scenario.getScenarioLineageId());
        assertThat(afterSecondSave.assignees()).extracting(ScenarioAssignmentView.Assignee::displayName)
                .containsExactly(bob.getDisplayName());
        assertThat(inTransaction(() -> assignmentRepository.findByLineageId(scenario.getScenarioLineageId())))
                .singleElement().satisfies(row -> assertThat(row.getAssignedBy()).isEqualTo(author.getId()));

        assertThat(inTransaction(() -> service.canStart(ada.getId(), scenario))).isFalse();
        assertThat(inTransaction(() -> service.canStart(bob.getId(), scenario))).isTrue();
        assertThat(inTransaction(() -> service.canStart(author.getId(), scenario))).isTrue();
    }

    // ─── Fixtures ─────────────────────────────────────────────────────────

    private static String token() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    private User persistUser(String name, UserRole role) {
        User user = User.create(name.toLowerCase() + "-" + UUID.randomUUID() + "@example.com", "hash",
                name + " " + token(), role);
        entityManager.persist(user);
        entityManager.flush();
        return user;
    }

    private Scenario persistScenario(String title, String industry, boolean live) {
        Scenario scenario = Scenario.create(title, industry, "Integration test scenario", 3);
        if (live) scenario.publish();
        entityManager.persist(scenario);
        entityManager.flush();
        return scenario;
    }

    private <T> T inTransaction(Callable<T> work) {
        return new TransactionTemplate(transactionManager).execute(status -> {
            try {
                return work.call();
            } catch (RuntimeException exception) {
                throw exception;
            } catch (Exception exception) {
                throw new IllegalStateException(exception);
            }
        });
    }

    /** Only lookups are needed by the assignment service. */
    private final class EntityManagerUserRepository implements UserRepository {
        @Override public Optional<User> findById(UUID id) { return Optional.ofNullable(entityManager.find(User.class, id)); }
        @Override public Optional<User> findByIdForUpdate(UUID id) { return findById(id); }
        @Override public User save(User user) { throw new UnsupportedOperationException(); }
        @Override public User saveAndFlush(User user) { throw new UnsupportedOperationException(); }
        @Override public Optional<User> findByEmail(String email) { throw new UnsupportedOperationException(); }
        @Override public Optional<User> findByEmailForUpdate(String email) { throw new UnsupportedOperationException(); }
        @Override public boolean existsByEmail(String email) { throw new UnsupportedOperationException(); }
        @Override public long countByRoleAndActive(UserRole role, boolean active) { throw new UnsupportedOperationException(); }
        @Override public List<User> findAll() { throw new UnsupportedOperationException(); }
        @Override public UserDirectoryPage findDirectory(UserDirectoryQuery query) { throw new UnsupportedOperationException(); }
        @Override public void delete(User user) { throw new UnsupportedOperationException(); }
    }
}
