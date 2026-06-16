import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  async notifyAlert(alert: any, rule: any, deviceName: string): Promise<void> {
    this.logger.log(`ALERT [${alert.severity}] ${alert.message}`);

    if (rule.webhookUrl) {
      await this.sendWebhook(rule.webhookUrl, alert, deviceName);
    }
  }

  private async sendWebhook(url: string, alert: any, deviceName: string): Promise<void> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'alert',
          alert,
          deviceName,
          timestamp: new Date().toISOString(),
        }),
      });
      if (!response.ok) {
        this.logger.warn(`Webhook ${url} returned ${response.status}`);
      }
    } catch (err) {
      this.logger.error(`Webhook call failed: ${err}`);
    }
  }
}
