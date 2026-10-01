-- ═══════════════════════════════════════════════════════════════════════════
-- One company, several problems.
--
-- V33 generated 24 near-identical scenarios per company. Each company now has
-- 2-3 scenarios, each a different problem with its own fixed complexity (see
-- "Scenario content drafts"). Existing rows are reused so they keep their
-- seeded research sources:
--   * each company keeps one row per approved problem;
--   * problems whose content is written are ACTIVE; the rest wait as DRAFT
--     (hidden) until their content batch is added;
--   * every other generated copy is ARCHIVED: hidden from the catalogue, but
--     existing test engagements on them keep working.
-- Titles lose the generated region and number:
--   "AeroVector Aviation Coastal 0313: predictive maintenance control"
--   -> "AeroVector Aviation: predictive maintenance control".
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. The approved problems.
CREATE TEMP TABLE v55_problem (
    vertical INT NOT NULL, slot INT NOT NULL, company TEXT NOT NULL, opportunity TEXT NOT NULL,
    complexity INT NOT NULL, fixed_number INT, written BOOLEAN NOT NULL
) ON COMMIT DROP;
INSERT INTO v55_problem VALUES
    (1, 1, 'AeroVector Aviation', 'predictive maintenance control', 3, 313, TRUE),
    (2, 1, 'HarbourGrid Utilities', 'outage response orchestration', 3, NULL, TRUE),
    (3, 1, 'CivicLink Services', 'service request triage', 2, NULL, TRUE),
    (4, 1, 'GreenSpan Developments', 'portfolio delivery assurance', 4, NULL, TRUE),
    (5, 1, 'Wavefront Media Group', 'audience data activation', 3, NULL, TRUE),
    (6, 1, 'Horizon Hotels Collective', 'property service consistency', 3, NULL, TRUE),
    (7, 1, 'NexaLearn Institute', 'enrolment journey redesign', 4, 391, TRUE),
    (8, 1, 'BlueCurrent Water', 'leak response visibility', 3, NULL, TRUE),
    (9, 1, 'Mosaic Foods Cooperative', 'supplier quality coordination', 3, NULL, TRUE),
    (10, 1, 'LumaCare Clinics', 'care-capacity optimisation', 4, NULL, TRUE),
    (11, 1, 'Ironwood Manufacturing', 'quality and downtime reduction', 3, NULL, TRUE),
    (12, 1, 'Verdant Retail Bank', 'KYC workflow improvement', 4, NULL, TRUE),
    (13, 1, 'Pathfinder Mobility', 'last-mile delivery control', 3, NULL, TRUE),
    (14, 1, 'Keystone Legal Services', 'knowledge and staffing optimisation', 3, NULL, TRUE),
    (15, 1, 'Northstar Telecom', 'incident triage modernisation', 4, NULL, TRUE),
    (16, 1, 'Solaris Life Sciences', 'trial site visibility', 4, NULL, TRUE),
    (17, 1, 'Granite Insurance', 'straight-through claims processing', 3, NULL, TRUE),
    (18, 1, 'Cobalt Mining Group', 'shutdown planning assurance', 4, NULL, TRUE),
    (19, 1, 'Arbor Social Housing', 'tenant service recovery', 3, NULL, TRUE),
    (20, 1, 'Brightline Consumer Goods', 'trade promotion execution', 3, NULL, TRUE),
    (21, 1, 'Momentum Auto Group', 'connected service experience', 4, 405, TRUE),
    (22, 1, 'Meridian Cloudworks', 'customer onboarding acceleration', 3, NULL, TRUE),
    (23, 1, 'Coastal State Government', 'casework transparency', 4, NULL, TRUE),
    (24, 1, 'CommonGround Foundation', 'funding outcome visibility', 3, NULL, TRUE),
    (1, 2, 'AeroVector Aviation', 'gate turnaround delays', 2, NULL, TRUE),
    (1, 3, 'AeroVector Aviation', 'crew rostering disruption', 4, NULL, TRUE),
    (2, 2, 'HarbourGrid Utilities', 'smart-meter billing errors', 2, NULL, FALSE),
    (3, 2, 'CivicLink Services', 'permit processing backlog', 3, NULL, FALSE),
    (3, 3, 'CivicLink Services', 'contractor spend visibility', 4, NULL, FALSE),
    (4, 2, 'GreenSpan Developments', 'defects at buyer handover', 2, NULL, FALSE),
    (5, 2, 'Wavefront Media Group', 'ad sales proposal turnaround', 2, NULL, FALSE),
    (5, 3, 'Wavefront Media Group', 'content rights tracking', 4, NULL, FALSE),
    (6, 2, 'Horizon Hotels Collective', 'housekeeping scheduling', 2, NULL, FALSE),
    (7, 2, 'NexaLearn Institute', 'student support ticket backlog', 2, NULL, TRUE),
    (7, 3, 'NexaLearn Institute', 'timetabling clashes across campuses', 3, NULL, TRUE),
    (8, 2, 'BlueCurrent Water', 'water quality reporting', 2, NULL, FALSE),
    (9, 2, 'Mosaic Foods Cooperative', 'cold-chain waste', 2, NULL, FALSE),
    (9, 3, 'Mosaic Foods Cooperative', 'member payment accuracy', 4, NULL, FALSE),
    (10, 2, 'LumaCare Clinics', 'appointment no-shows', 2, NULL, FALSE),
    (11, 2, 'Ironwood Manufacturing', 'spare parts inventory', 2, NULL, FALSE),
    (11, 3, 'Ironwood Manufacturing', 'supplier on-time delivery', 4, NULL, FALSE),
    (12, 2, 'Verdant Retail Bank', 'complaint handling times', 2, NULL, FALSE),
    (12, 3, 'Verdant Retail Bank', 'branch staffing', 3, NULL, FALSE),
    (13, 2, 'Pathfinder Mobility', 'fleet fuel costs', 2, NULL, FALSE),
    (14, 2, 'Keystone Legal Services', 'new matter intake', 2, NULL, FALSE),
    (14, 3, 'Keystone Legal Services', 'billing leakage', 4, NULL, FALSE),
    (15, 2, 'Northstar Telecom', 'customer churn after a price rise', 3, NULL, FALSE),
    (16, 2, 'Solaris Life Sciences', 'lab sample tracking', 2, NULL, FALSE),
    (17, 2, 'Granite Insurance', 'broker quote turnaround', 2, NULL, FALSE),
    (17, 3, 'Granite Insurance', 'fraud referral backlog', 4, NULL, FALSE),
    (18, 2, 'Cobalt Mining Group', 'haul truck fuel use', 3, NULL, FALSE),
    (19, 2, 'Arbor Social Housing', 'empty home turnaround', 2, NULL, FALSE),
    (20, 2, 'Brightline Consumer Goods', 'stock-outs at retailers', 2, NULL, FALSE),
    (20, 3, 'Brightline Consumer Goods', 'new product launch delays', 4, NULL, FALSE),
    (21, 2, 'Momentum Auto Group', 'used-car stock turnover', 3, NULL, TRUE),
    (22, 2, 'Meridian Cloudworks', 'support escalation rates', 2, NULL, FALSE),
    (22, 3, 'Meridian Cloudworks', 'cloud cost overruns', 4, NULL, FALSE),
    (23, 2, 'Coastal State Government', 'grant application drop-off', 2, NULL, FALSE),
    (24, 2, 'CommonGround Foundation', 'volunteer rostering', 2, NULL, FALSE);

