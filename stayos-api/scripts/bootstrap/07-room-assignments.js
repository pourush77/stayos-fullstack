async function run(client, ctx) {
  await client.query(
    `
      UPDATE rooms
      SET operational_status = CASE
        WHEN room_number IN ('303', '306') THEN 'OCCUPIED'::rooms_operational_status_enum
        ELSE operational_status
      END,
      updated_at = now()
      WHERE property_id = $1 AND room_number IN ('303', '306')
    `,
    [ctx.property.id],
  );
  ctx.summary.roomAssignments = 2;
}

module.exports = { run };
