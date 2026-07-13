import { NextRequest, NextResponse } from 'next/server';
import { getTenantId, ensureTenantDirectories } from '@/lib/tenant';
import {
  saveActivityEvent,
  saveAgentAssignment,
  saveApproval,
  saveCompany,
  saveDepartment,
  saveOutput,
  saveTask,
  saveTeam,
} from '@/lib/db';
import { getRuntimeModeInfo, isDemoMode } from '@/lib/runtimeMode';

type AgentSpec = {
  agent_name: string;
  task_type: string;
};

type TeamSpec = {
  name: string;
  description: string;
  agents: AgentSpec[];
};

type DepartmentSpec = {
  name: string;
  description: string;
  teams: TeamSpec[];
};

type CompanyStructure = {
  name: string;
  description: string;
  brand_color: string;
  category: string;
  departments: DepartmentSpec[];
};

const businessArchetypes = [
  {
    category: 'marketplace',
    keywords: ['etsy', 'shopify', 'print on demand', 'printify', 'product', 'store', 'merch', 'ecommerce', 'e-commerce', 'amazon'],
    color: '#f97316',
    defaultName: 'Marketplace Division',
    departments: [
      department('Market Intelligence', 'Finds profitable niches, competitors, and demand patterns.', [
        team('Trend Research', 'Identifies winning products and market gaps.', [
          agent('Product Trend Researcher', 'trend_research'),
          agent('Business Strategist', 'market_validation'),
        ]),
      ]),
      department('Product Studio', 'Creates offers, mockups, listings, and product experiments.', [
        team('Offer Creation', 'Turns research into shippable product concepts.', [
          agent('Product Manager', 'offer_design'),
          agent('Visual Storyteller', 'product_visuals'),
          agent('Image Prompt Engineer', 'creative_generation'),
        ]),
      ]),
      department('Growth', 'Drives traffic, search visibility, and conversion.', [
        team('SEO and Paid Media', 'Optimizes listings and acquisition channels.', [
          agent('Paid Media Creative Strategist', 'creative_testing'),
          agent('Paid Media PPC Strategist', 'paid_search'),
          agent('Sales Offer Lead Gen Strategist', 'lead_generation'),
        ]),
      ]),
      department('Operations', 'Handles fulfillment, reporting, and customer loops.', [
        team('Store Operations', 'Monitors orders, returns, and performance.', [
          agent('Operations Manager', 'operations'),
          agent('Finance FP&A Analyst', 'unit_economics'),
        ]),
      ]),
    ],
  },
  {
    category: 'content',
    keywords: ['youtube', 'tiktok', 'content', 'newsletter', 'blog', 'creator', 'media', 'podcast', 'social'],
    color: '#38bdf8',
    defaultName: 'Content Studio',
    departments: [
      department('Audience Research', 'Maps audience demand, topics, competitors, and channels.', [
        team('Topic Intelligence', 'Finds content angles with growth potential.', [
          agent('Product Trend Researcher', 'topic_research'),
          agent('UX Researcher', 'audience_research'),
        ]),
      ]),
      department('Creative Production', 'Plans, scripts, designs, and packages content.', [
        team('Editorial', 'Creates scripts, outlines, and publishing packages.', [
          agent('Copywriter', 'scriptwriting'),
          agent('Visual Storyteller', 'visual_direction'),
          agent('Brand Guardian', 'brand_consistency'),
        ]),
      ]),
      department('Distribution', 'Publishes, optimizes, and repurposes content.', [
        team('Channel Growth', 'Optimizes search, retention, and promotion.', [
          agent('Paid Social Strategist', 'channel_growth'),
          agent('Search Query Analyst', 'seo_research'),
        ]),
      ]),
      department('Analytics', 'Measures content performance and recommends next moves.', [
        team('Performance Review', 'Tracks audience growth, revenue, and experiments.', [
          agent('Feedback Synthesizer', 'performance_insights'),
          agent('FP&A Analyst', 'revenue_modeling'),
        ]),
      ]),
    ],
  },
  {
    category: 'software',
    keywords: ['software', 'saas', 'app', 'dashboard', 'platform', 'tool', 'web app', 'mobile app', 'ai tool'],
    color: '#6366f1',
    defaultName: 'Software Lab',
    departments: [
      department('Product Strategy', 'Defines the product, users, market, and roadmap.', [
        team('Discovery', 'Turns the vision into requirements and milestones.', [
          agent('Product Manager', 'product_strategy'),
          agent('UX Researcher', 'user_research'),
        ]),
      ]),
      department('Design', 'Creates the interface, experience, and visual system.', [
        team('Experience Design', 'Designs workflows, screens, and interaction models.', [
          agent('UX Architect', 'ux_architecture'),
          agent('UI Designer', 'ui_design'),
          agent('Brand Guardian', 'design_system'),
        ]),
      ]),
      department('Engineering', 'Builds frontend, backend, data, and integrations.', [
        team('Application Build', 'Implements the product safely and iteratively.', [
          agent('Frontend Developer', 'frontend'),
          agent('Backend Architect', 'backend'),
          agent('Database Optimizer', 'database'),
        ]),
      ]),
      department('Quality and Launch', 'Tests, hardens, deploys, and monitors the product.', [
        team('Release Readiness', 'Runs QA, security, performance, and deployment checks.', [
          agent('Test Results Analyzer', 'qa'),
          agent('Security AppSec Engineer', 'security_review'),
          agent('DevOps Automator', 'deployment'),
        ]),
      ]),
    ],
  },
  {
    category: 'music',
    keywords: ['music', 'label', 'album', 'song', 'producer', 'artist', 'record'],
    color: '#a855f7',
    defaultName: 'Music Label',
    departments: [
      department('Creative', 'Develops artists, concepts, sounds, and release direction.', [
        team('Concept Studio', 'Creates release concepts and creative briefs.', [
          agent('Visual Storyteller', 'creative_direction'),
          agent('Brand Guardian', 'artist_brand'),
        ]),
      ]),
      department('Production', 'Coordinates music, assets, and release packages.', [
        team('Release Production', 'Packages tracks, artwork, descriptions, and metadata.', [
          agent('Project Manager Senior', 'release_management'),
          agent('Technical Writer', 'metadata_packaging'),
        ]),
      ]),
      department('Marketing', 'Promotes releases and grows audiences.', [
        team('Audience Growth', 'Plans launch content, ads, and distribution.', [
          agent('Paid Social Strategist', 'release_marketing'),
          agent('Content Creator', 'social_content'),
        ]),
      ]),
      department('Finance', 'Tracks royalties, budgets, and release economics.', [
        team('Label Finance', 'Monitors spend, revenue, and profitability.', [
          agent('Finance Financial Analyst', 'royalty_tracking'),
          agent('Bookkeeper Controller', 'bookkeeping'),
        ]),
      ]),
    ],
  },
  {
    category: 'investment',
    keywords: ['investment', 'stocks', 'equities', 'portfolio', 'finance', 'research', 'trading', 'assets'],
    color: '#22c55e',
    defaultName: 'Investment Research',
    departments: [
      department('Macro Research', 'Monitors market regimes, economic signals, and risk context.', [
        team('Market Intelligence', 'Synthesizes macro themes and watchlists.', [
          agent('Finance Investment Researcher', 'macro_research'),
          agent('Financial Analyst', 'market_analysis'),
        ]),
      ]),
      department('Equities', 'Researches companies, sectors, and investment narratives.', [
        team('Company Research', 'Builds reports, theses, and valuation notes.', [
          agent('Finance Financial Analyst', 'equity_research'),
          agent('Statistician', 'data_analysis'),
        ]),
      ]),
      department('Risk', 'Evaluates downside, exposure, and scenario planning.', [
        team('Risk Review', 'Challenges assumptions and monitors portfolio risk.', [
          agent('Strategy Duel Agent', 'devils_advocate'),
          agent('Compliance Auditor', 'compliance'),
        ]),
      ]),
      department('Reports', 'Turns research into readable founder briefings.', [
        team('Briefing Desk', 'Creates investment memos and executive summaries.', [
          agent('Executive Summary Generator', 'reporting'),
          agent('Technical Writer', 'documentation'),
        ]),
      ]),
    ],
  },
  {
    category: 'consulting',
    keywords: ['consulting', 'agency', 'client', 'dealership', 'leads', 'service', 'call center', 'b2b'],
    color: '#0ea5e9',
    defaultName: 'Consulting Group',
    departments: [
      department('Strategy', 'Shapes offers, positioning, and client outcomes.', [
        team('Offer Strategy', 'Defines the consulting offer and delivery plan.', [
          agent('Business Strategist', 'offer_strategy'),
          agent('Proposal Strategist', 'proposal_design'),
        ]),
      ]),
      department('Sales', 'Generates pipeline and manages deal flow.', [
        team('Outbound', 'Builds lead lists, outreach, and follow-up systems.', [
          agent('Outbound Strategist', 'outreach'),
          agent('Sales Coach', 'sales_enablement'),
          agent('Pipeline Analyst', 'pipeline_analysis'),
        ]),
      ]),
      department('Delivery', 'Runs client work and operational handoffs.', [
        team('Client Operations', 'Executes projects and tracks client outcomes.', [
          agent('Project Shepherd', 'client_delivery'),
          agent('Customer Success Manager', 'retention'),
        ]),
      ]),
      department('Reporting', 'Summarizes progress, ROI, and next actions.', [
        team('Account Intelligence', 'Produces client reports and recommendations.', [
          agent('Analytics Reporter', 'reporting'),
          agent('FP&A Analyst', 'roi_analysis'),
        ]),
      ]),
    ],
  },
  {
    category: 'game',
    keywords: ['game', 'gaming', 'roblox', 'unity', 'unreal', 'godot'],
    color: '#ec4899',
    defaultName: 'Game Studio',
    departments: [
      department('Game Design', 'Defines mechanics, loops, levels, and player experience.', [
        team('Design Pod', 'Creates the game concept and playable systems.', [
          agent('Game Designer', 'game_design'),
          agent('Narrative Designer', 'story_design'),
        ]),
      ]),
      department('Production', 'Builds prototypes, worlds, and assets.', [
        team('Build Team', 'Implements gameplay and technical systems.', [
          agent('Unity Architect', 'game_engineering'),
          agent('Technical Artist', 'asset_pipeline'),
        ]),
      ]),
      department('QA', 'Tests gameplay, performance, balance, and stability.', [
        team('Playtest Lab', 'Finds bugs and validates player experience.', [
          agent('Reality Checker', 'qa_review'),
          agent('Performance Benchmarker', 'performance'),
        ]),
      ]),
      department('Launch', 'Plans store pages, community, and launch campaigns.', [
        team('Go-to-Market', 'Packages the game for audience growth.', [
          agent('Paid Social Strategist', 'launch_marketing'),
          agent('Brand Guardian', 'positioning'),
        ]),
      ]),
    ],
  },
  {
    category: 'affiliate',
    keywords: ['affiliate', 'buyers guide', 'review site', 'commission', 'blog monetization'],
    color: '#eab308',
    defaultName: 'Affiliate Network',
    departments: [
      department('Niche Research', 'Finds profitable topics, products, and affiliate programs.', [
        team('Opportunity Scan', 'Ranks niches by demand and monetization potential.', [
          agent('Product Trend Researcher', 'niche_research'),
          agent('Search Query Analyst', 'keyword_research'),
        ]),
      ]),
      department('Content Production', 'Creates buyer guides, comparisons, and review content.', [
        team('Editorial Desk', 'Builds useful, conversion-oriented content.', [
          agent('Copywriter', 'affiliate_content'),
          agent('Technical Writer', 'product_explainers'),
        ]),
      ]),
      department('Growth', 'Improves search visibility and distribution.', [
        team('SEO Growth', 'Optimizes pages, internal links, and content refreshes.', [
          agent('Search Relevance Engineer', 'seo_systems'),
          agent('Paid Media Tracking Specialist', 'tracking'),
        ]),
      ]),
      department('Revenue', 'Tracks commission, conversion, and offer performance.', [
        team('Monetization', 'Analyzes revenue and recommends offer swaps.', [
          agent('Finance FP&A Analyst', 'revenue_tracking'),
          agent('Feedback Synthesizer', 'optimization'),
        ]),
      ]),
    ],
  },
];

