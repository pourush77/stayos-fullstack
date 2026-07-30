import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiStandardCreatedResponse,
  ApiStandardListResponse,
  ApiStandardOkResponse,
} from '../../common/decorators/api-standard-response.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permissions } from '../auth/permissions';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';
import { EmployeeResponseDto } from './dto/employee-response.dto';
import { UpdateStaffAccessDto } from './dto/update-staff-access.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesMapper } from './employees.mapper';
import { EmployeesService } from './employees.service';

@ApiTags('Employees')
@ApiBearerAuth()
@Controller('properties/:propertyId/employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @RequirePermissions(Permissions.EmployeesView)
  @ApiOperation({ summary: 'List employees for a property' })
  @ApiStandardListResponse(EmployeeResponseDto)
  @ApiForbiddenResponse({ description: 'Missing employees.view permission' })
  @ApiNotFoundResponse({ description: 'Property not found' })
  async findAll(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: EmployeeQueryDto,
  ): Promise<EmployeeResponseDto[]> {
    const employees = await this.employeesService.findAll(propertyId, query);

    return employees.map(EmployeesMapper.toResponse);
  }

  @Get(':employeeId')
  @RequirePermissions(Permissions.EmployeesView)
  @ApiOperation({ summary: 'Get employee by id' })
  @ApiStandardOkResponse(EmployeeResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid property or employee id' })
  @ApiForbiddenResponse({ description: 'Missing employees.view permission' })
  @ApiNotFoundResponse({ description: 'Property or employee not found' })
  async findOne(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
  ): Promise<EmployeeResponseDto> {
    return EmployeesMapper.toResponse(await this.employeesService.findOne(propertyId, employeeId));
  }

  @Post()
  @RequirePermissions(Permissions.EmployeesManage)
  @ApiOperation({ summary: 'Create employee' })
  @ApiStandardCreatedResponse(EmployeeResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid employee payload' })
  @ApiConflictResponse({ description: 'Employee code already exists' })
  @ApiForbiddenResponse({ description: 'Missing employees.manage permission' })
  @ApiNotFoundResponse({ description: 'Property not found' })
  async create(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() createEmployeeDto: CreateEmployeeDto,
  ): Promise<EmployeeResponseDto> {
    const employee = await this.employeesService.create(propertyId, createEmployeeDto);

    return EmployeesMapper.toResponse(employee);
  }

  @Patch(':employeeId')
  @RequirePermissions(Permissions.EmployeesManage)
  @ApiOperation({ summary: 'Update employee' })
  @ApiStandardOkResponse(EmployeeResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid property, employee id, or payload' })
  @ApiConflictResponse({ description: 'Employee code already exists' })
  @ApiForbiddenResponse({ description: 'Missing employees.manage permission' })
  @ApiNotFoundResponse({ description: 'Property or employee not found' })
  async update(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
  ): Promise<EmployeeResponseDto> {
    const employee = await this.employeesService.update(propertyId, employeeId, updateEmployeeDto);

    return EmployeesMapper.toResponse(employee);
  }

  @Post(':employeeId/staff-access/regenerate')
  @RequirePermissions(Permissions.EmployeesManage)
  @ApiOperation({ summary: 'Regenerate employee staff access token' })
  @ApiStandardOkResponse(EmployeeResponseDto)
  @ApiForbiddenResponse({ description: 'Missing employees.manage permission' })
  @ApiNotFoundResponse({ description: 'Property or employee not found' })
  async regenerateStaffAccess(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
  ): Promise<EmployeeResponseDto> {
    const employee = await this.employeesService.regenerateStaffAccess(propertyId, employeeId);

    return EmployeesMapper.toResponse(employee);
  }

  @Patch(':employeeId/staff-access')
  @RequirePermissions(Permissions.EmployeesManage)
  @ApiOperation({ summary: 'Enable or disable employee staff access' })
  @ApiStandardOkResponse(EmployeeResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid staff access payload' })
  @ApiForbiddenResponse({ description: 'Missing employees.manage permission' })
  @ApiNotFoundResponse({ description: 'Property or employee not found' })
  async updateStaffAccess(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() updateStaffAccessDto: UpdateStaffAccessDto,
  ): Promise<EmployeeResponseDto> {
    const employee = await this.employeesService.updateStaffAccess(
      propertyId,
      employeeId,
      updateStaffAccessDto.enabled,
    );

    return EmployeesMapper.toResponse(employee);
  }
}
