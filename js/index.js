(() => {
    const TEAM = '1. FC Zdorf';
    const MAX_RESULTS = 4;
    const MAX_NEWS = 3;

    const el = (tag, cls, text) => {
        const n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    };

    const fetchJSON = async url => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${url} → ${res.status}`);
        return res.json();
    };

    /* ---- news (latest articles from data/news.json) ---- */
    const newsDateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    function renderNews(list) {
        const box = document.getElementById('home-news');
        if (!box) return;

        if (list.length === 0) {
            box.replaceChildren(el('p', null, 'No news yet.'));
            return;
        }

        const cards = [...list]
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, MAX_NEWS)
            .map((n, i) => {
                const card = el('article', i === 0 ? 'card feature' : 'card');

                const time = el('time', null, newsDateFmt.format(new Date(n.date)));
                time.dateTime = n.date;

                const link = el('a', null, 'Read more');
                link.href = `./news.html?news=${encodeURIComponent(n.id)}`;

                card.append(time, el('h3', null, n.title), el('p', null, n.summary || ''), link);
                return card;
            });

        box.replaceChildren(...cards);
    }

    /* ---- players ---- */
    function renderPlayers(players) {
        const track = document.querySelector('.players-track');
        if (!track) return;

        track.replaceChildren(...players.map(p => {
            const card = el('article', 'player');

            const photo = el('div', 'photo');
            const img = el('img');
            img.src = p.photo;
            img.alt = `Portrait of ${p.name}`;
            img.loading = 'lazy';
            photo.append(img, el('span', 'number', p.number));

            card.append(photo, el('h3', null, p.name), el('p', null, p.position));
            return card;
        }));
    }

    /* ---- next match ---- */
    function renderNextMatch(data) {
        const bar = document.getElementById('tickets');
        if (!bar) return;

        const now = new Date();
        const next = [...data.matches]
            .filter(m => new Date(m.kickoff) > now)
            .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff))[0];

        if (!next) return; // no upcoming match: bar stays hidden

        const kickoff = new Date(next.kickoff);
        const parts = Object.fromEntries(
            new Intl.DateTimeFormat('en-GB', {
                weekday: 'short', day: 'numeric', month: 'short',
                hour: '2-digit', minute: '2-digit', hour12: false
            }).formatToParts(kickoff).map(p => [p.type, p.value])
        );

        const left = Object.values(next.available || {}).reduce((a, b) => a + b, 0);
        const label = `${parts.weekday} ${parts.day} ${parts.month}, ${parts.hour}:${parts.minute} · ${data.venue}`
            + (left <= 0 ? ' · Sold out' : '');

        bar.querySelector('.teams').replaceChildren(TEAM, el('i', null, 'vs'), next.opponent);

        const time = bar.querySelector('time');
        time.dateTime = next.kickoff;
        time.textContent = label;

        bar.hidden = false;
    }

    /* ---- games ---- */
    const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

    function renderGames(games) {
        const box = document.getElementById('results');
        if (!box) return;

        if (games.length == 0) {
            box.innerHTML = "<p>No Recent Matches</p>"
            return
        }

        const rows = [...games]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, MAX_RESULTS)
            .map(g => {
                const ours = g.home === TEAM ? g.homeScore : g.awayScore;
                const theirs = g.home === TEAM ? g.awayScore : g.homeScore;
                const outcome = ours > theirs ? 'w' : ours < theirs ? 'l' : '';

                const row = el('div', 'res');
                row.append(
                    el('span', 'd', dateFmt.format(new Date(g.date))),
                    el('span', null, `${g.home} – ${g.away}`),
                    el('span', `score ${outcome}`.trim(), `${g.homeScore} : ${g.awayScore}`)
                );
                return row;
            });

        box.replaceChildren(...rows);
    }

    /* ---- carousel (unchanged, just wrapped) ---- */
    function initCarousel() {
        const track = document.querySelector('.players-track');
        const dotsWrap = document.querySelector('.players-dots');
        if (!track || !dotsWrap || !track.children.length) return;

        const INTERVAL = 2500;
        const PAUSE_AFTER_TOUCH = 6000;
        const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
        const cards = [...track.children];
        let hovering = false, focused = false, lastInteraction = 0;
        let step = 0, max = 0, positions = 1, dots = [];

        const markInteraction = () => (lastInteraction = Date.now());

        function measure() {
            const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
            step = cards[0].getBoundingClientRect().width + gap;
            max = track.scrollWidth - track.clientWidth;
            const count = max > 2 ? Math.ceil(max / step - 0.05) + 1 : 1;
            if (count !== positions || dots.length !== count) {
                positions = count;
                buildDots();
            }
            dotsWrap.hidden = positions <= 1;
            updateActive();
        }

        function buildDots() {
            dotsWrap.replaceChildren();
            dots = Array.from({ length: positions }, (_, i) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.setAttribute('aria-label', `Go to slide ${i + 1} of ${positions}`);
                b.addEventListener('click', () => {
                    markInteraction();
                    track.scrollTo({
                        left: Math.min(i * step, max),
                        behavior: reduceMotion.matches ? 'auto' : 'smooth'
                    });
                });
                dotsWrap.appendChild(b);
                return b;
            });
        }

        function currentIndex() {
            if (track.scrollLeft >= max - 2) return positions - 1;
            return Math.min(positions - 1, Math.round(track.scrollLeft / step));
        }

        function updateActive() {
            const active = currentIndex();
            dots.forEach((d, i) => d.setAttribute('aria-current', i === active ? 'true' : 'false'));
        }

        let ticking = false;
        track.addEventListener('scroll', () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => { updateActive(); ticking = false; });
        }, { passive: true });

        new ResizeObserver(measure).observe(track);
        measure();

        track.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hovering = true; });
        track.addEventListener('pointerleave', () => (hovering = false));
        track.addEventListener('focusin', () => (focused = true));
        track.addEventListener('focusout', () => (focused = false));
        ['touchstart', 'wheel', 'keydown'].forEach(ev =>
            track.addEventListener(ev, markInteraction, { passive: true }));

        setInterval(() => {
            if (positions <= 1 || reduceMotion.matches || hovering || focused || document.hidden) return;
            if (Date.now() - lastInteraction < PAUSE_AFTER_TOUCH) return;

            const atEnd = track.scrollLeft >= max - 2;
            track.scrollTo({ left: atEnd ? 0 : Math.min(track.scrollLeft + step, max), behavior: 'smooth' });
        }, INTERVAL);
    }

    /* ---- boot ---- */
    fetchJSON('./data/news.json')
        .then(renderNews)
        .catch(err => {
            console.error('Could not load news:', err);
            const box = document.getElementById('home-news');
            if (box) box.replaceChildren(el('p', null, 'News is unavailable right now.'));
        });

    fetchJSON('./data/tickets.json')
        .then(renderNextMatch)
        .catch(err => console.error('Could not load tickets:', err));

    fetchJSON('./data/players.json')
        .then(renderPlayers)
        .then(initCarousel)
        .catch(err => console.error('Could not load players:', err));

    fetchJSON('./data/games.json')
        .then(renderGames)
        .catch(err => console.error('Could not load games:', err));
})();