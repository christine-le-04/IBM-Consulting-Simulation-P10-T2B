-- ═══════════════════════════════════════════════════════════════════════════
-- Company facts: company size and financial summary, shown from the
-- start. The numbers show what is happening; research explains why.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE company_facts (
    id          UUID PRIMARY KEY,
    scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
    section     VARCHAR(20)  NOT NULL CHECK (section IN ('SIZE', 'FINANCIAL')),
    label       VARCHAR(100) NOT NULL,
    value       VARCHAR(100) NOT NULL,
    tone        VARCHAR(10)  NOT NULL DEFAULT 'NORMAL' CHECK (tone IN ('NORMAL', 'WARNING', 'ALERT')),
    sort_order  INT          NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL,
    updated_at  TIMESTAMPTZ  NOT NULL,
    version     BIGINT       NOT NULL DEFAULT 0
);
CREATE INDEX idx_company_facts_scenario ON company_facts (scenario_id, section, sort_order);


-- 1. The three demo scenarios, written to fit their stories.

INSERT INTO company_facts (id, scenario_id, section, label, value, tone, sort_order, created_at, updated_at, version)
SELECT md5(v.scenario_id || v.section || v.sort_order)::uuid, v.scenario_id::uuid, v.section, v.label, v.value, v.tone, v.sort_order,
       NOW(), NOW(), 0
FROM (VALUES
    -- AeroVector Aviation Coastal 0313: predictive maintenance control
    ('62000000-0000-0000-0000-000000000313', 'SIZE', 1, 'Aircraft in fleet', '46', 'NORMAL'),
    ('62000000-0000-0000-0000-000000000313', 'SIZE', 2, 'Staff', '~3,900', 'NORMAL'),
    ('62000000-0000-0000-0000-000000000313', 'SIZE', 3, 'Flights / year', '~68,000', 'NORMAL'),
    ('62000000-0000-0000-0000-000000000313', 'FINANCIAL', 1, 'Revenue', '$1.3bn', 'NORMAL'),
    ('62000000-0000-0000-0000-000000000313', 'FINANCIAL', 2, 'Operating margin', '2.1% (was 4.4%)', 'ALERT'),
    ('62000000-0000-0000-0000-000000000313', 'FINANCIAL', 3, 'Maintenance spend', '$212m, up 18% in 2 years', 'ALERT'),
    ('62000000-0000-0000-0000-000000000313', 'FINANCIAL', 4, 'Maintenance IT capital', '$9.8m, flat for 3 years', 'WARNING'),

    -- Momentum Auto Group Atlas 0405: connected service experience
    ('62000000-0000-0000-0000-000000000405', 'SIZE', 1, 'Dealerships', '24', 'NORMAL'),
    ('62000000-0000-0000-0000-000000000405', 'SIZE', 2, 'Staff', '~2,100', 'NORMAL'),
    ('62000000-0000-0000-0000-000000000405', 'SIZE', 3, 'Vehicles serviced / year', '~152,000', 'NORMAL'),
    ('62000000-0000-0000-0000-000000000405', 'FINANCIAL', 1, 'Revenue', '$690m', 'NORMAL'),
    ('62000000-0000-0000-0000-000000000405', 'FINANCIAL', 2, 'Operating margin', '1.9% (was 3.6%)', 'ALERT'),
    ('62000000-0000-0000-0000-000000000405', 'FINANCIAL', 3, 'After-sales revenue', '$118m, down 9%', 'ALERT'),
    ('62000000-0000-0000-0000-000000000405', 'FINANCIAL', 4, 'IT capital', '$5.4m, flat for 3 years', 'WARNING'),

    -- NexaLearn Institute Atlas 0391: enrolment journey redesign
    ('62000000-0000-0000-0000-000000000391', 'SIZE', 1, 'Campuses', '3', 'NORMAL'),
    ('62000000-0000-0000-0000-000000000391', 'SIZE', 2, 'Staff', '~2,300', 'NORMAL'),
    ('62000000-0000-0000-0000-000000000391', 'SIZE', 3, 'Enrolled students', '~24,500', 'NORMAL'),
    ('62000000-0000-0000-0000-000000000391', 'FINANCIAL', 1, 'Revenue', '$486m', 'NORMAL'),
    ('62000000-0000-0000-0000-000000000391', 'FINANCIAL', 2, 'Operating margin', '0.8% (was 2.7%)', 'ALERT'),
    ('62000000-0000-0000-0000-000000000391', 'FINANCIAL', 3, 'First-year attrition', '19% (target 12%)', 'ALERT'),
    ('62000000-0000-0000-0000-000000000391', 'FINANCIAL', 4, 'IT capital', '$7.2m, flat for 2 years', 'WARNING')
) AS v(scenario_id, section, sort_order, label, value, tone)
JOIN scenarios s ON s.id = v.scenario_id::uuid;