const fallbackDepartments = [
  department('Research', 'Validates the market, audience, and opportunity.', [
    team('Discovery', 'Turns the founder vision into a grounded operating plan.', [
      agent('Business Strategist', 'strategy'),
      agent('Product Trend Researcher', 'research'),
    ]),
  ]),
  department('Product', 'Creates offers, workflows, and customer-facing outputs.', [
    team('Build Pod', 'Designs and implements the first operating system for the business.', [
      agent('Product Manager', 'product'),
      agent('UX Architect', 'ux'),
      agent('Frontend Developer', 'implementation'),
    ]),
  ]),
  department('Growth', 'Finds channels, messaging, and monetization loops.', [
    team('Growth Team', 'Builds acquisition and launch systems.', [
      agent('Brand Guardian', 'positioning'),
      agent('Paid Media Creative Strategist', 'creative'),
      agent('Sales Offer Lead Gen Strategist', 'go_to_market'),
    ]),
  ]),
  department('Operations', 'Monitors performance, costs, quality, and approvals.', [
    team('Operating Desk', 'Runs reporting, QA, and founder approval gates.', [
      agent('Project Manager Senior', 'operations'),
      agent('Finance FP&A Analyst', 'finance'),
      agent('Security Compliance Auditor', 'risk'),
    ]),
  ]),
];

