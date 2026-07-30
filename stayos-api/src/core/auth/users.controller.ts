import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiStandardCreatedResponse,
  ApiStandardListResponse,
  ApiStandardOkResponse,
} from '../../common/decorators/api-standard-response.decorator';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { RequirePermissions } from './decorators/require-permissions.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { Permissions } from './permissions';
import { AuthenticatedRequest } from './types/authenticated-request';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('properties/:propertyId/users')
export class UsersController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  @RequirePermissions(Permissions.UsersView)
  @ApiOperation({ summary: 'List users for a property' })
  @ApiStandardListResponse(UserResponseDto)
  list(@Param('propertyId', ParseUUIDPipe) propertyId: string): Promise<UserResponseDto[]> {
    return this.authService.listUsers(propertyId);
  }

  @Get(':userId')
  @RequirePermissions(Permissions.UsersView)
  @ApiOperation({ summary: 'Get user by id' })
  @ApiStandardOkResponse(UserResponseDto)
  get(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<UserResponseDto> {
    return this.authService.getUser(propertyId, userId);
  }

  @Post()
  @RequirePermissions(Permissions.UsersManage)
  @ApiOperation({ summary: 'Create user' })
  @ApiStandardCreatedResponse(UserResponseDto)
  create(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: AuthenticatedRequest['currentUser'],
  ): Promise<UserResponseDto> {
    return this.authService.createUser(propertyId, dto, actor);
  }

  @Patch(':userId')
  @RequirePermissions(Permissions.UsersManage)
  @ApiOperation({ summary: 'Update user' })
  @ApiStandardOkResponse(UserResponseDto)
  update(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedRequest['currentUser'],
  ): Promise<UserResponseDto> {
    return this.authService.updateUser(propertyId, userId, dto, actor);
  }
}