-- 2. The generated copies (V33 ids end in the scenario number).
CREATE TEMP TABLE v55_copy ON COMMIT DROP AS
SELECT s.id, s.title, s.difficulty,
       right(s.id::text, 12)::int AS number,
       ((right(s.id::text, 12)::int - 1) % 24) + 1 AS vertical
FROM scenarios s
WHERE s.id::text LIKE '62000000-0000-0000-0000-%';

-- 3. Pick one copy per problem, at the problem's complexity. Each company's
--    current problem uses the demo row where there is one, otherwise the
--    lowest-numbered copy; new problems take the next unused copies.
CREATE TEMP TABLE v55_pick (scenario_id UUID PRIMARY KEY, vertical INT, slot INT) ON COMMIT DROP;

INSERT INTO v55_pick
SELECT DISTINCT ON (p.vertical) c.id, p.vertical, p.slot
FROM v55_problem p
JOIN v55_copy c ON c.vertical = p.vertical AND c.difficulty = p.complexity
WHERE p.slot = 1 AND (p.fixed_number IS NULL OR c.number = p.fixed_number)
ORDER BY p.vertical, c.number;

INSERT INTO v55_pick
SELECT c.id, p.vertical, p.slot
FROM (SELECT *, row_number() OVER (PARTITION BY vertical, complexity ORDER BY slot) AS rank
      FROM v55_problem WHERE slot > 1) p
JOIN (SELECT *, row_number() OVER (PARTITION BY vertical, difficulty ORDER BY number) AS rank
      FROM v55_copy WHERE id NOT IN (SELECT scenario_id FROM v55_pick)) c
  ON c.vertical = p.vertical AND c.difficulty = p.complexity AND c.rank = p.rank;

CREATE TEMP TABLE v55_kept ON COMMIT DROP AS
SELECT k.scenario_id, p.vertical, p.slot, p.written, p.company, c.title AS old_title,
       p.company || ': ' || p.opportunity AS new_title
FROM v55_pick k
JOIN v55_problem p ON p.vertical = k.vertical AND p.slot = k.slot
JOIN v55_copy c ON c.id = k.scenario_id;

-- 4. Kept rows get their new title and status; every other copy is archived.
UPDATE scenarios s
SET title = k.new_title,
    status = CASE WHEN k.written THEN 'ACTIVE' ELSE 'DRAFT' END,
    updated_at = NOW(), version = s.version + 1
FROM v55_kept k
WHERE s.id = k.scenario_id;

UPDATE scenarios s
SET status = 'ARCHIVED', updated_at = NOW(), version = s.version + 1
FROM v55_copy c
WHERE s.id = c.id
  AND c.id NOT IN (SELECT scenario_id FROM v55_kept)
  AND s.status <> 'ARCHIVED';

-- 5. Names without the generated region word, and the plain company name.
UPDATE personas p
SET name = regexp_replace(p.name, ' (Pacific|Northern|Urban|Coastal|Summit|Cedar|Atlas|Meridian|Pioneer|Aurora)$', ''),
    organisation = k.company, updated_at = NOW(), version = p.version + 1
FROM v55_kept k
WHERE p.scenario_id = k.scenario_id;

