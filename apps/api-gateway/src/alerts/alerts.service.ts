import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAlertRuleDto } from './dto/create-alert-rule.dto';
import { UpdateAlertRuleDto } from './dto/update-alert-rule.dto';
import { QueryAlertsDto } from './dto/query-alerts.dto';

@Injectable()
export class AlertsService {
  constructor(private prisma: PrismaService) {}

  async findRulesByOrg(orgId: string) {
    return this.prisma.alertRule.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRule(orgId: string, dto: CreateAlertRuleDto) {
    return this.prisma.alertRule.create({
      data: { ...dto, orgId },
    });
  }

  async updateRule(id: string, orgId: string, dto: UpdateAlertRuleDto) {
    const rule = await this.prisma.alertRule.findFirst({ where: { id, orgId } });
    if (!rule) throw new NotFoundException('Alert rule not found');
    return this.prisma.alertRule.update({ where: { id }, data: dto });
  }

  async deleteRule(id: string, orgId: string) {
    const rule = await this.prisma.alertRule.findFirst({ where: { id, orgId } });
    if (!rule) throw new NotFoundException('Alert rule not found');
    return this.prisma.alertRule.delete({ where: { id } });
  }

  async findAlertsByOrg(orgId: string, query: QueryAlertsDto) {
    const where: any = { orgId };
    if (query.deviceId) where.deviceId = query.deviceId;
    if (query.alertRuleId) where.alertRuleId = query.alertRuleId;
    if (query.severity) where.severity = query.severity;
    if (query.acknowledged === 'false') where.acknowledgedAt = null;

    const [data, total] = await Promise.all([
      this.prisma.alert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit ?? 50,
        skip: query.offset ?? 0,
        include: {
          device: { select: { id: true, name: true, hostname: true } },
          alertRule: { select: { id: true, name: true, metricName: true } },
        },
      }),
      this.prisma.alert.count({ where }),
    ]);

    return { data, total };
  }

  async getLatestAlerts(orgId: string, limit = 10) {
    return this.prisma.alert.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        device: { select: { id: true, name: true, hostname: true } },
        alertRule: { select: { id: true, name: true, metricName: true } },
      },
    });
  }

  async acknowledgeAlert(id: string, orgId: string) {
    const alert = await this.prisma.alert.findFirst({ where: { id, orgId } });
    if (!alert) throw new NotFoundException('Alert not found');
    return this.prisma.alert.update({
      where: { id },
      data: { acknowledgedAt: new Date() },
    });
  }
}
