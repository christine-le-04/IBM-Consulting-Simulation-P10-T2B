-- Demo content for Choose contact: two distracting contacts in each of three
-- scenarios, and a stakeholder research passage that points to the decision
-- maker's role (without naming them) so the right contact can be found.
--
--   0313 AeroVector Aviation Coastal: predictive maintenance control
--   0405 Momentum Auto Group Atlas:   connected service experience
--   0391 NexaLearn Institute Atlas:   enrolment journey redesign

-- 1. Decision makers: drop the generated region word from the name
--    ("Elena Vargas Coastal" -> "Elena Vargas") so they read like the distractors.
UPDATE personas SET name = 'Elena Vargas', updated_at = NOW(), version = version + 1
WHERE id = '63000000-0000-0000-0000-000000000313';
UPDATE personas SET name = 'Harper Nguyen', updated_at = NOW(), version = version + 1
WHERE id = '63000000-0000-0000-0000-000000000405';
UPDATE personas SET name = 'Aisha Robinson', updated_at = NOW(), version = version + 1
WHERE id = '63000000-0000-0000-0000-000000000391';

UPDATE leads SET decision_maker = 'Elena Vargas, VP Asset Operations', updated_at = NOW(), version = version + 1
WHERE scenario_id = '62000000-0000-0000-0000-000000000313' AND decision_maker LIKE 'Elena Vargas Coastal%';
UPDATE leads SET decision_maker = 'Harper Nguyen, Director of Customer Experience', updated_at = NOW(), version = version + 1
WHERE scenario_id = '62000000-0000-0000-0000-000000000405' AND decision_maker LIKE 'Harper Nguyen Atlas%';
UPDATE leads SET decision_maker = 'Aisha Robinson, Chief Student Experience Officer', updated_at = NOW(), version = version + 1
WHERE scenario_id = '62000000-0000-0000-0000-000000000391' AND decision_maker LIKE 'Aisha Robinson Atlas%';

-- 2. Distracting contacts. They never reach the AI, so the AI fields stay empty.
INSERT INTO personas (
    id, scenario_id, name, job_title, organisation, visible_concerns,
    contact_role, decline_reply, hint_reply, prompt_version, created_at, updated_at, version
)
SELECT v.id::uuid, v.scenario_id::uuid, v.name, v.job_title, dm.organisation, v.visible_concerns,
       'DISTRACTOR', v.decline_reply, v.hint_reply, 1, NOW(), NOW(), 0
FROM (VALUES
    -- AeroVector (difficulty 3): one hint names the decision maker.
    ('66000000-0000-0000-0313-000000000001', '62000000-0000-0000-0000-000000000313',
     '63000000-0000-0000-0000-000000000313',
     'Dan Whitaker', 'Head of Line Maintenance',
     'Technicians are losing shift time chasing parts and paperwork.',
     'Thanks for getting in touch, but maintenance systems are not something I can take forward.',
     'Thanks for reaching out. My crews would welcome better tools, but I don''t set priorities or budget for maintenance systems. That sits with Elena Vargas in Asset Operations, and she''s the one under pressure on dispatch reliability right now.'),
    ('66000000-0000-0000-0313-000000000002', '62000000-0000-0000-0000-000000000313',
     '63000000-0000-0000-0000-000000000313',
     'Priya Nair', 'IT Systems Manager, MRO & Telemetry',
     'Keeping the MRO and telemetry platforms stable through the next upgrade window.',
     'I appreciate the note, but I''m not able to take vendor meetings. My team supports the systems; decisions about new capabilities come from the business side.',
     NULL),

    -- Momentum Auto (difficulty 4): hints point to a place or programme, not a name.
    ('66000000-0000-0000-0405-000000000001', '62000000-0000-0000-0000-000000000405',
     '63000000-0000-0000-0000-000000000405',
     'Rob Castellano', 'Service Manager, Flagship Dealership',
     'Service bays are full, but customers aren''t coming back for their second service.',
     'Thanks, but I''m not the right person for this.',
     'Happy to chat, but I run one dealership''s service floor. Group-wide programmes are decided at head office, so I''m not the right person for this.'),
    ('66000000-0000-0000-0405-000000000002', '62000000-0000-0000-0000-000000000405',
     '63000000-0000-0000-0000-000000000405',
     'Mei Tanaka', 'Head of Warranty Operations',
     'Warranty claims data is inconsistent across dealers.',
     'Thanks, but warranty doesn''t own this kind of work.',
     'Thanks, but warranty doesn''t own the customer experience work. You''d want whoever is leading the after-sales growth programme.'),

    -- NexaLearn (difficulty 4): Tom Fraser is the deliberate trap for
    -- "enrolment journey"; the hint points to the programme, not a name.
    ('66000000-0000-0000-0391-000000000001', '62000000-0000-0000-0000-000000000391',
     '63000000-0000-0000-0000-000000000391',
     'Tom Fraser', 'Admissions Manager',
     'Applicants drop off between offer and enrolment.',
     'Thanks, but I can''t approve anything like this.',
     'My team handles offers and admissions day to day, but changes to the student journey go through the retention improvement programme. I can''t approve anything like this.'),
    ('66000000-0000-0000-0391-000000000002', '62000000-0000-0000-0000-000000000391',
     '63000000-0000-0000-0000-000000000391',
     'Dr Lena Park', 'Head of Learning Technology',
     'The student information and learning systems don''t talk to each other.',
     'We''d be involved in any system changes, but we don''t start projects. They come to us from student experience leadership.',
     NULL)
) AS v(id, scenario_id, decision_maker_id, name, job_title, visible_concerns, decline_reply, hint_reply)
JOIN personas dm ON dm.id = v.decision_maker_id::uuid
ON CONFLICT (id) DO NOTHING;

