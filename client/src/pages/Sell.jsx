import { Fragment, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Steps, TradeRequestForm, HubRecommendations } from '../components/Trade.jsx';
import { AppPage, StatusChip } from '../components/AppPage.jsx';
import VisitReport from '../components/VisitReport.jsx';
import { createDropOff, getMyDropOffs, formatKes, formatKg, formatDate } from '../utils/trade.jsx';
import { showSuccessNotification } from '../utils/payments.jsx';

const STEPS = ['What you collected', 'Choose a hub', 'Confirm drop-off'];

/** Seller flow: log what you collected → pick a recommended hub → confirm the drop-off. */
export default function Sell() {
    const [step, setStep] = useState(0);
    // Coming from the Marketplace (?material=PET) pre-selects that material.
    const [searchParams] = useSearchParams();
    const [request, setRequest] = useState(() => {
        const materialId = searchParams.get('material');
        return materialId ? { materialId } : null;
    });
    const [choice, setChoice] = useState(null);
    const [notes, setNotes] = useState('');
    const [saved, setSaved] = useState(null);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    async function confirm() {
        setSubmitting(true);
        setError('');
        try {
            const drop = await createDropOff({
                hotspotId: choice.hub.hotspot_id,
                materialId: choice.material.id,
                quantityKg: request.quantityKg,
                notes: notes.trim(),
            });
            setSaved(drop);
            showSuccessNotification(`Drop-off ${drop.drop_off_id} logged at ${drop.hub.name}`);
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    }

    function startOver() {
        setStep(0);
        setRequest(null);
        setChoice(null);
        setNotes('');
        setSaved(null);
    }

    return (
        <AppPage title="Sell your scrap" eyebrow="Seller">
            <div className="dash-card">
                <Steps steps={STEPS} current={saved ? 3 : step} />

                {saved ? (
                    <div className="trade-done">
                        <h3>✓ Drop-off {saved.drop_off_id} logged</h3>
                        <p>
                            Take your <strong>{formatKg(saved.quantity_kg)} of {saved.material.name}</strong> to the{' '}
                            <strong>{saved.hub.name}</strong> hub. They will weigh it and pay you on M-Pesa: about{' '}
                            <strong>{formatKes(saved.est_payout_kes)}</strong> at today's price.
                        </p>
                        <div className="trade-actions">
                            <button type="button" className="btn" onClick={startOver}>Log more scrap</button>
                            <Link to="/sell/history" className="btn btn-outline">See my drop-offs</Link>
                        </div>
                    </div>
                ) : step === 0 ? (
                    <TradeRequestForm
                        mode="sell"
                        initial={request}
                        onSubmit={(r) => { setRequest(r); setStep(1); }}
                    />
                ) : step === 1 ? (
                    <>
                        <div className="trade-recap">
                            <span>{formatKg(request.quantityKg)} of {request.material?.name}</span>
                            <button type="button" className="text-button" onClick={() => setStep(0)}>Change</button>
                        </div>
                        <HubRecommendations
                            mode="sell"
                            request={request}
                            onChoose={(hub, material) => { setChoice({ hub, material }); setStep(2); }}
                        />
                    </>
                ) : (
                    <div className="trade-confirm">
                        <dl className="trade-summary">
                            <div><dt>Material</dt><dd>{choice.material.name}</dd></div>
                            <div><dt>Weight (your estimate)</dt><dd>{formatKg(request.quantityKg)}</dd></div>
                            <div><dt>Hub</dt><dd>{choice.hub.name}{choice.hub.area && choice.hub.area !== choice.hub.name && `, ${choice.hub.area}`}</dd></div>
                            <div><dt>Expected payout</dt><dd>{formatKes(choice.hub.est_amount_kes)}</dd></div>
                        </dl>
                        <p className="field-hint">The hub pays you for the weight on its scale, so the final amount can differ a little.</p>
                        <div className="dash-form-field dash-form-field-wide">
                            <label htmlFor="sell-notes">Notes for the hub (optional)</label>
                            <input id="sell-notes" type="text" maxLength={500} placeholder="e.g. 3 sacks, already sorted"
                                value={notes} onChange={(e) => setNotes(e.target.value)} />
                        </div>
                        {error && <p className="form-error" role="alert">{error}</p>}
                        <div className="trade-actions">
                            <button type="button" className="btn btn-outline" onClick={() => setStep(1)}>← Back</button>
                            <button type="button" className="btn" onClick={confirm} disabled={submitting}>
                                {submitting ? 'Logging…' : 'Confirm drop-off'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </AppPage>
    );
}

/** A seller's drop-offs, newest first, with their status and payout. */
export function SellHistory() {
    const [drops, setDrops] = useState(null);
    const [error, setError] = useState('');
    const [reporting, setReporting] = useState(null);

    useEffect(() => {
        let alive = true;
        getMyDropOffs()
            .then((d) => { if (alive) setDrops(d); })
            .catch((err) => { if (alive) setError(err.message); });
        return () => { alive = false; };
    }, []);

    const paid = drops ? drops.reduce((sum, d) => sum + (d.payout_kes || 0), 0) : 0;
    const waiting = drops ? drops.filter((d) => d.status === 'pending').length : 0;

    return (
        <AppPage title="My drop-offs" eyebrow="Seller" actions={<Link to="/sell" className="btn btn-sm">+ Sell scrap</Link>}>
            {drops && (
                <div className="kpi-row">
                    <div className="kpi-card"><div className="kpi-label">Paid to you</div><div className="kpi-value">{formatKes(paid)}</div></div>
                    <div className="kpi-card"><div className="kpi-label">Waiting to be weighed</div><div className="kpi-value">{waiting}</div></div>
                    <div className="kpi-card"><div className="kpi-label">Drop-offs</div><div className="kpi-value">{drops.length}</div></div>
                </div>
            )}
            <div className="dash-card">
                {error ? <p className="form-error">{error}</p>
                    : drops === null ? <p className="muted-note">Loading…</p>
                    : drops.length === 0 ? (
                        <p className="muted-note">No drop-offs yet. <Link to="/sell">Log the scrap you collected</Link> to get matched to a hub.</p>
                    ) : (
                        <div className="table-scroll">
                            <table className="app-table">
                                <thead>
                                    <tr><th>Drop-off</th><th>Hub</th><th>Material</th><th>Weight</th><th>Payout</th><th>Status</th><th><span className="sr-only">Report</span></th></tr>
                                </thead>
                                <tbody>
                                    {drops.map((d) => (
                                        <Fragment key={d.drop_off_id}>
                                            <tr>
                                                <td><span className="mono">{d.drop_off_id}</span><br /><span className="cell-sub">{formatDate(d.created_at)}</span></td>
                                                <td>{d.hub.name}</td>
                                                <td>{d.material?.name || d.material_type}</td>
                                                <td>{formatKg(d.received_kg ?? d.quantity_kg)}{d.received_kg === null && <span className="cell-sub"> (estimate)</span>}</td>
                                                <td>{d.payout_kes !== null ? formatKes(d.payout_kes) : d.est_payout_kes !== null ? <span className="cell-sub">≈ {formatKes(d.est_payout_kes)}</span> : '—'}</td>
                                                <td><StatusChip status={d.status} /></td>
                                                <td>
                                                    <button type="button" className="text-button" aria-expanded={reporting === d.drop_off_id}
                                                        onClick={() => setReporting(reporting === d.drop_off_id ? null : d.drop_off_id)}>
                                                        Report the place
                                                    </button>
                                                </td>
                                            </tr>
                                            {reporting === d.drop_off_id && (
                                                <tr className="report-row">
                                                    <td colSpan={7}>
                                                        <VisitReport hubId={d.hub.id} hubName={d.hub.name} onClose={() => setReporting(null)} />
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
            </div>
        </AppPage>
    );
}
