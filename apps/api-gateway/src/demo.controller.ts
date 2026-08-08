import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from './common/permissions.decorator';
import { Permission } from './common/permissions';

@Controller('demo')
export class DemoController {
  @RequirePermissions(Permission.MEMBERS_MANAGE)
  @Get('admin')
  adminOnly() {
    return { message: 'Admin or Owner access granted' };
  }

  @RequirePermissions(Permission.SECURITY_SCAN_TRIGGER)
  @Get('technician')
  technicianOnly() {
    return { message: 'Technician or above access granted' };
  }

  @RequirePermissions(Permission.DEVICES_VIEW)
  @Get('viewer')
  viewerOnly() {
    return { message: 'Viewer or above access granted' };
  }
}
