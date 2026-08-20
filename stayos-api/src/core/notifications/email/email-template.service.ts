import { Injectable } from '@nestjs/common';

export interface BookingConfirmationEmailInput {
  property: {
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    checkInTime?: string | null;
    checkOutTime?: string | null;
    logoUrl?: string | null;
  };

  guestName: string;
  reservationCode: string;

  arrivalDate: string;
  departureDate: string;

  roomType?: string | null;
  adults: number;
  children?: number;

  // Optional commercial details.
  // These should come from the committed StayOS booking/rate data.
  ratePlanName?: string | null;
  mealPlan?: string | null;
  refundable?: boolean | null;

  roomAmount?: number | string | null;
  taxAmount?: number | string | null;
  totalAmount?: number | string | null;
  paidAmount?: number | string | null;
  balanceAmount?: number | string | null;

  currency?: string | null;
}

export interface CheckoutInvoiceEmailInput {
  property: {
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    logoUrl?: string | null;
  };

  guestName: string;
  reservationCode: string;
  invoiceNumber?: string | null;

  arrivalDate?: string | null;
  departureDate?: string | null;

  totalPaid?: number | string | null;
  currency?: string | null;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

@Injectable()
export class EmailTemplateService {
  bookingConfirmation(input: BookingConfirmationEmailInput): RenderedEmail {
    const currency = input.currency ?? 'INR';

    const propertyName = this.escape(input.property.name);
    const guestName = this.escape(input.guestName);
    const reservationCode = this.escape(input.reservationCode);

    const arrival = this.formatDate(input.arrivalDate);
    const departure = this.formatDate(input.departureDate);
    const nights = this.calculateNights(input.arrivalDate, input.departureDate);

    const checkInTime = this.formatTime(input.property.checkInTime) ?? 'As per hotel policy';

    const checkOutTime = this.formatTime(input.property.checkOutTime) ?? 'As per hotel policy';

    const guestSummary = [
      `${input.adults} adult${input.adults === 1 ? '' : 's'}`,
      input.children ? `${input.children} child${input.children === 1 ? '' : 'ren'}` : null,
    ]
      .filter(Boolean)
      .join(', ');

    const roomAmount = this.optionalMoney(input.roomAmount, currency);

    const taxAmount = this.optionalMoney(input.taxAmount, currency);

    const totalAmount = this.optionalMoney(input.totalAmount, currency);

    const paidAmount = this.optionalMoney(input.paidAmount, currency);

    const balanceAmount = this.optionalMoney(input.balanceAmount, currency);

    const logoHtml = input.property.logoUrl
      ? `
        <img
          src="${this.escapeAttribute(input.property.logoUrl)}"
          alt="${propertyName}"
          width="88"
          style="
            display:block;
            max-width:88px;
            height:auto;
            margin:0 auto 12px;
            border:0;
          "
        />
      `
      : '';

    const stayCommercialSummary = [
      input.mealPlan ? this.formatMealPlan(input.mealPlan) : null,

      input.refundable !== null && input.refundable !== undefined
        ? input.refundable
          ? 'Refundable'
          : 'Non-refundable'
        : null,
    ]
      .filter(Boolean)
      .join(' · ');

    const bookingSummaryRows = [
      roomAmount ? this.moneyRow('Room charges', roomAmount) : '',

      taxAmount ? this.moneyRow('Taxes', taxAmount) : '',

      totalAmount ? this.moneyRow('Total', totalAmount, true) : '',

      paidAmount ? this.moneyRow('Paid', paidAmount) : '',

      balanceAmount ? this.moneyRow('Balance due', balanceAmount, true, true) : '',
    ]
      .filter(Boolean)
      .join('');

    const hasBookingSummary = Boolean(bookingSummaryRows);

    const html = `<!doctype html>
<html>
  <head>
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0"
    />

    <meta
      http-equiv="Content-Type"
      content="text/html; charset=UTF-8"
    />

    <title>Booking Confirmation</title>
  </head>

  <body
    style="
      margin:0;
      padding:0;
      background:#f5f6f8;
      font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
      color:#172033;
    "
  >
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      border="0"
      style="background:#f5f6f8;"
    >
      <tr>
        <td
          align="center"
          style="padding:24px 12px;"
        >

          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="
              max-width:640px;
              background:#ffffff;
              border-collapse:separate;
              border-spacing:0;
              border:1px solid #e5e7eb;
              border-radius:16px;
              overflow:hidden;
            "
          >

            <!-- PROPERTY HEADER -->
            <tr>
              <td
                align="center"
                style="
                  padding:28px 28px 22px;
                  background:#ffffff;
                  border-top:7px solid #7d4dd6;
                "
              >
                ${logoHtml}

                <div
                  style="
                    font-size:25px;
                    line-height:32px;
                    font-weight:700;
                    color:#7d4dd6;
                  "
                >
                  ${propertyName}
                </div>
              </td>
            </tr>

            <!-- CONFIRMATION -->
            <tr>
              <td style="padding:0 28px 24px;">
                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                >
                  <tr>
                    <td
                      align="center"
                      style="
                        padding:16px;
                        background:#f5f3ff;
                        border:1px solid #ddd6fe;
                        border-radius:10px;
                        color:#5b21b6;
                        font-size:17px;
                        font-weight:700;
                      "
                    >
                      ✓ Your booking is confirmed
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- BOOKING / GUEST -->
            <tr>
              <td style="padding:0 28px 24px;">
                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="
                    border:1px solid #e5e7eb;
                    border-radius:10px;
                  "
                >
                  <tr>
                    <td
                      width="50%"
                      style="
                        padding:14px 16px;
                        border-right:1px solid #e5e7eb;
                      "
                    >
                      <div
                        style="
                          font-size:11px;
                          color:#7b8495;
                          text-transform:uppercase;
                          letter-spacing:.5px;
                          margin-bottom:5px;
                        "
                      >
                        Booking ID
                      </div>

                      <div
                        style="
                          font-size:14px;
                          color:#172033;
                          font-weight:700;
                        "
                      >
                        ${reservationCode}
                      </div>
                    </td>

                    <td
                      width="50%"
                      style="padding:14px 16px;"
                    >
                      <div
                        style="
                          font-size:11px;
                          color:#7b8495;
                          text-transform:uppercase;
                          letter-spacing:.5px;
                          margin-bottom:5px;
                        "
                      >
                        Guest
                      </div>

                      <div
                        style="
                          font-size:14px;
                          color:#172033;
                          font-weight:700;
                        "
                      >
                        ${guestName}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- DATES -->
            <tr>
              <td style="padding:0 28px 24px;">
                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="
                    background:#fafafa;
                    border-radius:10px;
                  "
                >
                  <tr>
                    <td
                      width="33.33%"
                      align="center"
                      style="
                        padding:16px 8px;
                        border-right:1px solid #e5e7eb;
                      "
                    >
                      <div
                        style="
                          font-size:11px;
                          color:#7b8495;
                          text-transform:uppercase;
                          margin-bottom:5px;
                        "
                      >
                        Check-in
                      </div>

                      <div
                        style="
                          font-size:15px;
                          font-weight:700;
                          color:#172033;
                        "
                      >
                        ${this.escape(arrival)}
                      </div>
                    </td>

                    <td
                      width="33.33%"
                      align="center"
                      style="
                        padding:16px 8px;
                        border-right:1px solid #e5e7eb;
                      "
                    >
                      <div
                        style="
                          font-size:11px;
                          color:#7b8495;
                          text-transform:uppercase;
                          margin-bottom:5px;
                        "
                      >
                        Check-out
                      </div>

                      <div
                        style="
                          font-size:15px;
                          font-weight:700;
                          color:#172033;
                        "
                      >
                        ${this.escape(departure)}
                      </div>
                    </td>

                    <td
                      width="33.33%"
                      align="center"
                      style="padding:16px 8px;"
                    >
                      <div
                        style="
                          font-size:11px;
                          color:#7b8495;
                          text-transform:uppercase;
                          margin-bottom:5px;
                        "
                      >
                        Stay
                      </div>

                      <div
                        style="
                          font-size:15px;
                          font-weight:700;
                          color:#172033;
                        "
                      >
                        ${nights}
                        night${nights === 1 ? '' : 's'}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- HOTEL DETAILS -->
            <tr>
              <td style="padding:0 28px 24px;">
                <div
                  style="
                    font-size:13px;
                    font-weight:700;
                    color:#7d4dd6;
                    text-transform:uppercase;
                    letter-spacing:.4px;
                    margin-bottom:10px;
                  "
                >
                  Hotel details
                </div>

                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="
                    background:#f8f7ff;
                    border-radius:10px;
                  "
                >
                  <tr>
                    <td style="padding:16px;">
                      <div
                        style="
                          font-size:16px;
                          font-weight:700;
                          color:#172033;
                          margin-bottom:6px;
                        "
                      >
                        ${propertyName}
                      </div>

                      ${
                        input.property.address
                          ? `
                            <div
                              style="
                                font-size:13px;
                                line-height:20px;
                                color:#5d6678;
                                margin-bottom:4px;
                              "
                            >
                              ${this.escape(input.property.address)}
                            </div>
                          `
                          : ''
                      }

                      ${
                        input.property.phone
                          ? `
                            <div
                              style="
                                font-size:13px;
                                line-height:20px;
                                color:#5d6678;
                              "
                            >
                              ${this.escape(input.property.phone)}
                            </div>
                          `
                          : ''
                      }

                      ${
                        input.property.email
                          ? `
                            <div
                              style="
                                font-size:13px;
                                line-height:20px;
                                color:#5d6678;
                              "
                            >
                              ${this.escape(input.property.email)}
                            </div>
                          `
                          : ''
                      }
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- YOUR STAY -->
            <tr>
              <td style="padding:0 28px 24px;">
                <div
                  style="
                    font-size:13px;
                    font-weight:700;
                    color:#7d4dd6;
                    text-transform:uppercase;
                    letter-spacing:.4px;
                    margin-bottom:10px;
                  "
                >
                  Your stay
                </div>

                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="
                    border:1px solid #e5e7eb;
                    border-radius:10px;
                  "
                >
                  <tr>
                    <td style="padding:18px 16px;">

                      <div
                        style="
                          font-size:18px;
                          color:#7d4dd6;
                          font-weight:700;
                          margin-bottom:6px;
                        "
                      >
                        ${this.escape(input.roomType || 'Room')}
                      </div>

                      ${
                        stayCommercialSummary
                          ? `
                            <div
                              style="
                                font-size:13px;
                                line-height:20px;
                                color:#5d6678;
                                margin-bottom:14px;
                              "
                            >
                              ${this.escape(stayCommercialSummary)}
                            </div>
                          `
                          : ''
                      }

                      <div
                        style="
                          font-size:13px;
                          line-height:20px;
                          color:#172033;
                          margin-bottom:7px;
                        "
                      >
                        ${this.escape(arrival)}
                        →
                        ${this.escape(departure)}
                        ·
                        ${nights}
                        night${nights === 1 ? '' : 's'}
                      </div>

                      <div
                        style="
                          font-size:13px;
                          line-height:20px;
                          color:#172033;
                        "
                      >
                        ${this.escape(guestSummary)}
                      </div>

                      ${
                        input.ratePlanName && input.ratePlanName.trim().toUpperCase() !== 'BAR'
                          ? `
                            <div
                              style="
                                font-size:12px;
                                line-height:19px;
                                color:#7b8495;
                                margin-top:8px;
                              "
                            >
                              ${this.escape(input.ratePlanName)}
                            </div>
                          `
                          : ''
                      }

                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            ${
              hasBookingSummary
                ? `
                  <!-- BOOKING SUMMARY -->
                  <tr>
                    <td style="padding:0 28px 24px;">
                      <div
                        style="
                          font-size:13px;
                          font-weight:700;
                          color:#7d4dd6;
                          text-transform:uppercase;
                          letter-spacing:.4px;
                          margin-bottom:10px;
                        "
                      >
                        Booking summary
                      </div>

                      <table
                        role="presentation"
                        width="100%"
                        cellspacing="0"
                        cellpadding="0"
                        border="0"
                        style="
                          background:#fafafa;
                          border-radius:10px;
                        "
                      >
                        ${bookingSummaryRows}
                      </table>
                    </td>
                  </tr>
                `
                : ''
            }

            <!-- IMPORTANT INFORMATION -->
            <tr>
              <td style="padding:0 28px 24px;">
                <div
                  style="
                    font-size:13px;
                    font-weight:700;
                    color:#7d4dd6;
                    text-transform:uppercase;
                    letter-spacing:.4px;
                    margin-bottom:10px;
                  "
                >
                  Important information
                </div>

                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="
                    border:1px solid #e5e7eb;
                    border-radius:10px;
                  "
                >
                  <tr>
                    <td
                      style="
                        padding:16px;
                        font-size:13px;
                        line-height:21px;
                        color:#5d6678;
                      "
                    >
                      <div style="margin-bottom:8px;">
                        <strong style="color:#172033;">
                          Check-in:
                        </strong>

                        ${this.escape(checkInTime)}
                      </div>

                      <div style="margin-bottom:8px;">
                        <strong style="color:#172033;">
                          Check-out:
                        </strong>

                        ${this.escape(checkOutTime)}
                      </div>

                      <div>
                        Guests are requested to carry valid
                        government-issued photographic
                        identification at check-in.
                        International guests should carry a
                        valid passport and applicable travel
                        documents.
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- SUPPORT -->
            <tr>
              <td style="padding:0 28px 28px;">
                <div
                  style="
                    font-size:13px;
                    font-weight:700;
                    color:#7d4dd6;
                    text-transform:uppercase;
                    letter-spacing:.4px;
                    margin-bottom:10px;
                  "
                >
                  Need help with your booking?
                </div>

                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="
                    background:#f8f7ff;
                    border-radius:10px;
                  "
                >
                  <tr>
                    <td
                      style="
                        padding:16px;
                        font-size:13px;
                        line-height:21px;
                        color:#5d6678;
                      "
                    >
                      ${
                        input.property.phone
                          ? `
                            <div>
                              <strong style="color:#172033;">
                                Phone:
                              </strong>

                              ${this.escape(input.property.phone)}
                            </div>
                          `
                          : ''
                      }

                      ${
                        input.property.email
                          ? `
                            <div>
                              <strong style="color:#172033;">
                                Email:
                              </strong>

                              ${this.escape(input.property.email)}
                            </div>
                          `
                          : ''
                      }
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td
                align="center"
                style="
                  padding:18px 28px;
                  background:#7d4dd6;
                  color:#ffffff;
                "
              >
                <div
                  style="
                    font-size:15px;
                    font-weight:700;
                    margin-bottom:4px;
                  "
                >
                  ${propertyName}
                </div>

                <div
                  style="
                    font-size:11px;
                    line-height:17px;
                    color:#ede9fe;
                  "
                >
                  This is an automated booking confirmation.
                </div>
              </td>
            </tr>

          </table>

          <div
            style="
              max-width:640px;
              font-size:10px;
              line-height:16px;
              color:#9aa2b1;
              text-align:center;
              padding:12px 10px 0;
            "
          >
            Powered by StayOS
          </div>

        </td>
      </tr>
    </table>
  </body>
</html>`;

    const text = [
      `Your booking at ${input.property.name} is confirmed`,
      '',
      `Booking ID: ${input.reservationCode}`,
      `Guest: ${input.guestName}`,
      '',
      `Check-in: ${arrival}`,
      `Check-out: ${departure}`,
      `Stay: ${nights} night${nights === 1 ? '' : 's'}`,
      '',
      `Room: ${input.roomType || '-'}`,

      stayCommercialSummary ? stayCommercialSummary : null,

      `Guests: ${guestSummary}`,

      input.ratePlanName && input.ratePlanName.trim().toUpperCase() !== 'BAR'
        ? `Rate: ${input.ratePlanName}`
        : null,

      '',
      roomAmount ? `Room charges: ${roomAmount}` : null,

      taxAmount ? `Taxes: ${taxAmount}` : null,

      totalAmount ? `Total: ${totalAmount}` : null,

      paidAmount ? `Paid: ${paidAmount}` : null,

      balanceAmount ? `Balance due: ${balanceAmount}` : null,

      '',
      `Hotel check-in time: ${checkInTime}`,
      `Hotel check-out time: ${checkOutTime}`,
      '',

      input.property.address ? input.property.address : null,

      input.property.phone ? `Phone: ${input.property.phone}` : null,

      input.property.email ? `Email: ${input.property.email}` : null,
    ]
      .filter((value): value is string => value !== null)
      .join('\n');

    return {
      subject:
        `Your booking at ${input.property.name} ` + `is confirmed · ${input.reservationCode}`,

      html,
      text,
    };
  }

