const { PROPERTY_CODE, one } = require('./00-utils');

async function run(client, ctx) {
  const property = await one(
    client,
    `
      INSERT INTO properties (
        code, name, legal_name, gst_number, pan_number, cin_number, logo_url, email, phone,
        website, address_line_1, address_line_2, city, state, state_code, country,
        postal_code, timezone, currency, check_in_time, check_out_time, total_floors,
        total_rooms, status
      )
      VALUES (
        $1, 'Hillston Hotel', 'Hillston Hotel Pvt. Ltd.', '23AABCH1234H1Z9', NULL, NULL,
        NULL, 'reservations@hillston.local', '+917314000000', NULL, 'Ralamandal Road',
        'Near Hillston Convention Centre', 'Indore', 'Madhya Pradesh', '23', 'India',
        '452020', 'Asia/Kolkata', 'INR', '14:00', '12:00', 2, 24, 'ACTIVE'
      )
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        legal_name = EXCLUDED.legal_name,
        timezone = EXCLUDED.timezone,
        currency = EXCLUDED.currency,
        total_floors = EXCLUDED.total_floors,
        total_rooms = EXCLUDED.total_rooms,
        status = EXCLUDED.status,
        updated_at = now()
      RETURNING *
    `,
    [PROPERTY_CODE],
  );
  ctx.property = property;
  ctx.summary.property = property.name;
}

module.exports = { run };
