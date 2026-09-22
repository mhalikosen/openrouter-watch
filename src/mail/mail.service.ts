import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import { EnvironmentVariables, MailTransport } from '#config/env.config.js';

export type MailMessage = {
  subject: string;
  text: string;
};

type Transport = {
  send: (message: MailMessage) => Promise<void>;
};

const createConsoleTransport = (logger: Logger, to: string): Transport => ({
  send: async ({ subject, text }) => {
    logger.log('mail.console', { to, subject, text });
  },
});

type SmtpOptions = {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  to: string;
};

const createSmtpTransport = (options: SmtpOptions): Transport => {
  const transporter = createTransport({
    host: options.host,
    port: options.port,
    secure: options.port === 465,
    auth: { user: options.user, pass: options.password },
  });

  return {
    send: async ({ subject, text }) => {
      await transporter.sendMail({
        from: options.from,
        to: options.to,
        subject,
        text,
      });
    },
  };
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: Transport;

  constructor(
    @Inject(ConfigService)
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    const to = config.get('MAIL_TO', { infer: true });
    const host = config.get('SMTP_HOST', { infer: true });
    const user = config.get('SMTP_USER', { infer: true });
    const password = config.get('SMTP_PASSWORD', { infer: true });
    const from = config.get('MAIL_FROM', { infer: true });

    this.transport =
      config.get('MAIL_TRANSPORT', { infer: true }) === MailTransport.Smtp &&
      host !== undefined &&
      user !== undefined &&
      password !== undefined &&
      from !== undefined
        ? createSmtpTransport({
            host,
            port: config.get('SMTP_PORT', { infer: true }),
            user,
            password,
            from,
            to,
          })
        : createConsoleTransport(this.logger, to);
  }

  send(message: MailMessage): Promise<void> {
    return this.transport.send(message);
  }
}