-- 2. Every other scenario: basic numbers generated from its industry.
-- Each scenario's numbers are calculated from its id, so they never change.

CREATE TEMP TABLE v53_industry_profile ON COMMIT DROP AS
SELECT * FROM (VALUES
    -- industry, size metric 1 (label, typical), staff, size metric 3 (label, typical),
    -- revenue per staff member ($k), revenue label, margin label
    ('Aerospace & Aviation',      'Aircraft in fleet',        40,    3500, 'Flights / year',            60000,    350, 'Revenue',       'Operating margin'),
    ('Energy & Utilities',        'Service regions',           6,    2400, 'Customer accounts',        520000,    480, 'Revenue',       'Operating margin'),
    ('Public Sector',             'Service centres',          18,    1900, 'Cases / year',             140000,    180, 'Annual budget', 'Operating surplus'),
    ('Real Estate & Construction','Active projects',          35,    1600, 'Homes delivered / year',     1200,    520, 'Revenue',       'Operating margin'),
    ('Media & Entertainment',     'Channels and titles',      24,    1300, 'Monthly audience',        3200000,    300, 'Revenue',       'Operating margin'),
    ('Hospitality & Travel',      'Hotels',                   28,    4200, 'Guest nights / year',      900000,    110, 'Revenue',       'Operating margin'),
    ('Education',                 'Campuses',                  4,    2100, 'Enrolled students',         26000,    190, 'Revenue',       'Operating margin'),
    ('Water & Environment',       'Treatment plants',         22,    1100, 'Households served',        450000,    400, 'Revenue',       'Operating margin'),
    ('Food & Agriculture',        'Member farms',            850,    1500, 'Tonnes processed / year',  310000,    420, 'Revenue',       'Operating margin'),
    ('Healthcare',                'Clinics',                  32,    2600, 'Patient visits / year',    480000,    150, 'Revenue',       'Operating margin'),
    ('Industrial Manufacturing',  'Plants',                    7,    3100, 'Units shipped / year',    1200000,    260, 'Revenue',       'Operating margin'),
    ('Financial Services',        'Branches',                 60,    2800, 'Customers',                740000,    380, 'Revenue',       'Operating margin'),
    ('Transport & Logistics',     'Depots',                   19,    3600, 'Deliveries / year',       8500000,    190, 'Revenue',       'Operating margin'),
    ('Professional Services',     'Offices',                   9,     900, 'Active clients',             2300,    240, 'Revenue',       'Operating margin'),
    ('Telecommunications',        'Network sites',          2100,    3900, 'Subscribers',             1900000,    520, 'Revenue',       'Operating margin'),
    ('Life Sciences',             'Laboratories',              6,    1200, 'Active trials',                42,    450, 'Revenue',       'Operating margin'),
    ('Insurance',                 'Offices',                  14,    2000, 'Policies in force',       1100000,    600, 'Revenue',       'Operating margin'),
    ('Mining & Resources',        'Operating sites',           5,    2300, 'Tonnes mined / year',    18000000,    900, 'Revenue',       'Operating margin'),
    ('Housing & Community',       'Homes managed',         14000,     700, 'Tenants',                   31000,    160, 'Annual budget', 'Operating surplus'),
    ('Consumer Products',         'Brands',                   16,    2400, 'Retail stockists',           5200,    420, 'Revenue',       'Operating margin'),
    ('Automotive',                'Dealerships',              22,    1800, 'Vehicles serviced / year', 140000,    310, 'Revenue',       'Operating margin'),
    ('Technology',                'Data centres',              4,    1100, 'Business customers',         6800,    330, 'Revenue',       'Operating margin'),
    ('Government',                'Service centres',          26,    3300, 'Grant applications / year', 48000,    210, 'Annual budget', 'Operating surplus'),
    ('Nonprofit & Social Impact', 'Programmes',               35,     420, 'People supported / year',   85000,    140, 'Annual funding','Operating surplus')
) AS p(industry, metric1_label, metric1_typical, staff_typical, metric3_label, metric3_typical,
       revenue_per_staff_k, revenue_label, margin_label);

