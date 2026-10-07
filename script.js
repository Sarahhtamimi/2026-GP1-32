const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];


// ==========================================
// PAGE NAVIGATION
// ==========================================

$$('[data-go]').forEach(
  b => b.onclick = () =>
    $(b.dataset.go)?.scrollIntoView({
      behavior: 'smooth'
    })
);

$$('[data-page]').forEach(
  b => b.onclick = () =>
    location.href = b.dataset.page
);


// ==========================================
// REVEAL ANIMATIONS
// ==========================================

const reveals = $$('.reveal');

if (reveals.length) {

  const ro = new IntersectionObserver(
    es => es.forEach(e => {

      if (e.isIntersecting) {
        e.target.classList.add('in');
      }

    }),
    {
      threshold: .16
    }
  );

  reveals.forEach(
    x => ro.observe(x)
  );

}


// ==========================================
// HERO DASHBOARD EFFECT
// ==========================================

const hero = $('#productHero');
const dash = $('#dashboard');

if (hero && dash) {

  hero.addEventListener(
    'pointermove',
    e => {

      if (innerWidth < 900) return;

      const r =
        hero.getBoundingClientRect();

      const x =
        (e.clientX - r.left) /
        r.width - .5;

      const y =
        (e.clientY - r.top) /
        r.height - .5;

      dash.style.transform =
        `rotateY(${x * 7 - 3}deg)
         rotateX(${-y * 5 + 1}deg)
         translate3d(${x * 7}px, ${y * 6}px, 0)`;

    }
  );


  hero.addEventListener(
    'pointerleave',
    () => {

      dash.style.transform =
        'rotateY(-5deg) rotateX(2deg)';

    }
  );

}


// ==========================================
// STORY / SCROLL PROGRESS
// ==========================================

const story = $('#story');
const steps = $$('.step');
const nodes = $$('.node');
const fill = $('#roadFill');
const counter = $('#counter');


function storyUpdate() {

  const max =
    document.documentElement.scrollHeight -
    innerHeight;


  const sb =
    $('#scrollbar');


  if (sb) {

    sb.style.width =
      (max > 0
        ? scrollY / max * 100
        : 0) + '%';

  }


  if (!story) return;


  const r =
    story.getBoundingClientRect();


  const travel =
    story.offsetHeight -
    innerHeight;


  const p =
    Math.max(
      0,
      Math.min(
        1,
        -r.top /
        Math.max(1, travel)
      )
    );


  const idx =
    Math.min(
      3,
      Math.floor(p * 4)
    );


  if (fill) {

    fill.style.height =
      (p * 100) + '%';

  }


  if (counter) {

    counter.textContent =
      String(idx + 1)
        .padStart(2, '0');

  }


  steps.forEach(
    (s, i) => {

      s.classList.toggle(
        'active',
        i === idx
      );

      s.classList.toggle(
        'past',
        i < idx
      );

    }
  );


  nodes.forEach(
    (n, i) =>
      n.classList.toggle(
        'on',
        i <= idx
      )
  );

}


addEventListener(
  'scroll',
  storyUpdate,
  {
    passive: true
  }
);

storyUpdate();


// ==========================================
// NAVBAR COMPACT MODE
// ==========================================

const sigNav =
  $('#signatureNav');


function navCompact() {

  sigNav?.classList.toggle(
    'is-compact',
    scrollY > 45
  );

}


addEventListener(
  'scroll',
  navCompact,
  {
    passive: true
  }
);

navCompact();


// ==========================================
// THEME
// ==========================================

const themeRoot =
  document.documentElement;

const themeButton =
  $('#themeToggle');


function applyTheme(theme) {

  const dark =
    theme === 'dark';


  themeRoot.classList.toggle(
    'dark',
    dark
  );


  if (themeButton) {

    themeButton.setAttribute(
      'aria-pressed',
      String(dark)
    );


    themeButton.setAttribute(
      'aria-label',
      dark
        ? 'Switch to light mode'
        : 'Switch to dark mode'
    );

  }


  try {

    localStorage.setItem(
      'siaq-theme',
      dark
        ? 'dark'
        : 'light'
    );

  } catch (e) {}


  const pt =
    $('#profileTheme');


  if (pt) {

    pt.textContent =
      dark
        ? 'Dark'
        : 'Light';

  }

}


themeButton?.addEventListener(
  'click',
  () =>
    applyTheme(
      themeRoot.classList.contains('dark')
        ? 'light'
        : 'dark'
    )
);


applyTheme(
  themeRoot.classList.contains('dark')
    ? 'dark'
    : 'light'
);


// ==========================================
// PASSWORD SHOW / HIDE
// ==========================================

$$('[data-password]').forEach(
  btn =>
    btn.addEventListener(
      'click',
      () => {

        const input =
          document.getElementById(
            btn.dataset.password
          );


        if (!input) return;


        const show =
          input.type === 'password';


        input.type =
          show
            ? 'text'
            : 'password';


        btn.textContent =
          show
            ? 'HIDE'
            : 'SHOW';

      }
    )
);


// ==========================================
// WORKSPACE DEMO
// ==========================================

const run =
  $('.workspaceBody aside .run');


run?.addEventListener(
  'click',
  () => {

    run.textContent =
      'Generating…';


    setTimeout(
      () => {

        run.textContent =
          'Generate comparison →';


        const ps =
          $$('.responses p');


        if (ps[0]) {

          ps[0].textContent =
            'It sounds like you have a lot to manage this week. Breaking the work into smaller priorities may make it feel more manageable.';

        }


        if (ps[1]) {

          ps[1].textContent =
            'That sounds overwhelming. We can organize what needs attention first, while keeping the plan realistic for the time you have.';

        }


        $('#resultPanel')
          ?.classList.add('show');

      },
      650
    );

  }
);