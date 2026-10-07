-- ═══════════════════════════════════════════════════════════════════════════
-- Contacts for every live scenario: one decision maker and two distracting
-- contacts, each with a three-sentence bio (role, what they own, current
-- concern) shown on the Choose contact card.
--
--   * 21 live scenarios only had their decision maker: two distracting
--     contacts are added, and the stakeholder research passage now says which
--     function owns the problem.
--   * 8 live scenarios already had distracting contacts (V59, V62): only
--     their bios are rewritten; replies and research passages are kept.
--   * Decision makers keep their names (engagements and the AI client use them).
--
-- A distracting contact's reply is its hint if it has one, otherwise its
-- decline. Hints scale with complexity: at 2 both distracting contacts name
-- the decision maker, at 3 one does, at 4 one points to a role, never a name.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Every contact, with the bio shown on the contact card (role, what they
--    own, current concern). keep_replies: an existing contact whose
--    pre-written replies are kept as they are.
CREATE TEMP TABLE v65_contact (
    company       TEXT    NOT NULL,
    problem       TEXT    NOT NULL,
    contact_role  TEXT    NOT NULL,
    name          TEXT    NOT NULL,
    job_title     TEXT    NOT NULL,
    bio           TEXT    NOT NULL,
    decline_reply TEXT,
    hint_reply    TEXT,
    keep_replies  BOOLEAN NOT NULL
) ON COMMIT DROP;