CREATE TEMP TABLE v53_generated ON COMMIT DROP AS
SELECT s.id AS scenario_id,
       COALESCE(p.metric1_label, 'Sites') AS metric1_label,
       COALESCE(p.metric3_label, 'Customers / year') AS metric3_label,
       COALESCE(p.revenue_label, 'Revenue') AS revenue_label,
       COALESCE(p.margin_label, 'Operating margin') AS margin_label,
       -- A stable size factor between 0.70 and 1.30 for each scenario.
       GREATEST(1, ROUND(COALESCE(p.metric1_typical, 12) * (0.7 + (abs(hashtext(s.id::text || 'm1')) % 61) / 100.0))) AS metric1,
       ROUND(COALESCE(p.staff_typical, 1500) * (0.7 + (abs(hashtext(s.id::text || 'st')) % 61) / 100.0) / 100) * 100 AS staff,
       GREATEST(1, ROUND(COALESCE(p.metric3_typical, 100000) * (0.7 + (abs(hashtext(s.id::text || 'm3')) % 61) / 100.0))) AS metric3,
       COALESCE(p.revenue_per_staff_k, 250) AS revenue_per_staff_k,
       -- Margin was 3.0-5.9% and has fallen by 1.0-2.5 points.
       3.0 + (abs(hashtext(s.id::text || 'mp')) % 30) / 10.0 AS margin_before,
       1.0 + (abs(hashtext(s.id::text || 'md')) % 16) / 10.0 AS margin_drop,
       2 + abs(hashtext(s.id::text || 'it')) % 2 AS it_flat_years
FROM scenarios s
LEFT JOIN v53_industry_profile p ON p.industry = s.industry
WHERE NOT EXISTS (SELECT 1 FROM company_facts f WHERE f.scenario_id = s.id);

-- Format helpers: "~3,900", "$1.3bn" / "$690m".
INSERT INTO company_facts (id, scenario_id, section, label, value, tone, sort_order, created_at, updated_at, version)
SELECT md5(g.scenario_id::text || f.section || f.sort_order)::uuid, g.scenario_id, f.section, f.label, f.value, f.tone, f.sort_order,
       NOW(), NOW(), 0
FROM v53_generated g
CROSS JOIN LATERAL (
    SELECT g.staff * g.revenue_per_staff_k / 1000.0 AS revenue_m,
           GREATEST(0.3, g.margin_before - g.margin_drop) AS margin_now
) calc
CROSS JOIN LATERAL (VALUES
    ('SIZE', 1, g.metric1_label,
        CASE WHEN g.metric1 >= 1000 THEN '~' || to_char(g.metric1, 'FM999,999,999') ELSE g.metric1::text END, 'NORMAL'),
    ('SIZE', 2, 'Staff', '~' || to_char(g.staff, 'FM999,999,999'), 'NORMAL'),
    ('SIZE', 3, g.metric3_label,
        CASE WHEN g.metric3 >= 1000 THEN '~' || to_char(g.metric3, 'FM999,999,999') ELSE g.metric3::text END, 'NORMAL'),
    ('FINANCIAL', 1, g.revenue_label,
        CASE WHEN calc.revenue_m >= 1000 THEN '$' || to_char(calc.revenue_m / 1000.0, 'FM990.0') || 'bn'
             ELSE '$' || to_char(ROUND(calc.revenue_m), 'FM999,999') || 'm' END, 'NORMAL'),
    ('FINANCIAL', 2, g.margin_label,
        to_char(calc.margin_now, 'FM990.0') || '% (was ' || to_char(g.margin_before, 'FM990.0') || '%)', 'ALERT'),
    ('FINANCIAL', 3, 'IT capital',
        '$' || to_char(GREATEST(0.5, calc.revenue_m * 0.012), 'FM9,990.0') || 'm, flat for ' || g.it_flat_years || ' years',
        'WARNING')
) AS f(section, sort_order, label, value, tone);
