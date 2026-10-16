"""Fail CI if any Testcontainers test class is absent, empty, skipped, or failing."""

import argparse
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET


def required_classes(sources: Path) -> list[str]:
    classes = []
    for source in sorted(sources.rglob("*.java")):
        text = source.read_text(encoding="utf-8")
        if not re.search(r"^\s*@Testcontainers\b", text, re.MULTILINE):
            continue
        package = re.search(r"^package\s+([\w.]+)\s*;", text, re.MULTILINE)
        if package is None:
            raise ValueError(f"Cannot determine the package of {source}")
        classes.append(f"{package.group(1)}.{source.stem}")
    if not classes:
        raise ValueError(f"No Testcontainers test classes found under {sources}")
    return classes


def check_reports(sources: Path, reports: Path) -> tuple[int, list[str]]:
    required = required_classes(sources)
    problems = []
    for name in required:
        report = reports / f"TEST-{name}.xml"
        if not report.is_file():
            problems.append(f"{name}: missing test report")
            continue
        try:
            suite = ET.parse(report).getroot()
            tests = int(suite.attrib["tests"])
            skipped = int(suite.get("skipped", "0"))
            failures = int(suite.get("failures", "0"))
            errors = int(suite.get("errors", "0"))
            cases = suite.findall("testcase")
            if suite.tag != "testsuite" or suite.get("name") != name:
                problems.append(f"{name}: unexpected test suite in report")
            elif tests <= 0 or not cases:
                problems.append(f"{name}: no executed test cases")
            elif skipped or any(case.find("skipped") is not None for case in cases):
                problems.append(f"{name}: skipped tests; required PostgreSQL tests must run")
            elif failures or errors or any(case.find("failure") is not None or case.find("error") is not None for case in cases):
                problems.append(f"{name}: failed tests")
        except (ET.ParseError, KeyError, ValueError, OSError) as error:
            problems.append(f"{name}: invalid report ({error})")
    return len(required), problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sources", type=Path, default=Path("apps/api/src/test/java"))
    parser.add_argument("--reports", type=Path, default=Path("apps/api/build/test-results/test"))
    args = parser.parse_args()
    try:
        count, problems = check_reports(args.sources, args.reports)
    except (ValueError, OSError) as error:
        print(f"Database test enforcement failed: {error}", file=sys.stderr)
        return 1
    if problems:
        print("Database test enforcement failed:\n" + "\n".join(problems), file=sys.stderr)
        return 1
    print(f"Verified {count} required database test classes: executed successfully, none skipped.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
