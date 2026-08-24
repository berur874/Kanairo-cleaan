# API Needs Statements

---

## Part 1: Kanairo-Klean (Team 13) consuming Group 12's API

**Consumer:** Kanairo-Klean (Team 13)  
**Provider:** Group 12 (Disability Information App)  

1. **Kanairo-Klean** needs to **read a list of venues filtered by category and Nairobi area**, in order to **identify market/mall-dense neighborhoods for planning new Material Hotspot locations**.
   * **Freshness:** Updated within a day is fine
   * **Volume:** Low — used during hotspot planning, not per page load
   * **Auth:** No authentication required

2. **Kanairo-Klean** needs to **read a venue's address/geolocation**, in order to **plot verified reference points on its own collection hotspot map**.
   * **Freshness:** Updated within a day
   * **Volume:** Low
   * **Auth:** No authentication required

3. **Kanairo-Klean** needs to **read a venue's accessibility badges (e.g., ramp, wide corridors, accessible parking)**, in order to **confirm collection vehicles and staff can physically access a site before designating it a drop-off hotspot**.
   * **Freshness:** Updated within a day is fine
   * **Volume:** Low — checked once per candidate site, not constantly
   * **Auth:** No authentication required

4. **Kanairo-Klean** needs to **read a venue's average community star rating**, in order to **prioritize partnering with well-reviewed, trusted locations as collection hotspots**.
   * **Freshness:** Updated within a day/week
   * **Volume:** Low
   * **Auth:** No authentication required

---

## Part 2: Group 1 (Artisans) consuming Kanairo-Klean's (Team 13) API

**Consumer:** Group 1 (Artisans App)  
**Provider:** Kanairo-Klean (Team 13)  

1. **Group 1** needs to **read a list of second-hand/raw material collection locations**, in order to **find pickup points to source materials for their jobs**.
   * **Freshness:** Real-time
   * **Volume:** Low — once per page load
   * **Auth:** No authentication required

2. **Group 1** needs to **read cost information for raw materials**, in order to **budget and decide what to buy to supply their artisans**.
   * **Freshness:** Real-time
   * **Volume:** High — called constantly
   * **Auth:** No authentication required

3. **Group 1** needs to **read a filtered list of raw materials (by quantity/type)**, in order to **give artisans access to only the materials relevant to their current job, supporting accountability in what's supplied**.
   * **Freshness:** Real-time
   * **Volume:** High — called constantly
   * **Auth:** No authentication require

4. **Group 1** needs to **write a leftover-scrap log entry after a job is completed**, in order to **let their mobile app users report reusable material back to Kanairo**.
   * **Freshness:** Updated once per page load
   * **Volume:** Low
   * **Auth:** No authentication required

---

## Reflection

During our partner interviews across the API ring, we were surprised by how different our upstream and downstream data requirements are. When consuming Group 12's Disability Information API, we realized we only need low-volume, read-only batch data (such as venue ratings and accessibility attributes) to validate physical sites during hotspot planning.Conversely, serving Group 1 (Artisans App) as an upstream provider showed us that their app needs high-frequency, real-time polling to monitor material costs and availability, as well as a write endpoint to log completed job scrap. Discovering that our incoming requests are lightweight planning lookups while our outgoing API must handle continuous active traffic helped us properly scope our system design.