INSERT INTO v65_contact VALUES
    ('AeroVector Aviation', 'predictive maintenance control', 'DECISION_MAKER', 'Elena Vargas', 'VP Asset Operations',
     'Elena Vargas is VP Asset Operations at AeroVector Aviation and reports fleet performance to the executive committee. She is accountable for fleet availability and dispatch reliability across the network. Dispatch reliability has been below target for three straight quarters, and she must explain why aircraft keep being grounded for unplanned repairs.',
     NULL, NULL, FALSE),
    ('AeroVector Aviation', 'predictive maintenance control', 'DISTRACTOR', 'Dan Whitaker', 'Head of Line Maintenance',
     'Dan Whitaker is Head of Line Maintenance at AeroVector Aviation, leading the engineers who service aircraft between flights. He manages technician rosters, shift planning and day-to-day fault rectification at each base. His technicians are losing shift time chasing parts and paperwork when aircraft arrive with unexpected faults.',
     NULL,
     NULL, TRUE),
    ('AeroVector Aviation', 'predictive maintenance control', 'DISTRACTOR', 'Priya Nair', 'IT Systems Manager, MRO & Telemetry',
     'Priya Nair is IT Systems Manager for MRO and Telemetry at AeroVector Aviation. Her team runs the maintenance, repair and overhaul platform and the aircraft health data feeds. She is focused on keeping both platforms stable through the next upgrade window.',
     NULL,
     NULL, TRUE),
    ('AeroVector Aviation', 'gate turnaround delays', 'DECISION_MAKER', 'Marcus Webb', 'Head of Ground Operations',
     'Marcus Webb is Head of Ground Operations at AeroVector Aviation''s main hub. He is responsible for turnaround performance, coordinating the fuelling, cleaning, catering and baggage teams that work each aircraft at the gate. On-time departures at the hub have fallen below 80%, and most delays now start at the gate between flights.',
     NULL, NULL, FALSE),
    ('AeroVector Aviation', 'gate turnaround delays', 'DISTRACTOR', 'Leila Haddad', 'Catering Services Manager',
     'Leila Haddad is Catering Services Manager at AeroVector Aviation. She runs the catering supplier contract and the teams that load meals and supplies onto aircraft. Her carts are often loaded late because gate times keep moving.',
     NULL,
     NULL, TRUE),
    ('AeroVector Aviation', 'gate turnaround delays', 'DISTRACTOR', 'Tom Brennan', 'Airport Partnerships Manager',
     'Tom Brennan is Airport Partnerships Manager at AeroVector Aviation. He manages the airline''s commercial relationship with the hub airport, including slot agreements and terminal facilities. With the slot agreements up for renewal, he is wary of the penalties the airport now charges for overruns.',
     NULL,
     NULL, TRUE),
    ('AeroVector Aviation', 'crew rostering disruption', 'DECISION_MAKER', 'Sofia Marchetti', 'Director of Crew Planning',
     'Sofia Marchetti is Director of Crew Planning at AeroVector Aviation. She leads the network planning function that builds monthly rosters and manages standby crews at every base. Short-notice cancellations doubled over the winter schedule, mostly on flights whose crew had run out of legal duty hours.',
     NULL, NULL, FALSE),
    ('AeroVector Aviation', 'crew rostering disruption', 'DISTRACTOR', 'Captain James Okafor', 'Chief Pilot',
     'Captain James Okafor is Chief Pilot at AeroVector Aviation and the senior voice for the airline''s pilots. He oversees flight standards, pilot training and fatigue reporting. Pilots are increasingly frustrated by last-minute roster changes after delays.',
     NULL,
     NULL, TRUE),
    ('AeroVector Aviation', 'crew rostering disruption', 'DISTRACTOR', 'Rachel Kim', 'HR Business Partner, Flight Operations',
     'Rachel Kim is HR Business Partner for Flight Operations at AeroVector Aviation. She advises flight crew managers on leave, wellbeing and workplace relations. Crew sick leave has risen for two years running.',
     NULL,
     NULL, TRUE),
    ('NexaLearn Institute', 'enrolment journey redesign', 'DECISION_MAKER', 'Aisha Robinson', 'Chief Student Experience Officer',
     'Aisha Robinson is Chief Student Experience Officer at NexaLearn Institute and sits on the executive team. She is accountable for the student journey from offer to the end of first year, and leads the retention improvement programme. First-year retention missed its target, with attrition reaching 19% against a 12% goal.',
     NULL, NULL, FALSE),
    ('NexaLearn Institute', 'enrolment journey redesign', 'DISTRACTOR', 'Tom Fraser', 'Admissions Manager',
     'Tom Fraser is Admissions Manager at NexaLearn Institute. His team assesses applications, issues offers and answers applicant questions up to acceptance. He is worried about how many applicants accept an offer but never complete enrolment.',
     NULL,
     NULL, TRUE),
    ('NexaLearn Institute', 'enrolment journey redesign', 'DISTRACTOR', 'Dr Lena Park', 'Head of Learning Technology',
     'Dr Lena Park is Head of Learning Technology at NexaLearn Institute. She runs the learning management system and its integrations with the student information system. Her team spends too much time reconciling records because the student and learning systems don''t talk to each other.',
     NULL,
     NULL, TRUE),
    ('NexaLearn Institute', 'student support ticket backlog', 'DECISION_MAKER', 'Grace Liu', 'Head of Student Services',
     'Grace Liu is Head of Student Services at NexaLearn Institute. She runs the student support team and the shared queue that handles every student enquiry. Students now wait an average of six days for a reply, even after she hired extra temporary staff.',
     NULL, NULL, FALSE),
    ('NexaLearn Institute', 'student support ticket backlog', 'DISTRACTOR', 'Owen Carter', 'IT Service Desk Manager',
     'Owen Carter is IT Service Desk Manager at NexaLearn Institute. His team supports staff and student technology and administers the institute''s ticketing software. The ticketing system is due for renewal next year, and he is reviewing licence costs.',
     NULL,
     NULL, TRUE),
    ('NexaLearn Institute', 'student support ticket backlog', 'DISTRACTOR', 'Priyanka Das', 'Student Union President',
     'Priyanka Das is the elected Student Union President at NexaLearn Institute. She represents students to the institute''s leadership and runs the union''s advocacy and welfare services. Students keep telling her they feel ignored when they ask for help.',
     NULL,
     NULL, TRUE),
    ('NexaLearn Institute', 'timetabling clashes across campuses', 'DECISION_MAKER', 'Dr Martin Hale', 'Registrar',
     'Dr Martin Hale is Registrar at NexaLearn Institute. His office owns enrolment records, academic policy and the central timetable across all campuses. 1,800 timetable clashes were reported this semester, most of them for students enrolled at two campuses.',
     NULL, NULL, FALSE),
    ('NexaLearn Institute', 'timetabling clashes across campuses', 'DISTRACTOR', 'Ana Souza', 'Campus Facilities Manager, North Campus',
     'Ana Souza is Campus Facilities Manager at NexaLearn Institute''s North Campus. She manages the campus buildings, room bookings and teaching spaces. Lecture rooms sit empty on Fridays but are overbooked in the middle of the week.',
     NULL,
     NULL, TRUE),
    ('NexaLearn Institute', 'timetabling clashes across campuses', 'DISTRACTOR', 'Professor Neil Grant', 'Head of the School of Business',
     'Professor Neil Grant is Head of the School of Business at NexaLearn Institute. He leads the school''s academic staff and the subjects it offers each semester. His staff are teaching the same class twice to work around timetable clashes.',
     NULL,
     NULL, TRUE),
    ('Momentum Auto Group', 'connected service experience', 'DECISION_MAKER', 'Harper Nguyen', 'Director of Customer Experience',
     'Harper Nguyen is Director of Customer Experience at Momentum Auto Group''s head office. She leads the after-sales growth programme and the customer journey across every dealership, from purchase to servicing. Customers return for their first service but not their second, and after-sales revenue fell 9% last year.',
     NULL, NULL, FALSE),
    ('Momentum Auto Group', 'connected service experience', 'DISTRACTOR', 'Rob Castellano', 'Service Manager, Flagship Dealership',
     'Rob Castellano is Service Manager at Momentum Auto Group''s flagship dealership. He runs the service floor, technicians and booking desk for that site. His service bays are full, but too few customers come back for their second service.',
     NULL,
     NULL, TRUE),
    ('Momentum Auto Group', 'connected service experience', 'DISTRACTOR', 'Mei Tanaka', 'Head of Warranty Operations',
     'Mei Tanaka is Head of Warranty Operations at Momentum Auto Group. She manages warranty claims between the dealerships and the manufacturers the group represents. Warranty claims data is inconsistent across dealers, which slows reimbursements.',
     NULL,
     NULL, TRUE),
    ('Momentum Auto Group', 'used-car stock turnover', 'DECISION_MAKER', 'Daniel Reyes', 'Head of Used Vehicles',
     'Daniel Reyes is Head of Used Vehicles at Momentum Auto Group. He manages used stock across all dealerships, including trade-in buying, pricing guidance and transfers between sites. The average used car now takes 74 days to sell, losing value every week it sits on a lot.',
     NULL, NULL, FALSE),
    ('Momentum Auto Group', 'used-car stock turnover', 'DISTRACTOR', 'Kate Morrison', 'Sales Manager, Northside Dealership',
     'Kate Morrison is Sales Manager at Momentum Auto Group''s Northside dealership. She leads the sales team and sells the new and used stock allocated to her lot. She is short of the popular models her customers keep asking for.',
     NULL,
     NULL, TRUE),
    ('Momentum Auto Group', 'used-car stock turnover', 'DISTRACTOR', 'Ben Alvarez', 'Marketing Manager',
     'Ben Alvarez is Marketing Manager at Momentum Auto Group. He runs the group''s brand campaigns and online vehicle listings. Listings get plenty of views but few enquiries, and he is under pressure to show a better return on advertising spend.',
     NULL,
     NULL, TRUE),
    ('HarbourGrid Utilities', 'outage response orchestration', 'DECISION_MAKER', 'Malik Okafor', 'Director of Grid Operations',
     'Malik Okafor is Director of Grid Operations at HarbourGrid Utilities. He runs the network control centre and the field crews who restore power when outages occur. With reliability targets tightening, he needs outages restored faster without adding more crews.',
     NULL, NULL, FALSE),
    ('HarbourGrid Utilities', 'outage response orchestration', 'DISTRACTOR', 'Sarah Lindqvist', 'Customer Contact Centre Manager',
     'Sarah Lindqvist is Customer Contact Centre Manager at HarbourGrid Utilities. She leads the team that answers customer calls, from outage reports to billing enquiries. Call volumes spike during every major outage, and customers complain that estimated restoration times keep changing.',
     'Thanks for reaching out, but I''m not the right person for this.',
     'Thanks for getting in touch. My team hears from customers during outages, but we don''t run the restoration itself. That''s Malik Okafor''s area in Grid Operations.', FALSE),
    ('HarbourGrid Utilities', 'outage response orchestration', 'DISTRACTOR', 'Raj Menon', 'GIS and Spatial Data Lead',
     'Raj Menon is GIS and Spatial Data Lead at HarbourGrid Utilities. He maintains the network maps and asset location data that field and planning teams rely on. He is midway through a two-year project to correct inaccurate asset records.',
     'I appreciate the note, but I look after mapping data and can''t take on operational projects.',
     NULL, FALSE),
    ('CivicLink Services', 'service request triage', 'DECISION_MAKER', 'Grace Liu', 'Chief Service Officer',
     'Grace Liu is Chief Service Officer at CivicLink Services. She leads frontline service delivery and the case teams that receive, triage and resolve citizen requests. Ahead of the ministerial service review, she needs to show that requests reach the right team faster.',
     NULL, NULL, FALSE),
    ('CivicLink Services', 'service request triage', 'DISTRACTOR', 'Peter Novak', 'Digital Channels Manager',
     'Peter Novak is Digital Channels Manager at CivicLink Services. He runs the website, online forms and portal through which citizens lodge requests and applications. Online submissions are rising, but many arrive incomplete and have to be sent back.',
     'Thanks, but I only look after the digital channels.',
     'Thanks for getting in touch. I look after the website and online forms, but how requests are sorted once they arrive is Grace Liu''s call as Chief Service Officer.', FALSE),
    ('CivicLink Services', 'service request triage', 'DISTRACTOR', 'Hannah Morris', 'Records and Privacy Officer',
     'Hannah Morris is Records and Privacy Officer at CivicLink Services. She manages records retention, privacy requests and information-sharing agreements. She is concerned that request data is copied between systems without clear controls.',
     'Thanks, but I''m not able to take this forward.',
     'Thanks for reaching out. I''d need to review any change to how request data is handled, but triage itself belongs to Grace Liu''s service teams.', FALSE),
    ('GreenSpan Developments', 'portfolio delivery assurance', 'DECISION_MAKER', 'Owen Hart', 'Programme Delivery Director',
     'Owen Hart is Programme Delivery Director at GreenSpan Developments. He oversees delivery of every major project in the capital portfolio and reports progress at each gateway review. Milestone slippage is putting funding releases at risk, and he lacks a reliable early view of which projects are drifting.',
     NULL, NULL, FALSE),
    ('GreenSpan Developments', 'portfolio delivery assurance', 'DISTRACTOR', 'Claire Dubois', 'Commercial Manager',
     'Claire Dubois is Commercial Manager at GreenSpan Developments. She manages builder and contractor contracts, variations and payment claims across the portfolio. Contractor variation claims have risen sharply, and she suspects some reflect schedule problems reported too late.',
     'Thanks, but I can''t take this forward.',
     'Thanks for getting in touch. I see the cost side of slippage through variation claims, but assurance across the whole portfolio is run by programme delivery leadership, not commercial.', FALSE),
    ('GreenSpan Developments', 'portfolio delivery assurance', 'DISTRACTOR', 'Ivan Petrov', 'Senior Project Manager, Riverside Precinct',
     'Ivan Petrov is Senior Project Manager for the Riverside Precinct development at GreenSpan Developments. He runs the project team, builders and site schedule for that one development until practical completion. His monthly progress report takes days to compile from contractor spreadsheets.',
     'I appreciate the note, but I only run one project and can''t speak for the portfolio.',
     NULL, FALSE),
    ('Wavefront Media Group', 'audience data activation', 'DECISION_MAKER', 'Sofia Bennett', 'Chief Digital Officer',
     'Sofia Bennett is Chief Digital Officer at Wavefront Media Group. She leads the streaming platform, digital products and the audience data and analytics teams. Subscription retention is under pressure ahead of the platform relaunch, and she wants audience data to shape what subscribers are shown.',
     NULL, NULL, FALSE),
    ('Wavefront Media Group', 'audience data activation', 'DISTRACTOR', 'Lucy Harrington', 'Head of Content Programming',
     'Lucy Harrington is Head of Content Programming at Wavefront Media Group. She decides which shows are commissioned, scheduled and promoted across broadcast and streaming. She worries that new releases are getting lost in the streaming catalogue.',
     'Thanks, but data projects aren''t something I run.',
     'Thanks for reaching out. I decide what we programme, but how audience data is used on the platform is Sofia Bennett''s area as Chief Digital Officer.', FALSE),
    ('Wavefront Media Group', 'audience data activation', 'DISTRACTOR', 'Marcus Lee', 'Advertising Sales Director',
     'Marcus Lee is Advertising Sales Director at Wavefront Media Group. He leads the team that sells advertising and builds proposals for agencies and brands. Advertisers are asking for better audience targeting than the group can currently offer.',
     'I appreciate the note, but I''m focused on advertising sales and can''t take this on.',
     NULL, FALSE),
    ('Horizon Hotels Collective', 'property service consistency', 'DECISION_MAKER', 'Noah Patel', 'VP Guest Operations',
     'Noah Patel is VP Guest Operations at Horizon Hotels Collective. He oversees front office, guest services and service standards across every property in the group. Guest satisfaction varies widely between properties, and he needs a consistent experience before the brand initiative launches.',
     NULL, NULL, FALSE),
    ('Horizon Hotels Collective', 'property service consistency', 'DISTRACTOR', 'Isabella Rossi', 'General Manager, Harbourside Hotel',
     'Isabella Rossi is General Manager of the Harbourside Hotel, one of Horizon Hotels Collective''s flagship properties. She runs the hotel''s teams and day-to-day operations. Her hotel''s scores are strong, but she spends hours each week answering head office reporting requests.',
     'Thanks, but I only run one hotel.',
     'Thanks for getting in touch. I can speak for my own hotel, but service standards across the group are set by Noah Patel in Guest Operations.', FALSE),
    ('Horizon Hotels Collective', 'property service consistency', 'DISTRACTOR', 'Kevin O''Brien', 'Revenue Manager',
     'Kevin O''Brien is Revenue Manager at Horizon Hotels Collective. He sets room rates and manages distribution across booking channels for the group. He has noticed that properties with weaker reviews are losing direct bookings.',
     'I appreciate it, but pricing is my focus, so I''m not the right contact.',
     NULL, FALSE),
    ('BlueCurrent Water', 'leak response visibility', 'DECISION_MAKER', 'Theo Martin', 'Head of Asset Strategy',
     'Theo Martin is Head of Asset Strategy at BlueCurrent Water. He owns the long-term plan for the pipe network, including where monitoring and renewal effort is focused. Non-revenue water is rising, and he can''t see quickly enough where leaks occur or how long they take to fix.',
     NULL, NULL, FALSE),
    ('BlueCurrent Water', 'leak response visibility', 'DISTRACTOR', 'Megan Clarke', 'Field Services Supervisor',
     'Megan Clarke is Field Services Supervisor at BlueCurrent Water. She dispatches and supervises the field crews who repair leaks and collect water samples. Her crews often arrive to find a leak has already been reported several times.',
     'Thanks, but I just run the crews.',
     'Thanks for reaching out. My crews fix the leaks, but where monitoring effort goes across the network is Theo Martin''s call in Asset Strategy.', FALSE),
    ('BlueCurrent Water', 'leak response visibility', 'DISTRACTOR', 'Samir Haddad', 'SCADA and Sensor Engineer',
     'Samir Haddad is SCADA and Sensor Engineer at BlueCurrent Water. He maintains the network''s pressure, flow and quality sensors and the control system that collects their readings. Sensor alarms are frequent, but many turn out to be false alerts.',
     'I appreciate the note, but I maintain the sensors and can''t take on projects like this.',
     NULL, FALSE),
    ('Mosaic Foods Cooperative', 'supplier quality coordination', 'DECISION_MAKER', 'Camila Torres', 'Director of Supply Chain',
     'Camila Torres is Director of Supply Chain at Mosaic Foods Cooperative. She runs sourcing and supplier management for the cooperative''s member growers. With the export compliance deadline approaching, she needs traceability evidence for every supplier batch.',
     NULL, NULL, FALSE),
    ('Mosaic Foods Cooperative', 'supplier quality coordination', 'DISTRACTOR', 'Arjun Patel', 'Quality Assurance Manager',
     'Arjun Patel is Quality Assurance Manager at Mosaic Foods Cooperative. He runs product testing, food safety audits and corrective actions at the packing sites. His team spends too long chasing suppliers for missing certificates before each audit.',
     'Thanks, but I''m not the right contact for this.',
     'Thanks for getting in touch. I run the quality checks, but supplier coordination across the cooperative is Camila Torres''s area in Supply Chain.', FALSE),
    ('Mosaic Foods Cooperative', 'supplier quality coordination', 'DISTRACTOR', 'Olivia Grant', 'Export Sales Manager',
     'Olivia Grant is Export Sales Manager at Mosaic Foods Cooperative. She manages relationships with overseas buyers and distributors. Buyers are asking for traceability documents earlier in the sales process.',
     'Thanks, but I''m focused on export customers and can''t take this forward.',
     NULL, FALSE),
    ('LumaCare Clinics', 'care-capacity optimisation', 'DECISION_MAKER', 'Ravi Shah', 'Chief Operating Officer',
     'Ravi Shah is Chief Operating Officer at LumaCare Clinics. He oversees clinic operations and capacity planning across the network, and leads the care access improvement plan. Patient wait times are increasing, and he needs to free capacity without opening new clinics.',
     NULL, NULL, FALSE),
    ('LumaCare Clinics', 'care-capacity optimisation', 'DISTRACTOR', 'Dr Anna Kowalski', 'Medical Director',
     'Dr Anna Kowalski is Medical Director at LumaCare Clinics. She leads the clinical workforce and is responsible for clinical governance and patient safety. She is concerned that long waits are delaying care for patients with urgent needs.',
     'Thanks, but I can''t take this forward.',
     'Thanks for getting in touch. I''m responsible for clinical standards, but how clinic capacity is planned across the network is an operations matter, and the care access plan is run from there.', FALSE),
    ('LumaCare Clinics', 'care-capacity optimisation', 'DISTRACTOR', 'Ben Thompson', 'Scheduling Systems Analyst',
     'Ben Thompson is Scheduling Systems Analyst at LumaCare Clinics. He configures the appointment scheduling system, its reminder messages and its reports. He fields constant requests for one-off reports on clinic utilisation.',
     'I appreciate the note, but I support the scheduling system and can''t start projects.',
     NULL, FALSE),
    ('Ironwood Manufacturing', 'quality and downtime reduction', 'DECISION_MAKER', 'Mina Kaur', 'VP Manufacturing Excellence',
     'Mina Kaur is VP Manufacturing Excellence at Ironwood Manufacturing. She leads the plant performance programme, covering quality, maintenance practice and continuous improvement at every plant. Unplanned downtime is above target, and quality defects are rising on the lines with the most stoppages.',
     NULL, NULL, FALSE),
    ('Ironwood Manufacturing', 'quality and downtime reduction', 'DISTRACTOR', 'Greg Walsh', 'Maintenance Planner',
     'Greg Walsh is Maintenance Planner at Ironwood Manufacturing''s main plant. He schedules preventive maintenance and coordinates technicians and spare parts. Planned maintenance keeps being bumped by breakdowns.',
     'Thanks, but I just plan the maintenance schedule.',
     'Thanks for reaching out. I plan maintenance for one plant, but the plant performance programme is led by Mina Kaur in Manufacturing Excellence.', FALSE),
    ('Ironwood Manufacturing', 'quality and downtime reduction', 'DISTRACTOR', 'Yuki Sato', 'MES Administrator',
     'Yuki Sato is MES Administrator at Ironwood Manufacturing. She supports the manufacturing execution system that records production, quality checks and machine status. Machine data is captured, but few people use the reports she builds.',
     'I appreciate the note, but I support the MES and can''t take this forward.',
     NULL, FALSE),
    ('Verdant Retail Bank', 'KYC workflow improvement', 'DECISION_MAKER', 'Daniel Kim', 'Chief Risk Operations Officer',
     'Daniel Kim is Chief Risk Operations Officer at Verdant Retail Bank. He runs the teams that carry out customer due diligence and onboarding checks, and leads the risk remediation plan. Remediation milestones are tracked by the board, and the KYC backlog is putting the next milestone at risk.',
     NULL, NULL, FALSE),
    ('Verdant Retail Bank', 'KYC workflow improvement', 'DISTRACTOR', 'Laura Chen', 'Head of Compliance',
     'Laura Chen is Head of Compliance at Verdant Retail Bank. She sets the bank''s financial crime and conduct policies and reports to the regulator. She is concerned that KYC files fail quality checks because documents are missing.',
     'Thanks, but compliance can''t take on this kind of work.',
     'Thanks for getting in touch. Compliance sets the KYC policy, but running the checks and the remediation plan sits with risk operations, not with me.', FALSE),
    ('Verdant Retail Bank', 'KYC workflow improvement', 'DISTRACTOR', 'Mark Evans', 'Branch Network Manager',
     'Mark Evans is Branch Network Manager at Verdant Retail Bank. He leads the branch managers and sets staffing and opening hours across the branch network. New customers complain that opening an account takes too long in branch.',
     'I appreciate the note, but I''m not the right person for this.',
     NULL, FALSE),
    ('Pathfinder Mobility', 'last-mile delivery control', 'DECISION_MAKER', 'Jade Wilson', 'VP Network Operations',
     'Jade Wilson is VP Network Operations at Pathfinder Mobility. She runs the depots, delivery routes and drivers across the network, and leads peak season readiness. Late and missed deliveries are putting contract renewals with major customers at risk.',
     NULL, NULL, FALSE),
    ('Pathfinder Mobility', 'last-mile delivery control', 'DISTRACTOR', 'Liam Foster', 'Key Account Manager',
     'Liam Foster is Key Account Manager at Pathfinder Mobility. He manages the relationships with the company''s largest retail customers. Customers keep escalating late deliveries to him ahead of contract renewal talks.',
     'Thanks, but I''m not the right person for this.',
     'Thanks for reaching out. I hear about late deliveries from customers, but delivery operations are run by Jade Wilson in Network Operations.', FALSE),
    ('Pathfinder Mobility', 'last-mile delivery control', 'DISTRACTOR', 'Nadia Rahman', 'Fleet Telematics Lead',
     'Nadia Rahman is Fleet Telematics Lead at Pathfinder Mobility. She manages the vehicle tracking devices and the data they produce. She has more vehicle data than any team currently uses.',
     'I appreciate the note, but I look after telematics and can''t take this on.',
     NULL, FALSE),
    ('Keystone Legal Services', 'knowledge and staffing optimisation', 'DECISION_MAKER', 'Henry Brooks', 'Chief Practice Officer',
     'Henry Brooks is Chief Practice Officer at Keystone Legal Services. He runs the firm''s operations, including resourcing, knowledge management and the client service transformation. Utilisation and response times vary widely between practice teams, and clients are noticing.',
     NULL, NULL, FALSE),
    ('Keystone Legal Services', 'knowledge and staffing optimisation', 'DISTRACTOR', 'Emma Collins', 'Partner, Commercial Litigation',
     'Emma Collins is a Partner in Commercial Litigation at Keystone Legal Services. She leads her team''s client work, supervises its lawyers and signs off its bills. Her team is stretched while other teams have spare capacity.',
     'Thanks, but I''m not the right person for this.',
     'Thanks for getting in touch. I can only speak for my team. Staffing and knowledge across the firm are managed by Henry Brooks as Chief Practice Officer.', FALSE),
    ('Keystone Legal Services', 'knowledge and staffing optimisation', 'DISTRACTOR', 'Joshua Tan', 'Knowledge Systems Librarian',
     'Joshua Tan is Knowledge Systems Librarian at Keystone Legal Services. He maintains the precedent library and the firm''s document management system. Lawyers keep drafting from scratch because they can''t find existing precedents.',
     'I appreciate the note, but I maintain the library and can''t take this forward.',
     NULL, FALSE),
    ('Northstar Telecom', 'incident triage modernisation', 'DECISION_MAKER', 'Priyanka Rao', 'Director of Network Delivery',
     'Priyanka Rao is Director of Network Delivery at Northstar Telecom. She leads the teams that build, assure and fix the network, including incident triage for the 5G rollout. Rollout dates are commercially committed, and slow incident triage is delaying sites going live.',
     NULL, NULL, FALSE),
    ('Northstar Telecom', 'incident triage modernisation', 'DISTRACTOR', 'Craig Mitchell', 'Network Operations Centre Manager',
     'Craig Mitchell is Network Operations Centre Manager at Northstar Telecom. He leads the shift teams that monitor the live network around the clock. His operators are overwhelmed by duplicate alarms during busy periods.',
     'Thanks, but I can''t take this forward.',
     'Thanks for reaching out. My team watches the network, but how incidents are triaged across the rollout is decided by network delivery leadership.', FALSE),
    ('Northstar Telecom', 'incident triage modernisation', 'DISTRACTOR', 'Sophie Laurent', 'Customer Service Director',
     'Sophie Laurent is Customer Service Director at Northstar Telecom. She leads the contact centres and the customer complaints team. Customers in new 5G areas are calling about coverage problems.',
     'I appreciate the note, but I''m not the right person for this.',
     NULL, FALSE),
    ('Solaris Life Sciences', 'trial site visibility', 'DECISION_MAKER', 'Lucas Meyer', 'VP Clinical Operations',
     'Lucas Meyer is VP Clinical Operations at Solaris Life Sciences. He oversees how clinical trials are run at every site and leads the trial acceleration portfolio. Protocol timelines are at risk, and he lacks a timely view of which trial sites are falling behind.',
     NULL, NULL, FALSE),
    ('Solaris Life Sciences', 'trial site visibility', 'DISTRACTOR', 'Dr Helena Voss', 'Head of Clinical Quality',
     'Dr Helena Voss is Head of Clinical Quality at Solaris Life Sciences. She runs site audits and makes sure trials follow good clinical practice. Recent audits found sites logging trial data late.',
     'Thanks, but I can''t take this forward.',
     'Thanks for getting in touch. I audit the sites, but how trial sites are tracked across the portfolio is run by clinical operations leadership.', FALSE),
    ('Solaris Life Sciences', 'trial site visibility', 'DISTRACTOR', 'Aaron Fitzgerald', 'Clinical Supply Planner',
     'Aaron Fitzgerald is Clinical Supply Planner at Solaris Life Sciences. He plans and ships trial medicine and sample collection kits to trial sites. Sites keep requesting supplies at short notice.',
     'I appreciate the note, but I plan supplies and can''t take this on.',
     NULL, FALSE),
    ('Granite Insurance', 'straight-through claims processing', 'DECISION_MAKER', 'Natalie Ford', 'Chief Claims Officer',
     'Natalie Ford is Chief Claims Officer at Granite Insurance. She leads every claims team and the claims transformation programme. Claim cycle times and leakage are under review, and too many simple claims still need manual handling.',
     NULL, NULL, FALSE),
    ('Granite Insurance', 'straight-through claims processing', 'DISTRACTOR', 'Ryan Douglas', 'Claims Assessor Team Leader',
     'Ryan Douglas is a Claims Assessor Team Leader at Granite Insurance. He leads a team of assessors handling motor and home claims. His assessors spend much of their day re-keying information from documents.',
     'Thanks, but I just lead one claims team.',
     'Thanks for reaching out. I run one team of assessors, but claims processing across the business is Natalie Ford''s area as Chief Claims Officer.', FALSE),
    ('Granite Insurance', 'straight-through claims processing', 'DISTRACTOR', 'Tasha Brown', 'Head of Underwriting',
     'Tasha Brown is Head of Underwriting at Granite Insurance. She leads the underwriters who assess risks, set underwriting rules and prepare quotes for brokers. She wants clearer claims data to refine underwriting rules.',
     'I appreciate the note, but underwriting doesn''t run claims, so I''m not the right contact.',
     NULL, FALSE),
    ('Cobalt Mining Group', 'shutdown planning assurance', 'DECISION_MAKER', 'Ethan Cole', 'General Manager Operations',
     'Ethan Cole is General Manager Operations at Cobalt Mining Group''s main site. He is accountable for production, maintenance and planned shutdowns across the site, and leads the production stability initiative. Availability losses are reducing output, and recent shutdowns overran their planned duration.',
     NULL, NULL, FALSE),
    ('Cobalt Mining Group', 'shutdown planning assurance', 'DISTRACTOR', 'Jake Turner', 'Shutdown Coordinator',
     'Jake Turner is Shutdown Coordinator at Cobalt Mining Group. He schedules contractors, permits and work packs for each planned shutdown. Work packs often arrive late, and scope keeps changing in the final week before a shutdown.',
     'Thanks, but I can''t take this forward.',
     'Thanks for getting in touch. I coordinate the shutdowns, but how they''re planned and assured sits with site operations leadership.', FALSE),
    ('Cobalt Mining Group', 'shutdown planning assurance', 'DISTRACTOR', 'Leah Sinclair', 'Safety and Environment Manager',
     'Leah Sinclair is Safety and Environment Manager at Cobalt Mining Group. She oversees safety systems, incident investigations and environmental compliance. Overrunning shutdowns add fatigue and safety risk for the crews.',
     'I appreciate the note, but I''m not the right person for this.',
     NULL, FALSE),
    ('Arbor Social Housing', 'tenant service recovery', 'DECISION_MAKER', 'Imani Price', 'Director of Customer Services',
     'Imani Price is Director of Customer Services at Arbor Social Housing. She leads tenant services, the repairs contact centre and the service recovery plan. Repair completion times are escalating, and tenant complaints to the housing ombudsman are rising.',
     NULL, NULL, FALSE),
    ('Arbor Social Housing', 'tenant service recovery', 'DISTRACTOR', 'Callum Reid', 'Repairs Contractor Manager',
     'Callum Reid is Repairs Contractor Manager at Arbor Social Housing. He manages the contracts with the maintenance firms that carry out repairs. Contractors say jobs reach them with too little detail to fix first time.',
     'Thanks, but I only manage the contractors.',
     'Thanks for reaching out. I manage the contractors, but the tenant service recovery plan is led by Imani Price in Customer Services.', FALSE),
    ('Arbor Social Housing', 'tenant service recovery', 'DISTRACTOR', 'Joanne Pike', 'Tenant Engagement Officer',
     'Joanne Pike is Tenant Engagement Officer at Arbor Social Housing. She runs tenant forums and resident feedback groups. Tenants tell her they never know when a repair will happen.',
     'I appreciate the note, but I''m not able to take this forward.',
     NULL, FALSE),
    ('Brightline Consumer Goods', 'trade promotion execution', 'DECISION_MAKER', 'Marco Silva', 'VP Commercial Operations',
     'Marco Silva is VP Commercial Operations at Brightline Consumer Goods. He runs sales planning, trade promotions and distributor performance. Forecast error during promotions is eroding margin, and the margin protection programme is under scrutiny.',
     NULL, NULL, FALSE),
    ('Brightline Consumer Goods', 'trade promotion execution', 'DISTRACTOR', 'Chloe Martin', 'Brand Manager',
     'Chloe Martin is Brand Manager for Brightline Consumer Goods'' snack range. She plans product launches, advertising and brand campaigns. Her promotions sell out in some stores while sitting unsold in others.',
     'Thanks, but I''m not the right person for this.',
     'Thanks for getting in touch. I plan the brand side, but trade promotions are run by Marco Silva in Commercial Operations.', FALSE),
    ('Brightline Consumer Goods', 'trade promotion execution', 'DISTRACTOR', 'Diego Fernandez', 'Demand Planner',
     'Diego Fernandez is a Demand Planner at Brightline Consumer Goods. He builds the monthly sales forecast for each product range. Promotional volumes are the hardest part of his forecast to get right.',
     'I appreciate the note, but I build forecasts and can''t take on projects like this.',
     NULL, FALSE),
    ('Meridian Cloudworks', 'customer onboarding acceleration', 'DECISION_MAKER', 'Jon Bell', 'VP Customer Delivery',
     'Jon Bell is VP Customer Delivery at Meridian Cloudworks. He leads the implementation and onboarding teams that bring new enterprise customers live. The implementation backlog keeps growing, and slow onboarding is starting to affect renewals.',
     NULL, NULL, FALSE),
    ('Meridian Cloudworks', 'customer onboarding acceleration', 'DISTRACTOR', 'Alicia Gomez', 'Enterprise Account Executive',
     'Alicia Gomez is an Enterprise Account Executive at Meridian Cloudworks. She sells the platform to large organisations and manages them through renewal. Two of her customers have delayed their renewals until they are fully live.',
     'Thanks, but I''m not the right person for this.',
     'Thanks for reaching out. I sell and renew accounts, but onboarding is run by Jon Bell in Customer Delivery.', FALSE),
    ('Meridian Cloudworks', 'customer onboarding acceleration', 'DISTRACTOR', 'Felix Moreau', 'Product Manager, Integrations',
     'Felix Moreau is Product Manager for Integrations at Meridian Cloudworks. He decides which connectors and APIs the product team builds next. Customers keep requesting new integrations during onboarding.',
     'I appreciate the note, but I look after the product roadmap and can''t take this forward.',
     NULL, FALSE),
    ('Coastal State Government', 'casework transparency', 'DECISION_MAKER', 'Fiona Walsh', 'Deputy Secretary, Service Delivery',
     'Fiona Walsh is Deputy Secretary, Service Delivery at Coastal State Government. She is accountable for the department''s casework and payment services, and leads its response to the public value improvement review. Audit findings require a measurable improvement in how casework decisions are recorded and explained.',
     NULL, NULL, FALSE),
    ('Coastal State Government', 'casework transparency', 'DISTRACTOR', 'Simon Burke', 'Director of Internal Audit',
     'Simon Burke is Director of Internal Audit at Coastal State Government. He leads audits of the department''s programmes and reports findings to the audit committee. He is following up recent findings that casework decisions were poorly documented.',
     'Thanks, but I can''t take this forward.',
     'Thanks for getting in touch. Audit identifies the issues, but responding to them is a matter for service delivery leadership, so I''m not the person to engage.', FALSE),
    ('Coastal State Government', 'casework transparency', 'DISTRACTOR', 'Mia Johansson', 'Records Manager',
     'Mia Johansson is Records Manager at Coastal State Government. She manages records policy and the department''s records systems. Case files are scattered across several systems.',
     'I appreciate the note, but I''m not the right person for this.',
     NULL, FALSE),
    ('CommonGround Foundation', 'funding outcome visibility', 'DECISION_MAKER', 'Samuel Adeyemi', 'Chief Programmes Officer',
     'Samuel Adeyemi is Chief Programmes Officer at CommonGround Foundation. He leads every programme the foundation funds and how their outcomes are measured and reported. With the funding renewal cycle approaching, funders are asking for clearer evidence of impact.',
     NULL, NULL, FALSE),
    ('CommonGround Foundation', 'funding outcome visibility', 'DISTRACTOR', 'Rebecca Holt', 'Grants and Partnerships Manager',
     'Rebecca Holt is Grants and Partnerships Manager at CommonGround Foundation. She writes funding applications and manages relationships with funders. Funders keep asking her for outcome data she can''t easily find.',
     'Thanks, but I''m not the right person for this.',
     'Thanks for reaching out. I deal with funders, but how programme outcomes are measured is Samuel Adeyemi''s area as Chief Programmes Officer.', FALSE),
    ('CommonGround Foundation', 'funding outcome visibility', 'DISTRACTOR', 'Tariq Aziz', 'Database and CRM Officer',
     'Tariq Aziz is Database and CRM Officer at CommonGround Foundation. He maintains the supporter CRM, including volunteer records, and the grants database. Programme staff keep outcome data in their own spreadsheets.',
     'I appreciate the note, but I maintain the databases and can''t take this forward.',
     NULL, FALSE);