  checkoutInvoice(input: CheckoutInvoiceEmailInput): RenderedEmail {
    const propertyName = this.escape(input.property.name);
    const guestName = this.escape(input.guestName);

    const logoHtml = input.property.logoUrl
      ? `
      <img
        src="${this.escape(input.property.logoUrl)}"
        alt="${propertyName}"
        style="
          display:block;
          max-width:150px;
          max-height:72px;
          width:auto;
          height:auto;
          margin:0 auto 14px;
        "
      />
    `
      : '';

    const supportPhone = input.property.phone
      ? `
      <div style="margin-bottom:6px;">
        <strong>Phone:</strong>
        ${this.escape(input.property.phone)}
      </div>
    `
      : '';

    const supportEmail = input.property.email
      ? `
      <div>
        <strong>Email:</strong>
        ${this.escape(input.property.email)}
      </div>
    `
      : '';

    const subject = `Your invoice for ${input.property.name}`;

    const html = `
<!doctype html>
<html>
  <body
    style="
      margin:0;
      padding:0;
      background:#f5f3f8;
      font-family:Arial,Helvetica,sans-serif;
    "
  >
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      border="0"
      style="background:#f5f3f8;padding:32px 14px;"
    >
      <tr>
        <td align="center">

          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="
              max-width:620px;
              background:#ffffff;
              border-radius:16px;
              overflow:hidden;
              box-shadow:0 8px 28px rgba(31,41,55,0.08);
            "
          >

            <tr>
              <td
                align="center"
                style="
                  padding:32px 28px 26px;
                  border-top:7px solid #7d4dd6;
                "
              >
                ${logoHtml}

                <div
                  style="
                    font-size:24px;
                    line-height:30px;
                    font-weight:700;
                    color:#7d4dd6;
                  "
                >
                  ${propertyName}
                </div>
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding:8px 42px 34px;
                  color:#5d6678;
                  font-size:15px;
                  line-height:25px;
                "
              >
                <p
                  style="
                    margin:0 0 22px;
                    color:#172033;
                    font-size:17px;
                  "
                >
                  Hi ${guestName},
                </p>

                <p style="margin:0 0 18px;">
                  Thank you for staying with ${propertyName}.
                </p>

                <p style="margin:0 0 18px;">
                  Please find attached a copy of your final tax invoice.
                </p>

                <p style="margin:0 0 18px;">
                  If there's anything we can help you with,
                  please don't hesitate to get in touch.
                </p>

                <p style="margin:0 0 18px;">
                  We look forward to welcoming you again.
                </p>

                <p style="margin:28px 0 0;">
                  Safe travels,
                </p>

                <p
                  style="
                    margin:3px 0 0;
                    color:#172033;
                    font-weight:700;
                  "
                >
                  Team ${propertyName}
                </p>
              </td>
            </tr>

            ${
              supportPhone || supportEmail
                ? `
                  <tr>
                    <td style="padding:0 42px 34px;">
                      <div
                        style="
                          border-top:1px solid #ece8f2;
                          padding-top:24px;
                        "
                      >
                        <div
                          style="
                            color:#7d4dd6;
                            font-size:12px;
                            font-weight:700;
                            letter-spacing:0.5px;
                            text-transform:uppercase;
                            margin-bottom:12px;
                          "
                        >
                          Need help with your stay?
                        </div>

                        <div
                          style="
                            color:#5d6678;
                            font-size:13px;
                            line-height:21px;
                          "
                        >
                          ${supportPhone}
                          ${supportEmail}
                        </div>
                      </div>
                    </td>
                  </tr>
                `
                : ''
            }

            <tr>
              <td
                align="center"
                style="
                  padding:22px 28px;
                  background:#7d4dd6;
                  color:#ffffff;
                "
              >
                <div
                  style="
                    font-size:14px;
                    font-weight:700;
                    margin-bottom:5px;
                  "
                >
                  ${propertyName}
                </div>

                <div
                  style="
                    color:#ede9fe;
                    font-size:11px;
                  "
                >
                  Powered by StayOS
                </div>
              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>
  </body>
</html>`;

    const text = [
      `Hi ${input.guestName},`,
      '',
      `Thank you for staying with ${input.property.name}.`,
      '',
      'Please find attached a copy of your final tax invoice.',
      '',
      "If there's anything we can help you with, please don't hesitate to get in touch.",
      '',
      'We look forward to welcoming you again.',
      '',
      'Safe travels,',
      `Team ${input.property.name}`,
      '',
      input.property.phone ? `Phone: ${input.property.phone}` : null,
      input.property.email ? `Email: ${input.property.email}` : null,
      '',
      input.property.name,
      'Powered by StayOS',
    ]
      .filter((line): line is string => line !== null)
      .join('\n');

    return {
      subject,
      html,
      text,
    };
  }

