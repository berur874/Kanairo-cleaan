# ENDPOINT_LIST.md

## Endpoint Mapping Table

| Method | Path | Purpose | Maps to Need |
| --- | --- | --- | --- |
| **GET** | `/venues?category={category}&area={area}` | List market venues filtered by category and Nairobi area | Part 1, Need 1: Kanairo-Klean needs to read a list of venues filtered by category and Nairobi area... |
| **GET** | `/venues/{venue_id}` | Retrieve specific venue details including full address and geolocation coordinates | Part 1, Need 2: Kanairo-Klean needs to read a venue's address/geolocation... |
| **GET** | `/venues/{venue_id}/accessibility-badges` | Read physical accessibility features for a candidate venue | Part 1, Need 3: Kanairo-Klean needs to read a venue's accessibility badges... |
| **GET** | `/venues/{venue_id}/rating` | Read the average community star rating for a venue to prioritize trusted locations | Part 1, Need 4: Kanairo-Klean needs to read a venue's average community star rating... |
| **GET** | `/collection-locations` | Read active collection and drop-off hotspot locations for material sourcing | Part 2, Need 1: Group 1 needs to read a list of material collection locations... |
| **GET** | `/materials` | Read raw materials catalog with pricing and cost information | Part 2, Need 2: Group 1 needs to read cost information for raw materials... |
| **GET** | `/materials?type={type}&min_quantity={qty}` | Read a filtered list of raw materials by quantity and type for job-specific sourcing | Part 2, Need 3: Group 1 needs to read a filtered list of raw materials (by quantity/type)... |
| **POST** | `/scrap-logs` | Create a leftover-scrap log entry after a completed job to report reusable materials | Part 2, Need 4: Group 1 needs to write a leftover-scrap log entry after a job is completed... |

---

## Peer Review Feedback

Overall, the endpoints follow REST rules well. However, we noticed a few things that could be improved:

* **`/venues/{venue_id}/rating`** — The rating could possibly be included in `/venues/{venue_id}` instead of having a separate endpoint.
* **`/venues/{venue_id}/accessibility-badges`** — The accessibility information could also be included in the main venue details if it is not a separate resource.
* **`min_quantity`** — Make the purpose clearer because it means the minimum quantity of materials.
Overall, the endpoint structure is good, but these areas should be reviewed.

---

## Part D: Peer Review Revisions & Responses
  
* **Fixed :** Removed the standalone `/venues/{venue_id}/accessibility-badges` endpoint and embedded the accessibility badges directly as a field in the `/venues/{venue_id}` response. On reflection, badges are static, small, and always needed alongside the rest of the venue detail view.
* **Pushed back :** Kept `/venues/{venue_id}/rating` as its own endpoint rather than merging it into `/venues/{venue_id}`. Unlike accessibility badges, the rating is a computed aggregate derived from a separate reviews/ratings dataset, so it benefits from being fetched independently instead of being recalculated on every venue detail request.
* **Fixed (Comment 6):** Renamed the query parameter from `min_quantity` to `min_quantity_kg` and updated the Purpose column to explicitly state it filters by the minimum quantity of material (in kg) available.
