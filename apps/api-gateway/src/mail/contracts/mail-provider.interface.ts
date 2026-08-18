import { RenderedTransactionalEmail, TransactionalEmailResult } from './mail.types';

export type { TransactionalEmailResult };

export interface TransactionalEmailProvider {
  readonly name: string;
  send(renderedEmail: RenderedTransactionalEmail, metadata: { to: string; templateId: string; correlationId: string }): Promise<TransactionalEmailResult>;
  isReady(): boolean;
  shutdown(): Promise<void>;
}