  private detailRow(label: string, value: string): string {
    return `
      <table
        role="presentation"
        width="100%"
        cellspacing="0"
        cellpadding="0"
        border="0"
      >
        <tr>
          <td
            width="38%"
            style="
              padding:7px 0;
              font-size:12px;
              color:#7b8495;
            "
          >
            ${this.escape(label)}
          </td>

          <td
            style="
              padding:7px 0;
              font-size:13px;
              color:#172033;
              font-weight:700;
            "
          >
            ${value}
          </td>
        </tr>
      </table>
    `;
  }

  private moneyRow(label: string, value: string, strong = false, highlight = false): string {
    return `
      <tr>
        <td
          style="
            padding:${strong ? '12px 16px' : '7px 16px'};
            font-size:${strong ? '14px' : '13px'};
            color:${strong ? '#172033' : '#5d6678'};
            font-weight:${strong ? '700' : '500'};
            ${strong ? 'border-top:1px solid #e5e7eb;' : ''}
          "
        >
          ${this.escape(label)}
        </td>

        <td
          align="right"
          style="
            padding:${strong ? '12px 16px' : '7px 16px'};
            font-size:${strong ? '15px' : '13px'};
            color:${highlight ? '#b45309' : strong ? '#166534' : '#172033'};
            font-weight:${strong ? '700' : '600'};
            ${strong ? 'border-top:1px solid #e5e7eb;' : ''}
          "
        >
          ${this.escape(value)}
        </td>
      </tr>
    `;
  }

