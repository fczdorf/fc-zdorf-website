(() => {
    const app = document.getElementById('app');
    const AUTOPLAY_MS = 5000;

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

    const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const fmt = d => dateFmt.format(new Date(d));

    const backLink = () => {
        const a = el('a', 'back', '← All news');
        a.href = './news.html';
        return a;
    };

    /* ---- list: news.html ---- */
    function renderList(list) {
        document.title = 'News · 1. FC Zdorf';

        const grid = el('div', 'news-grid');
        grid.append(...list.map(n => {
            const card = el('a', 'news-card');
            card.href = `./news.html?news=${encodeURIComponent(n.id)}`;

            const thumb = el('div', 'thumb');
            const first = (n.images || [])[0];
            if (first) {
                const img = el('img');
                img.src = first.src;
                img.alt = '';
                img.loading = 'lazy';
                img.onerror = () => img.remove();
                thumb.append(img);
            }

            const body = el('div', 'card-body');
            const time = el('time', null, fmt(n.date));
            time.dateTime = n.date;
            body.append(time, el('h3', null, n.title), el('p', null, n.summary || ''));

            card.append(thumb, body);
            return card;
        }));

        app.replaceChildren(el('h1', null, 'News'), list.length ? grid : el('p', 'empty', 'No news yet.'));
    }

    /* ---- carousel ---- */
    function buildCarousel(images) {
        const box = el('div', 'carousel');
        box.setAttribute('role', 'region');
        box.setAttribute('aria-roledescription', 'carousel');
        box.setAttribute('aria-label', 'Article photos');

        const track = el('div', 'track');
        images.forEach((im, i) => {
            const slide = el('figure', 'slide');
            slide.setAttribute('role', 'group');
            slide.setAttribute('aria-label', `${i + 1} of ${images.length}`);

            const img = el('img');
            img.src = im.src;
            img.alt = im.alt || '';
            if (i) img.loading = 'lazy';
            img.onerror = () => img.remove();
            slide.append(img);

            if (im.caption) slide.append(el('figcaption', null, im.caption));
            track.append(slide);
        });
        box.append(track);
        if (images.length < 2) return box;

        const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
        let index = 0, timer = null;

        const dots = el('div', 'dots');
        const dotBtns = images.map((_, n) => {
            const b = el('button');
            b.type = 'button';
            b.setAttribute('aria-label', `Go to photo ${n + 1}`);
            b.onclick = () => { go(n); restart(); };
            dots.append(b);
            return b;
        });

        const prev = el('button', 'cbtn prev', '‹');
        const next = el('button', 'cbtn next', '›');
        prev.type = next.type = 'button';
        prev.setAttribute('aria-label', 'Previous photo');
        next.setAttribute('aria-label', 'Next photo');
        prev.onclick = () => { go(index - 1); restart(); };
        next.onclick = () => { go(index + 1); restart(); };
        box.append(prev, next, dots);

        function go(n) {
            index = (n + images.length) % images.length;
            track.style.transform = `translateX(${-100 * index}%)`;
            dotBtns.forEach((b, k) => b.setAttribute('aria-current', k === index ? 'true' : 'false'));
        }

        const stop = () => { clearInterval(timer); timer = null; };
        const start = () => {
            if (reduceMotion.matches || timer || document.hidden) return;
            timer = setInterval(() => go(index + 1), AUTOPLAY_MS);
        };
        const restart = () => { stop(); start(); };

        box.addEventListener('mouseenter', stop);
        box.addEventListener('mouseleave', start);
        box.addEventListener('focusin', stop);
        box.addEventListener('focusout', start);
        document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

        box.tabIndex = 0;
        box.addEventListener('keydown', e => {
            if (e.key === 'ArrowLeft') { go(index - 1); restart(); }
            if (e.key === 'ArrowRight') { go(index + 1); restart(); }
        });

        let x0 = null;
        box.addEventListener('pointerdown', e => { x0 = e.clientX; });
        box.addEventListener('pointerup', e => {
            if (x0 == null) return;
            const dx = e.clientX - x0;
            x0 = null;
            if (Math.abs(dx) > 50) { go(index + (dx < 0 ? 1 : -1)); restart(); }
        });

        go(0);
        start();
        return box;
    }

    /* ---- article body: data/articles/<name>.md (Markdown, raw HTML allowed) ---- */
    const escapeHtml = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Used only if the Markdown library failed to load: blank line = new paragraph
    const plainToHtml = t => t.trim().split(/\n\s*\n/)
        .map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('');

    async function loadBody(n) {
        if (!n.content) return n.body || ''; // old-style inline HTML still works
        const res = await fetch(n.content);
        if (!res.ok) throw new Error(`${n.content} → ${res.status}`);
        const text = await res.text();
        return window.marked ? marked.parse(text) : plainToHtml(text);
    }

    /* ---- single article: news.html?news=<id> ---- */
    function renderArticle(n) {
        document.title = `${n.title} · 1. FC Zdorf`;

        const art = el('article', 'article');
        art.append(backLink());
        if ((n.images || []).length) art.append(buildCarousel(n.images));

        const time = el('time', null, fmt(n.date));
        time.dateTime = n.date;

        const body = el('div', 'article-body');
        body.append(el('p', 'empty', 'Loading…'));

        art.append(time, el('h1', null, n.title), body);
        app.replaceChildren(art);

        loadBody(n)
            .then(html => { body.innerHTML = html; }) // HTML is allowed here
            .catch(err => {
                console.error('Could not load article:', err);
                body.replaceChildren(el('p', 'empty', 'Could not load this article.'));
            });
    }

    function renderMissing() {
        document.title = 'Not found · 1. FC Zdorf';
        app.replaceChildren(
            backLink(),
            el('h1', null, 'Article not found'),
            el('p', 'empty', 'That article does not exist or was removed.')
        );
    }

    /* ---- boot ---- */
    fetchJSON('./data/news.json')
        .then(list => {
            list.sort((a, b) => b.date.localeCompare(a.date));
            const id = new URLSearchParams(location.search).get('news');
            if (id == null) return renderList(list);
            const article = list.find(n => String(n.id) === id);
            article ? renderArticle(article) : renderMissing();
        })
        .catch(err => {
            console.error('Could not load news:', err);
            app.replaceChildren(el('p', 'empty', 'Could not load the news right now.'));
        });
})();