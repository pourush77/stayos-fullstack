import { ValidationError } from 'class-validator';
import { formatValidationErrors } from './validation-error.formatter';

describe('formatValidationErrors', () => {
  it('formats nested validation errors and hides sensitive rejected values', () => {
    const errors: ValidationError[] = [
      {
        property: 'credentials',
        children: [
          {
            property: 'password',
            value: 'secret',
            constraints: {
              minLength: 'password must be longer',
            },
          } as ValidationError,
        ],
      } as ValidationError,
      {
        property: 'email',
        value: 'bad-email',
        constraints: {
          isEmail: 'email must be an email',
        },
      } as ValidationError,
    ];

    expect(formatValidationErrors(errors)).toEqual([
      {
        field: 'credentials.password',
        message: 'password must be longer',
      },
      {
        field: 'email',
        message: 'email must be an email',
        rejectedValue: 'bad-email',
      },
    ]);
  });
});
