export type BlueprintAgent = {
  name: string;
  role: string;
  taskType: string;
};

export type BlueprintTeam = {
  name: string;
  purpose: string;
  agents: BlueprintAgent[];
};

export type BlueprintDepartment = {
  name: string;
  purpose: string;
  teams: BlueprintTeam[];
};

export type BlueprintTask = {
  title: string;
  department: string;
  owner: string;
  stage: 'Research' | 'Planning' | 'Generation' | 'Validation' | 'Publishing' | 'Operations';
  priority: 'low' | 'medium' | 'high' | 'critical';
  approvalRequired: boolean;
};

export type ExecutiveBlueprint = {
  id: string;
  objective: string;
  archetype: string;
  company: {
    name: string;
    description: string;
    positioning: string;
    brandColor: string;
  };
  executiveSummary: string;
  departments: BlueprintDepartment[];
  connectors: { name: string; mode: 'mock'; purpose: string; risk: 'low' | 'medium' | 'high' }[];
  tasks: BlueprintTask[];
  approvals: { title: string; reason: string; risk: 'medium' | 'high' | 'critical' }[];
  kpis: { name: string; target: string; cadence: string }[];
  roadmap: { phase: string; objective: string; outputs: string[] }[];
  risks: { title: string; mitigation: string; severity: 'low' | 'medium' | 'high' }[];
  estimatedMonthlyCost: number;
  providerMode: 'mock';
  connectorMode: 'mock';
  generatedAt: string;
};

type Template = Omit<ExecutiveBlueprint, 'id' | 'objective' | 'generatedAt'>;

const agent = (name: string, role: string, taskType: string): BlueprintAgent => ({ name, role, taskType });
const team = (name: string, purpose: string, agents: BlueprintAgent[]): BlueprintTeam => ({ name, purpose, agents });
const department = (name: string, purpose: string, teams: BlueprintTeam[]): BlueprintDepartment => ({ name, purpose, teams });