UPDATE leads l
SET company_name = k.company,
    decision_maker = regexp_replace(l.decision_maker, ' (Pacific|Northern|Urban|Coastal|Summit|Cedar|Atlas|Meridian|Pioneer|Aurora),', ','),
    updated_at = NOW(), version = l.version + 1
FROM v55_kept k
WHERE l.scenario_id = k.scenario_id;

-- 6. The research sources quote the scenario title: move them to the new one.
UPDATE document_chunks ch
SET content = replace(ch.content, k.old_title, k.new_title), updated_at = NOW(), version = ch.version + 1
FROM v55_kept k
WHERE ch.scenario_id = k.scenario_id AND position(k.old_title IN ch.content) > 0;

UPDATE knowledge_documents d
SET title = replace(d.title, k.old_title, k.new_title), updated_at = NOW(), version = d.version + 1
FROM v55_kept k
WHERE d.scenario_id = k.scenario_id AND position(k.old_title IN d.title) > 0;


-- ═══════════════════════════════════════════════════════════════════════════
-- Batch 1 content: the new problems for AeroVector, NexaLearn and Momentum Auto.
-- (Their existing problems were written in V52 and V54.)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TEMP TABLE v55_content (vertical INT, slot INT, description TEXT, business_situation TEXT, observable_symptom TEXT,
    consulting_mandate TEXT, unknowns TEXT, objective TEXT, dm_name TEXT, dm_title TEXT, dm_visible TEXT, dm_hidden TEXT, dm_goals TEXT,
    lead_description TEXT, lead_decision_maker TEXT, lead_technology TEXT, lead_budget TEXT, lead_pain TEXT, lead_value TEXT,
    signal_trigger TEXT, signal_pain TEXT) ON COMMIT DROP;
INSERT INTO v55_content VALUES
    (1, 2, 'Aircraft spend too long on the ground between flights at the main hub, and the knock-on delays are costing slots and connections.', 'On-time performance at the main hub has become a board concern as delays spread from the first departures of the day through the rest of the schedule.', 'On-time departures at the main hub fell below 80%, and most delays begin at the gate between flights.', 'Work out why aircraft turnarounds at the main hub overrun and agree a measured first step to bring departures back on time.', 'Which gate activity finishes last most often|How each ground team schedules its work|What delays and slot overruns cost|Who owns turnaround performance across teams', 'Find the real cause of turnaround delays at the main hub, build a grounded hypothesis and earn agreement on a low-risk pilot.', 'Marcus Webb', 'Head of Ground Operations', 'On-time departures at the main hub have fallen below 80%.', 'Worries that another technology rollout will add work for gate teams without fixing coordination.', 'Bring on-time departures back above 88% without adding gate staff.', 'An airline whose main-hub turnarounds are overrunning, pushing delays and costs through the day''s schedule.', 'Marcus Webb, Head of Ground Operations', 'Gate schedules for fuelling, cleaning, catering and baggage kept in separate systems', 'Delay costs are under board review this year', 'High - on-time departures fell below 80%', '$600K - $1.4M', 'on-time performance is under board review', 'on-time departures at the main hub fell below 80%'),
    (1, 3, 'Flights are cancelled at short notice because crews run out of legal duty hours after delays, and rostering can''t recover fast enough.', 'Short-notice cancellations have become the airline''s most visible reliability problem, and crew costs are rising at the same time.', 'Short-notice cancellations doubled this winter, mostly on flights whose crew had run out of legal duty hours.', 'Work out why crew disruptions turn into cancellations and agree a measured first step to recover delayed schedules without losing flights.', 'How close crews are to duty limits on a typical day|How roster changes are made on the day|Where standby crews are based and why|Who owns crew planning across the network', 'Find why crew disruption leads to cancellations, build a grounded hypothesis and earn agreement on a low-risk pilot.', 'Sofia Marchetti', 'Director of Crew Planning', 'Short-notice cancellations doubled over the winter schedule.', 'Knows the monthly roster is fine; the problem is recovering it on the day, and she doesn''t want pilots or HR to own the fix.', 'Halve short-notice cancellations without adding standby crews.', 'An airline losing flights at short notice because crews time out after delays and rosters can''t recover in time.', 'Sofia Marchetti, Director of Crew Planning', 'Monthly rostering system with same-day changes made by phone and spreadsheet', 'Crew costs are being reviewed in the next budget', 'High - short-notice cancellations doubled', '$1.5M - $3.5M', 'crew costs are part of the next budget review', 'short-notice cancellations doubled this winter'),
    (7, 2, 'Students wait days for answers to simple questions, and the support team is buried in repeat tickets.', 'Student support has become the lowest-rated service in student surveys, even after extra staff were hired.', 'Students wait an average of six days for a reply, and nearly half of all tickets ask the same questions.', 'Work out why the support backlog keeps growing and agree a measured first step to cut reply times without simply adding staff.', 'Which questions students ask most|How tickets are sorted and prioritised|What extra staff have cost so far|Who owns the student support queue', 'Find why the support backlog keeps growing, build a grounded hypothesis and earn agreement on a low-risk pilot.', 'Grace Liu', 'Head of Student Services', 'Students wait an average of six days for a reply.', 'Has already tried hiring more staff and is wary of another fix that treats the symptom.', 'Get reply times under two days before the next intake.', 'An institute whose student support queue is overwhelmed by repeat questions, with reply times of six days.', 'Grace Liu, Head of Student Services', 'One shared ticket queue with no self-service answers', 'Support spending is under review after this year''s overspend', 'Medium - average reply time has reached six days', '$300K - $800K', 'support spending is under review', 'the average reply time has reached six days'),
    (7, 3, 'Students studying across two campuses keep getting classes at the same time, forcing late changes every semester.', 'Letting students study at more than one campus has been popular, but the timetable has not kept up.', '1,800 timetable clashes were reported this semester, most for students enrolled at two campuses.', 'Work out why cross-campus timetables clash and agree a measured first step to stop clashes before students enrol.', 'How each campus builds its timetable|When clashes are first noticed|What the workarounds cost|Who owns the timetable across campuses', 'Find why cross-campus timetables clash, build a grounded hypothesis and earn agreement on a low-risk pilot.', 'Dr Martin Hale', 'Registrar', '1,800 timetable clashes were reported this semester.', 'Suspects the campuses resist a single timetable because they would lose control of their own scheduling.', 'Remove cross-campus clashes before the next semester''s enrolment.', 'An institute whose cross-campus students keep getting clashing classes, forcing late changes each semester.', 'Dr Martin Hale, Registrar', 'Separate copies of the scheduling system at each campus, merged by hand', 'Teaching costs are under review', 'Medium - 1,800 clashes reported this semester', '$400K - $1M', 'teaching costs are under review', '1,800 timetable clashes were reported this semester'),
    (21, 2, 'Trade-in cars sit on dealer lots for months, losing value before they sell.', 'Used-car margins are shrinking across the group while some dealerships turn away buyers for models that sit unsold elsewhere.', 'The average used car takes 74 days to sell, and slow stock is losing value every week.', 'Work out why used cars sell slowly and agree a measured first step to move stock to where buyers are.', 'Which models sit longest and where|How trade-ins are priced|How much value is lost while cars wait|Who manages used stock across the group', 'Find why used cars sell slowly, build a grounded hypothesis and earn agreement on a low-risk pilot.', 'Daniel Reyes', 'Head of Used Vehicles', 'Used cars take an average of 74 days to sell.', 'Dealership managers push back on moving ''their'' stock to other sites.', 'Bring average days to sell under 45 without discounting.', 'A dealer group whose used cars sit on lots for months, losing value before they sell.', 'Daniel Reyes, Head of Used Vehicles', 'Each dealership prices and lists its own trade-ins', 'Stock funding costs are rising', 'High - used cars take 74 days to sell', '$700K - $1.6M', 'stock funding costs are rising', 'the average used car takes 74 days to sell');