export async function POST(req: NextRequest) {
  try {
    const { vision } = await req.json();
    if (!vision || !vision.trim()) {
      return NextResponse.json({ error: 'Vision is required' }, { status: 400 });
    }
    if (isDemoMode()) {
      return NextResponse.json(
        { error: 'Company creation is disabled in free demo mode. Reset the demo to refresh showcase data.' },
        { status: 403 }
      );
    }

    const tenant = await getTenantId();
    ensureTenantDirectories(tenant);
    const runtimeMode = getRuntimeModeInfo();

    const companyStructure = generateCompanyStructure(vision.trim());
    const companyId = await saveCompany({
      tenant,
      name: companyStructure.name,
      description: companyStructure.description,
      brand_color: companyStructure.brand_color,
    });

    for (const dept of companyStructure.departments) {
      const deptId = await saveDepartment({
        company_id: companyId,
        name: dept.name,
        description: dept.description,
      });

      for (const team of dept.teams) {
        const teamId = await saveTeam({
          department_id: deptId,
          name: team.name,
          description: team.description,
        });

        for (const teamAgent of team.agents) {
          await saveAgentAssignment({
            team_id: teamId,
            agent_name: teamAgent.agent_name,
            task_type: teamAgent.task_type,
          });
        }
      }

      const firstTeam = dept.teams[0];
      const firstAgent = firstTeam?.agents[0];
      const taskId = await saveTask({
        company_id: companyId,
        department_id: deptId,
        title: `${dept.name}: create first operating plan`,
        description: `Initial task generated by Executive AI for ${dept.name}.`,
        workflow_stage: workflowStageForDepartment(dept.name),
        status: 'active',
        priority: dept.name.toLowerCase().includes('operations') ? 'medium' : 'high',
        assigned_agent: firstAgent?.agent_name || 'Executive AI',
      });

      await saveOutput({
        company_id: companyId,
        task_id: taskId,
        title: `${dept.name} starter brief`,
        output_type: 'brief',
        status: 'drafting',
        summary: `Output placeholder for ${dept.name}'s first operating brief.`,
      });
    }

    await saveApproval({
      company_id: companyId,
      title: `Approve launch plan for ${companyStructure.name}`,
      summary: 'Founder approval required before this company moves from planning into execution.',
      status: 'pending',
      risk_level: 'medium',
    });

    await saveActivityEvent({
      company_id: companyId,
      event_type: 'company_created',
      title: `${companyStructure.name} created`,
      description: `Executive AI generated a ${companyStructure.category} company from founder vision.`,
    });

    await saveActivityEvent({
      company_id: companyId,
      event_type: 'approval_requested',
      title: 'Launch approval requested',
      description: 'The company has an initial operating plan waiting for founder review.',
    });

    return NextResponse.json({
      success: true,
      runtime_mode: runtimeMode.mode,
      company: {
        id: companyId,
        name: companyStructure.name,
        description: companyStructure.description,
        category: companyStructure.category,
        departments: companyStructure.departments,
      },
    });
  } catch (error: any) {
    console.error('Error in execute-vision:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

function generateCompanyStructure(vision: string): CompanyStructure {
  const normalized = vision.toLowerCase();
  const archetype =
    businessArchetypes.find((candidate) =>
      candidate.keywords.some((keyword) => normalized.includes(keyword))
    ) || null;

  const category = archetype?.category || 'custom';
  const companyName = inferCompanyName(vision, archetype?.defaultName || 'Autonomous Venture');

  return {
    name: companyName,
    description: `An autonomous ${readableCategory(category)} built from the founder vision: ${vision}`,
    brand_color: archetype?.color || '#14b8a6',
    category,
    departments: archetype?.departments || fallbackDepartments,
  };
}

function inferCompanyName(vision: string, fallback: string) {
  const clean = vision
    .replace(/^i\s+(want|wanna|would like)\s+(to\s+)?/i, '')
    .replace(/^build\s+/i, '')
    .replace(/^start\s+/i, '')
    .replace(/^create\s+/i, '')
    .replace(/[.?!]+$/g, '')
    .trim();

  if (!clean) return fallback;

  const words = clean.split(/\s+/).slice(0, 5);
  const title = words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  if (title.length < 8) return fallback;
  if (/business|company|store|studio|agency|lab|label|network|group/i.test(title)) return title;
  return `${title} ${suffixForFallback(fallback)}`;
}

function suffixForFallback(fallback: string) {
  const parts = fallback.split(/\s+/);
  const suffix = parts[parts.length - 1];
  return suffix || 'Company';
}

function readableCategory(category: string) {
  return category === 'custom' ? 'business' : category.replace('-', ' ');
}

function department(name: string, description: string, teams: TeamSpec[]): DepartmentSpec {
  return { name, description, teams };
}

function team(name: string, description: string, agents: AgentSpec[]): TeamSpec {
  return { name, description, agents };
}

function agent(agent_name: string, task_type: string): AgentSpec {
  return { agent_name, task_type };
}

function workflowStageForDepartment(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('research') || lower.includes('intelligence')) return 'Research';
  if (lower.includes('design') || lower.includes('creative') || lower.includes('product')) return 'Planning';
  if (lower.includes('engineering') || lower.includes('production')) return 'Generation';
  if (lower.includes('quality') || lower.includes('risk') || lower.includes('qa')) return 'Validation';
  if (lower.includes('growth') || lower.includes('marketing') || lower.includes('distribution')) return 'Publishing';
  return 'Analysis';
}
