const names = [
  ['Rhea', 'Malhotra', true, 'VIP guest'],
  ['Aarav', 'Kapoor', false, 'Returning guest'],
  ['Meera', 'Iyer', false, 'Family with children'],
  ['Kabir', 'Sharma', false, 'Corporate guest'],
  ['Ananya', 'Rao', false, 'OTA guest'],
  ['David', 'Miller', false, 'International guest'],
  ['Sophia', 'Wilson', false, 'International guest'],
  ['Rahul', 'Verma', false, 'Walk-in guest'],
  ['Neha', 'Arora', false, 'Solo business traveler'],
  ['Ishaan', 'Khanna', false, 'Couple booking'],
  ['Priya', 'Nair', false, 'Late checkout request'],
  ['Arjun', 'Mehta', false, 'Airport pickup request'],
  ['Fatima', 'Khan', false, 'Accessibility request'],
  ['Vikram', 'Sethi', false, 'High floor request'],
  ['Elena', 'Petrova', false, 'International guest'],
  ['Sanjay', 'Gupta', false, 'Elderly guest'],
  ['Nisha', 'Bansal', false, 'Quiet room request'],
  ['Rohan', 'Das', false, 'Extra bed request'],
  ['Pooja', 'Menon', false, 'Early check-in request'],
  ['Karan', 'Gill', false, 'Direct booking'],
  ['Aditi', 'Bose', false, 'Cancelled booking'],
  ['Harsh', 'Jain', false, 'Payment due'],
  ['Maya', 'Thomas', false, 'Paid booking'],
  ['Sameer', 'Ali', false, 'No-show candidate'],
  ['Tara', 'Singh', false, 'Long stay'],
  ['Oliver', 'Brown', false, 'OTA family'],
  ['Emma', 'Davis', false, 'Suite at capacity'],
  ['Yuki', 'Tanaka', false, 'Business traveler'],
  ['Maria', 'Garcia', false, 'Special request'],
  ['Ahmed', 'Hassan', false, 'Corporate booking'],
  ['Gaurav', 'Batra', false, 'Returning guest'],
  ['Simran', 'Kaur', false, 'Family booking'],
  ['Dev', 'Patel', false, 'Checked in'],
  ['Ira', 'Sen', false, 'Checkout today'],
  ['Nikhil', 'Rao', false, 'Checkout tomorrow'],
  ['Lakshmi', 'Menon', false, 'Past stay'],
];

async function run(client, ctx) {
  for (let index = 0; index < names.length; index += 1) {
    const [first, last, vip, note] = names[index];
    const phone = `+91988000${String(index + 1).padStart(4, '0')}`;
    await client.query(
      `
        INSERT INTO guests (
          property_id, first_name, last_name, display_name, phone, email, nationality,
          preferred_language, company_name, vip_status, blacklist_status, notes, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'English', $8, $9, false, $10, 'ACTIVE')
        ON CONFLICT (property_id, phone) DO UPDATE SET
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          display_name = EXCLUDED.display_name,
          email = EXCLUDED.email,
          nationality = EXCLUDED.nationality,
          company_name = EXCLUDED.company_name,
          vip_status = EXCLUDED.vip_status,
          notes = EXCLUDED.notes,
          status = 'ACTIVE',
          updated_at = now()
      `,
      [
        ctx.property.id,
        first,
        last,
        `${first} ${last}`,
        phone,
        `${first}.${last}@demo.stayos.local`.toLowerCase(),
        index >= 25 ? 'International' : 'Indian',
        note.includes('Corporate') ? 'StayOS Corporate Services' : null,
        vip,
        `Demo profile: ${note}`,
      ],
    );
  }
  ctx.summary.guests = names.length;
}

module.exports = { run, names };
