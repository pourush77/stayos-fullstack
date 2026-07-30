import { applyDecorators, Type } from '@nestjs/common';
import { ApiCreatedResponse, ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { ApiListSuccessResponseDto, ApiSuccessResponseDto } from '../dto/api-success-response.dto';
import { ApiMetaDto } from '../dto/api-meta.dto';
import { PaginationMetaDto } from '../dto/pagination.dto';

export const ApiStandardOkResponse = <TModel extends Type<unknown>>(
  model: TModel,
  description = 'Operation completed successfully.',
) =>
  applyDecorators(
    ApiExtraModels(ApiSuccessResponseDto, ApiMetaDto, model),
    ApiOkResponse({
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiSuccessResponseDto) },
          {
            properties: {
              data: { $ref: getSchemaPath(model) },
            },
          },
        ],
      },
    }),
  );

export const ApiStandardCreatedResponse = <TModel extends Type<unknown>>(
  model: TModel,
  description = 'Operation completed successfully.',
) =>
  applyDecorators(
    ApiExtraModels(ApiSuccessResponseDto, ApiMetaDto, model),
    ApiCreatedResponse({
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiSuccessResponseDto) },
          {
            properties: {
              data: { $ref: getSchemaPath(model) },
            },
          },
        ],
      },
    }),
  );

export const ApiStandardListResponse = <TModel extends Type<unknown>>(
  model: TModel,
  description = 'Records fetched successfully.',
) =>
  applyDecorators(
    ApiExtraModels(ApiListSuccessResponseDto, ApiMetaDto, PaginationMetaDto, model),
    ApiOkResponse({
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiListSuccessResponseDto) },
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
            },
          },
        ],
      },
    }),
  );