CREATE TEMP TABLE v55_written ON COMMIT DROP AS
SELECT k.scenario_id, k.company, c.*
FROM v55_kept k JOIN v55_content c ON c.vertical = k.vertical AND c.slot = k.slot;

-- The scenario's briefing, which the research sources are generated from.
UPDATE scenarios s
SET description = w.description, business_situation = w.business_situation,
    observable_symptom = w.observable_symptom, consulting_mandate = w.consulting_mandate,
    unknowns_to_validate = w.unknowns, objective = w.objective,
    updated_at = NOW(), version = s.version + 1
FROM v55_written w
WHERE s.id = w.scenario_id;

-- The decision maker (the AI client). Each generated scenario has exactly one persona.
UPDATE personas p
SET name = w.dm_name, job_title = w.dm_title, visible_concerns = w.dm_visible,
    hidden_concerns = w.dm_hidden, business_goals = w.dm_goals,
    contact_role = 'DECISION_MAKER', updated_at = NOW(), version = p.version + 1
FROM v55_written w
WHERE p.scenario_id = w.scenario_id;

-- The company profile and its public signals.
UPDATE leads l
SET public_description = w.lead_description, decision_maker = w.lead_decision_maker,
    technology_stack = w.lead_technology, budget_signal = w.lead_budget,
    pain_severity = w.lead_pain, potential_value_range = w.lead_value,
    updated_at = NOW(), version = l.version + 1
FROM v55_written w
WHERE l.scenario_id = w.scenario_id;

UPDATE lead_signals sig
SET label = CASE sig.category WHEN 'BUSINESS_TRIGGER' THEN w.signal_trigger ELSE w.signal_pain END
FROM leads l JOIN v55_written w ON w.scenario_id = l.scenario_id
WHERE sig.lead_id = l.id;

-- Distracting contacts, with their pre-written replies.
INSERT INTO personas (id, scenario_id, name, job_title, organisation, visible_concerns,
    contact_role, decline_reply, hint_reply, prompt_version, created_at, updated_at, version)
SELECT md5(w.scenario_id::text || v.name)::uuid, w.scenario_id, v.name, v.job_title, w.company, v.visible_concerns,
       'DISTRACTOR', v.decline_reply, v.hint_reply, 1, NOW(), NOW(), 0
