
Members: Edgar Nguyo, Cedric Ngari, Ian Mbaya
Github: https://github.com/edgarnguyo/Find-My-Artisan.git
Reviewing: Kanairo-Klean Provider API (Team 13), v1.0.0

## 1. Is `unit_price_kes` per kilogram or per listing?

A material shows `quantity_kg: 120.5` and `unit_price_kes: 150.00` with nothing linking them.
Per-kg makes this listing worth 18,075 KES; flat-price makes it 150 KES. We need to know which
before we show artisans any cost.

## 2. Does `material_type` on a scrap log have to match `type` in the catalog?

Same example value (`"scrap_metal"`), different field name, no stated shared enum. If an
artisan logs `"metal"` instead, does it get rejected, silently misfiled, or is there a list we
should validate against ourselves first?

## 3. Can `is_active` on a collection location ever be `false`?

The endpoint says it only returns *active* locations, but every object still carries the
field. If it's always `true`, it's dead weight. If it can be `false`, what should we do with
one — hide it, or still show it?

## 4. Is `POST /scrap-logs` the same interconnection issue we fixed on `POST /bookings`?

Our lecturer flagged `POST /bookings` because Meditrac would be writing their own record into
our system. Here it's reversed — we'd be writing into theirs. Our read: it's not the same
problem, since a scrap log becomes *their* resellable inventory, not something we could just
track ourselves. Worth confirming with them directly rather than assuming.

---
Also unanswered: no error response documented on either GET endpoint — only the POST has one.
