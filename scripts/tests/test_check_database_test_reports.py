import importlib.util
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "check_database_test_reports.py"
SPEC = importlib.util.spec_from_file_location("check_database_test_reports", SCRIPT)
checker = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(checker)


class DatabaseTestReportEnforcementTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.sources = Path(self.directory.name) / "sources"
        self.reports = Path(self.directory.name) / "reports"
        self.sources.mkdir()
        self.reports.mkdir()
        self.source("DatabaseIntegrationTest")

    def source(self, name):
        (self.sources / f"{name}.java").write_text(
            f"package example;\n@Testcontainers(disabledWithoutDocker = true)\nclass {name} {{}}\n", encoding="utf-8")

    def report(self, name="DatabaseIntegrationTest", attributes='tests="1" skipped="0" failures="0" errors="0"', case="<testcase name=\"runs\"/>"):
        (self.reports / f"TEST-example.{name}.xml").write_text(
            f'<testsuite name="example.{name}" {attributes}>{case}</testsuite>', encoding="utf-8")

    def check(self):
        return checker.check_reports(self.sources, self.reports)

    def test_accepts_successfully_executed_database_tests(self):
        self.report()
        self.assertEqual(self.check(), (1, []))

    def test_rejects_docker_unavailable_class_level_skip(self):
        self.report(attributes='tests="1" skipped="1"', case='<testcase name="container unavailable"><skipped/></testcase>')
        self.assertIn("skipped tests", self.check()[1][0])

    def test_rejects_skipped_case_even_if_summary_claims_success(self):
        self.report(case='<testcase name="skipped"><skipped/></testcase>')
        self.assertIn("skipped tests", self.check()[1][0])

    def test_new_container_test_classes_are_required_automatically(self):
        self.report()
        self.source("NewDatabaseTest")
        count, problems = self.check()
        self.assertEqual(count, 2)
        self.assertEqual(problems, ["example.NewDatabaseTest: missing test report"])

    def test_rejects_empty_failed_and_malformed_reports(self):
        for attributes, case, expected in [
            ('tests="0"', '', 'no executed test cases'),
            ('tests="1" failures="1"', '<testcase name="fails"><failure/></testcase>', 'failed tests'),
            ('tests="1" errors="1"', '<testcase name="errors"><error/></testcase>', 'failed tests'),
            ('tests="invalid"', '<testcase/>', 'invalid report'),
        ]:
            with self.subTest(expected=expected):
                self.report(attributes=attributes, case=case)
                self.assertIn(expected, self.check()[1][0])
        (self.reports / 'TEST-example.DatabaseIntegrationTest.xml').write_text('<broken', encoding='utf-8')
        self.assertIn('invalid report', self.check()[1][0])

    def test_wrong_source_path_cannot_report_success(self):
        with self.assertRaisesRegex(ValueError, 'No Testcontainers'):
            checker.check_reports(self.sources / 'missing', self.reports)

    def test_cli_returns_failure_for_missing_reports_and_success_for_executed_tests(self):
        command = [sys.executable, str(SCRIPT), '--sources', str(self.sources), '--reports', str(self.reports)]
        missing = subprocess.run(command, capture_output=True, text=True, check=False)
        self.assertEqual(missing.returncode, 1)
        self.assertIn('missing test report', missing.stderr)
        self.report()
        success = subprocess.run(command, capture_output=True, text=True, check=False)
        self.assertEqual(success.returncode, 0)
        self.assertIn('none skipped', success.stdout)


if __name__ == '__main__':
    unittest.main()
