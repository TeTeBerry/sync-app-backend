import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiResponseOptions,
  getSchemaPath,
} from '@nestjs/swagger';
import { ApiEnvelopeDto } from './api-envelope.dto';

export function ApiOkEnvelopeResponse(
  model: Type<unknown>,
  options?: Omit<ApiResponseOptions, 'schema'>,
) {
  return applyDecorators(
    ApiExtraModels(ApiEnvelopeDto, model),
    ApiOkResponse({
      description: options?.description ?? 'Success',
      ...options,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiEnvelopeDto) },
          {
            properties: {
              data: { $ref: getSchemaPath(model) },
            },
          },
        ],
      },
    }),
  );
}

export function ApiOkEnvelopeArrayResponse(
  model: Type<unknown>,
  options?: Omit<ApiResponseOptions, 'schema'>,
) {
  return applyDecorators(
    ApiExtraModels(ApiEnvelopeDto, model),
    ApiOkResponse({
      description: options?.description ?? 'Success',
      ...options,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiEnvelopeDto) },
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
}
