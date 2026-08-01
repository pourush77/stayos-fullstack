import { BadRequestException, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';
import { createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private client?: Razorpay;
  private readonly keyId?: string;
  private readonly keySecret?: string;

  constructor(private readonly config: ConfigService) {
    this.keyId = this.config.get<string>('RAZORPAY_KEY_ID');
    this.keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    if (this.keyId && this.keySecret) {
      this.client = new Razorpay({ key_id: this.keyId, key_secret: this.keySecret });
    } else {
      this.logger.warn('Razorpay keys not configured — /razorpay endpoints will return 501 until RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set in stayos-api/.env');
    }
  }

  isConfigured(): boolean {
    return Boolean(this.client && this.keyId && this.keySecret);
  }

  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException({
        code: 'RAZORPAY_NOT_CONFIGURED',
        message: 'Online payments are not enabled. Please collect payment via cash, card or UPI at reception, or ask your admin to configure Razorpay.',
      });
    }
  }

  private toPaise(amount: string | number): number {
    const cleaned = typeof amount === 'number' ? amount.toFixed(2) : amount.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) throw new BadRequestException('Invalid amount');
    const [rupees, paise = ''] = cleaned.split('.');
    return Number(`${rupees}${(paise + '00').slice(0, 2)}`);
  }

  async createOrder(input: {
    amount: string;
    folioId: string;
    reservationId?: string;
    guestName?: string;
  }): Promise<{ orderId: string; keyId: string; amount: number; currency: string }> {
    this.ensureConfigured();
    const amountPaise = this.toPaise(input.amount);
    const order = await this.client!.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `folio_${input.folioId}_${Date.now()}`,
      notes: {
        folioId: input.folioId,
        reservationId: input.reservationId ?? '',
        guestName: input.guestName ?? '',
      },
    });
    return { orderId: order.id, keyId: this.keyId!, amount: amountPaise, currency: 'INR' };
  }

  verifySignature(params: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }): void {
    this.ensureConfigured();
    const payload = `${params.razorpay_order_id}|${params.razorpay_payment_id}`;
    const expected = createHmac('sha256', this.keySecret!).update(payload).digest('hex');
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(params.razorpay_signature, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException({ code: 'RAZORPAY_SIGNATURE_INVALID', message: 'Signature verification failed.' });
    }
  }
}