FROM (VALUES
    (1, 2, 'Leila Haddad', 'Catering Services Manager', 'Catering carts are often loaded late because gate times keep moving.', 'Thanks, but I only run catering.', 'Thanks, but I only run catering. Turnaround as a whole is Marcus Webb''s call in Ground Operations.'),
    (1, 2, 'Tom Brennan', 'Airport Partnerships Manager', 'Our slot agreements with the airport are up for renewal.', 'Thanks, but this isn''t my area.', 'I look after our relationship with the airport, not what happens at the gate. Marcus Webb in Ground Operations runs turnaround.'),
    (1, 3, 'Captain James Okafor', 'Chief Pilot', 'Pilots are tired of last-minute roster changes.', 'Thanks, but I can''t take this forward.', 'I speak for the pilots, and they''re frustrated too, but rosters aren''t mine to change. That sits with whoever plans crew across the network.'),
    (1, 3, 'Rachel Kim', 'HR Business Partner, Flight Operations', 'Crew sick leave has risen for two years running.', 'Thanks for getting in touch, but HR can''t take on operational projects like this.', NULL),
    (7, 2, 'Owen Carter', 'IT Service Desk Manager', 'The ticketing system is due for renewal next year.', 'Thanks, but we only look after the software.', 'We only look after the ticketing software. The student support queue is Grace Liu''s team in Student Services.'),
    (7, 2, 'Priyanka Das', 'Student Union President', 'Students feel ignored when they ask for help.', 'Thanks, but we can''t sign anything off.', 'Thanks! We hear the complaints all the time, but we can''t sign anything off. Grace Liu runs Student Services.'),
    (7, 3, 'Ana Souza', 'Campus Facilities Manager, North Campus', 'Lecture rooms sit empty on Fridays but are overbooked mid-week.', 'Thanks, but I only handle rooms.', 'Room bookings come through me, but the timetable itself is built by the Registrar, Dr Martin Hale.'),
    (7, 3, 'Professor Neil Grant', 'Head of the School of Business', 'Staff are teaching the same class twice because of clashes.', 'Thanks, but I''m not the right person.', 'I can tell you how it affects my school, but I don''t control the timetable. That''s decided centrally.'),
    (21, 2, 'Kate Morrison', 'Sales Manager, Northside Dealership', 'We''re short of the popular models customers ask for.', 'Thanks, but I only sell what''s on my lot.', 'I sell what''s on my lot, but used stock across the group is managed by Daniel Reyes.'),
    (21, 2, 'Ben Alvarez', 'Marketing Manager', 'Online listings get views but few enquiries.', 'Thanks, but this isn''t a marketing decision.', 'Listings go out through marketing, but which cars we buy and where they go is decided by the used vehicle team.')
) AS v(vertical, slot, name, job_title, visible_concerns, decline_reply, hint_reply)
JOIN v55_written w ON w.vertical = v.vertical AND w.slot = v.slot
ON CONFLICT (id) DO NOTHING;

-- Company facts: company size and revenue/margin are shared with the company's other
-- scenarios; the last two financial lines are specific to this problem.
DELETE FROM company_facts f USING v55_written w WHERE f.scenario_id = w.scenario_id;
INSERT INTO company_facts (id, scenario_id, section, label, value, tone, sort_order, created_at, updated_at, version)
SELECT md5(w.scenario_id::text || v.section || v.sort_order)::uuid, w.scenario_id, v.section, v.label, v.value, v.tone, v.sort_order,
       NOW(), NOW(), 0
FROM (VALUES
    (1, 2, 'SIZE', 1, 'Aircraft in fleet', '46', 'NORMAL'),
    (1, 2, 'SIZE', 2, 'Staff', '~3,900', 'NORMAL'),
    (1, 2, 'SIZE', 3, 'Flights / year', '~68,000', 'NORMAL'),
    (1, 2, 'FINANCIAL', 1, 'Revenue', '$1.3bn', 'NORMAL'),
    (1, 2, 'FINANCIAL', 2, 'Operating margin', '2.1% (was 4.4%)', 'ALERT'),
    (1, 2, 'FINANCIAL', 3, 'Delay compensation', '$38m, up 27%', 'ALERT'),
    (1, 2, 'FINANCIAL', 4, 'Airport slot penalties', '$6.2m', 'WARNING'),
    (1, 3, 'SIZE', 1, 'Aircraft in fleet', '46', 'NORMAL'),
    (1, 3, 'SIZE', 2, 'Staff', '~3,900', 'NORMAL'),
    (1, 3, 'SIZE', 3, 'Flights / year', '~68,000', 'NORMAL'),
    (1, 3, 'FINANCIAL', 1, 'Revenue', '$1.3bn', 'NORMAL'),
    (1, 3, 'FINANCIAL', 2, 'Operating margin', '2.1% (was 4.4%)', 'ALERT'),
    (1, 3, 'FINANCIAL', 3, 'Crew overtime and standby', '$54m, up 31%', 'ALERT'),
    (1, 3, 'FINANCIAL', 4, 'Flights cancelled this winter', '1,140', 'WARNING'),
    (7, 2, 'SIZE', 1, 'Campuses', '3', 'NORMAL'),
    (7, 2, 'SIZE', 2, 'Staff', '~2,300', 'NORMAL'),
    (7, 2, 'SIZE', 3, 'Enrolled students', '~24,500', 'NORMAL'),
    (7, 2, 'FINANCIAL', 1, 'Revenue', '$486m', 'NORMAL'),
    (7, 2, 'FINANCIAL', 2, 'Operating margin', '0.8% (was 2.7%)', 'ALERT'),
    (7, 2, 'FINANCIAL', 3, 'Support staffing', '$9.6m, up 22%', 'ALERT'),
    (7, 2, 'FINANCIAL', 4, 'Cost per ticket', '$31 (was $19)', 'WARNING'),
    (7, 3, 'SIZE', 1, 'Campuses', '3', 'NORMAL'),
    (7, 3, 'SIZE', 2, 'Staff', '~2,300', 'NORMAL'),
    (7, 3, 'SIZE', 3, 'Enrolled students', '~24,500', 'NORMAL'),
    (7, 3, 'FINANCIAL', 1, 'Revenue', '$486m', 'NORMAL'),
    (7, 3, 'FINANCIAL', 2, 'Operating margin', '0.8% (was 2.7%)', 'ALERT'),
    (7, 3, 'FINANCIAL', 3, 'Extra class sessions', '$4.3m a year', 'ALERT'),
    (7, 3, 'FINANCIAL', 4, 'Room utilisation', '51%', 'WARNING'),
    (21, 2, 'SIZE', 1, 'Dealerships', '24', 'NORMAL'),
    (21, 2, 'SIZE', 2, 'Staff', '~2,100', 'NORMAL'),
    (21, 2, 'SIZE', 3, 'Vehicles serviced / year', '~152,000', 'NORMAL'),
    (21, 2, 'FINANCIAL', 1, 'Revenue', '$690m', 'NORMAL'),
    (21, 2, 'FINANCIAL', 2, 'Operating margin', '1.9% (was 3.6%)', 'ALERT'),
    (21, 2, 'FINANCIAL', 3, 'Value lost on slow-selling cars', '$11.8m', 'ALERT'),
    (21, 2, 'FINANCIAL', 4, 'Used-car stock on hand', '$96m', 'WARNING')
) AS v(vertical, slot, section, sort_order, label, value, tone)
JOIN v55_written w ON w.vertical = v.vertical AND w.slot = v.slot;