const investmentTemplate: Template = {
  archetype: 'investment',
  company: {
    name: 'Investment Intelligence Company',
    description: 'A founder-controlled research organization for market intelligence, due diligence, portfolio monitoring, and risk reporting.',
    positioning: 'Decision support and research infrastructure—not autonomous trading or financial advice.',
    brandColor: '#22c55e',
  },
  executiveSummary: 'Build a disciplined investment research operation that separates evidence gathering, thesis construction, risk challenge, compliance review, and founder decisions.',
  departments: [
    department('Research', 'Collects macro, sector, company, and alternative-data evidence.', [
      team('Market Intelligence', 'Tracks regimes, catalysts, industries, and watchlists.', [
        agent('Investment Researcher', 'Builds evidence-backed research briefs.', 'investment_research'),
        agent('Macro Analyst', 'Monitors economic regimes and market drivers.', 'macro_research'),
      ]),
    ]),
    department('Portfolio', 'Converts approved research into watchlists, allocation scenarios, and monitoring plans.', [
      team('Portfolio Intelligence', 'Maintains theses, exposure views, and review schedules.', [
        agent('Portfolio Analyst', 'Models scenarios and portfolio exposure.', 'portfolio_analysis'),
        agent('Performance Analyst', 'Tracks outcomes against original assumptions.', 'performance_review'),
      ]),
    ]),
    department('Compliance', 'Checks claims, disclosures, permissions, and prohibited actions.', [
      team('Governance Desk', 'Reviews research and external-facing materials before release.', [
        agent('Compliance Auditor', 'Checks policy, disclosures, and recordkeeping.', 'compliance_review'),
        agent('Evidence Verifier', 'Verifies sources, dates, and unsupported claims.', 'evidence_validation'),
      ]),
    ]),
    department('Risk', 'Challenges investment theses and models downside scenarios.', [
      team('Risk Review', 'Preserves dissent and identifies hidden assumptions.', [
        agent('Risk Analyst', 'Scores downside, liquidity, concentration, and uncertainty.', 'risk_analysis'),
        agent('Devil’s Advocate', 'Challenges consensus and weak evidence.', 'challenge_review'),
      ]),
    ]),
    department('Finance', 'Tracks research costs, budgets, and operating economics.', [
      team('FP&A', 'Monitors spending, provider usage, and unit economics.', [
        agent('FP&A Analyst', 'Builds cost and budget reports.', 'financial_planning'),
      ]),
    ]),
    department('Operations', 'Runs workflows, task queues, schedules, and audit history.', [
      team('Operating Desk', 'Coordinates approvals and recurring research cycles.', [
        agent('Operations Manager', 'Owns workflow reliability and handoffs.', 'operations'),
        agent('Executive Summary Generator', 'Packages founder-ready briefings.', 'executive_reporting'),
      ]),
    ]),
    department('Legal', 'Reviews terms, data use, disclaimers, and jurisdictional risk.', [
      team('Legal Review', 'Escalates legal and regulatory questions to human counsel.', [
        agent('Legal Research Assistant', 'Prepares non-authoritative issue summaries.', 'legal_research'),
      ]),
    ]),
  ],
  connectors: [
    { name: 'Mock Market Data', mode: 'mock', purpose: 'Simulated quotes, company metrics, and economic data.', risk: 'medium' },
    { name: 'Mock Research Library', mode: 'mock', purpose: 'Seeded filings, reports, and citations.', risk: 'low' },
    { name: 'Mock Portfolio Tracker', mode: 'mock', purpose: 'Simulated watchlists and scenario portfolios.', risk: 'high' },
    { name: 'Approval Ledger', mode: 'mock', purpose: 'Founder decisions and acceptance history.', risk: 'low' },
  ],
  tasks: [
    { title: 'Define investment mandate and prohibited actions', department: 'Compliance', owner: 'Compliance Auditor', stage: 'Planning', priority: 'critical', approvalRequired: true },
    { title: 'Build initial market regime briefing', department: 'Research', owner: 'Macro Analyst', stage: 'Research', priority: 'high', approvalRequired: false },
    { title: 'Create evidence-scored watchlist', department: 'Portfolio', owner: 'Portfolio Analyst', stage: 'Generation', priority: 'high', approvalRequired: true },
    { title: 'Run downside and concentration review', department: 'Risk', owner: 'Risk Analyst', stage: 'Validation', priority: 'high', approvalRequired: true },
    { title: 'Publish founder research briefing', department: 'Operations', owner: 'Executive Summary Generator', stage: 'Publishing', priority: 'medium', approvalRequired: true },
  ],
  approvals: [
    { title: 'Approve investment mandate', reason: 'Defines allowed research and explicitly prohibits autonomous transactions.', risk: 'critical' },
    { title: 'Accept research report', reason: 'High-stakes outputs require founder review before becoming final.', risk: 'high' },
    { title: 'Approve external distribution', reason: 'Public or client-facing financial content requires disclosures and human approval.', risk: 'critical' },
  ],
  kpis: [
    { name: 'Evidence coverage', target: '≥ 90% sourced claims', cadence: 'Per report' },
    { name: 'Thesis review completion', target: '100% on schedule', cadence: 'Weekly' },
    { name: 'Risk exceptions', target: '0 unresolved critical findings', cadence: 'Daily' },
    { name: 'Mock runtime cost', target: '$0', cadence: 'Continuous' },
  ],
  roadmap: [
    { phase: 'Phase 1 · Foundation', objective: 'Define mandate, policies, templates, and mock data.', outputs: ['Investment mandate', 'Research template', 'Risk rubric'] },
    { phase: 'Phase 2 · Research Loop', objective: 'Run repeatable evidence-to-briefing workflows.', outputs: ['Market briefing', 'Watchlist', 'Risk review'] },
    { phase: 'Phase 3 · Founder Operations', objective: 'Use Cyvora daily with approvals and outcome tracking.', outputs: ['Decision log', 'Performance review', 'Lessons learned'] },
  ],
  risks: [
    { title: 'False confidence', mitigation: 'Separate agent confidence from independent validation and preserve dissent.', severity: 'high' },
    { title: 'Unlicensed financial activity', mitigation: 'Prohibit autonomous trading and require legal review before commercial use.', severity: 'high' },
    { title: 'Stale data', mitigation: 'Display timestamps and block reports when freshness requirements fail.', severity: 'medium' },
  ],
  estimatedMonthlyCost: 0,
  providerMode: 'mock',
  connectorMode: 'mock',
};

