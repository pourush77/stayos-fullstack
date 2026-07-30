# Hotel Inventory Amenities TODO

Hillston requires a Master Amenity Catalog and Room Type Amenity assignment.

Amenity entities are not implemented yet, so the Hillston bootstrap intentionally skips this section without failing.

Required future entities:

- `Amenity`
- `RoomTypeAmenity`

Required amenity groups:

- General Amenities
- Premium Amenities

Assignment rules:

- Deluxe receives all General Amenities.
- Suite receives all General Amenities plus Premium Amenities.
