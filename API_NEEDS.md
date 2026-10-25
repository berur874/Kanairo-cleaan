# API Needs Statements

---

## Part 1: Kanairo-Klean (Team 13) consuming Group 12's API

**Consumer:** Kanairo-Klean (Team 13)  
**Provider:** Group 12 (Disability Information App)  

1. **Kanairo-Klean** needs to **read a list of venues filtered by category and Nairobi area**, in order to **identify market/mall-dense neighborhoods for planning new Material Hotspot locations**.
   * **Freshness:** Updated within a day is fine
   * **Volume:** Low — used during hotspot planning, not per page load
   * **Auth:** No authentication required

2. **Kanairo-Klean** needs to **write an accessibility report (star rating, visit date, notes and the accessibility features we observed) for a venue after a site visit**, in order to **record whether a candidate hotspot site is really accessible to our collection vehicles and staff, and keep AccessMap's ratings accurate for everyone who relies on them**.
   * **Freshness:** The new report should count towards the venue's rating immediately
   * **Volume:** Low — one report per site visit
   * **Auth:** No authentication required

3. **Kanairo-Klean** needs to **write a new venue (name, area, address, category, coordinates and accessibility features)**, in order to **add markets and sites our hub managers find on the ground that AccessMap does not list yet, so they can be assessed as hotspot locations and shared with other AccessMap users**.
   * **Freshness:** The new venue should appear in the venue list immediately
   * **Volume:** Very low — only when a missing site is found
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

**Update (webapp, October 2026):** Our use of Group 12's API is no longer read-only. Hub managers write reports and venues back to AccessMap (Needs 2 and 3). Group 12's data also now reaches our sellers and buyers, not just hotspot planning: when a user says they have accessibility needs, we rank hubs by the AccessMap venues within 3 km that have every feature they need. That ranking uses each venue's coordinates and accessibility features from `GET /api/venues`. The volume is still low, because our server fetches the venue list once and reuses it for a day, which matches the "updated within a day" freshness in Need 1.