const contentTemplate: Template = {
  archetype: 'content',
  company: { name: 'Content Studio', description: 'A media company for audience research, editorial production, publishing, and performance learning.', positioning: 'Founder-controlled content operations with mock publishing until real connectors are enabled.', brandColor: '#38bdf8' },
  executiveSummary: 'Build an audience-led media operation that turns research into approved content packages and learns from simulated performance.',
  departments: [
    department('Audience Research', 'Finds topics, demand, and audience language.', [team('Topic Intelligence', 'Scores opportunities and competitor gaps.', [agent('Trend Researcher', 'Finds emerging topics.', 'topic_research'), agent('Audience Researcher', 'Maps user language and needs.', 'audience_research')])]),
    department('Editorial', 'Creates scripts, articles, and publishing packages.', [team('Production Desk', 'Turns approved topics into content.', [agent('Copywriter', 'Writes scripts and copy.', 'copywriting'), agent('Visual Storyteller', 'Creates visual direction.', 'visual_direction'), agent('Brand Guardian', 'Checks consistency.', 'brand_review')])]),
    department('Distribution', 'Prepares release schedules and channel packages.', [team('Publishing Operations', 'Runs mock publishing workflows.', [agent('Channel Strategist', 'Optimizes packaging and timing.', 'channel_strategy')])]),
    department('Analytics', 'Measures simulated performance and recommends next experiments.', [team('Performance Review', 'Connects output to outcomes.', [agent('Analytics Reviewer', 'Interprets channel metrics.', 'analytics')])]),
  ],
  connectors: [
    { name: 'Mock YouTube', mode: 'mock', purpose: 'Simulated uploads, metadata, and channel results.', risk: 'high' },
    { name: 'Mock Drive', mode: 'mock', purpose: 'Seeded asset storage.', risk: 'low' },
    { name: 'Mock Analytics', mode: 'mock', purpose: 'Deterministic views, retention, and conversion data.', risk: 'medium' },
  ],
  tasks: [
    { title: 'Research first 20 topic opportunities', department: 'Audience Research', owner: 'Trend Researcher', stage: 'Research', priority: 'high', approvalRequired: false },
    { title: 'Approve first editorial slate', department: 'Editorial', owner: 'Brand Guardian', stage: 'Planning', priority: 'high', approvalRequired: true },
    { title: 'Produce launch content package', department: 'Editorial', owner: 'Copywriter', stage: 'Generation', priority: 'high', approvalRequired: false },
    { title: 'Run mock publishing review', department: 'Distribution', owner: 'Channel Strategist', stage: 'Validation', priority: 'medium', approvalRequired: true },
  ],
  approvals: [
    { title: 'Approve content strategy', reason: 'Confirms audience, claims, and brand direction.', risk: 'medium' },
    { title: 'Approve public publishing', reason: 'External publication remains founder-controlled.', risk: 'high' },
  ],
  kpis: [
    { name: 'Content throughput', target: '3 approved packages/week', cadence: 'Weekly' },
    { name: 'Mock retention', target: '≥ 45%', cadence: 'Per release' },
    { name: 'Approval turnaround', target: '< 24 hours', cadence: 'Weekly' },
  ],
  roadmap: [
    { phase: 'Phase 1 · Audience', objective: 'Define audience and topic system.', outputs: ['Audience brief', 'Topic backlog'] },
    { phase: 'Phase 2 · Production', objective: 'Create repeatable editorial workflows.', outputs: ['Scripts', 'Visual briefs', 'Publishing packages'] },
    { phase: 'Phase 3 · Learning', objective: 'Use mock analytics to refine decisions.', outputs: ['Performance review', 'Next experiment'] },
  ],
  risks: [
    { title: 'Unsupported claims', mitigation: 'Require evidence review and founder acceptance.', severity: 'high' },
    { title: 'Brand drift', mitigation: 'Run Brand Guardian validation on every package.', severity: 'medium' },
  ],
  estimatedMonthlyCost: 0,
  providerMode: 'mock',
  connectorMode: 'mock',
};

