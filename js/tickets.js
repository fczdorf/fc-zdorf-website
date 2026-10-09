(() => {
    /* ---------------- Data (loaded from data/tickets.json) ---------------- */
    const DATA_URL = './data/tickets.json';
    let VENUE = '';
    let BOOKING_FEE = 0;
    let MAX_PER_CATEGORY = 8;
    let CATEGORIES = [];
    let MATCHES = [];

    /* ---------------- Helpers ---------------- */
    const $ = (s, r = document) => r.querySelector(s);
    const eur = n => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(n);
    const fmt = (iso, opts) => new Date(iso).toLocaleString('en-GB', opts);
    const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
    const maxFor = (m, c) => Math.min(MAX_PER_CATEGORY, m.available[c.id]);

    /* ---------------- State ---------------- */
    let cart = {};       // { matchId: { catId: qty } }
    let order = null;    // set after successful payment

    try { cart = JSON.parse(sessionStorage.getItem('zdorf-cart')) || {}; } catch (e) { cart = {}; }
    const save = () => { try { sessionStorage.setItem('zdorf-cart', JSON.stringify(cart)); } catch (e) { } };
    const qty = (m, c) => (cart[m.id] && cart[m.id][c.id]) || 0;

    function setQty(m, c, n) {
        n = Math.max(0, Math.min(maxFor(m, c), n));
        cart[m.id] = cart[m.id] || {};
        if (n) cart[m.id][c.id] = n; else delete cart[m.id][c.id];
        if (!Object.keys(cart[m.id]).length) delete cart[m.id];
        save();
    }

    function lines() {
        const out = [];
        MATCHES.forEach(m => CATEGORIES.forEach(c => {
            const q = qty(m, c);
            if (q) out.push({ m, c, q, total: q * c.price });
        }));
        return out;
    }
    const countAll = () => lines().reduce((s, l) => s + l.q, 0);
    const subtotal = () => lines().reduce((s, l) => s + l.total, 0);
    const grand = () => subtotal() + (countAll() ? BOOKING_FEE : 0);

    /* ---------------- Step 1: matches ---------------- */
    const matchesEl = $('#matches');

    function catHTML(m, c) {
        const left = m.available[c.id];
        const low = left > 0 && left <= 10 ? ` <em>Only ${left} left</em>` : '';
        const control = left === 0
            ? '<span class="tk-sold">Sold out</span>'
            : `<div class="tk-step" role="group" aria-label="${c.name} tickets">
                   <button type="button" data-d="-1" aria-label="Remove one ${c.name} ticket">&minus;</button>
                   <output aria-live="polite">0</output>
                   <button type="button" data-d="1" aria-label="Add one ${c.name} ticket">+</button>
               </div>`;
        return `<li class="tk-cat" data-cat="${c.id}">
                    <div class="tk-cname"><b>${c.name}</b><small>${c.note}${low}</small></div>
                    <span class="tk-price">${eur(c.price)}</span>
                    ${control}
                </li>`;
    }

    function matchHTML(m) {
        const day = fmt(m.kickoff, { day: 'numeric' });
        const mon = fmt(m.kickoff, { month: 'short' });
        const when = fmt(m.kickoff, { weekday: 'long' }) + ', ' + fmt(m.kickoff, { hour: '2-digit', minute: '2-digit' });
        return `<article class="tk-match" data-match="${m.id}">
                    <header class="tk-mhead">
                        <time class="tk-date" datetime="${m.kickoff}"><b>${day}</b><span>${mon}</span></time>
                        <div>
                            <h3>1. FC Zdorf<i>vs</i>${m.opponent}</h3>
                            <p>${when} at ${VENUE}</p>
                        </div>
                        ${m.tag ? `<span class="tk-tag">${m.tag}</span>` : ''}
                    </header>
                    <ul class="tk-cats">${CATEGORIES.map(c => catHTML(m, c)).join('')}</ul>
                </article>`;
    }

    matchesEl.addEventListener('click', e => {
        const btn = e.target.closest('button[data-d]');
        if (!btn) return;
        const m = MATCHES.find(x => x.id === btn.closest('.tk-match').dataset.match);
        const c = CATEGORIES.find(x => x.id === btn.closest('.tk-cat').dataset.cat);
        setQty(m, c, qty(m, c) + Number(btn.dataset.d));
        refreshSteppers();
        refreshBar();
    });

    function refreshSteppers() {
        MATCHES.forEach(m => {
            const card = $(`[data-match="${m.id}"]`, matchesEl);
            CATEGORIES.forEach(c => {
                const row = $(`[data-cat="${c.id}"]`, card);
                const out = $('output', row);
                if (!out) return;
                const q = qty(m, c);
                out.textContent = q;
                row.classList.toggle('has', q > 0);
                const [minus, plus] = row.querySelectorAll('button');
                minus.disabled = q === 0;
                plus.disabled = q >= maxFor(m, c);
            });
        });
    }

    /* ---------------- Basket bar ---------------- */
    const bar = $('#cartbar');
    let currentStep = 'tickets';

    function refreshBar() {
        const n = countAll();
        $('#cart-count').textContent = plural(n, 'ticket');
        $('#cart-total').textContent = n ? `${eur(subtotal())} plus ${eur(BOOKING_FEE)} booking fee` : '';
        const show = currentStep === 'tickets' && n > 0;
        bar.hidden = !show;
        document.body.classList.toggle('has-cartbar', show);
    }

    /* ---------------- Summary rendering ---------------- */
    function linesHTML(ls) {
        return ls.map(l => `<li class="sum-line">
            <span>${l.q} &times; ${l.c.name}<small>vs ${l.m.opponent}, ${fmt(l.m.kickoff, { weekday: 'short', day: 'numeric', month: 'short' })}</small></span>
            <span>${eur(l.total)}</span></li>`).join('');
    }

    function totalsHTML(sub, fee, total) {
        return `<div><dt>Tickets</dt><dd>${eur(sub)}</dd></div>
                <div><dt>Booking fee</dt><dd>${eur(fee)}</dd></div>
                <div class="total"><dt>Total</dt><dd>${eur(total)}</dd></div>`;
    }

    function renderSummary() {
        $('#sum-lines').innerHTML = linesHTML(lines());
        $('#sum-totals').innerHTML = totalsHTML(subtotal(), BOOKING_FEE, grand());
        $('#pay-btn').textContent = `Pay ${eur(grand())}`;
    }

    /* ---------------- Routing (#tickets, #checkout, #done) ---------------- */
    const panels = ['tickets', 'checkout', 'done'];
    const stepsEl = $('#steps');
    let firstRoute = true;

    function route() {
        let step = (location.hash || '#tickets').slice(1);
        if (!panels.includes(step)) step = 'tickets';
        if (step === 'checkout' && !countAll()) step = 'tickets';
        if (step === 'done' && !order) step = 'tickets';
        currentStep = step;

        panels.forEach(p => { $('#step-' + p).hidden = p !== step; });

        const idx = panels.indexOf(step);
        stepsEl.querySelectorAll('li').forEach((li, i) => {
            li.classList.toggle('is-done', i < idx);
            if (i === idx) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
        });

        if (step === 'checkout') renderSummary();
        refreshBar();

        if (!firstRoute) {
            window.scrollTo(0, 0);
            const h = $('#step-' + step + ' h2');
            if (h) h.focus({ preventScroll: true });
        }
        firstRoute = false;
    }

    window.addEventListener('hashchange', route);

    /* ---------------- Step 2: checkout ---------------- */
    const form = $('#checkout-form');
    const errorEl = $('#form-error');
    const payBtn = $('#pay-btn');

    function showError(msg, field) {
        errorEl.textContent = msg;
        errorEl.hidden = false;
        form.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
        if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
    }

    form.addEventListener('submit', e => {
        e.preventDefault();
        errorEl.hidden = true;

        const first = form.elements.first, last = form.elements.last, email = form.elements.email, terms = form.elements.terms;
        if (!first.value.trim()) return showError('Enter your first name.', first);
        if (!last.value.trim()) return showError('Enter your last name.', last);
        if (!email.validity.valid || !email.value.trim()) return showError('Enter a valid email address, for example name@example.com.', email);
        if (!terms.checked) return showError('Accept the ticket terms to continue.', terms);

        payBtn.disabled = true;
        payBtn.textContent = 'Processing...';

        /* ------------------------------------------------------------------
           TODO: real payment goes here. Create the order on your server, hand
           the customer to your payment provider (Stripe, Mollie, PayPal...),
           and only call completeOrder() once the provider confirms payment.
           The timeout below just simulates that round trip.
        ------------------------------------------------------------------- */
        setTimeout(() => completeOrder({
            email: email.value.trim(),
            method: form.elements.pay.value
        }), 800);
    });

    function completeOrder(customer) {
        order = {
            number: 'ZD-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
            email: customer.email,
            lines: lines(),
            sub: subtotal(),
            total: grand()
        };
        cart = {};
        save();
        refreshSteppers();

        $('#done-msg').textContent = `We sent your tickets to ${order.email}. Show them on your phone at the gate.`;
        $('#done-order').textContent = `Order ${order.number}`;
        $('#done-lines').innerHTML = linesHTML(order.lines);
        $('#done-totals').innerHTML = totalsHTML(order.sub, BOOKING_FEE, order.total);

        payBtn.disabled = false;
        form.reset();
        location.hash = '#done';
    }

    /* ---------------- Init ---------------- */
    function pruneCart() {
        // Drop anything in a saved basket that no longer exists or exceeds current stock
        Object.keys(cart).forEach(mid => {
            const m = MATCHES.find(x => x.id === mid);
            if (!m) { delete cart[mid]; return; }
            Object.keys(cart[mid]).forEach(cid => {
                const c = CATEGORIES.find(x => x.id === cid);
                const n = c ? Math.min(cart[mid][cid], maxFor(m, c)) : 0;
                if (n > 0) cart[mid][cid] = n; else delete cart[mid][cid];
            });
            if (!Object.keys(cart[mid]).length) delete cart[mid];
        });
        save();
    }

    async function init() {
        matchesEl.innerHTML = '<p class="tk-status">Loading matches...</p>';
        try {
            const res = await fetch(DATA_URL, { cache: 'no-cache' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            VENUE = data.venue;
            BOOKING_FEE = Number(data.bookingFee) || 0;
            MAX_PER_CATEGORY = Number(data.maxPerCategory) || 8;
            CATEGORIES = data.categories;
            MATCHES = data.matches;
        } catch (err) {
            console.error('Could not load ' + DATA_URL, err);
            matchesEl.innerHTML = '<p class="tk-status">We could not load the matches. Reload the page or try again in a few minutes.</p>';
            return;
        }

        pruneCart();
        matchesEl.innerHTML = MATCHES.length
            ? MATCHES.map(matchHTML).join('')
            : '<p class="tk-status">No home matches are on sale right now. Check back soon.</p>';
        refreshSteppers();
        route();
    }

    init();
})();