-- 2. Find each problem's scenario by its title. Only the seeded live and draft
--    rows are touched: archived copies and admin-created scenarios are not.
CREATE TEMP TABLE v65_scenario ON COMMIT DROP AS
SELECT DISTINCT c.company, c.problem, s.id AS scenario_id
FROM v65_contact c
JOIN scenarios s ON s.title = c.company || ': ' || c.problem
WHERE s.id::text LIKE '62000000-0000-0000-0000-%'
  AND s.status IN ('ACTIVE', 'DRAFT');

DO $$
DECLARE
    missing    TEXT;
    duplicated TEXT;
BEGIN
    SELECT string_agg(DISTINCT c.company || ': ' || c.problem, '; ') INTO missing
    FROM v65_contact c
    WHERE NOT EXISTS (SELECT 1 FROM v65_scenario s WHERE s.company = c.company AND s.problem = c.problem);
    IF missing IS NOT NULL THEN
        RAISE NOTICE 'V65: skipped, no live or draft scenario titled: %', missing;
    END IF;

    SELECT string_agg(company || ': ' || problem, '; ') INTO duplicated
    FROM (SELECT company, problem FROM v65_scenario GROUP BY company, problem HAVING count(*) > 1) d;
    IF duplicated IS NOT NULL THEN
        RAISE EXCEPTION 'V65: more than one scenario matches: %', duplicated;
    END IF;
