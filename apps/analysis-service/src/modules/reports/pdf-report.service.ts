import { Injectable } from '@nestjs/common';
import type { BuiltReportSections } from './report-builder.service';

export type PdfReportInput = BuiltReportSections & {
  generatedAt: string;
  executiveSummary: string;
  businessImpact: string;
  recommendedNextSteps: string[];
  risk: {
    score: number | null;
    level: string | null;
    openFindings: number;
    criticalAndHigh: number;
  };
  repository: {
    repoUrl: string;
    defaultBranch?: string;
  };
  topFindings: Array<{
    severity: string;
    message: string;
    recommendation: string | null;
    tool: string;
    category: string | null;
  }>;
};

@Injectable()
export class PdfReportService {
  generate(input: PdfReportInput): Buffer {
    const pages = this.paginate(this.lines(input), 42);
    return Buffer.from(this.renderPdf(pages), 'binary');
  }

  private lines(input: PdfReportInput) {
    return [
      'CodeGuard AI Repository Security Report',
      input.repository.repoUrl,
      `Generated at ${new Date(input.generatedAt).toLocaleString('en-US')}`,
      '',
      `Health score: ${input.risk.score ?? '--'}/100`,
      `Risk level: ${input.risk.level ?? 'Pending'}`,
      `Open findings: ${input.risk.openFindings}`,
      `Critical + high: ${input.risk.criticalAndHigh}`,
      '',
      'Executive summary',
      ...this.wrap(input.executiveSummary),
      '',
      'Business impact',
      ...this.wrap(input.businessImpact),
      '',
      'Severity distribution',
      ...this.metricLines(input.charts.severity),
      '',
      'Finding categories',
      ...this.metricLines(input.charts.categories),
      '',
      'Tool coverage',
      `Enabled: ${input.coverage.toolsEnabled}`,
      `Completed: ${input.coverage.toolsCompleted}`,
      `Failed: ${input.coverage.toolsFailed}`,
      `Skipped: ${input.coverage.toolsSkipped}`,
      '',
      'Repository posture',
      `CI/CD: ${input.posture.ciCd.status} - ${input.posture.ciCd.summary}`,
      `Repository: ${input.posture.repository.status} - ${input.posture.repository.summary}`,
      `Docker/IaC: ${input.posture.dockerIac.status} - ${input.posture.dockerIac.summary}`,
      '',
      'SBOM and license summary',
      `Components detected: ${input.repositoryHealth.componentsDetected}`,
      `License risks: ${input.repositoryHealth.licenseRisks}`,
      ...this.metricLines(input.charts.licenses),
      '',
      'Top findings',
      ...this.findingLines(input.topFindings),
      '',
      'Recommended next steps',
      ...input.recommendedNextSteps.slice(0, 8).map((step, index) => `${index + 1}. ${step}`),
    ];
  }

  private findingLines(findings: PdfReportInput['topFindings']) {
    if (findings.length === 0) {
      return ['No actionable findings are currently open.'];
    }
    return findings
      .slice(0, 10)
      .flatMap((finding, index) => [
        `${index + 1}. [${finding.severity}] ${finding.message}`,
        `   ${finding.tool} / ${finding.category ?? 'uncategorized'}`,
        `   ${finding.recommendation ?? 'Review the evidence and assign an owner.'}`,
      ]);
  }

  private metricLines(data: Array<{ label: string; count: number }>) {
    if (data.length === 0) {
      return ['No data available.'];
    }
    const total = data.reduce((accumulator, item) => accumulator + item.count, 0);
    return data.slice(0, 10).map((item) => {
      const percent = total > 0 ? ((item.count / total) * 100).toFixed(1) : '0.0';
      return `${item.label.padEnd(20, ' ')} | count: ${item.count.toString().padStart(3, ' ')} | ${percent}%`;
    });
  }

  private wrap(text: string, width = 92) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (next.length > width) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) {
      lines.push(line);
    }
    return lines.length > 0 ? lines : [''];
  }

  private paginate(lines: string[], pageSize: number) {
    const pages: string[][] = [];
    for (let index = 0; index < lines.length; index += pageSize) {
      pages.push(lines.slice(index, index + pageSize));
    }
    return pages.length > 0 ? pages : [['CodeGuard AI Report']];
  }

  private renderPdf(pages: string[][]) {
    const objects: string[] = [];
    const fontObjectNumber = 3 + pages.length * 2;
    objects.push('<< /Type /Catalog /Pages 2 0 R >>');
    objects.push(
      `<< /Type /Pages /Kids [${pages.map((_, index) => `${3 + index * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`,
    );

    pages.forEach((page, index) => {
      const pageObjectNumber = 3 + index * 2;
      const contentObjectNumber = pageObjectNumber + 1;
      const content = this.pageContent(page);
      objects.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontObjectNumber} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`,
      );
      objects.push(
        `<< /Length ${Buffer.byteLength(content, 'binary')} >>\nstream\n${content}\nendstream`,
      );
    });

    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

    const offsets: number[] = [];
    let pdf = '%PDF-1.4\n';
    objects.forEach((object, index) => {
      offsets.push(Buffer.byteLength(pdf, 'binary'));
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xrefOffset = Buffer.byteLength(pdf, 'binary');
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    pdf += offsets.map((offset) => `${offset.toString().padStart(10, '0')} 00000 n \n`).join('');
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return pdf;
  }

  private pageContent(lines: string[]) {
    const content = ['BT', '/F1 10 Tf', '48 792 Td'];
    lines.forEach((line, index) => {
      if (index > 0) {
        content.push('0 -16 Td');
      }
      content.push(`(${this.escapePdfText(line)}) Tj`);
    });
    content.push('ET');
    return content.join('\n');
  }

  private escapePdfText(value: string) {
    return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }
}
