import { Controller, Get } from '@nestjs/common';
import { Roles } from './common/roles.decorator';

@Controller('demo')
export class DemoController {
  @Roles('Owner', 'Admin')
  @Get('admin')
  adminOnly() {
    return { message: 'Admin or Owner access granted' };
  }

  @Roles('Owner', 'Admin', 'Technician')
  @Get('technician')
  technicianOnly() {
    return { message: 'Technician or above access granted' };
  }

  @Roles('Owner', 'Admin', 'Technician', 'Viewer')
  @Get('viewer')
  viewerOnly() {
    return { message: 'Viewer or above access granted' };
  }
}