END $$;

-- 3. Contacts.
-- Decision maker: the scenario already has exactly one; update it in place.
UPDATE personas p
SET name = c.name, job_title = c.job_title, visible_concerns = c.bio,
    updated_at = NOW(), version = p.version + 1
FROM v65_contact c JOIN v65_scenario s USING (company, problem)
WHERE c.contact_role = 'DECISION_MAKER'
  AND p.scenario_id = s.scenario_id AND p.contact_role = 'DECISION_MAKER';

-- Distracting contacts that already exist (matched by name): refresh them.
UPDATE personas p
SET job_title = c.job_title, visible_concerns = c.bio,
    decline_reply = CASE WHEN c.keep_replies THEN p.decline_reply ELSE c.decline_reply END,
    hint_reply    = CASE WHEN c.keep_replies THEN p.hint_reply    ELSE c.hint_reply    END,
    updated_at = NOW(), version = p.version + 1
FROM v65_contact c JOIN v65_scenario s USING (company, problem)
WHERE c.contact_role = 'DISTRACTOR'
  AND p.scenario_id = s.scenario_id AND p.contact_role = 'DISTRACTOR' AND p.name = c.name;

-- New distracting contacts. They never reach the AI, so the AI fields stay empty.
INSERT INTO personas (id, scenario_id, name, job_title, organisation, visible_concerns,
                      contact_role, decline_reply, hint_reply, prompt_version, created_at, updated_at, version)