  private calculateNights(arrivalDate: string, departureDate: string): number {
    const arrival = new Date(`${arrivalDate}T00:00:00Z`);

    const departure = new Date(`${departureDate}T00:00:00Z`);

    const milliseconds = departure.getTime() - arrival.getTime();

    const nights = Math.round(milliseconds / 86_400_000);

    return Number.isFinite(nights) && nights > 0 ? nights : 1;
  }

  private optionalMoney(
    value: number | string | null | undefined,
    currency: string,
  ): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    return this.formatMoney(value, currency);
  }

  private formatDate(value: string): string {
    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  private formatTime(value?: string | null): string | null {
    if (!value) {
      return null;
    }

    const [hoursText, minutesText = '00'] = value.split(':');

    const hours = Number(hoursText);

    const minutes = Number(minutesText.slice(0, 2));

    if (
      !Number.isFinite(hours) ||
      !Number.isFinite(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return value;
    }

    const suffix = hours >= 12 ? 'PM' : 'AM';

    const displayHours = hours % 12 || 12;

    return `${displayHours}:` + `${String(minutes).padStart(2, '0')} ${suffix}`;
  }

  private formatMealPlan(value: string): string {
    const normalized = value.trim().toUpperCase();

    const labels: Record<string, string> = {
      ROOM_ONLY: 'Room only',

      BREAKFAST: 'Breakfast included',

      HALF_BOARD: 'Half board',

      FULL_BOARD: 'Full board',
    };

    return labels[normalized] ?? this.toTitleCase(value.replace(/_/g, ' '));
  }

  private formatMoney(value: number | string, currency: string): string {
    const amount = Number(value);

    if (!Number.isFinite(amount)) {
      return String(value);
    }

    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  private toTitleCase(value: string): string {
    return value.toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
  }

  private escape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private escapeAttribute(value: string): string {
    return this.escape(value);
  }
}
