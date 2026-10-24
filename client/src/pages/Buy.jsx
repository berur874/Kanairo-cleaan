import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Steps, TradeRequestForm, HubRecommendations } from '../components/Trade.jsx';
import { AppPage, StatusChip } from '../components/AppPage.jsx';
import VisitReport from '../components/VisitReport.jsx';
import MpesaModal from '../components/MpesaModal.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { placeOrder, getMyOrders, formatKes, formatKg, formatDate } from '../utils/trade.jsx';
import { showSuccessNotification } from '../utils/payments.jsx';

const STEPS = ['What you need', 'Choose a hub', 'Pay with M-Pesa'];

/** Buyer flow: say what you need → pick a recommended hub that has it → pay with M-Pesa. */
export default function Buy() {
    const { user } = useAuth();
    const [step, setStep] = useState(0);
    const [request, setRequest] = useState(null);
    const [choice, setChoice] = useState(null);
    const [order, setOrder] = useState(null);

    async function pay() {
        const saved = await placeOrder({
            hotspotId: choice.hub.hotspot_id,
            materialId: choice.material.id,
            quantityKg: request.quantityKg,
        });
        setOrder(saved);
        setChoice(null);
        showSuccessNotification(`Paid ${formatKes(saved.amount_kes)} — receipt ${saved.id}`);
    }

    function startOver() {
        setStep(0);
        setRequest(null);
        setOrder(null);
    }

    return (
        <AppPage title="Buy materials" eyebrow="Buyer">
            <div className="dash-card">
                <Steps steps={STEPS} current={order ? 3 : step} />

                {order ? (
                    <div className="trade-done">
                        <h3>✓ Paid · receipt {order.id}</h3>
                        <p>
                            <strong>{formatKg(order.quantity_kg)} of {order.material.name}</strong> is reserved for you at the{' '}
                            <strong>{order.hub.name}</strong> hub. Show receipt <span className="mono">{order.id}</span> when you collect it.
                        </p>
                        <div className="trade-actions">
                            <button type="button" className="btn" onClick={startOver}>Buy more</button>
                            <Link to="/buy/orders" className="btn btn-outline">See my orders</Link>
                        </div>
                    </div>
                ) : step === 0 ? (
                    <TradeRequestForm mode="buy" initial={request} onSubmit={(r) => { setRequest(r); setStep(1); }} />
                ) : (
                    <>
                        <div className="trade-recap">
                            <span>{formatKg(request.quantityKg)} of {request.material?.name}</span>
                            <button type="button" className="text-button" onClick={() => setStep(0)}>Change</button>
                        </div>
                        <HubRecommendations
                            mode="buy"
                            request={request}
                            onChoose={(hub, material) => { setChoice({ hub, material }); setStep(2); }}
                        />
                    </>
                )}
            </div>

            {choice && (
                <MpesaModal
                    title="Pay with M-Pesa"
                    summary={`${formatKg(request.quantityKg)} of ${choice.material.name} from the ${choice.hub.name} hub`}
                    amountKes={choice.hub.est_amount_kes}
                    defaultPhone={user.phone}
                    confirmLabel="Pay"
                    onConfirm={pay}
                    onClose={() => { setChoice(null); setStep(1); }}
                />
            )}
        </AppPage>
    );
}

/** A buyer's orders, newest first. */
export function BuyOrders() {
    const [orders, setOrders] = useState(null);
    const [error, setError] = useState('');
    const [reporting, setReporting] = useState(null);

    useEffect(() => {
        let alive = true;
        getMyOrders()
            .then((o) => { if (alive) setOrders(o); })
            .catch((err) => { if (alive) setError(err.message); });
        return () => { alive = false; };
    }, []);

    return (
        <AppPage title="My orders" eyebrow="Buyer" actions={<Link to="/buy" className="btn btn-sm">+ Buy materials</Link>}>
            <div className="dash-card">
                {error ? <p className="form-error">{error}</p>
                    : orders === null ? <p className="muted-note">Loading…</p>
                    : orders.length === 0 ? (
                        <p className="muted-note">No orders yet. <Link to="/buy">Find a hub that has what you need.</Link></p>
                    ) : (
                        <div className="table-scroll">
                            <table className="app-table">
                                <thead>
                                    <tr><th>Receipt</th><th>Hub</th><th>Material</th><th>Weight</th><th>Paid</th><th>Status</th><th><span className="sr-only">Report</span></th></tr>
                                </thead>
                                <tbody>
                                    {orders.map((o) => (
                                        <Fragment key={o.id}>
                                            <tr>
                                                <td><span className="mono">{o.id}</span><br /><span className="cell-sub">{formatDate(o.created_at)}</span></td>
                                                <td>{o.hub?.name || '—'}</td>
                                                <td>{o.material.name}</td>
                                                <td>{formatKg(o.quantity_kg)}</td>
                                                <td>{formatKes(o.amount_kes)}</td>
                                                <td><StatusChip status={o.status} /></td>
                                                <td>
                                                    {o.hub && (
                                                        <button type="button" className="text-button" aria-expanded={reporting === o.id}
                                                            onClick={() => setReporting(reporting === o.id ? null : o.id)}>
                                                            Report the place
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                            {reporting === o.id && (
                                                <tr className="report-row">
                                                    <td colSpan={7}>
                                                        <VisitReport hubId={o.hub.id} hubName={o.hub.name} onClose={() => setReporting(null)} />
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