SELECT md5(s.scenario_id::text || c.name)::uuid, s.scenario_id, c.name, c.job_title, c.company, c.bio,
       'DISTRACTOR', c.decline_reply, c.hint_reply, 1, NOW(), NOW(), 0
FROM v65_contact c JOIN v65_scenario s USING (company, problem)
WHERE c.contact_role = 'DISTRACTOR'
  AND NOT EXISTS (SELECT 1 FROM personas p WHERE p.scenario_id = s.scenario_id AND p.name = c.name)
ON CONFLICT (id) DO NOTHING;

-- 4. Research clue: the stakeholder passage says which function owns the
--    problem (never the person), so the right contact can be reasoned out.
CREATE TEMP TABLE v65_passage (company TEXT NOT NULL, problem TEXT NOT NULL, content TEXT NOT NULL) ON COMMIT DROP;
INSERT INTO v65_passage VALUES
    ('HarbourGrid Utilities', 'outage response orchestration',
     'Influence boundary. Outage restoration is run by Grid Operations, which directs the control centre and the field crews. The contact centre and GIS teams support restoration but do not decide how crews are dispatched.'),
    ('CivicLink Services', 'service request triage',
     'Influence boundary. Service request triage is run by the Chief Service Officer''s frontline teams. Digital channels and records management shape how requests arrive and are stored, but do not decide how they are prioritised.'),
    ('GreenSpan Developments', 'portfolio delivery assurance',
     'Influence boundary. Delivery assurance across the capital portfolio sits with programme delivery leadership, which reports at each gateway review. Commercial and individual project managers supply the data but do not set how the portfolio is assured.'),
    ('Wavefront Media Group', 'audience data activation',
     'Influence boundary. The streaming platform and the use of audience data are led by the Chief Digital Officer. Programming and advertising sales draw on audience insight but do not decide how the data is used.'),
    ('Horizon Hotels Collective', 'property service consistency',
     'Influence boundary. Service standards across all properties are set by Guest Operations at group level. Hotel general managers run their own sites and revenue management sets prices, but neither sets group-wide service standards.'),
    ('BlueCurrent Water', 'leak response visibility',
     'Influence boundary. Leak monitoring priorities across the network are set by Asset Strategy as part of the long-term network plan. Field services and the control systems team respond to leaks but do not set where monitoring is focused.'),
    ('Mosaic Foods Cooperative', 'supplier quality coordination',
     'Influence boundary. Supplier quality coordination sits with Supply Chain, which manages every member supplier. Quality assurance tests the product and export sales manage buyers, but neither runs supplier coordination.'),
    ('LumaCare Clinics', 'care-capacity optimisation',
     'Influence boundary. Capacity planning across the clinic network is led by operations leadership through the care access improvement plan. Clinical leaders set standards and the scheduling team configures systems, but neither plans capacity.'),
    ('Ironwood Manufacturing', 'quality and downtime reduction',
     'Influence boundary. Quality and downtime improvement across the plants is led by Manufacturing Excellence through the plant performance programme. Maintenance planning and systems teams support it but do not set its priorities.'),
    ('Verdant Retail Bank', 'KYC workflow improvement',
     'Influence boundary. KYC checks and the risk remediation plan are run by risk operations, which reports progress to the board. Compliance sets policy and branches open accounts, but neither runs the KYC workflow.'),
    ('Pathfinder Mobility', 'last-mile delivery control',
     'Influence boundary. Last-mile delivery performance is owned by Network Operations, which runs the depots, routes and drivers. Account management and telematics support delivery but do not run it.'),
    ('Keystone Legal Services', 'knowledge and staffing optimisation',
     'Influence boundary. Resourcing and knowledge management across the firm sit with the Chief Practice Officer''s operations team. Partners run their own client teams and the library maintains precedents, but neither sets firm-wide staffing.'),
    ('Northstar Telecom', 'incident triage modernisation',
     'Influence boundary. Incident triage for the rollout sits with network delivery leadership, which builds and assures new sites. The operations centre monitors the network and customer service handles complaints, but neither sets the triage process.'),
    ('Solaris Life Sciences', 'trial site visibility',
     'Influence boundary. Visibility of trial site performance is owned by clinical operations leadership through the trial acceleration portfolio. Clinical quality audits sites and supply planning ships medicine, but neither runs site tracking.'),
    ('Granite Insurance', 'straight-through claims processing',
     'Influence boundary. Claims processing across the business is led by the Chief Claims Officer through the claims transformation programme. Assessor teams handle claims and underwriting uses the data, but neither changes the process.'),
    ('Cobalt Mining Group', 'shutdown planning assurance',
     'Influence boundary. Shutdown planning and its assurance sit with site operations leadership through the production stability initiative. Shutdown coordination and safety teams carry out and check the work, but neither sets the planning approach.'),
    ('Arbor Social Housing', 'tenant service recovery',
     'Influence boundary. Tenant service recovery is led by Customer Services, which runs the repairs contact centre. Contractor management and tenant engagement support it but do not decide how service is recovered.'),
    ('Brightline Consumer Goods', 'trade promotion execution',
     'Influence boundary. Trade promotion execution is owned by Commercial Operations, which runs promotion planning with distributors. Brand and demand planning teams feed into promotions but do not run them.'),
    ('Meridian Cloudworks', 'customer onboarding acceleration',
     'Influence boundary. Customer onboarding is owned by Customer Delivery, which runs implementation for new enterprise customers. Sales and product teams influence onboarding but do not run it.'),
    ('Coastal State Government', 'casework transparency',
     'Influence boundary. Casework services and the response to audit findings sit with service delivery leadership at deputy secretary level. Internal audit and records management inform the response but do not lead it.'),
    ('CommonGround Foundation', 'funding outcome visibility',
     'Influence boundary. Outcome measurement across programmes is led by the Chief Programmes Officer. Grants and data teams use and store outcome data but do not decide how it is measured.');

