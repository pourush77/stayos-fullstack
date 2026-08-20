import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { EmailProvider, EmailSendInput, EmailSendResult } from './email-provider.interface';

@Injectable()
export class ResendEmailProvider implements EmailProvider {
  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    return (
      this.configService.get<boolean>('email.enabled') === true &&
      Boolean(this.configService.get<string>('email.apiKey')?.trim()) &&
      Boolean(this.configService.get<string>('email.fromAddress')?.trim())
    );
  }

  async send(input: EmailSendInput): Promise<EmailSendResult> {
    const apiKey = this.configService.get<string>('email.apiKey')?.trim();
    const fromAddress = this.configService.get<string>('email.fromAddress')?.trim();
    const fromName = this.configService.get<string>('email.fromName')?.trim() || 'StayOS';
    const replyTo = this.configService.get<string>('email.replyTo')?.trim();

    if (!this.isConfigured() || !apiKey || !fromAddress) {
      throw new Error('Email provider is not configured');
    }

    if (!input.html && !input.text) {
      throw new Error('Email requires html or text content');
    }

    const resend = new Resend(apiKey);

    const common = {
      from: `${fromName} <${fromAddress}>`,
      to: [input.to],
      subject: input.subject,
      replyTo: replyTo || undefined,
      attachments: input.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType,
      })),
    };

    const payload = input.html
      ? {
          ...common,
          html: input.html,
          ...(input.text ? { text: input.text } : {}),
        }
      : {
          ...common,
          text: input.text as string,
        };

    const { data, error } = await resend.emails.send(payload);

    if (error) {
      throw new Error(error.message || 'Email provider rejected the message');
    }

    return {
      providerMessageId: data?.id ?? null,
    };
  }
}
