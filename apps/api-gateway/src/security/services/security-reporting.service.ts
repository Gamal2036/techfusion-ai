import { Injectable } from '@nestjs/common';

export interface ExecutiveSummaryData {
  deviceName: string;
  deviceHostname: string | null;
  score: number;
  riskLevel: string;
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  scanDate: string;
  topFindings: { finding: string; severity: string; remediation: string }[];
  recommendations: string[];
  summaryText: string;
}

@Injectable()
export class SecurityReportingService {
  generateSummary(data: {
    deviceName: string;
    deviceHostname: string | null;
    securityScore: number;
    riskLevel: string;
    totalFindings: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    scanDate: Date;
    findings: { finding: string; severity: string; remediation: string }[];
  }): ExecutiveSummaryData {
    const topFindings = [...data.findings]
      .sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2, low: 3 };
        return (order[a.severity as keyof typeof order] || 99) - (order[b.severity as keyof typeof order] || 99);
      })
      .slice(0, 5);

    const recommendations: string[] = [];

    for (const f of topFindings) {
      if (f.remediation) {
        recommendations.push(`${f.remediation}`);
      }
    }

    let summaryText = '';
    if (data.totalFindings === 0) {
      summaryText = `${data.deviceName} has a clean security posture with no outstanding findings. Continue monitoring and maintaining current security practices.`;
    } else if (data.riskLevel === 'low') {
      summaryText = `${data.deviceName} has a solid security posture with only minor issues. The overall risk is low but addressing the ${data.lowCount} low-severity finding${data.lowCount !== 1 ? 's' : ''} will further strengthen defenses.`;
    } else if (data.riskLevel === 'medium') {
      summaryText = `${data.deviceName} has moderate security concerns that should be addressed. With ${data.totalFindings} total finding${data.totalFindings !== 1 ? 's' : ''} (${data.highCount} high, ${data.mediumCount} medium, ${data.lowCount} low), the system has meaningful exposure that warrants attention from the IT team.`;
    } else if (data.riskLevel === 'high') {
      summaryText = `${data.deviceName} has significant security issues requiring prompt action. ${data.highCount} high-severity issue${data.highCount !== 1 ? 's' : ''} and ${data.mediumCount} medium-severity issue${data.mediumCount !== 1 ? 's' : ''} present a material risk to the organization. Remediation should be prioritized.`;
    } else {
      summaryText = `${data.deviceName} is in a critical security state. ${data.criticalCount} critical finding${data.criticalCount !== 1 ? 's' : ''} and ${data.highCount} high finding${data.highCount !== 1 ? 's' : ''} indicate urgent action is needed. Immediate remediation is required to prevent potential compromise.`;
    }

    return {
      deviceName: data.deviceName,
      deviceHostname: data.deviceHostname,
      score: data.securityScore,
      riskLevel: data.riskLevel,
      totalFindings: data.totalFindings,
      criticalCount: data.criticalCount,
      highCount: data.highCount,
      mediumCount: data.mediumCount,
      lowCount: data.lowCount,
      scanDate: data.scanDate.toISOString(),
      topFindings,
      recommendations,
      summaryText,
    };
  }
}