UPDATE document_chunks ch
SET content = x.content, updated_at = NOW(), version = ch.version + 1
FROM v65_passage x JOIN v65_scenario s USING (company, problem)
WHERE ch.scenario_id = s.scenario_id
  AND ch.collection = 'RESEARCH_STAKEHOLDER' AND ch.chunk_index = 2;

-- Rebuild each changed document's combined text from all of its passages (as V62 does).
UPDATE knowledge_documents d
SET source_text = r.source_text, updated_at = NOW(), version = d.version + 1
FROM (
    SELECT ch.document_id, string_agg(ch.content, E'\n\n' ORDER BY ch.chunk_index) AS source_text
    FROM document_chunks ch
    WHERE ch.chunk_index < 4
      AND ch.document_id IN (
          SELECT changed.document_id
          FROM document_chunks changed
          JOIN v65_scenario s ON s.scenario_id = changed.scenario_id
          JOIN v65_passage x ON x.company = s.company AND x.problem = s.problem
          WHERE changed.collection = 'RESEARCH_STAKEHOLDER' AND changed.chunk_index = 2)
    GROUP BY ch.document_id
) r
WHERE d.id = r.document_id;

-- 5. Every scenario handled here must end with exactly one decision maker and
--    two distracting contacts; otherwise nothing above is kept.
DO $$
DECLARE
    wrong TEXT;
BEGIN
    SELECT string_agg(format('%s: %s (%s decision makers, %s distracting contacts)',
                             x.company, x.problem, x.decision_makers, x.distractors), '; ') INTO wrong
    FROM (
        SELECT s.company, s.problem,
               count(p.id) FILTER (WHERE p.contact_role = 'DECISION_MAKER') AS decision_makers,
               count(p.id) FILTER (WHERE p.contact_role = 'DISTRACTOR') AS distractors
        FROM v65_scenario s LEFT JOIN personas p ON p.scenario_id = s.scenario_id
        GROUP BY s.company, s.problem
    ) x
    WHERE x.decision_makers <> 1 OR x.distractors <> 2;
    IF wrong IS NOT NULL THEN
        RAISE EXCEPTION 'V65: each scenario must have 1 decision maker and 2 distracting contacts: %', wrong;
    END IF;
END $$;