-- Regenerate the research sources from the new briefing, using V49's template.
WITH concise_passages AS (
    SELECT chunks.id,
           CASE chunks.collection
               WHEN 'RESEARCH_COMPANY_NEWS' THEN CASE chunks.chunk_index
                   WHEN 0 THEN format('Executive watch for %s. %s The report places this leadership pressure beside the current operating picture, without claiming an external announcement, market outcome or completed response. The open evidence question is %s.', s.title, s.business_situation, COALESCE(NULLIF(split_part(s.unknowns_to_validate, '|', 1), ''), 'which client signal requires corroboration'))
                   WHEN 1 THEN format('Operating report. %s This section records the visible delivery condition and its immediate business setting. It does not establish a root cause, accountable owner or preferred intervention; those remain separate questions in the client record.', s.observable_symptom)
                   WHEN 2 THEN format('Decision desk. %s The published operating narrative identifies a decision context, not a decision made. The reader should distinguish reported pressure from any assumed sponsor, commitment, timing or outcome.', s.consulting_mandate)
                   ELSE format('Evidence watch. %s The company account keeps the public description and the problem frame connected while reserving technical, financial and stakeholder detail for their dedicated research sources.', s.description)
               END
               WHEN 'RESEARCH_STAKEHOLDER' THEN CASE chunks.chunk_index
                   WHEN 0 THEN format('Mandate file for %s. %s This stakeholder record begins with the organisation''s stated consulting mandate, without assigning personal sponsorship, authority or resistance to an unnamed individual.', s.title, s.consulting_mandate)
                   WHEN 1 THEN format('Priority context. %s The stated business situation frames the decision environment. It does not confirm who owns the trade-off, controls funding or speaks for every affected operating team.', s.business_situation)
                   WHEN 2 THEN format('Influence boundary. %s The scenario identifies an operating concern that may shape stakeholder priorities. Decision rights, success measures and approval pathways still need direct validation.', s.observable_symptom)
                   ELSE format('Question on record. %s This profile preserves the unknown as a stakeholder-research question rather than presenting an inferred role, position or commitment as a source fact.', COALESCE(NULLIF(split_part(s.unknowns_to_validate, '|', 2), ''), 'Which stakeholder can validate the decision context?'))
               END
               WHEN 'RESEARCH_FINANCIAL' THEN CASE chunks.chunk_index
                   WHEN 0 THEN format('Commercial frame for %s. %s This note identifies the outcome the scenario expects to improve, while withholding a financial baseline, approved business case, forecast or realised benefit.', s.title, s.objective)
                   WHEN 1 THEN format('Materiality signal. %s The business situation makes the operating condition commercially relevant, but it does not itself confirm a budget, contract value, investment timetable or purchasing decision.', s.business_situation)
                   WHEN 2 THEN format('Measurement record. %s These stated success criteria identify what a credible outcome would need to demonstrate. They are not evidence of current performance or an agreed financial target.', COALESCE(NULLIF(replace(s.success_criteria, '|', '; '), ''), s.consulting_mandate))
                   ELSE format('Funding boundary. %s The financial research lane keeps commercial exposure separate from any assumed approval, supplier choice or benefit claim. The outstanding question is %s.', s.observable_symptom, COALESCE(NULLIF(split_part(s.unknowns_to_validate, '|', 3), ''), 'which measure is credible enough to support a decision'))
               END
               ELSE CASE chunks.chunk_index
                   WHEN 0 THEN format('Current-state brief for %s. %s This technical source records the observable condition before attributing it to a system defect, integration failure or data-quality problem.', s.title, s.observable_symptom)
                   WHEN 1 THEN format('Information-flow context. %s The mandate points to hand-offs that require examination. It does not identify a target architecture, technical owner or implementation sequence.', s.consulting_mandate)
                   WHEN 2 THEN format('Control boundary. %s The scenario description establishes the operating setting for systems and records. Existing controls must be understood before any technical change is assumed.', s.description)
                   ELSE format('Architecture question. %s This passage retains the technology-research unknown as a validation point, separating documented information conditions from a root-cause or solution claim.', COALESCE(NULLIF(split_part(s.unknowns_to_validate, '|', 4), ''), 'which dependency is least visible in the current operating record'))
               END
           END AS content
    FROM document_chunks chunks
    JOIN scenarios s ON s.id = chunks.scenario_id
        WHERE chunks.id::text LIKE 'd4610000-%%'
      AND chunks.chunk_index < 4
      AND chunks.scenario_id IN (SELECT scenario_id FROM v55_written)
      AND chunks.collection IN ('RESEARCH_COMPANY_NEWS', 'RESEARCH_STAKEHOLDER',
                                'RESEARCH_FINANCIAL', 'RESEARCH_TECHNOLOGY')
)
UPDATE document_chunks chunks
SET content = concise_passages.content,
    updated_at = NOW(),
    version = chunks.version + 1
