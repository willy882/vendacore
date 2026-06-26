import { Global, Module } from '@nestjs/common';
import { PlanEnforcementService } from './plan-enforcement.service';

@Global()
@Module({
  providers: [PlanEnforcementService],
  exports: [PlanEnforcementService],
})
export class PlanEnforcementModule {}