const softwareTemplate: Template = {
  archetype: 'software',
  company: { name: 'Software Lab', description: 'A product organization for strategy, design, engineering, quality, and release operations.', positioning: 'A mock-first software factory with approval-gated changes and no automatic production writes.', brandColor: '#6366f1' },
  executiveSummary: 'Build software through an architecture-first pipeline that separates planning, implementation, validation, approval, and deployment.',
  departments: [
    department('Product', 'Defines users, requirements, and roadmap.', [team('Discovery', 'Turns intent into acceptance criteria.', [agent('Product Manager', 'Owns product definition.', 'product_strategy'), agent('UX Researcher', 'Validates user needs.', 'user_research')])]),
    department('Design', 'Creates workflows and design-system patterns.', [team('Experience Design', 'Produces mockups and interaction specifications.', [agent('UX Architect', 'Designs information architecture.', 'ux_architecture'), agent('UI Designer', 'Builds interface specifications.', 'ui_design')])]),
    department('Engineering', 'Implements frontend, backend, and data systems.', [team('Application Build', 'Creates reviewable patches.', [agent('Frontend Developer', 'Implements user interfaces.', 'frontend'), agent('Backend Architect', 'Implements services and APIs.', 'backend'), agent('Database Engineer', 'Owns schema and migrations.', 'database')])]),
    department('Quality', 'Runs deterministic checks and release review.', [team('Release Readiness', 'Validates code and deployment posture.', [agent('QA Engineer', 'Runs tests and acceptance checks.', 'qa'), agent('Security Auditor', 'Reviews security impact.', 'security_review'), agent('DevOps Automator', 'Prepares deployment.', 'deployment')])]),
  ],
  connectors: [
    { name: 'Mock GitHub', mode: 'mock', purpose: 'Simulated branches, commits, and pull requests.', risk: 'high' },
    { name: 'Mock CI', mode: 'mock', purpose: 'Deterministic build and test results.', risk: 'medium' },
    { name: 'Mock Fly', mode: 'mock', purpose: 'Simulated deploy previews.', risk: 'high' },
  ],
  tasks: [
    { title: 'Create product requirements and acceptance criteria', department: 'Product', owner: 'Product Manager', stage: 'Planning', priority: 'high', approvalRequired: true },
    { title: 'Produce architecture and threat model', department: 'Engineering', owner: 'Backend Architect', stage: 'Planning', priority: 'high', approvalRequired: true },
    { title: 'Generate implementation patch', department: 'Engineering', owner: 'Frontend Developer', stage: 'Generation', priority: 'high', approvalRequired: false },
    { title: 'Run mock CI and security review', department: 'Quality', owner: 'QA Engineer', stage: 'Validation', priority: 'critical', approvalRequired: true },
  ],
  approvals: [
    { title: 'Approve implementation plan', reason: 'Confirms scope before code generation.', risk: 'high' },
    { title: 'Approve patch application', reason: 'No code is applied before diff and validation review.', risk: 'critical' },
    { title: 'Approve production deployment', reason: 'Deployment remains a separate founder-controlled action.', risk: 'critical' },
  ],
  kpis: [
    { name: 'Build success', target: '100% before approval', cadence: 'Per change' },
    { name: 'Critical security findings', target: '0 unresolved', cadence: 'Per change' },
    { name: 'Rollback readiness', target: '100%', cadence: 'Per release' },
  ],
  roadmap: [
    { phase: 'Phase 1 · Product', objective: 'Define requirements and architecture.', outputs: ['PRD', 'Architecture', 'Acceptance criteria'] },
    { phase: 'Phase 2 · Build', objective: 'Generate isolated, reviewable changes.', outputs: ['Branch', 'Patch', 'Tests'] },
    { phase: 'Phase 3 · Release', objective: 'Validate and approve a mock deployment.', outputs: ['QA report', 'Deploy plan', 'Rollback plan'] },
  ],
  risks: [
    { title: 'Unsafe code execution', mitigation: 'Keep tools mocked until sandboxing is complete.', severity: 'high' },
    { title: 'Unreviewed changes', mitigation: 'Require plan, diff, QA, and founder approval.', severity: 'high' },
  ],
  estimatedMonthlyCost: 0,
  providerMode: 'mock',
  connectorMode: 'mock',
};