FROM concise_passages
WHERE chunks.id = concise_passages.id;

-- The "why" passages and the stakeholder clue, written for each problem.
UPDATE document_chunks SET content = 'Operating report. On-time departures at the main hub fell below 80% this year. Most delays start with the first flight of the day and knock on through the schedule.', updated_at = NOW(), version = version + 1
WHERE scenario_id = (SELECT scenario_id FROM v55_written WHERE vertical = 1 AND slot = 2)
  AND collection = 'RESEARCH_COMPANY_NEWS' AND chunk_index = 1;
UPDATE document_chunks SET content = 'Materiality signal. Delay compensation and missed-connection rebooking cost $38m last year, up 27%. The airport has also started charging penalties for slot overruns.', updated_at = NOW(), version = version + 1
WHERE scenario_id = (SELECT scenario_id FROM v55_written WHERE vertical = 1 AND slot = 2)
  AND collection = 'RESEARCH_FINANCIAL' AND chunk_index = 1;
UPDATE document_chunks SET content = 'Information-flow context. Fuelling, cleaning, catering and baggage teams each work from their own schedule. None of them can see when the others have finished, so the aircraft waits for whoever is last.', updated_at = NOW(), version = version + 1
WHERE scenario_id = (SELECT scenario_id FROM v55_written WHERE vertical = 1 AND slot = 2)
  AND collection = 'RESEARCH_TECHNOLOGY' AND chunk_index = 1;
UPDATE document_chunks SET content = 'Influence boundary. Turnaround performance is owned by Ground Operations, which coordinates every team at the gate. Catering and airport partnerships feed into it but don''t run it.', updated_at = NOW(), version = version + 1
WHERE scenario_id = (SELECT scenario_id FROM v55_written WHERE vertical = 1 AND slot = 2)
  AND collection = 'RESEARCH_STAKEHOLDER' AND chunk_index = 2;
UPDATE document_chunks SET content = 'Operating report. Short-notice cancellations doubled this winter. Most were flights where the scheduled crew had run out of legal duty hours after an earlier delay.', updated_at = NOW(), version = version + 1
WHERE scenario_id = (SELECT scenario_id FROM v55_written WHERE vertical = 1 AND slot = 3)
  AND collection = 'RESEARCH_COMPANY_NEWS' AND chunk_index = 1;
UPDATE document_chunks SET content = 'Materiality signal. Crew overtime and standby costs rose 31% to $54m. Standby crews are called in more often, but frequently from the wrong base.', updated_at = NOW(), version = version + 1
WHERE scenario_id = (SELECT scenario_id FROM v55_written WHERE vertical = 1 AND slot = 3)
  AND collection = 'RESEARCH_FINANCIAL' AND chunk_index = 1;
UPDATE document_chunks SET content = 'Information-flow context. Rosters are built monthly in one system; changes on the day are handled by phone and spreadsheet. Nobody can see in advance which crews are close to their duty limits.', updated_at = NOW(), version = version + 1
WHERE scenario_id = (SELECT scenario_id FROM v55_written WHERE vertical = 1 AND slot = 3)
  AND collection = 'RESEARCH_TECHNOLOGY' AND chunk_index = 1;
UPDATE document_chunks SET content = 'Influence boundary. Crew planning across the network sits with one planning function. The Chief Pilot represents pilots and HR manages leave, but neither changes rosters.', updated_at = NOW(), version = version + 1
WHERE scenario_id = (SELECT scenario_id FROM v55_written WHERE vertical = 1 AND slot = 3)
  AND collection = 'RESEARCH_STAKEHOLDER' AND chunk_index = 2;
UPDATE document_chunks SET content = 'Operating report. Student surveys rank support as the lowest-rated service this year. The most common complaint is waiting days for answers to simple questions.', updated_at = NOW(), version = version + 1
WHERE scenario_id = (SELECT scenario_id FROM v55_written WHERE vertical = 7 AND slot = 2)
  AND collection = 'RESEARCH_COMPANY_NEWS' AND chunk_index = 1;
UPDATE document_chunks SET content = 'Materiality signal. Support staffing costs rose 22% after extra temporary staff were hired, yet reply times still got worse. Cost per ticket went from $19 to $31.', updated_at = NOW(), version = version + 1
WHERE scenario_id = (SELECT scenario_id FROM v55_written WHERE vertical = 7 AND slot = 2)
  AND collection = 'RESEARCH_FINANCIAL' AND chunk_index = 1;
