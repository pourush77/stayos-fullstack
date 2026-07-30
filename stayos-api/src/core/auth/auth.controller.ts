import { Body, Controller, Get, Headers, Ip, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { ApiStandardOkResponse } from '../../common/decorators/api-standard-response.decorator';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { AuthUserDto } from './dto/auth-user.dto';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UnlockSessionDto } from './dto/unlock-session.dto';
import { AuthenticatedRequest } from './types/authenticated-request';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login and create a user session' })
  @ApiStandardOkResponse(LoginResponseDto)
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  login(
    @Body() loginDto: LoginDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<LoginResponseDto> {
    return this.authService.login(loginDto, { ipAddress, userAgent: userAgent ?? null });
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate refresh token and issue a new access token' })
  @ApiStandardOkResponse(LoginResponseDto)
  refresh(@Body() dto: RefreshTokenDto): Promise<LoginResponseDto> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @Post('unlock')
  @ApiOperation({ summary: 'Unlock an idle-locked session with password' })
  @ApiStandardOkResponse(LoginResponseDto)
  unlock(@Body() dto: UnlockSessionDto): Promise<LoginResponseDto> {
    return this.authService.unlock(dto.refreshToken, dto.password);
  }

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke the current session' })
  @ApiStandardOkResponse(Object)
  logout(@CurrentUser() user: AuthenticatedRequest['currentUser']): Promise<{ loggedOut: true }> {
    return this.authService.logout(user?.sessionId ?? '');
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user and permissions' })
  @ApiStandardOkResponse(AuthUserDto)
  me(@CurrentUser() user: AuthenticatedRequest['currentUser']): Promise<AuthUserDto> {
    return this.authService.getMe(user?.id ?? '', user?.sessionId ?? '');
  }
}