const marketplaceTemplate: Template = {
  ...contentTemplate,
  archetype: 'marketplace',
  company: { name: 'Marketplace Division', description: 'A commerce operation for opportunity research, product creation, listings, marketing, and support.', positioning: 'Mock-first commerce workflows before any real storefront or payment access.', brandColor: '#f97316' },
  executiveSummary: 'Build a disciplined marketplace operation that validates demand before product creation and keeps publishing and financial actions approval-gated.',
  connectors: [
    { name: 'Mock Storefront', mode: 'mock', purpose: 'Simulated listings, orders, and customers.', risk: 'high' },
    { name: 'Mock Fulfillment', mode: 'mock', purpose: 'Simulated production and shipping events.', risk: 'medium' },
    { name: 'Mock Payments', mode: 'mock', purpose: 'Simulated revenue and refunds.', risk: 'high' },
  ],
};

const consultingTemplate: Template = {
  ...contentTemplate,
  archetype: 'consulting',
  company: { name: 'Consulting Group', description: 'A client-service organization for lead research, discovery, proposals, delivery, and reporting.', positioning: 'Founder-approved client communications and mock CRM operations.', brandColor: '#0ea5e9' },
  executiveSummary: 'Build a repeatable consulting operation with clear offers, controlled client communication, delivery workflows, and outcome reporting.',
  connectors: [
    { name: 'Mock CRM', mode: 'mock', purpose: 'Simulated accounts, leads, and pipeline.', risk: 'medium' },
    { name: 'Mock Inbox', mode: 'mock', purpose: 'Draft-only client communications.', risk: 'high' },
    { name: 'Mock Invoicing', mode: 'mock', purpose: 'Simulated invoices and collections.', risk: 'high' },
  ],
};

function inferTemplate(objective: string): Template {
  const text = objective.toLowerCase();
  if (/invest|portfolio|stock|equity|fund|asset|finance/.test(text)) return investmentTemplate;
  if (/software|saas|app|platform|dashboard|developer|code/.test(text)) return softwareTemplate;
  if (/marketplace|etsy|shop|commerce|store|product/.test(text)) return marketplaceTemplate;
  if (/consult|agency|client|service|lead/.test(text)) return consultingTemplate;
  return contentTemplate;
}

function inferName(objective: string, fallback: string): string {
  const clean = objective
    .replace(/^\s*(i\s+)?(want|would like|need)\s+(to\s+)?/i, '')
    .replace(/^\s*(build|create|start|launch)\s+/i, '')
    .replace(/^\s*(an?|the)\s+/i, '')
    .replace(/[.!?]+$/g, '')
    .trim();
  if (!clean || clean.length < 6) return fallback;
  const title = clean.split(/\s+/).slice(0, 5).map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
  return /company|studio|lab|group|division|fund|firm|agency/i.test(title) ? title : fallback;
}

export function buildExecutiveBlueprint(objective: string): ExecutiveBlueprint {
  const trimmed = objective.trim();
  const template = structuredClone(inferTemplate(trimmed));
  template.company.name = inferName(trimmed, template.company.name);
  return {
    ...template,
    id: `bp_${slug(trimmed).slice(0, 36) || 'founder'}_${stableHash(trimmed)}`,
    objective: trimmed,
    generatedAt: new Date().toISOString(),
  };
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
