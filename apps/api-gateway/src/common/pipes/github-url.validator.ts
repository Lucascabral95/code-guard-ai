import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ async: false })
export class GithubRepositoryUrlConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    try {
      const parsed = new URL(value);
      const pathParts = parsed.pathname.replace(/\/$/, '').split('/').filter(Boolean);
      return (
        parsed.protocol === 'https:' && parsed.hostname === 'github.com' && pathParts.length >= 2
      );
    } catch {
      return false;
    }
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a public GitHub repository URL`;
  }
}

export function IsGithubRepositoryUrl(validationOptions?: ValidationOptions) {
  return function validateGithubUrl(target: object, propertyName: string): void {
    registerDecorator({
      target: target.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: GithubRepositoryUrlConstraint,
    });
  };
}