-- 3. Research clue: replace the neutral "Influence boundary" stakeholder
--    passage with one that points to the decision maker's role.
UPDATE document_chunks
SET content = 'Influence boundary. Fleet availability and dispatch reliability targets sit with Asset Operations, which reports reliability to the executive committee. Line maintenance and IT support delivery but do not hold budget for new capabilities.',
    updated_at = NOW(), version = version + 1
WHERE scenario_id = '62000000-0000-0000-0000-000000000313'
  AND collection = 'RESEARCH_STAKEHOLDER' AND chunk_index = 2;

UPDATE document_chunks
SET content = 'Influence boundary. The after-sales growth programme is sponsored from head office by the Customer Experience function. Dealer service managers implement changes locally but do not initiate group-wide programmes.',
    updated_at = NOW(), version = version + 1
WHERE scenario_id = '62000000-0000-0000-0000-000000000405'
  AND collection = 'RESEARCH_STAKEHOLDER' AND chunk_index = 2;

UPDATE document_chunks
SET content = 'Influence boundary. The retention improvement programme is led by the executive accountable for the missed first-year retention target. Admissions and learning technology teams contribute but do not approve changes to the student journey.',
    updated_at = NOW(), version = version + 1
WHERE scenario_id = '62000000-0000-0000-0000-000000000391'
  AND collection = 'RESEARCH_STAKEHOLDER' AND chunk_index = 2;

-- 4. The "why" behind each demo company's numbers, spread across the research
--    sources. The financial summary shows what is happening; these passages
--    explain the cause, and the learner has to connect them in a hypothesis.

-- AeroVector: margin falls because faults are found late -> costly unplanned repairs.
UPDATE document_chunks SET content = 'Operating report. Dispatch reliability has been below target for three consecutive quarters. Most cancellations trace back to aircraft grounded for unplanned repairs, not to scheduled maintenance checks.', updated_at = NOW(), version = version + 1
WHERE scenario_id = '62000000-0000-0000-0000-000000000313' AND collection = 'RESEARCH_COMPANY_NEWS' AND chunk_index = 1;
UPDATE document_chunks SET content = 'Materiality signal. Maintenance spend rose 18% over two years. The increase is concentrated in overtime and short-notice spare parts ordered after unexpected faults, not in the planned maintenance programme.', updated_at = NOW(), version = version + 1
WHERE scenario_id = '62000000-0000-0000-0000-000000000313' AND collection = 'RESEARCH_FINANCIAL' AND chunk_index = 1;
UPDATE document_chunks SET content = 'Information-flow context. Aircraft health sensors record engine and component data on every flight, but engineers only review it by hand after the fact. It is not connected to the maintenance planning system, so developing faults are found only once they cause a defect.', updated_at = NOW(), version = version + 1
WHERE scenario_id = '62000000-0000-0000-0000-000000000313' AND collection = 'RESEARCH_TECHNOLOGY' AND chunk_index = 1;

-- Momentum Auto: customers don't come back for a second service -> after-sales income falls.
UPDATE document_chunks SET content = 'Operating report. Customers return for their first service but not their second. Complaint logs mention hard-to-book appointments and never being reminded that a service was due.', updated_at = NOW(), version = version + 1
WHERE scenario_id = '62000000-0000-0000-0000-000000000405' AND collection = 'RESEARCH_COMPANY_NEWS' AND chunk_index = 1;
UPDATE document_chunks SET content = 'Materiality signal. After-sales revenue fell 9% last year while new-car sales held steady. Every customer who stops coming back for servicing also takes their parts and warranty work elsewhere.', updated_at = NOW(), version = version + 1
WHERE scenario_id = '62000000-0000-0000-0000-000000000405' AND collection = 'RESEARCH_FINANCIAL' AND chunk_index = 1;
UPDATE document_chunks SET content = 'Information-flow context. Connected-car data shows when each vehicle is due for a service, but it stays with the manufacturer. It is never passed to the dealers'' booking systems, so reminders go out late or not at all.', updated_at = NOW(), version = version + 1
WHERE scenario_id = '62000000-0000-0000-0000-000000000405' AND collection = 'RESEARCH_TECHNOLOGY' AND chunk_index = 1;

-- NexaLearn: new students stall between offer and first week -> first-year attrition -> lost income.
UPDATE document_chunks SET content = 'Operating report. First-year attrition reached 19% against a 12% target. Exit surveys point to the weeks between offer and first class: students did not know which steps to complete or who to ask.', updated_at = NOW(), version = version + 1
WHERE scenario_id = '62000000-0000-0000-0000-000000000391' AND collection = 'RESEARCH_COMPANY_NEWS' AND chunk_index = 1;
UPDATE document_chunks SET content = 'Materiality signal. Each student who leaves in first year takes three years of tuition income with them. Attrition is the main reason the operating margin fell from 2.7% to 0.8%.', updated_at = NOW(), version = version + 1
WHERE scenario_id = '62000000-0000-0000-0000-000000000391' AND collection = 'RESEARCH_FINANCIAL' AND chunk_index = 1;
UPDATE document_chunks SET content = 'Information-flow context. Offers, enrolment and orientation run on three systems that do not share a student record, so the institute cannot see which new students have stalled part-way through enrolling.', updated_at = NOW(), version = version + 1
WHERE scenario_id = '62000000-0000-0000-0000-000000000391' AND collection = 'RESEARCH_TECHNOLOGY' AND chunk_index = 1;
