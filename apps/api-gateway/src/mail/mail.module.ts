import { Module } from '@nestjs/common';
import { TransactionalEmailService } from './mail.service';

@Module({
  providers: [
    {
      provide: TransactionalEmailService,
      useFactory: async () => {
        return TransactionalEmailService.create();
      },
    },
  ],
  exports: [TransactionalEmailService],
})
export class MailModule {}
