import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getCompanyTemplates } from '@/lib/companyEngine';

export type AgentRisk = 'low' | 'medium' | 'high';
export type AgentLifecycle = 'available' | 'assigned' | 'paused' | 'archived';

export type AgentRegistryEntry = {
  id: string;
  slug: string;
  name: string;
  role: string;
  summary: string;
  category: string;
  source: 'core' | 'custom' | 'library';
  sourcePath: string;
  version: string;
  lifecycle: AgentLifecycle;
  provider: 'mock';
  risk: AgentRisk;
  costProfile: '$0 mock';
  capabilities: string[];
  tags: string[];
  assignedTemplates: string[];
};

const registryRoot = process.env.JARVIS_WORKSPACE_ROOT || process.cwd();

let cache: AgentRegistryEntry[] | null = null;

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function walk(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : entry.isFile() && entry.name.endsWith('.md') ? [full] : [];
  });
}

function cleanLine(value: string) {
  return value.replace(/^[-*#>\s]+/, '').replace(/\*\*/g, '').trim();
}

function inferRisk(text: string): AgentRisk {
  if (/security|legal|compliance|finance|investment|deploy|devops|database|backend/i.test(text)) return 'high';
  if (/sales|marketing|research|product|operations|analytics/i.test(text)) return 'medium';
  return 'low';
}

function inferCapabilities(text: string) {
  const capabilityMap: [RegExp, string][] = [
    [/research|analyst|intelligence/i, 'Research'],
    [/write|copy|content|editor/i, 'Content'],
    [/design|visual|ux|ui|brand/i, 'Design'],
    [/engineer|developer|architect|database|devops/i, 'Engineering'],
    [/security|compliance|legal|risk/i, 'Governance'],
    [/sales|lead|pipeline|outbound/i, 'Sales'],
    [/finance|investment|portfolio|bookkeep/i, 'Finance'],
    [/operation|project|manager|delivery/i, 'Operations'],
    [/analytics|statistic|performance|data/i, 'Analytics'],
  ];
  const values = capabilityMap.filter(([pattern]) => pattern.test(text)).map(([, label]) => label);
  return values.length ? values : ['General'];
}

function sourceInfo(file: string): { source: AgentRegistryEntry['source']; category: string } {
  const relative = path.relative(registryRoot, file).replaceAll(path.sep, '/');
  if (relative.startsWith('personas/')) return { source: 'core', category: 'core' };
  if (relative.includes('/custom/')) return { source: 'custom', category: 'custom' };
  const libraryIndex = relative.indexOf('/library/');
  if (libraryIndex >= 0) {
    const rest = relative.slice(libraryIndex + '/library/'.length);
    return { source: 'library', category: rest.includes('/') ? rest.split('/')[0] : 'general' };
  }
  return { source: 'library', category: 'general' };
}

function loadRegistry() {
  const directories = [
    path.join(registryRoot, 'personas'),
    path.join(registryRoot, 'backend', 'app', 'agents', 'custom'),
    path.join(registryRoot, 'backend', 'app', 'agents', 'library'),
  ];
  const templateAssignments = new Map<string, Set<string>>();
  for (const template of getCompanyTemplates()) {
    for (const department of template.blueprint.departments) {
      for (const team of department.teams) {
        for (const agent of team.agents) {
          const key = slugify(agent.name);
          const current = templateAssignments.get(key) || new Set<string>();
          current.add(template.id);
          templateAssignments.set(key, current);
        }
      }
    }
  }

  const seen = new Map<string, AgentRegistryEntry>();
  for (const file of directories.flatMap(walk)) {
    const basename = path.basename(file, '.md');
    if (/^(readme|contributing|security|license|code-of-conduct)/i.test(basename)) continue;
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const heading = lines.find((line) => line.startsWith('# '));
    const name = cleanLine(heading || basename.replaceAll('-', ' ')).replace(/\b\w/g, (letter) => letter.toUpperCase());
    const slug = slugify(name || basename);
    if (!slug) continue;
    const summaryLine = lines.find((line) => !line.startsWith('#') && !line.startsWith('---')) || `${name} specialist persona.`;
    const summary = cleanLine(summaryLine).slice(0, 240);
    const info = sourceInfo(file);
    const fingerprint = crypto.createHash('sha1').update(content).digest('hex').slice(0, 8);
    const role = summary.replace(/[.]+$/, '');
    const capabilities = inferCapabilities(`${name} ${summary} ${info.category}`);
    const entry: AgentRegistryEntry = {
      id: `agent_${slug}`,
      slug,
      name,
      role,
      summary,
      category: info.category,
      source: info.source,
      sourcePath: path.relative(registryRoot, file).replaceAll(path.sep, '/'),
      version: `1.0.${parseInt(fingerprint.slice(0, 4), 16) % 1000}`,
      lifecycle: templateAssignments.has(slug) ? 'assigned' : 'available',
      provider: 'mock',
      risk: inferRisk(`${name} ${summary} ${info.category}`),
      costProfile: '$0 mock',
      capabilities,
      tags: Array.from(new Set([info.category, info.source, ...capabilities.map((item) => item.toLowerCase())])),
      assignedTemplates: Array.from(templateAssignments.get(slug) || []),
    };
    const existing = seen.get(slug);
    if (!existing || (existing.source === 'library' && entry.source !== 'library')) seen.set(slug, entry);
  }
  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function getAgentRegistry(options?: { query?: string; category?: string; risk?: string; source?: string }) {
  cache ??= loadRegistry();
  const query = options?.query?.trim().toLowerCase() || '';
  return cache.filter((agent) => {
    if (options?.category && options.category !== 'all' && agent.category !== options.category) return false;
    if (options?.risk && options.risk !== 'all' && agent.risk !== options.risk) return false;
    if (options?.source && options.source !== 'all' && agent.source !== options.source) return false;
    if (!query) return true;
    return `${agent.name} ${agent.role} ${agent.summary} ${agent.tags.join(' ')}`.toLowerCase().includes(query);
  });
}

export function getAgentBySlug(slug: string) {
  return getAgentRegistry().find((agent) => agent.slug === slug) || null;
}

export function getAgentRegistryStats() {
  const agents = getAgentRegistry();
  return {
    total: agents.length,
    assigned: agents.filter((agent) => agent.lifecycle === 'assigned').length,
    highRisk: agents.filter((agent) => agent.risk === 'high').length,
    categories: Array.from(new Set(agents.map((agent) => agent.category))).sort(),
    sources: Array.from(new Set(agents.map((agent) => agent.source))).sort(),
  };
}
