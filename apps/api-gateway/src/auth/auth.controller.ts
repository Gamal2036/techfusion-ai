import { Controller, Post, Body, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { throttle } from '../config/rate-limits';
import { AuthService } from './auth.service';
import { Public } from '../common/public.decorator';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyLoginDto } from './dto/verify-login.dto';
import { RefreshDto } from './dto/refresh.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Throttle(throttle(3, 300000))
  @Post('signup')
  async signup(@Body() body: SignupDto) {
    return this.authService.signup(body);
  }

  @Public()
  @Throttle(throttle(5, 60000))
  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Public()
  @Throttle(throttle(10, 60000))
  @Post('verify-login')
  async verifyLogin(@Body() body: VerifyLoginDto) {
    return this.authService.verifyLoginMfa(body.userId, body.token, body.recoveryCode);
  }

  @Public()
  @Throttle(throttle(5, 60000))
  @Post('refresh')
  async refresh(@Body() body: RefreshDto) {
    return this.authService.refresh(body.refreshToken);
  }

  @Post('logout')
  async logout(@Req() req: any) {
    await this.authService.logout(req.user.sub);
    return { message: 'Logged out' };
  }
}
