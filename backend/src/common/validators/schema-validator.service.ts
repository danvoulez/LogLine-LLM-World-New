import { Injectable } from '@nestjs/common';
import Ajv, { ValidateFunction, ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import { ValidationException } from '../exceptions/validation.exception';

/**
 * Service for validating data against JSON Schema
 */
@Injectable()
export class SchemaValidatorService {
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      strict: false,
      coerceTypes: true, // Enable type coercion (string to number, etc.)
      removeAdditional: false, // Don't remove additional properties
    });
    addFormats(this.ajv); // Add format validation (email, date, etc.)
  }

  /**
   * Validate data against a JSON Schema
   * @param schema JSON Schema object
   * @param data Data to validate
   * @param context Optional context for error messages
   * @returns Validated data (with type coercion applied)
   * @throws ValidationException if validation fails
   */
  validate<T = any>(
    schema: Record<string, any>,
    data: any,
    context?: Record<string, any>,
  ): T {
    // Compile schema
    let validate: ValidateFunction;
    try {
      validate = this.ajv.compile(schema);
    } catch (error) {
      throw new ValidationException(
        `Invalid JSON Schema: ${error instanceof Error ? error.message : String(error)}`,
        [],
        context,
      );
    }

    // Validate data
    const valid = validate(data);

    if (!valid) {
      const errors = this.formatValidationErrors(validate.errors || []);
      throw new ValidationException(
        'Schema validation failed',
        errors,
        context,
      );
    }

    // Return validated data (with type coercion)
    return data as T;
  }

  /**
   * Format AJV validation errors into structured format
   */
  private formatValidationErrors(
    errors: ErrorObject[],
  ): Array<{ path: string; message: string }> {
    return errors.map((error) => {
      const path = error.instancePath || error.schemaPath || 'root';
      let message = error.message || 'Validation error';

      // Enhance message with additional context
      if (error.params) {
        const params = error.params as Record<string, any>;
        if (params.missingProperty) {
          message = `Missing required property: ${params.missingProperty}`;
        } else if (params.additionalProperty) {
          message = `Unexpected property: ${params.additionalProperty}`;
        } else if (params.allowedValues) {
          message = `Value must be one of: ${params.allowedValues.join(', ')}`;
        }
      }

      return {
        path,
        message,
      };
    });
  }

  /**
   * Check if a schema is valid
   */
  isValidSchema(schema: Record<string, any>): boolean {
    try {
      this.ajv.compile(schema);
      return true;
    } catch {
      return false;
    }
  }
}

