

let pending = null;

export function loadSiteData() {
    if (!pending) {
        pending = fetch('/data/site-data.json').then((res) => {
            if (!res.ok) throw new Error(`Failed to load site data: ${res.status}`);
            return res.json();
        });
    }
    return pending;
}