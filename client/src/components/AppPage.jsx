/** Layout for every logged-in page: a title bar and a column of cards. */
export function AppPage({ title, eyebrow, children, actions }) {
    return (
        <main className="app-page">
            <div className="dash-topbar">
                <div>
                    {eyebrow && <span className="eyebrow">{eyebrow}</span>}
                    <h1 id="dash-section-title">{title}</h1>
                </div>
                {actions && <div className="dash-topbar-right">{actions}</div>}
            </div>
            <div className="dash-content">{children}</div>
        </main>
    );
}

const STATUS_LABELS = {
    pending: 'Waiting to be weighed',
    received: 'Weighed & paid',
    paid: 'Paid · ready to collect',
    collected: 'Collected',
};

/** Status of a drop-off (pending/received) or an order (paid/collected). */
export function StatusChip({ status }) {
    return <span className={`status-chip ${status}`}>{STATUS_LABELS[status] || status}</span>;
}
