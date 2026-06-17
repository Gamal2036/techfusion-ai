import { Module, forwardRef } from '@nestjs/common';
import { KbService } from './kb.service';
import { KbController } from './kb.controller';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [forwardRef(() => AiModule)],
  providers: [KbService],
  controllers: [KbController],
  exports: [KbService],
})
export class KbModule {}
