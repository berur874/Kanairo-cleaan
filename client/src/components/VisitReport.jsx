// After taking scrap to a hub (or collecting an order), a user can report how accessible the place
// was. Reports go to AccessMap Nairobi (Group 12), so they are about the AccessMap venues near the hub.
import { useEffect, useState } from 'react';
import { ReportForm } from './PartnerVenues.jsx';
import { getNearbyVenues } from '../utils/trade.jsx';

export default function VisitReport({ hubId, hubName, onClose }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [venueId, setVenueId] = useState('');

    useEffect(() => {
        let alive = true;
        getNearbyVenues(hubId)
            .then((d) => {
                if (!alive) return;
                setData(d);
                if (d.venues.length === 1) setVenueId(d.venues[0].id);
            })
            .catch((err) => { if (alive) setError(err.message); });
        return () => { alive = false; };
    }, [hubId]);

    const venue = data?.venues.find((v) => v.id === venueId);

    return (
        <div className="visit-report">
            <div className="visit-report-head">
                <div>
                    <h4>Report the place</h4>
                    <p className="cell-sub">
                        Tell AccessMap Nairobi how accessible the area around the {hubName} hub was, so the next person knows what to expect.
                    </p>
                </div>
                <button type="button" className="text-button" onClick={onClose}>Close</button>
            </div>

            {error ? <p className="form-error">{error}</p>
                : !data ? <p className="muted-note">Finding AccessMap places near {hubName}…</p>
                : data.venues.length === 0 ? <p className="muted-note">{data.note}</p>
                : (
                    <>
                        <div className="dash-form-field visit-report-pick">
                            <label htmlFor={`visit-venue-${hubId}`}>Which place did you go to?</label>
                            <select id={`visit-venue-${hubId}`} value={venueId} onChange={(e) => setVenueId(e.target.value)}>
                                <option value="" disabled>Choose a place…</option>
                                {data.venues.map((v) => (
                                    <option key={v.id} value={v.id}>{v.name} · {v.distance_km} km from the hub</option>
                                ))}
                            </select>
                        </div>
                        {venue && <ReportForm key={venue.id} venue={venue} onSubmitted={() => {}} />}
                    </>
                )}
        </div>
    );
}
