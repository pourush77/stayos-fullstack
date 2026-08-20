import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { ResendEmailProvider } from './resend-email.provider';

jest.mock('resend', () => ({
  Resend: jest.fn(),
}));

describe('ResendEmailProvider', () => {
  const config = new Map<string, unknown>([
    ['email.enabled', true],
    ['email.apiKey', 're_test_key'],
    ['email.fromAddress', 'bookings@example.com'],
    ['email.fromName', 'Example Hotel'],
    ['email.replyTo', 'frontdesk@example.com'],
  ]);

  const configService = {
    get: jest.fn((key: string) => config.get(key)),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports configured only when email is enabled with key and sender', () => {
    const provider = new ResendEmailProvider(configService);
    expect(provider.isConfigured()).toBe(true);
  });

  it('sends email and returns provider message id', async () => {
    const send = jest.fn().mockResolvedValue({
      data: { id: 'email-123' },
      error: null,
    });

    (Resend as unknown as jest.Mock).mockImplementation(() => ({
      emails: { send },
    }));

    const provider = new ResendEmailProvider(configService);
    const result = await provider.send({
      to: 'guest@example.com',
      subject: 'Booking confirmed',
      html: '<p>Confirmed</p>',
    });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Example Hotel <bookings@example.com>',
        to: ['guest@example.com'],
        subject: 'Booking confirmed',
        replyTo: 'frontdesk@example.com',
      }),
    );
    expect(result.providerMessageId).toBe('email-123');
  });

  it('throws when Resend returns an error', async () => {
    const send = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'Rejected' },
    });

    (Resend as unknown as jest.Mock).mockImplementation(() => ({
      emails: { send },
    }));

    const provider = new ResendEmailProvider(configService);

    await expect(
      provider.send({
        to: 'guest@example.com',
        subject: 'Booking confirmed',
        text: 'Confirmed',
      }),
    ).rejects.toThrow('Rejected');
  });
});
