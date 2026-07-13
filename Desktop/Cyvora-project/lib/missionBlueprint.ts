export type MissionBlueprint = {
  companyName: string;
  description: string;
  brandColor: string;
  connectors: string[];
  connectorDetails: {
    name: string;
    connectorType: string;
    status: string;
    summary: string;
  }[];
  departments: {
    name: string;
    description: string;
    teams: {
      name: string;
      description: string;
      agents: {
        name: string;
        taskType: string;
      }[];
    }[];
  }[];
};

export function inferMissionBlueprint(objective: string): MissionBlueprint {
  const lower = objective.toLowerCase();

  if (lower.includes('youtube') || lower.includes('content') || lower.includes('creator') || lower.includes('video')) {
    return {
      companyName: 'Content Studio',
      description: 'A media company for channel growth, production, and audience analytics.',
      brandColor: '#38bdf8',
      connectors: ['YouTube Studio', 'Drive asset library', 'Analytics dashboard', 'Publishing queue'],
      connectorDetails: [
        { name: 'YouTube Studio', connectorType: 'platform', status: 'linked', summary: 'Publishing and channel analytics surface.' },
        { name: 'Drive asset library', connectorType: 'storage', status: 'ready', summary: 'Source assets and packaged media.' },
        { name: 'Analytics dashboard', connectorType: 'analytics', status: 'ready', summary: 'Performance tracking for views and retention.' },
        { name: 'Publishing queue', connectorType: 'workflow', status: 'queued', summary: 'Release orchestration for new episodes.' },
      ],
      departments: [
        {
          name: 'Audience Research',
          description: 'Finds topics, demand, and audience language.',
          teams: [
            {
              name: 'Topic Intelligence',
              description: 'Tracks what the audience wants next.',
              agents: [
                { name: 'Product Trend Researcher', taskType: 'topic_research' },
                { name: 'UX Researcher', taskType: 'audience_research' },
              ],
            },
          ],
        },
        {
          name: 'Creative Production',
          description: 'Drafts scripts, visuals, and packaging.',
          teams: [
            {
              name: 'Editorial',
              description: 'Shapes the message and the release plan.',
              agents: [
                { name: 'Copywriter', taskType: 'scriptwriting' },
                { name: 'Visual Storyteller', taskType: 'visual_direction' },
                { name: 'Brand Guardian', taskType: 'brand_consistency' },
              ],
            },
          ],
        },
      ],
    };
  }

  if (lower.includes('software') || lower.includes('dashboard') || lower.includes('app') || lower.includes('saas')) {
    return {
      companyName: 'Software Lab',
      description: 'A product org for building dashboards, systems, and workflows.',
      brandColor: '#6366f1',
      connectors: ['GitHub', 'Issue tracker', 'Database', 'Deployment pipeline'],
      connectorDetails: [
        { name: 'GitHub', connectorType: 'source control', status: 'linked', summary: 'Codebase and pull request coordination.' },
        { name: 'Issue tracker', connectorType: 'workflow', status: 'ready', summary: 'Planning and execution board for engineering work.' },
        { name: 'Database', connectorType: 'data', status: 'ready', summary: 'Operational data and generated records.' },
        { name: 'Deployment pipeline', connectorType: 'ops', status: 'queued', summary: 'Release path for staged builds.' },
      ],
      departments: [
        {
          name: 'Product Strategy',
          description: 'Turns the objective into requirements and milestones.',
          teams: [
            {
              name: 'Discovery',
              description: 'Defines scope and delivery shape.',
              agents: [
                { name: 'Product Manager', taskType: 'product_strategy' },
                { name: 'UX Researcher', taskType: 'user_research' },
              ],
            },
          ],
        },
        {
          name: 'Engineering',
          description: 'Builds the interface and backend systems.',
          teams: [
            {
              name: 'Application Build',
              description: 'Ships the product in safe increments.',
              agents: [
                { name: 'Frontend Developer', taskType: 'frontend' },
                { name: 'Backend Architect', taskType: 'backend' },
                { name: 'Database Optimizer', taskType: 'database' },
              ],
            },
          ],
        },
      ],
    };
  }

  if (lower.includes('marketplace') || lower.includes('etsy') || lower.includes('shop') || lower.includes('ecommerce')) {
    return {
      companyName: 'Marketplace Division',
      description: 'A commerce engine for product discovery, listing, and fulfillment.',
      brandColor: '#f97316',
      connectors: ['Storefront', 'Catalog feed', 'Fulfillment tracker', 'Revenue dashboard'],
      connectorDetails: [
        { name: 'Storefront', connectorType: 'platform', status: 'linked', summary: 'Primary storefront and order surface.' },
        { name: 'Catalog feed', connectorType: 'data', status: 'ready', summary: 'Product catalog and inventory feed.' },
        { name: 'Fulfillment tracker', connectorType: 'ops', status: 'ready', summary: 'Order and shipping status stream.' },
        { name: 'Revenue dashboard', connectorType: 'analytics', status: 'queued', summary: 'Sales and margin visibility.' },
      ],
      departments: [
        {
          name: 'Market Intelligence',
          description: 'Analyzes demand and pricing.',
          teams: [
            {
              name: 'Trend Research',
              description: 'Finds winning product opportunities.',
              agents: [
                { name: 'Product Trend Researcher', taskType: 'trend_research' },
                { name: 'Business Strategist', taskType: 'market_validation' },
              ],
            },
          ],
        },
        {
          name: 'Operations',
          description: 'Manages fulfillment and performance.',
          teams: [
            {
              name: 'Store Operations',
              description: 'Keeps commerce running.',
              agents: [
                { name: 'Operations Manager', taskType: 'operations' },
                { name: 'Finance FP&A Analyst', taskType: 'unit_economics' },
              ],
            },
          ],
        },
      ],
    };
  }

  if (lower.includes('consulting') || lower.includes('agency') || lower.includes('client') || lower.includes('service')) {
    return {
      companyName: 'Consulting Group',
      description: 'A client delivery org for strategy, sales, and execution support.',
      brandColor: '#0ea5e9',
      connectors: ['CRM', 'Inbox', 'Docs workspace', 'Invoice tracker'],
      connectorDetails: [
        { name: 'CRM', connectorType: 'platform', status: 'linked', summary: 'Client pipeline and account data.' },
        { name: 'Inbox', connectorType: 'communication', status: 'ready', summary: 'Client communication surface.' },
        { name: 'Docs workspace', connectorType: 'knowledge', status: 'ready', summary: 'Proposal, brief, and delivery docs.' },
        { name: 'Invoice tracker', connectorType: 'finance', status: 'queued', summary: 'Billing and collections workflow.' },
      ],
      departments: [
        {
          name: 'Strategy',
          description: 'Shapes the offer and the client outcome.',
          teams: [
            {
              name: 'Offer Strategy',
              description: 'Defines scope and promise.',
              agents: [
                { name: 'Business Strategist', taskType: 'offer_strategy' },
                { name: 'Proposal Strategist', taskType: 'proposal_design' },
              ],
            },
          ],
        },
        {
          name: 'Delivery',
          description: 'Runs the work and the handoffs.',
          teams: [
            {
              name: 'Client Operations',
              description: 'Delivers the service and tracks success.',
              agents: [
                { name: 'Project Shepherd', taskType: 'client_delivery' },
                { name: 'Customer Success Manager', taskType: 'retention' },
              ],
            },
          ],
        },
      ],
    };
  }

  return {
    companyName: 'Executive Branch',
    description: 'A starter operating company generated from the objective.',
    brandColor: '#22c55e',
    connectors: ['Founder inbox', 'Briefing archive', 'Task board', 'Approval log'],
    connectorDetails: [
      { name: 'Founder inbox', connectorType: 'communication', status: 'linked', summary: 'Intake for founder intent and commands.' },
      { name: 'Briefing archive', connectorType: 'knowledge', status: 'ready', summary: 'Mission briefings and historical decisions.' },
      { name: 'Task board', connectorType: 'workflow', status: 'ready', summary: 'Operational work queue.' },
      { name: 'Approval log', connectorType: 'governance', status: 'queued', summary: 'Audit trail for approvals and reversals.' },
    ],
    departments: [
      {
        name: 'Strategy',
        description: 'Clarifies the objective and the operating model.',
        teams: [
          {
            name: 'Planning',
            description: 'Breaks the goal into the first execution steps.',
            agents: [
              { name: 'Business Strategist', taskType: 'strategy' },
              { name: 'Project Manager', taskType: 'planning' },
            ],
          },
        ],
      },
      {
        name: 'Execution',
        description: 'Turns the plan into work and outputs.',
        teams: [
          {
            name: 'Operations Desk',
            description: 'Carries the objective forward.',
            agents: [
              { name: 'Operations Manager', taskType: 'operations' },
              { name: 'Executive Summary Generator', taskType: 'reporting' },
            ],
          },
        ],
      },
    ],
  };
}
