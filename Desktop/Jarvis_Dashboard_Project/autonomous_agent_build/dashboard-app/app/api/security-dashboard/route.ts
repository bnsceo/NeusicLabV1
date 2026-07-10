import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getTenantPath, ensureTenantDirectories } from '@/lib/tenant';

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await req.cookies;
    const tenant = cookieStore.get('tenant')?.value || 'default';
    const tenantPath = ensureTenantDirectories(tenant);
    const briefingsPath = path.join(tenantPath, 'briefings');

    let vulnerabilities: any[] = [];
    let compliance: any[] = [];
    let incidents: any[] = [];

    let files: string[] = [];
    try {
      files = fs.readdirSync(briefingsPath).filter(f => f.endsWith('.md'));
    } catch {}

    for (const file of files) {
      const content = fs.readFileSync(path.join(briefingsPath, file), 'utf-8');
      const lines = content.split('\n');
      let currentSection = '';
      let sectionBuffer: string[] = [];

      for (const line of lines) {
        if (line.startsWith('## ')) {
          if (currentSection && sectionBuffer.length > 0) {
            const sectionContent = sectionBuffer.join('\n');
            if (currentSection.toLowerCase().includes('vulnerabilities')) {
              vulnerabilities = vulnerabilities.concat(parseVulnerabilities(sectionContent));
            } else if (currentSection.toLowerCase().includes('compliance')) {
              compliance = compliance.concat(parseCompliance(sectionContent));
            } else if (currentSection.toLowerCase().includes('incidents')) {
              incidents = incidents.concat(parseIncidents(sectionContent));
            }
          }
          currentSection = line.replace('## ', '').trim();
          sectionBuffer = [];
        } else {
          sectionBuffer.push(line);
        }
      }
      if (currentSection && sectionBuffer.length > 0) {
        const sectionContent = sectionBuffer.join('\n');
        if (currentSection.toLowerCase().includes('vulnerabilities')) {
          vulnerabilities = vulnerabilities.concat(parseVulnerabilities(sectionContent));
        } else if (currentSection.toLowerCase().includes('compliance')) {
          compliance = compliance.concat(parseCompliance(sectionContent));
        } else if (currentSection.toLowerCase().includes('incidents')) {
          incidents = incidents.concat(parseIncidents(sectionContent));
        }
      }
    }

    if (vulnerabilities.length === 0 && compliance.length === 0 && incidents.length === 0) {
      vulnerabilities = [
        { id: 'VULN-001', title: 'Outdated TLS version on API gateway', severity: 'medium', description: 'TLS 1.0 is still supported. Disable it.', status: 'open', date: '2026-07-09' },
        { id: 'VULN-002', title: 'Missing rate limiting on login endpoint', severity: 'high', description: 'Brute force attacks possible.', status: 'in-progress', date: '2026-07-08' },
      ];
      compliance = [
        { standard: 'SOC 2', status: 'partial', details: 'In progress – audit due Q3 2026', lastAudit: '2026-06-15' },
        { standard: 'GDPR', status: 'compliant', details: 'All data processing agreements updated', lastAudit: '2026-07-01' },
      ];
    }

    return NextResponse.json({
      vulnerabilities,
      compliance,
      incidents,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load security data' }, { status: 500 });
  }
}

function parseVulnerabilities(text: string): any[] {
  const items: any[] = [];
  const lines = text.split('\n').filter(line => line.trim());
  let current: any = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ')) {
      if (current.title) items.push(current);
      current = { id: `VULN-${items.length+1}`, status: 'open', date: new Date().toISOString().split('T')[0] };
      const match = trimmed.match(/-\s*\*\*(Critical|High|Medium|Low)\*\*:\s*(.*)/);
      if (match) {
        current.severity = match[1].toLowerCase();
        current.title = match[2].trim();
      } else {
        current.title = trimmed.replace(/^-\s*/, '');
        current.severity = 'medium';
      }
    } else if (current.title) {
      current.description = (current.description || '') + ' ' + trimmed;
    }
  }
  if (current.title) items.push(current);
  return items;
}

function parseCompliance(text: string): any[] {
  const items: any[] = [];
  const lines = text.split('\n').filter(line => line.trim());
  let current: any = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ')) {
      if (current.standard) items.push(current);
      current = { lastAudit: new Date().toISOString().split('T')[0] };
      const match = trimmed.match(/-\s*([^:]+):\s*(Compliant|Non-Compliant|Partial)\s*[-–]\s*(.*)/);
      if (match) {
        current.standard = match[1].trim();
        current.status = match[2].toLowerCase();
        current.details = match[3].trim();
      } else {
        current.standard = trimmed.replace(/^-\s*/, '');
        current.status = 'partial';
        current.details = '';
      }
    } else if (current.standard) {
      current.details = (current.details || '') + ' ' + trimmed;
    }
  }
  if (current.standard) items.push(current);
  return items;
}

function parseIncidents(text: string): any[] {
  const items: any[] = [];
  const lines = text.split('\n').filter(line => line.trim());
  let current: any = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ')) {
      if (current.title) items.push(current);
      current = { status: 'open', remediation: 'Pending investigation' };
      const match = trimmed.match(/-\s*\[(.*?)\]\s*(Critical|High|Medium|Low):\s*(.*)/);
      if (match) {
        current.timestamp = match[1];
        current.severity = match[2].toLowerCase();
        current.title = match[3];
      } else {
        current.title = trimmed.replace(/^-\s*/, '');
        current.timestamp = new Date().toISOString();
        current.severity = 'medium';
      }
    } else if (current.title) {
      const remMatch = trimmed.match(/Remediation:\s*(.*)/);
      if (remMatch) {
        current.remediation = remMatch[1].trim();
      }
    }
  }
  if (current.title) items.push(current);
  return items;
}
