-- Earlier retry logic labelled evaluated, retryable failures as PENDING.
-- The result of each scored attempt is LOST; submission_count controls retry eligibility.
UPDATE proposals SET decision = 'LOST'
WHERE status = 'SUBMITTED' AND decision = 'PENDING'
  AND submission_count > 0 AND client_decision_outcome IS NOT NULL;
