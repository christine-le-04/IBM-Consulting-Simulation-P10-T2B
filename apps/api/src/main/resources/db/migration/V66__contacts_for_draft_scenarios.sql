-- ═══════════════════════════════════════════════════════════════════════════
-- Contacts for every draft scenario (problems whose content is not written
-- yet). Each still had the generated contact copied from its company's first
-- problem, so it gets a decision maker who owns this problem, two distracting
-- contacts and a stakeholder research passage, ready for when it is written.
-- The company profile's decision maker is updated to match.
--
-- Colleagues recur across a company's scenarios with the same role, so the
-- organisation reads consistently from one problem to the next.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Every contact, with the bio shown on the contact card (role, what they
--    own, current concern). keep_replies: an existing contact whose
--    pre-written replies are kept as they are.
CREATE TEMP TABLE v66_contact (
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

INSERT INTO v66_contact VALUES
    ('HarbourGrid Utilities', 'smart-meter billing errors', 'DECISION_MAKER', 'Helen Tran', 'Head of Billing Operations',
     'Helen Tran is Head of Billing Operations at HarbourGrid Utilities. She runs the billing team and the process that turns smart-meter reads into customer bills. Billing errors and the complaints they cause have risen since the smart-meter rollout.',
     NULL, NULL, FALSE),
    ('HarbourGrid Utilities', 'smart-meter billing errors', 'DISTRACTOR', 'Sarah Lindqvist', 'Customer Contact Centre Manager',
     'Sarah Lindqvist is Customer Contact Centre Manager at HarbourGrid Utilities. She leads the team that answers customer calls, from outage reports to billing enquiries. Billing complaints have become her team''s biggest reason for calls since the smart-meter rollout.',
     'Thanks, but I''m not the right person for this.',
     'Thanks for getting in touch. My team takes the billing complaints, but billing itself is run by Helen Tran in Billing Operations.', FALSE),
    ('HarbourGrid Utilities', 'smart-meter billing errors', 'DISTRACTOR', 'Victor Hughes', 'Metering Services Manager',
     'Victor Hughes is Metering Services Manager at HarbourGrid Utilities. He manages the smart-meter fleet and the technicians who install and repair meters. Some meters are sending incomplete reads.',
     'Thanks, but I look after the meters, not billing.',
     'I can tell you about the meters, but how reads become bills is Helen Tran''s area in Billing Operations.', FALSE),
    ('CivicLink Services', 'permit processing backlog', 'DECISION_MAKER', 'Kwame Mensah', 'Director of Permits and Approvals',
     'Kwame Mensah is Director of Permits and Approvals at CivicLink Services. He leads the assessment teams that process building, business and event permits. Permit applications are waiting far longer than the published service standards.',
     NULL, NULL, FALSE),
    ('CivicLink Services', 'permit processing backlog', 'DISTRACTOR', 'Peter Novak', 'Digital Channels Manager',
     'Peter Novak is Digital Channels Manager at CivicLink Services. He runs the website, online forms and portal through which citizens lodge requests and applications. Many permit applications arrive incomplete, and applicants keep asking for status updates.',
     'Thanks, but I only look after the online channels.',
     'Thanks for getting in touch. I run the online portal, but permit assessment is managed by Kwame Mensah in Permits and Approvals.', FALSE),
    ('CivicLink Services', 'permit processing backlog', 'DISTRACTOR', 'Linda Forsyth', 'Senior Building Assessor',
     'Linda Forsyth is a Senior Building Assessor at CivicLink Services. She assesses complex building permit applications and mentors junior assessors. Her queue has doubled, and she spends hours chasing missing documents.',
     'I appreciate the note, but I assess applications and can''t take this forward.',
     NULL, FALSE),
    ('CivicLink Services', 'contractor spend visibility', 'DECISION_MAKER', 'Rosa Delgado', 'Chief Financial Officer',
     'Rosa Delgado is Chief Financial Officer at CivicLink Services. She leads finance, budget reporting and the oversight of spending across every business unit. Contractor spending has grown faster than budget, and she can''t see clearly what each contract is delivering.',
     NULL, NULL, FALSE),
    ('CivicLink Services', 'contractor spend visibility', 'DISTRACTOR', 'Gavin Ellis', 'Procurement Manager',
     'Gavin Ellis is Procurement Manager at CivicLink Services. He runs tenders and manages the panel of approved contractors. Business units keep engaging contractors outside the approved panel.',
     'Thanks, but I can''t take this forward.',
     'Thanks for getting in touch. I run tenders, but visibility of contractor spending across the department is owned by finance leadership.', FALSE),
    ('CivicLink Services', 'contractor spend visibility', 'DISTRACTOR', 'Nick Stavros', 'Business Unit Manager, Roads and Parks',
     'Nick Stavros is Business Unit Manager for Roads and Parks at CivicLink Services. He manages the unit''s crews, projects and operating budget. His unit relies heavily on contractors during the peak season.',
     'I appreciate the note, but I''m not the right person for this.',
     NULL, FALSE),
    ('GreenSpan Developments', 'defects at buyer handover', 'DECISION_MAKER', 'Nora Osei', 'Head of Customer Handover',
     'Nora Osei is Head of Customer Handover at GreenSpan Developments. She runs final inspections, settlement handovers and the defects period for home buyers. Buyers are finding more defects at handover, and fixing them is delaying settlements.',
     NULL, NULL, FALSE),
    ('GreenSpan Developments', 'defects at buyer handover', 'DISTRACTOR', 'Ivan Petrov', 'Senior Project Manager, Riverside Precinct',
     'Ivan Petrov is Senior Project Manager for the Riverside Precinct development at GreenSpan Developments. He runs the project team, builders and site schedule for that one development until practical completion. His team is under pressure to finish on time for buyer settlements.',
     'Thanks, but I only run one project.',
     'Thanks for getting in touch. My job ends at practical completion. Handover and defects for buyers are run by Nora Osei.', FALSE),
    ('GreenSpan Developments', 'defects at buyer handover', 'DISTRACTOR', 'Claire Dubois', 'Commercial Manager',
     'Claire Dubois is Commercial Manager at GreenSpan Developments. She manages builder and contractor contracts, variations and payment claims across the portfolio. Builders are slow to return to fix defects once they have been paid.',
     'Thanks, but this isn''t a commercial decision.',
     'I manage the builder contracts, but the handover process for buyers is Nora Osei''s area.', FALSE),
    ('Wavefront Media Group', 'ad sales proposal turnaround', 'DECISION_MAKER', 'Marcus Lee', 'Advertising Sales Director',
     'Marcus Lee is Advertising Sales Director at Wavefront Media Group. He leads the team that sells advertising and builds proposals for agencies and brands. Proposals take more than a week to turn around, and agencies are booking with faster competitors.',
     NULL, NULL, FALSE),
    ('Wavefront Media Group', 'ad sales proposal turnaround', 'DISTRACTOR', 'Jess Walker', 'Sales Planner',
     'Jess Walker is a Sales Planner at Wavefront Media Group. She builds the schedules and pricing behind each advertising proposal. She rebuilds the same spreadsheets for almost every proposal.',
     'Thanks, but I just build the schedules.',
     'Thanks for reaching out. I put proposals together, but the proposal process is Marcus Lee''s call as Advertising Sales Director.', FALSE),
    ('Wavefront Media Group', 'ad sales proposal turnaround', 'DISTRACTOR', 'Lucy Harrington', 'Head of Content Programming',
     'Lucy Harrington is Head of Content Programming at Wavefront Media Group. She decides which shows are commissioned, scheduled and promoted across broadcast and streaming. Sales keeps asking her for programme details at short notice.',
     'Thanks, but I''m not involved in advertising sales.',
     'I supply programme details, but advertising proposals are run by Marcus Lee''s sales team.', FALSE),
    ('Wavefront Media Group', 'content rights tracking', 'DECISION_MAKER', 'Anika Brandt', 'Director of Rights and Licensing',
     'Anika Brandt is Director of Rights and Licensing at Wavefront Media Group. She leads the team that acquires, tracks and manages the rights to every show the group airs or streams. Shows have been pulled after rights windows were missed, and some content is paid for but never used.',
     NULL, NULL, FALSE),
    ('Wavefront Media Group', 'content rights tracking', 'DISTRACTOR', 'Paul Mercer', 'Head of Legal',
     'Paul Mercer is Head of Legal at Wavefront Media Group. He leads the in-house lawyers who negotiate and review content contracts. A recent rights dispute has made the board nervous.',
     'Thanks, but legal can''t take this on.',
     'Thanks for getting in touch. We review the contracts, but tracking rights once they''re signed is the job of the rights and licensing function.', FALSE),
    ('Wavefront Media Group', 'content rights tracking', 'DISTRACTOR', 'Sam Whitfield', 'Streaming Catalogue Manager',
     'Sam Whitfield is Streaming Catalogue Manager at Wavefront Media Group. He manages what appears in the streaming catalogue and when titles go live. He has had to remove titles at short notice when rights expired.',
     'I appreciate the note, but I''m not the right person for this.',
     NULL, FALSE),
    ('Horizon Hotels Collective', 'housekeeping scheduling', 'DECISION_MAKER', 'Maria Santos', 'Director of Housekeeping',
     'Maria Santos is Director of Housekeeping at Horizon Hotels Collective. She sets housekeeping standards, staffing and schedules across every property. Rooms are often not ready at check-in, while housekeepers sit idle early in the shift.',
     NULL, NULL, FALSE),
    ('Horizon Hotels Collective', 'housekeeping scheduling', 'DISTRACTOR', 'Isabella Rossi', 'General Manager, Harbourside Hotel',
     'Isabella Rossi is General Manager of the Harbourside Hotel, one of Horizon Hotels Collective''s flagship properties. She runs the hotel''s teams and day-to-day operations. Early arrivals keep complaining that their rooms aren''t ready.',
     'Thanks, but I only run one hotel.',
     'Thanks for reaching out. I see the problem at my hotel, but housekeeping schedules across the group are set by Maria Santos.', FALSE),
    ('Horizon Hotels Collective', 'housekeeping scheduling', 'DISTRACTOR', 'Kevin O''Brien', 'Revenue Manager',
     'Kevin O''Brien is Revenue Manager at Horizon Hotels Collective. He sets room rates and manages distribution across booking channels for the group. He has started selling early check-in but can''t guarantee rooms will be ready.',
     'Thanks, but I only look after pricing.',
     'I sell early check-in, but housekeeping schedules are Maria Santos''s area.', FALSE),
    ('BlueCurrent Water', 'water quality reporting', 'DECISION_MAKER', 'Dr Priya Iyer', 'Water Quality Manager',
     'Dr Priya Iyer is Water Quality Manager at BlueCurrent Water. She runs the sampling programme, the laboratory results and the reports sent to the health regulator. Reports are compiled by hand from several systems, and a recent one reached the regulator late.',
     NULL, NULL, FALSE),
    ('BlueCurrent Water', 'water quality reporting', 'DISTRACTOR', 'Samir Haddad', 'SCADA and Sensor Engineer',
     'Samir Haddad is SCADA and Sensor Engineer at BlueCurrent Water. He maintains the network''s pressure, flow and quality sensors and the control system that collects their readings. The water quality team keeps asking him for data exports.',
     'Thanks, but I only maintain the sensors.',
     'Thanks for getting in touch. I can provide sensor data, but water quality reporting is run by Dr Priya Iyer.', FALSE),
    ('BlueCurrent Water', 'water quality reporting', 'DISTRACTOR', 'Megan Clarke', 'Field Services Supervisor',
     'Megan Clarke is Field Services Supervisor at BlueCurrent Water. She dispatches and supervises the field crews who repair leaks and collect water samples. Her crews'' sample collection rounds keep changing at short notice.',
     'Thanks, but I just run the crews.',
     'My crews collect the samples, but the reporting is Dr Priya Iyer''s responsibility.', FALSE),
    ('Mosaic Foods Cooperative', 'cold-chain waste', 'DECISION_MAKER', 'Henrik Larsen', 'Logistics Manager',
     'Henrik Larsen is Logistics Manager at Mosaic Foods Cooperative. He runs the refrigerated warehouses and the transport fleet that move produce to market. Produce written off after spoiling in transit has risen sharply this year.',
     NULL, NULL, FALSE),
    ('Mosaic Foods Cooperative', 'cold-chain waste', 'DISTRACTOR', 'Arjun Patel', 'Quality Assurance Manager',
     'Arjun Patel is Quality Assurance Manager at Mosaic Foods Cooperative. He runs product testing, food safety audits and corrective actions at the packing sites. He is rejecting more loads that arrive above safe temperatures.',
     'Thanks, but I''m not the right contact for this.',
     'Thanks for getting in touch. I reject spoiled loads, but the cold chain itself is run by Henrik Larsen in Logistics.', FALSE),
    ('Mosaic Foods Cooperative', 'cold-chain waste', 'DISTRACTOR', 'Olivia Grant', 'Export Sales Manager',
     'Olivia Grant is Export Sales Manager at Mosaic Foods Cooperative. She manages relationships with overseas buyers and distributors. Buyers have started claiming credits for produce that arrives damaged.',
     'Thanks, but I''m focused on customers.',
     'I hear about it from buyers, but the cold chain is Henrik Larsen''s area.', FALSE),
    ('Mosaic Foods Cooperative', 'member payment accuracy', 'DECISION_MAKER', 'Fatima Noor', 'Member Services and Payments Manager',
     'Fatima Noor is Member Services and Payments Manager at Mosaic Foods Cooperative. She runs the team that calculates what each grower is owed for the produce they supply. Members are disputing more payments, and corrections are taking weeks.',
     NULL, NULL, FALSE),
    ('Mosaic Foods Cooperative', 'member payment accuracy', 'DISTRACTOR', 'Peter Haldane', 'Financial Controller',
     'Peter Haldane is Financial Controller at Mosaic Foods Cooperative. He runs the accounts, payment runs and the monthly financial close. Payment corrections are making month-end harder to close.',
     'Thanks, but I can''t take this forward.',
     'Thanks for getting in touch. Finance pays out what we''re told, but how member payments are calculated is managed by the member services team.', FALSE),
    ('Mosaic Foods Cooperative', 'member payment accuracy', 'DISTRACTOR', 'Camila Torres', 'Director of Supply Chain',
     'Camila Torres is Director of Supply Chain at Mosaic Foods Cooperative. She runs sourcing and supplier management for the cooperative''s member growers. Growers raise payment complaints with her during supply negotiations.',
     'Thanks, but payments aren''t part of my role.',
     NULL, FALSE),
    ('LumaCare Clinics', 'appointment no-shows', 'DECISION_MAKER', 'Jessica Moore', 'Patient Access Manager',
     'Jessica Moore is Patient Access Manager at LumaCare Clinics. She runs the booking centre and the appointment reminder process across the network. No-shows are rising, wasting clinic time while other patients wait for appointments.',
     NULL, NULL, FALSE),
    ('LumaCare Clinics', 'appointment no-shows', 'DISTRACTOR', 'Ben Thompson', 'Scheduling Systems Analyst',
     'Ben Thompson is Scheduling Systems Analyst at LumaCare Clinics. He configures the appointment scheduling system, its reminder messages and its reports. He is asked to change reminder settings almost every week.',
     'Thanks, but I only support the system.',
     'Thanks for reaching out. I configure the system, but the booking and reminder process is Jessica Moore''s area in Patient Access.', FALSE),
    ('LumaCare Clinics', 'appointment no-shows', 'DISTRACTOR', 'Dr Anna Kowalski', 'Medical Director',
     'Dr Anna Kowalski is Medical Director at LumaCare Clinics. She leads the clinical workforce and is responsible for clinical governance and patient safety. Her clinicians are frustrated by gaps in their lists when patients don''t attend.',
     'Thanks, but I''m not the right person for this.',
     'I hear it from clinicians, but bookings and reminders are run by Jessica Moore.', FALSE),
    ('Ironwood Manufacturing', 'spare parts inventory', 'DECISION_MAKER', 'Robert Ng', 'Stores and Inventory Manager',
     'Robert Ng is Stores and Inventory Manager at Ironwood Manufacturing. He runs the parts stores and manages stock levels and reordering for every plant. Critical spares run out while slow-moving parts fill the shelves.',
     NULL, NULL, FALSE),
    ('Ironwood Manufacturing', 'spare parts inventory', 'DISTRACTOR', 'Greg Walsh', 'Maintenance Planner',
     'Greg Walsh is Maintenance Planner at Ironwood Manufacturing''s main plant. He schedules preventive maintenance and coordinates technicians and spare parts. Jobs are delayed while technicians wait for parts that should be in stock.',
     'Thanks, but I just plan maintenance.',
     'Thanks for reaching out. I wait on parts like everyone else. Stock levels are managed by Robert Ng in Stores.', FALSE),
    ('Ironwood Manufacturing', 'spare parts inventory', 'DISTRACTOR', 'Hannah Lewis', 'Procurement Officer',
     'Hannah Lewis is a Procurement Officer at Ironwood Manufacturing. She raises purchase orders and follows up deliveries with suppliers. She processes a growing number of urgent orders at premium prices.',
     'Thanks, but I only place the orders.',
     'I place the orders, but what we keep in stock is Robert Ng''s call.', FALSE),
    ('Ironwood Manufacturing', 'supplier on-time delivery', 'DECISION_MAKER', 'Elisa Moretti', 'Director of Procurement',
     'Elisa Moretti is Director of Procurement at Ironwood Manufacturing. She leads supplier selection, contracts and supplier performance across all plants. Late supplier deliveries are now the main cause of production schedule changes.',
     NULL, NULL, FALSE),
    ('Ironwood Manufacturing', 'supplier on-time delivery', 'DISTRACTOR', 'Hannah Lewis', 'Procurement Officer',
     'Hannah Lewis is a Procurement Officer at Ironwood Manufacturing. She raises purchase orders and follows up deliveries with suppliers. She spends most mornings chasing overdue orders.',
     'Thanks, but I can''t take this forward.',
     'Thanks for getting in touch. I chase the orders, but supplier performance is managed by procurement leadership.', FALSE),
    ('Ironwood Manufacturing', 'supplier on-time delivery', 'DISTRACTOR', 'Martin Doyle', 'Production Scheduler',
     'Martin Doyle is Production Scheduler at Ironwood Manufacturing. He builds the weekly production plan for each line. He reschedules the plan several times a week when materials arrive late.',
     'Thanks, but I''m not the right person for this.',
     NULL, FALSE),
    ('Verdant Retail Bank', 'complaint handling times', 'DECISION_MAKER', 'Natasha Ivanova', 'Head of Customer Resolution',
     'Natasha Ivanova is Head of Customer Resolution at Verdant Retail Bank. She runs the complaints team and the process for investigating and resolving customer complaints. Complaints are taking longer to resolve, and more are being escalated to the external ombudsman.',
     NULL, NULL, FALSE),
    ('Verdant Retail Bank', 'complaint handling times', 'DISTRACTOR', 'Mark Evans', 'Branch Network Manager',
     'Mark Evans is Branch Network Manager at Verdant Retail Bank. He leads the branch managers and sets staffing and opening hours across the branch network. Customers often complain in branch, and his staff don''t know what happens next.',
     'Thanks, but I''m not the right person for this.',
     'Thanks for reaching out. Branches pass complaints on, but resolving them is Natasha Ivanova''s team in Customer Resolution.', FALSE),
    ('Verdant Retail Bank', 'complaint handling times', 'DISTRACTOR', 'Laura Chen', 'Head of Compliance',
     'Laura Chen is Head of Compliance at Verdant Retail Bank. She sets the bank''s financial crime and conduct policies and reports to the regulator. She is watching complaint times closely ahead of a regulatory review.',
     'Thanks, but compliance doesn''t handle complaints.',
     'I monitor complaint times, but the complaints process is run by Natasha Ivanova.', FALSE),
    ('Verdant Retail Bank', 'branch staffing', 'DECISION_MAKER', 'Mark Evans', 'Branch Network Manager',
     'Mark Evans is Branch Network Manager at Verdant Retail Bank. He leads the branch managers and sets staffing and opening hours across the branch network. Some branches have long queues at lunchtime while others are quiet most of the day.',
     NULL, NULL, FALSE),
    ('Verdant Retail Bank', 'branch staffing', 'DISTRACTOR', 'Sienna Lowe', 'Workforce Planning Analyst',
     'Sienna Lowe is Workforce Planning Analyst at Verdant Retail Bank. She produces headcount forecasts and workforce reports for the HR team. Her forecasts don''t reflect how busy each branch actually is.',
     'Thanks, but I only prepare the reports.',
     'Thanks for getting in touch. I prepare the forecasts, but branch staffing is set by Mark Evans, our Branch Network Manager.', FALSE),
    ('Verdant Retail Bank', 'branch staffing', 'DISTRACTOR', 'Natasha Ivanova', 'Head of Customer Resolution',
     'Natasha Ivanova is Head of Customer Resolution at Verdant Retail Bank. She runs the complaints team and the process for investigating and resolving customer complaints. Complaints about branch wait times have doubled this year.',
     'Thanks, but I''m not the right person for this.',
     NULL, FALSE),
    ('Pathfinder Mobility', 'fleet fuel costs', 'DECISION_MAKER', 'Andrew Kerr', 'Fleet Manager',
     'Andrew Kerr is Fleet Manager at Pathfinder Mobility. He runs the vehicle fleet, including leasing, servicing and fuel cards. Fuel costs have risen faster than delivery volumes this year.',
     NULL, NULL, FALSE),
    ('Pathfinder Mobility', 'fleet fuel costs', 'DISTRACTOR', 'Nadia Rahman', 'Fleet Telematics Lead',
     'Nadia Rahman is Fleet Telematics Lead at Pathfinder Mobility. She manages the vehicle tracking devices and the data they produce. Her data shows long idling times, but nobody acts on it.',
     'Thanks, but I only look after telematics.',
     'Thanks for reaching out. I can show you the data, but the fleet is run by Andrew Kerr.', FALSE),
    ('Pathfinder Mobility', 'fleet fuel costs', 'DISTRACTOR', 'Jade Wilson', 'VP Network Operations',
     'Jade Wilson is VP Network Operations at Pathfinder Mobility. She runs the depots, delivery routes and drivers across the network, and leads peak season readiness. Her routes keep getting longer as the network grows.',
     'Thanks, but this isn''t something I''m taking on.',
     'My focus is routes and depots. Fuel and vehicles sit with Andrew Kerr, our Fleet Manager.', FALSE),
    ('Keystone Legal Services', 'new matter intake', 'DECISION_MAKER', 'Sarah O''Neill', 'Head of Client Intake',
     'Sarah O''Neill is Head of Client Intake at Keystone Legal Services. She runs the team that handles new client enquiries, conflict checks and engagement letters. New matters take days to open, and some clients go elsewhere while they wait.',
     NULL, NULL, FALSE),
    ('Keystone Legal Services', 'new matter intake', 'DISTRACTOR', 'Emma Collins', 'Partner, Commercial Litigation',
     'Emma Collins is a Partner in Commercial Litigation at Keystone Legal Services. She leads her team''s client work, supervises its lawyers and signs off its bills. Her new clients complain about waiting for work to start.',
     'Thanks, but I''m not the right person for this.',
     'Thanks for getting in touch. I''m one of the partners waiting on it. New matter intake is run by Sarah O''Neill.', FALSE),
    ('Keystone Legal Services', 'new matter intake', 'DISTRACTOR', 'Ahmed Saleh', 'Conflicts Analyst',
     'Ahmed Saleh is a Conflicts Analyst at Keystone Legal Services. He checks every new matter for conflicts of interest before work begins. His searches are slowed by duplicate client records.',
     'Thanks, but I only run conflict checks.',
     'I do the conflict checks, but the intake process is Sarah O''Neill''s.', FALSE),
    ('Keystone Legal Services', 'billing leakage', 'DECISION_MAKER', 'Victoria Lam', 'Chief Financial Officer',
     'Victoria Lam is Chief Financial Officer at Keystone Legal Services. She leads finance, billing and collections for the firm. Too much recorded time is written off before it is billed, and the firm''s realisation rate is falling.',
     NULL, NULL, FALSE),
    ('Keystone Legal Services', 'billing leakage', 'DISTRACTOR', 'Henry Brooks', 'Chief Practice Officer',
     'Henry Brooks is Chief Practice Officer at Keystone Legal Services. He runs the firm''s operations, including resourcing, knowledge management and the client service transformation. He has noticed that the busiest teams also write off the most time.',
     'Thanks, but I can''t take this forward.',
     'Thanks for getting in touch. I look at it from a resourcing angle, but billing and write-offs are owned by the firm''s finance leadership.', FALSE),
    ('Keystone Legal Services', 'billing leakage', 'DISTRACTOR', 'Emma Collins', 'Partner, Commercial Litigation',
     'Emma Collins is a Partner in Commercial Litigation at Keystone Legal Services. She leads her team''s client work, supervises its lawyers and signs off its bills. She writes off time when a bill looks too high for the client.',
     'Thanks, but I''m not the right person for this.',
     NULL, FALSE),
    ('Northstar Telecom', 'customer churn after a price rise', 'DECISION_MAKER', 'Hamish Mackay', 'Director of Customer Retention',
     'Hamish Mackay is Director of Customer Retention at Northstar Telecom. He runs the retention team, loyalty offers and the save desk for customers who want to leave. Churn has risen sharply since the recent price rise.',
     NULL, NULL, FALSE),
    ('Northstar Telecom', 'customer churn after a price rise', 'DISTRACTOR', 'Sophie Laurent', 'Customer Service Director',
     'Sophie Laurent is Customer Service Director at Northstar Telecom. She leads the contact centres and the customer complaints team. Her agents are taking more cancellation calls than ever.',
     'Thanks, but I''m not the right person for this.',
     'Thanks for getting in touch. My agents take the calls, but keeping customers is Hamish Mackay''s area in Customer Retention.', FALSE),
    ('Northstar Telecom', 'customer churn after a price rise', 'DISTRACTOR', 'Zoe Fitzpatrick', 'Pricing Manager',
     'Zoe Fitzpatrick is Pricing Manager at Northstar Telecom. She designs plans and prices for mobile and broadband customers. She modelled the price rise and expected far less churn than has occurred.',
     'Thanks, but I can''t take this forward.',
     NULL, FALSE),
    ('Solaris Life Sciences', 'lab sample tracking', 'DECISION_MAKER', 'Dr Kenji Watanabe', 'Laboratory Operations Manager',
     'Dr Kenji Watanabe is Laboratory Operations Manager at Solaris Life Sciences. He runs the central laboratory and the process for receiving, storing and testing trial samples. Samples are being misplaced or tested late, putting trial results at risk.',
     NULL, NULL, FALSE),
    ('Solaris Life Sciences', 'lab sample tracking', 'DISTRACTOR', 'Aaron Fitzgerald', 'Clinical Supply Planner',
     'Aaron Fitzgerald is Clinical Supply Planner at Solaris Life Sciences. He plans and ships trial medicine and sample collection kits to trial sites. Sites keep reporting missing labels in sample kits.',
     'Thanks, but I only plan supplies.',
     'Thanks for getting in touch. I ship the kits, but sample tracking is run by Dr Kenji Watanabe in the lab.', FALSE),
    ('Solaris Life Sciences', 'lab sample tracking', 'DISTRACTOR', 'Dr Helena Voss', 'Head of Clinical Quality',
     'Dr Helena Voss is Head of Clinical Quality at Solaris Life Sciences. She runs site audits and makes sure trials follow good clinical practice. Her audits have found gaps in sample records.',
     'Thanks, but I''m not the right person for this.',
     'I audit sample records, but tracking samples is Dr Kenji Watanabe''s responsibility.', FALSE),
    ('Granite Insurance', 'broker quote turnaround', 'DECISION_MAKER', 'Tasha Brown', 'Head of Underwriting',
     'Tasha Brown is Head of Underwriting at Granite Insurance. She leads the underwriters who assess risks, set underwriting rules and prepare quotes for brokers. Brokers wait several days for quotes and are placing business with faster insurers.',
     NULL, NULL, FALSE),
    ('Granite Insurance', 'broker quote turnaround', 'DISTRACTOR', 'Connor Blake', 'Broker Relationship Manager',
     'Connor Blake is Broker Relationship Manager at Granite Insurance. He manages the company''s relationships with its broker partners. Brokers tell him they are losing clients while they wait for quotes.',
     'Thanks, but I''m not the right person for this.',
     'Thanks for reaching out. I hear it from brokers every day, but quoting is run by Tasha Brown in Underwriting.', FALSE),
    ('Granite Insurance', 'broker quote turnaround', 'DISTRACTOR', 'Mei Lin Ho', 'Pricing Actuary',
     'Mei Lin Ho is a Pricing Actuary at Granite Insurance. She builds the pricing models underwriters use to rate risks. Underwriters keep asking her to rerun prices for individual quotes.',
     'Thanks, but I only build the pricing models.',
     'I build the models, but the quoting process is Tasha Brown''s area.', FALSE),
    ('Granite Insurance', 'fraud referral backlog', 'DECISION_MAKER', 'Andrea Russo', 'Head of Claims Integrity',
     'Andrea Russo is Head of Claims Integrity at Granite Insurance. She leads the fraud investigation team and the rules that flag suspicious claims. Referrals to her team are piling up, and genuine customers are waiting while flagged claims are checked.',
     NULL, NULL, FALSE),
    ('Granite Insurance', 'fraud referral backlog', 'DISTRACTOR', 'Ryan Douglas', 'Claims Assessor Team Leader',
     'Ryan Douglas is a Claims Assessor Team Leader at Granite Insurance. He leads a team of assessors handling motor and home claims. His team refers suspicious claims and then waits weeks for a decision.',
     'Thanks, but I can''t take this forward.',
     'Thanks for getting in touch. We refer the claims, but the fraud referral process is owned by the claims integrity function.', FALSE),
    ('Granite Insurance', 'fraud referral backlog', 'DISTRACTOR', 'Tasha Brown', 'Head of Underwriting',
     'Tasha Brown is Head of Underwriting at Granite Insurance. She leads the underwriters who assess risks, set underwriting rules and prepare quotes for brokers. She wants fraud findings fed back into underwriting rules.',
     'Thanks, but I''m not the right person for this.',
     NULL, FALSE),
    ('Cobalt Mining Group', 'haul truck fuel use', 'DECISION_MAKER', 'Bradley Quinn', 'Mine Fleet Superintendent',
     'Bradley Quinn is Mine Fleet Superintendent at Cobalt Mining Group. He runs the haul truck fleet, its operators and its fuel use. Fuel use per tonne moved has climbed for three quarters in a row.',
     NULL, NULL, FALSE),
    ('Cobalt Mining Group', 'haul truck fuel use', 'DISTRACTOR', 'Kirra Watson', 'Mine Planning Engineer',
     'Kirra Watson is a Mine Planning Engineer at Cobalt Mining Group. She designs the haul roads and the sequence in which the pit is mined. Haul distances are growing as the pit deepens.',
     'Thanks, but I only plan the mine.',
     'Thanks for getting in touch. Haul roads are mine, but the trucks and their fuel are run by Bradley Quinn.', FALSE),
    ('Cobalt Mining Group', 'haul truck fuel use', 'DISTRACTOR', 'Leah Sinclair', 'Safety and Environment Manager',
     'Leah Sinclair is Safety and Environment Manager at Cobalt Mining Group. She oversees safety systems, incident investigations and environmental compliance. Diesel emissions reporting is taking more of her time each quarter.',
     'Thanks, but I''m not the right person for this.',
     NULL, FALSE),
    ('Arbor Social Housing', 'empty home turnaround', 'DECISION_MAKER', 'Derek Simmons', 'Head of Lettings',
     'Derek Simmons is Head of Lettings at Arbor Social Housing. He runs the process for preparing empty homes and letting them to new tenants. Empty homes are taking more than two months to relet while the waiting list grows.',
     NULL, NULL, FALSE),
    ('Arbor Social Housing', 'empty home turnaround', 'DISTRACTOR', 'Callum Reid', 'Repairs Contractor Manager',
     'Callum Reid is Repairs Contractor Manager at Arbor Social Housing. He manages the contracts with the maintenance firms that carry out repairs. Contractors say empty homes are handed to them late.',
     'Thanks, but I only manage the contractors.',
     'Thanks for getting in touch. I manage the repair contractors, but reletting empty homes is Derek Simmons''s area in Lettings.', FALSE),
    ('Arbor Social Housing', 'empty home turnaround', 'DISTRACTOR', 'Joanne Pike', 'Tenant Engagement Officer',
     'Joanne Pike is Tenant Engagement Officer at Arbor Social Housing. She runs tenant forums and resident feedback groups. Applicants on the waiting list keep asking her why homes sit empty.',
     'Thanks, but I can''t take this forward.',
     'I hear it from applicants, but lettings are run by Derek Simmons.', FALSE),
    ('Brightline Consumer Goods', 'stock-outs at retailers', 'DECISION_MAKER', 'Ruth Adebayo', 'Head of Customer Supply',
     'Ruth Adebayo is Head of Customer Supply at Brightline Consumer Goods. She runs replenishment and order fulfilment for every retail customer. Retailers are reporting empty shelves on core lines, and penalties are rising.',
     NULL, NULL, FALSE),
    ('Brightline Consumer Goods', 'stock-outs at retailers', 'DISTRACTOR', 'Diego Fernandez', 'Demand Planner',
     'Diego Fernandez is a Demand Planner at Brightline Consumer Goods. He builds the monthly sales forecast for each product range. Retailers'' orders keep diverging from his forecast.',
     'Thanks, but I only build the forecast.',
     'Thanks for reaching out. I forecast demand, but getting stock to retailers is run by Ruth Adebayo in Customer Supply.', FALSE),
    ('Brightline Consumer Goods', 'stock-outs at retailers', 'DISTRACTOR', 'Chloe Martin', 'Brand Manager',
     'Chloe Martin is Brand Manager for Brightline Consumer Goods'' snack range. She plans product launches, advertising and brand campaigns. Her campaigns are sending shoppers to empty shelves.',
     'Thanks, but I''m not the right person for this.',
     'I drive the demand, but stock on shelves is Ruth Adebayo''s area.', FALSE),
    ('Brightline Consumer Goods', 'new product launch delays', 'DECISION_MAKER', 'Simone Castillo', 'Director of Product Innovation',
     'Simone Castillo is Director of Product Innovation at Brightline Consumer Goods. She leads the stage-gate process that takes new products from idea to launch. Most launches this year missed their planned date, losing seasonal shelf space.',
     NULL, NULL, FALSE),
    ('Brightline Consumer Goods', 'new product launch delays', 'DISTRACTOR', 'Chloe Martin', 'Brand Manager',
     'Chloe Martin is Brand Manager for Brightline Consumer Goods'' snack range. She plans product launches, advertising and brand campaigns. Her launch campaigns have been booked, then cancelled when products slipped.',
     'Thanks, but I can''t take this forward.',
     'Thanks for getting in touch. I plan the launch campaigns, but the launch process itself is run by product innovation leadership.', FALSE),
    ('Brightline Consumer Goods', 'new product launch delays', 'DISTRACTOR', 'Victor Lindgren', 'Packaging Engineer',
     'Victor Lindgren is a Packaging Engineer at Brightline Consumer Goods. He designs and tests packaging for new products. Packaging changes late in development keep pushing launches back.',
     'Thanks, but I''m not the right person for this.',
     NULL, FALSE),
    ('Meridian Cloudworks', 'support escalation rates', 'DECISION_MAKER', 'Nathan Hollis', 'Head of Customer Support',
     'Nathan Hollis is Head of Customer Support at Meridian Cloudworks. He leads the support engineers and the process for escalating complex cases. More cases are being escalated to engineering, and resolution times are slipping.',
     NULL, NULL, FALSE),
    ('Meridian Cloudworks', 'support escalation rates', 'DISTRACTOR', 'Felix Moreau', 'Product Manager, Integrations',
     'Felix Moreau is Product Manager for Integrations at Meridian Cloudworks. He decides which connectors and APIs the product team builds next. Escalations keep pulling his engineers off roadmap work.',
     'Thanks, but I''m not the right person for this.',
     'Thanks for reaching out. Escalations hit my team, but the support process is run by Nathan Hollis.', FALSE),
    ('Meridian Cloudworks', 'support escalation rates', 'DISTRACTOR', 'Alicia Gomez', 'Enterprise Account Executive',
     'Alicia Gomez is an Enterprise Account Executive at Meridian Cloudworks. She sells the platform to large organisations and manages them through renewal. Customers raise slow escalations in her renewal meetings.',
     'Thanks, but I can''t take this forward.',
     'I hear about it at renewal time, but support escalations are Nathan Hollis''s area.', FALSE),
    ('Meridian Cloudworks', 'cloud cost overruns', 'DECISION_MAKER', 'Ingrid Sorensen', 'VP Platform Engineering',
     'Ingrid Sorensen is VP Platform Engineering at Meridian Cloudworks. She leads the teams that build and run the company''s cloud infrastructure. Cloud costs are growing faster than revenue, and nobody can explain which customers or services drive them.',
     NULL, NULL, FALSE),
    ('Meridian Cloudworks', 'cloud cost overruns', 'DISTRACTOR', 'Aiden Murphy', 'Finance Business Partner, Technology',
     'Aiden Murphy is Finance Business Partner for Technology at Meridian Cloudworks. He tracks technology spending against budget and prepares the monthly cost reports. He reports the overruns each month but can''t trace them to a cause.',
     'Thanks, but I can''t take this forward.',
     'Thanks for getting in touch. I report the costs, but how the cloud platform is run and paid for sits with platform engineering leadership.', FALSE),
    ('Meridian Cloudworks', 'cloud cost overruns', 'DISTRACTOR', 'Zara Ahmed', 'Site Reliability Engineer',
     'Zara Ahmed is a Site Reliability Engineer at Meridian Cloudworks. She keeps production services running and responds to incidents. She over-provisions resources to avoid outages.',
     'Thanks, but I''m not the right person for this.',
     NULL, FALSE),
    ('Coastal State Government', 'grant application drop-off', 'DECISION_MAKER', 'Lauren Barker', 'Director of Grants Administration',
     'Lauren Barker is Director of Grants Administration at Coastal State Government. She runs the grant programmes, from application through assessment and payment. Many applicants start an application but never submit it.',
     NULL, NULL, FALSE),
    ('Coastal State Government', 'grant application drop-off', 'DISTRACTOR', 'Mia Johansson', 'Records Manager',
     'Mia Johansson is Records Manager at Coastal State Government. She manages records policy and the department''s records systems. Unfinished applications are stored but never followed up.',
     'Thanks, but I''m not the right person for this.',
     'Thanks for reaching out. I manage the records, but grant applications are run by Lauren Barker in Grants Administration.', FALSE),
    ('Coastal State Government', 'grant application drop-off', 'DISTRACTOR', 'Jordan Pierce', 'Digital Services Lead',
     'Jordan Pierce is Digital Services Lead at Coastal State Government. He runs the government''s online services portal. The grant forms are among the most abandoned on the portal.',
     'Thanks, but I only run the portal.',
     'The forms sit on my portal, but the grant process is Lauren Barker''s area.', FALSE),
    ('CommonGround Foundation', 'volunteer rostering', 'DECISION_MAKER', 'Elliot Shaw', 'Volunteer Services Manager',
     'Elliot Shaw is Volunteer Services Manager at CommonGround Foundation. He recruits volunteers and builds the rosters for every programme. Shifts are left unfilled at short notice while other volunteers are turned away.',
     NULL, NULL, FALSE),
    ('CommonGround Foundation', 'volunteer rostering', 'DISTRACTOR', 'Tariq Aziz', 'Database and CRM Officer',
     'Tariq Aziz is Database and CRM Officer at CommonGround Foundation. He maintains the supporter CRM, including volunteer records, and the grants database. Volunteer details in the CRM are often out of date.',
     'Thanks, but I only maintain the database.',
     'Thanks for getting in touch. I look after the records, but rosters are built by Elliot Shaw in Volunteer Services.', FALSE),
    ('CommonGround Foundation', 'volunteer rostering', 'DISTRACTOR', 'Rebecca Holt', 'Grants and Partnerships Manager',
     'Rebecca Holt is Grants and Partnerships Manager at CommonGround Foundation. She writes funding applications and manages relationships with funders. Some funders require volunteer hours that are hard to evidence.',
     'Thanks, but I''m not the right person for this.',
     'I report volunteer hours to funders, but rostering is Elliot Shaw''s area.', FALSE);

-- 2. Find each problem's scenario by its title. Only the seeded live and draft
--    rows are touched: archived copies and admin-created scenarios are not.
CREATE TEMP TABLE v66_scenario ON COMMIT DROP AS
SELECT DISTINCT c.company, c.problem, s.id AS scenario_id
FROM v66_contact c
JOIN scenarios s ON s.title = c.company || ': ' || c.problem
WHERE s.id::text LIKE '62000000-0000-0000-0000-%'
  AND s.status IN ('ACTIVE', 'DRAFT');

DO $$
DECLARE
    missing    TEXT;
    duplicated TEXT;
BEGIN
    SELECT string_agg(DISTINCT c.company || ': ' || c.problem, '; ') INTO missing
    FROM v66_contact c
    WHERE NOT EXISTS (SELECT 1 FROM v66_scenario s WHERE s.company = c.company AND s.problem = c.problem);
    IF missing IS NOT NULL THEN
        RAISE NOTICE 'V66: skipped, no live or draft scenario titled: %', missing;
    END IF;

    SELECT string_agg(company || ': ' || problem, '; ') INTO duplicated
    FROM (SELECT company, problem FROM v66_scenario GROUP BY company, problem HAVING count(*) > 1) d;
    IF duplicated IS NOT NULL THEN
        RAISE EXCEPTION 'V66: more than one scenario matches: %', duplicated;
    END IF;
END $$;

-- 3. Contacts.
-- Decision maker: the scenario already has exactly one; update it in place.
UPDATE personas p
SET name = c.name, job_title = c.job_title, visible_concerns = c.bio,
    updated_at = NOW(), version = p.version + 1
FROM v66_contact c JOIN v66_scenario s USING (company, problem)
WHERE c.contact_role = 'DECISION_MAKER'
  AND p.scenario_id = s.scenario_id AND p.contact_role = 'DECISION_MAKER';

-- The company profile names the decision maker; keep it in step.
UPDATE leads l
SET decision_maker = c.name || ', ' || c.job_title, updated_at = NOW(), version = l.version + 1
FROM v66_contact c JOIN v66_scenario s USING (company, problem)
WHERE c.contact_role = 'DECISION_MAKER' AND l.scenario_id = s.scenario_id
  AND l.decision_maker IS DISTINCT FROM c.name || ', ' || c.job_title;

-- Distracting contacts that already exist (matched by name): refresh them.
UPDATE personas p
SET job_title = c.job_title, visible_concerns = c.bio,
    decline_reply = CASE WHEN c.keep_replies THEN p.decline_reply ELSE c.decline_reply END,
    hint_reply    = CASE WHEN c.keep_replies THEN p.hint_reply    ELSE c.hint_reply    END,
    updated_at = NOW(), version = p.version + 1
FROM v66_contact c JOIN v66_scenario s USING (company, problem)
WHERE c.contact_role = 'DISTRACTOR'
  AND p.scenario_id = s.scenario_id AND p.contact_role = 'DISTRACTOR' AND p.name = c.name;

-- New distracting contacts. They never reach the AI, so the AI fields stay empty.
INSERT INTO personas (id, scenario_id, name, job_title, organisation, visible_concerns,
                      contact_role, decline_reply, hint_reply, prompt_version, created_at, updated_at, version)
SELECT md5(s.scenario_id::text || c.name)::uuid, s.scenario_id, c.name, c.job_title, c.company, c.bio,
       'DISTRACTOR', c.decline_reply, c.hint_reply, 1, NOW(), NOW(), 0
FROM v66_contact c JOIN v66_scenario s USING (company, problem)
WHERE c.contact_role = 'DISTRACTOR'
  AND NOT EXISTS (SELECT 1 FROM personas p WHERE p.scenario_id = s.scenario_id AND p.name = c.name)
ON CONFLICT (id) DO NOTHING;

-- 4. Research clue: the stakeholder passage says which function owns the
--    problem (never the person), so the right contact can be reasoned out.
CREATE TEMP TABLE v66_passage (company TEXT NOT NULL, problem TEXT NOT NULL, content TEXT NOT NULL) ON COMMIT DROP;
INSERT INTO v66_passage VALUES
    ('HarbourGrid Utilities', 'smart-meter billing errors',
     'Influence boundary. Billing is owned by Billing Operations, which turns meter reads into customer bills. The contact centre handles complaints and metering services maintain the meters, but neither runs billing.'),
    ('CivicLink Services', 'permit processing backlog',
     'Influence boundary. Permit processing is managed by Permits and Approvals, which leads the assessment teams. The online portal team and individual assessors support processing but do not set how the backlog is managed.'),
    ('CivicLink Services', 'contractor spend visibility',
     'Influence boundary. Visibility of contractor spending across the department sits with finance leadership. Procurement runs tenders and business units engage contractors, but neither owns department-wide spend reporting.'),
    ('GreenSpan Developments', 'defects at buyer handover',
     'Influence boundary. Buyer handover and the defects period are run by the Customer Handover team. Project managers deliver the buildings and commercial manages builder contracts, but neither runs handover.'),
    ('Wavefront Media Group', 'ad sales proposal turnaround',
     'Influence boundary. Advertising proposals are owned by the Advertising Sales Director''s team. Sales planners build them and programming supplies schedules, but neither sets the proposal process.'),
    ('Wavefront Media Group', 'content rights tracking',
     'Influence boundary. Content rights are tracked by the rights and licensing function after contracts are signed. Legal negotiates the contracts and the catalogue team publishes titles, but neither tracks rights windows.'),
    ('Horizon Hotels Collective', 'housekeeping scheduling',
     'Influence boundary. Housekeeping standards and schedules across the group are set by the Director of Housekeeping. Hotel general managers and revenue management feel the effects but do not set the schedules.'),
    ('BlueCurrent Water', 'water quality reporting',
     'Influence boundary. Water quality reporting to the regulator is owned by the Water Quality Manager. Field crews collect samples and the control systems team provides sensor data, but neither prepares the reports.'),
    ('Mosaic Foods Cooperative', 'cold-chain waste',
     'Influence boundary. The cold chain is run by Logistics, which manages refrigerated warehouses and transport. Quality assurance and export sales see the waste but do not run the cold chain.'),
    ('Mosaic Foods Cooperative', 'member payment accuracy',
     'Influence boundary. Member payments are calculated by the member services team before finance pays them. Finance and supply chain see the disputes but do not set how payments are calculated.'),
    ('LumaCare Clinics', 'appointment no-shows',
     'Influence boundary. Bookings and appointment reminders are run by Patient Access. Clinicians and the scheduling systems team see the impact but do not run the booking process.'),
    ('Ironwood Manufacturing', 'spare parts inventory',
     'Influence boundary. Spare parts stock levels are managed by Stores and Inventory. Maintenance planning and procurement depend on the stores but do not set stock levels.'),
    ('Ironwood Manufacturing', 'supplier on-time delivery',
     'Influence boundary. Supplier performance is managed by procurement leadership, which selects suppliers and sets contract terms. Purchasing officers and production scheduling deal with late deliveries but do not manage suppliers.'),
    ('Verdant Retail Bank', 'complaint handling times',
     'Influence boundary. Complaint handling is run by Customer Resolution. Branches pass complaints on and compliance monitors outcomes, but neither manages the complaints process.'),
    ('Verdant Retail Bank', 'branch staffing',
     'Influence boundary. Branch staffing and opening hours are set by Branch Network leadership. Workforce planning and customer resolution provide data and complaints, but neither sets branch staffing.'),
    ('Pathfinder Mobility', 'fleet fuel costs',
     'Influence boundary. Fuel and vehicle costs are managed by the Fleet Manager. Network Operations plans routes and telematics supplies data, but neither manages fleet costs.'),
    ('Keystone Legal Services', 'new matter intake',
     'Influence boundary. New matter intake is run by Client Intake, which handles enquiries, conflict checks and engagement letters. Partners and the conflicts team depend on intake but do not run it.'),
    ('Keystone Legal Services', 'billing leakage',
     'Influence boundary. Billing and write-offs across the firm are owned by finance leadership. Partners sign off their own bills and the Chief Practice Officer manages resourcing, but neither owns billing.'),
    ('Northstar Telecom', 'customer churn after a price rise',
     'Influence boundary. Customer retention is owned by the Customer Retention team, which runs loyalty offers and the save desk. Customer service and pricing see the churn but do not run retention.'),
    ('Solaris Life Sciences', 'lab sample tracking',
     'Influence boundary. Sample tracking is run by Laboratory Operations, which receives, stores and tests trial samples. Supply planning and clinical quality support it but do not run sample tracking.'),
    ('Granite Insurance', 'broker quote turnaround',
     'Influence boundary. Quoting for brokers is run by Underwriting. Broker relationships and pricing actuaries support quoting but do not run it.'),
    ('Granite Insurance', 'fraud referral backlog',
     'Influence boundary. Fraud referrals are handled by the claims integrity function, which investigates flagged claims. Claims teams make referrals and underwriting uses the findings, but neither runs the referral process.'),
    ('Cobalt Mining Group', 'haul truck fuel use',
     'Influence boundary. Haul truck fuel use is managed by the Mine Fleet Superintendent. Mine planning designs haul routes and the environment team reports emissions, but neither runs the fleet.'),
    ('Arbor Social Housing', 'empty home turnaround',
     'Influence boundary. Empty homes and reletting are run by Lettings. Contractor management and tenant engagement support it but do not manage reletting.'),
    ('Brightline Consumer Goods', 'stock-outs at retailers',
     'Influence boundary. Replenishment to retailers is run by Customer Supply. Demand planning and brand teams influence demand but do not manage replenishment.'),
    ('Brightline Consumer Goods', 'new product launch delays',
     'Influence boundary. The new product launch process is run by product innovation leadership through its stage-gate reviews. Brand and packaging teams contribute but do not run the launch process.'),
    ('Meridian Cloudworks', 'support escalation rates',
     'Influence boundary. Support escalations are managed by Customer Support. Product teams receive escalations and sales hears about them at renewal, but neither runs the escalation process.'),
    ('Meridian Cloudworks', 'cloud cost overruns',
     'Influence boundary. Cloud infrastructure and its costs are owned by platform engineering leadership. Finance reports the spending and engineers use the resources, but neither manages the platform.'),
    ('Coastal State Government', 'grant application drop-off',
     'Influence boundary. Grant applications are run by Grants Administration. The digital services team hosts the forms and records management stores them, but neither runs the grant process.'),
    ('CommonGround Foundation', 'volunteer rostering',
     'Influence boundary. Volunteer rostering is run by Volunteer Services. The CRM team keeps volunteer records and the grants team reports hours, but neither builds the rosters.');

UPDATE document_chunks ch
SET content = x.content, updated_at = NOW(), version = ch.version + 1
FROM v66_passage x JOIN v66_scenario s USING (company, problem)
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
          JOIN v66_scenario s ON s.scenario_id = changed.scenario_id
          JOIN v66_passage x ON x.company = s.company AND x.problem = s.problem
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
        FROM v66_scenario s LEFT JOIN personas p ON p.scenario_id = s.scenario_id
        GROUP BY s.company, s.problem
    ) x
    WHERE x.decision_makers <> 1 OR x.distractors <> 2;
    IF wrong IS NOT NULL THEN
        RAISE EXCEPTION 'V66: each scenario must have 1 decision maker and 2 distracting contacts: %', wrong;
    END IF;
END $$;
