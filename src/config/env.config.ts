import { plainToInstance, Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
  validateSync,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export enum MailTransport {
  Console = 'console',
  Smtp = 'smtp',
}

type Source = { obj: Record<string, unknown>; key: string };

const emptyToUndefined = ({ obj, key }: Source) =>
  obj[key] === '' ? undefined : obj[key];

const toList = ({ obj, key }: Source) => {
  const value = obj[key];

  return (typeof value === 'string' ? value : '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');
};

const smtp = (env: EnvironmentVariables) =>
  env.MAIL_TRANSPORT === MailTransport.Smtp;

export class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @Transform(toList)
  WATCH_MODELS: string[];

  @IsString()
  @IsNotEmpty()
  WATCH_CRON: string = '0 9 * * *';

  @IsString()
  @IsNotEmpty()
  WATCH_TIMEZONE: string = 'Europe/Istanbul';

  @IsInt()
  @Min(0)
  @Max(1000)
  WATCH_SPEED_THRESHOLD_PERCENT: number = 25;

  @IsString()
  @IsNotEmpty()
  SNAPSHOT_DIR: string = './data';

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Transform(emptyToUndefined)
  OPENROUTER_API_KEY?: string;

  @IsInt()
  @Min(1)
  OPENROUTER_TIMEOUT_SECONDS: number = 10;

  @IsEnum(MailTransport)
  MAIL_TRANSPORT: MailTransport = MailTransport.Console;

  @IsEmail()
  MAIL_TO: string;

  @ValidateIf(smtp)
  @IsEmail()
  @Transform(emptyToUndefined)
  MAIL_FROM?: string;

  @ValidateIf(smtp)
  @IsString()
  @IsNotEmpty()
  @Transform(emptyToUndefined)
  SMTP_HOST?: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  SMTP_PORT: number = 587;

  @ValidateIf(smtp)
  @IsString()
  @IsNotEmpty()
  @Transform(emptyToUndefined)
  SMTP_USER?: string;

  @ValidateIf(smtp)
  @IsString()
  @IsNotEmpty()
  @Transform(emptyToUndefined)
  SMTP_PASSWORD?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const reasons = errors.map(
      (error) =>
        `  ${error.property}: ${Object.values(error.constraints ?? {}).join(', ')}`,
    );
    throw new Error(['The environment is not usable:', ...reasons].join('\n'));
  }
  return validatedConfig;
}