UPDATE document_chunks SET content = 'Information-flow context. Nearly half of all tickets ask the same dozen questions (fees, timetables, enrolment deadlines), but the answers aren''t published anywhere students can find them, and every ticket goes into one queue regardless of urgency.', updated_at = NOW(), version = version + 1
WHERE scenario_id = (SELECT scenario_id FROM v55_written WHERE vertical = 7 AND slot = 2)
  AND collection = 'RESEARCH_TECHNOLOGY' AND chunk_index = 1;
UPDATE document_chunks SET content = 'Influence boundary. The support queue is run by Student Services. IT provides the ticketing software and the Student Union passes on feedback, but neither manages the queue.', updated_at = NOW(), version = version + 1
WHERE scenario_id = (SELECT scenario_id FROM v55_written WHERE vertical = 7 AND slot = 2)
  AND collection = 'RESEARCH_STAKEHOLDER' AND chunk_index = 2;
UPDATE document_chunks SET content = 'Operating report. Clashes jumped after the institute let students take subjects at more than one campus. Complaints peak in the first two weeks of each semester.', updated_at = NOW(), version = version + 1
WHERE scenario_id = (SELECT scenario_id FROM v55_written WHERE vertical = 7 AND slot = 3)
  AND collection = 'RESEARCH_COMPANY_NEWS' AND chunk_index = 1;
UPDATE document_chunks SET content = 'Materiality signal. Running extra sessions to work around clashes costs $4.3m a year in teaching time, while rooms are only 51% used on average.', updated_at = NOW(), version = version + 1
WHERE scenario_id = (SELECT scenario_id FROM v55_written WHERE vertical = 7 AND slot = 3)
  AND collection = 'RESEARCH_FINANCIAL' AND chunk_index = 1;
UPDATE document_chunks SET content = 'Information-flow context. Each campus builds its own timetable in a separate copy of the scheduling system, and the copies are merged by hand. Clashes for students at two campuses only show up after enrolment.', updated_at = NOW(), version = version + 1
WHERE scenario_id = (SELECT scenario_id FROM v55_written WHERE vertical = 7 AND slot = 3)
  AND collection = 'RESEARCH_TECHNOLOGY' AND chunk_index = 1;
UPDATE document_chunks SET content = 'Influence boundary. The timetable is owned centrally by the Registrar''s office. Facilities manage rooms and schools request classes, but neither sets the timetable.', updated_at = NOW(), version = version + 1
WHERE scenario_id = (SELECT scenario_id FROM v55_written WHERE vertical = 7 AND slot = 3)
  AND collection = 'RESEARCH_STAKEHOLDER' AND chunk_index = 2;
UPDATE document_chunks SET content = 'Operating report. Dealers say their lots are full of cars nobody asks for, while customers are turned away for popular models that sit unsold at other dealerships.', updated_at = NOW(), version = version + 1
WHERE scenario_id = (SELECT scenario_id FROM v55_written WHERE vertical = 21 AND slot = 2)
  AND collection = 'RESEARCH_COMPANY_NEWS' AND chunk_index = 1;
UPDATE document_chunks SET content = 'Materiality signal. Used cars lose value every week they go unsold. Slow-moving stock cost $11.8m in lost value last year, and $96m is tied up in cars on lots.', updated_at = NOW(), version = version + 1
WHERE scenario_id = (SELECT scenario_id FROM v55_written WHERE vertical = 21 AND slot = 2)
  AND collection = 'RESEARCH_FINANCIAL' AND chunk_index = 1;
UPDATE document_chunks SET content = 'Information-flow context. Each dealership prices and lists its own trade-ins. There''s no shared view of stock across the group, so cars can''t be moved to where the demand is.', updated_at = NOW(), version = version + 1
WHERE scenario_id = (SELECT scenario_id FROM v55_written WHERE vertical = 21 AND slot = 2)
  AND collection = 'RESEARCH_TECHNOLOGY' AND chunk_index = 1;
UPDATE document_chunks SET content = 'Influence boundary. Used vehicle stock across all dealerships is managed centrally by the used vehicle team. Dealership sales managers and marketing work with the stock they''re given.', updated_at = NOW(), version = version + 1
WHERE scenario_id = (SELECT scenario_id FROM v55_written WHERE vertical = 21 AND slot = 2)
  AND collection = 'RESEARCH_STAKEHOLDER' AND chunk_index = 2;

-- Rebuild each kept document's combined text from its (renamed or rewritten) passages.
UPDATE knowledge_documents documents
SET source_text = refreshed.source_text, updated_at = NOW(), version = documents.version + 1
FROM (
    SELECT chunks.document_id, string_agg(chunks.content, E'\n\n' ORDER BY chunks.chunk_index) AS source_text
    FROM document_chunks chunks
    WHERE chunks.scenario_id IN (SELECT scenario_id FROM v55_kept)
      AND chunks.chunk_index < 4
      AND chunks.collection IN ('RESEARCH_COMPANY_NEWS', 'RESEARCH_STAKEHOLDER', 'RESEARCH_FINANCIAL', 'RESEARCH_TECHNOLOGY')
    GROUP BY chunks.document_id
) refreshed
WHERE documents.id = refreshed.document_id;
