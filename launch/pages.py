#!/usr/bin/env python3
"""Writes the landing page in English (/) and Spanish (/es/). Run: python3 launch/pages.py
OPEN = False while Neusic Studio is invite-only (the page asks for an invite); set it to True on launch day and run again."""
import os
OPEN = True
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
STUDIO = 'https://studio.neusicwave.com/'
T = {
 'en': dict(path='index.html', url='https://neusicwave.com/', other=('/es/', 'Español', 'es'), locale='en_US',
  title='Neusic Studio: make a beat in your browser | NeusicWave',
  desc='Neusic Studio is a music studio that runs in your browser: drum patterns, 18 genre starters, recording and WAV export, on a phone, tablet or computer. Free to make music.',
  og_t='Neusic Studio: make a beat in your browser', og_d='A music studio in your browser. Nothing to install. Free to make music.',
  skip='Skip to content', nav=('What is inside', 'Prices', 'Books'), books='/books/', open='Open Neusic Studio', ask='Request an invite', see='See the prices',
  h1='Make a beat right here.', lead='Tap the pads, press play. This small board is a taste. Neusic Studio is the whole music studio, in your browser, with nothing to install.',
  nogl='The pad board needs WebGL, which this browser has turned off.', rows=('Kick', 'Snare', 'Hat', 'Rim'), play='Play', stop='Stop', clear='Clear', hint='Eight steps, four drums. Tap any pad.',
  in_h='What is inside the studio',
  inside=[('Genre starters', 'Eighteen of them. Pick reggaeton, bachata, salsa, hip hop, dancehall or another, and a beat is playing.'), ('Drum patterns', 'Step grids like the one above, for every drum track.'),
          ('Arrange and record', 'Lay parts out on a timeline, and record your voice or an instrument over them.'), ('Real sounds', 'A sampled bass and upright piano are built in, and you can load your own SoundFont files.'),
          ('Export', 'Your finished track as a WAV file. What you make is yours.'), ('Any screen', 'Phone, tablet or computer. It opens in the browser you already have.')],
  pr_h='Free to make. Pay to keep.',
  plans=[('Free', '$0', '', ['Every instrument, pattern, genre and recording tool', 'Nothing is saved when you close it', 'No export']),
         ('Session Pass', '$5', 'for 24 hours', ['Save, reopen and export for a day', 'When it ends, your projects stay in your browser, locked, until you get another pass or Studio']),
         ('Studio', '$50', 'once', ['Save and reopen your projects', 'Export any time', 'Every update we release', '$45 if you bought a pass in the last 30 days'])],
  fine='Prices in US dollars. Secure checkout by Stripe. Refunds within 14 days: see the <a href="https://studio.neusicwave.com/terms">Terms of Use</a>.',
  inv_h='It is invite-only for now.', inv_p='Neusic Studio is in a private preview. Leave your email and an invite link arrives when there is room.',
  inv_ph='you@example.com', inv_note='What do you make? (optional)',
  inv_fine='We keep your email, your note and your country for up to 90 days, only to send you an invite. Ask us to delete it any time. <a href="https://studio.neusicwave.com/privacy">Privacy</a>',
  m_bad='That email address looks incomplete. Check it and try again.', m_off='You seem to be offline. Reconnect and try again.', m_send='Sending…', m_fail='We could not send that just now. Try again in a minute.', m_ok='Thanks. When there is room, your invite link will arrive by email.',
  bk_h='Also from NeusicWave', bk='<b>Monetize Your Music.</b> Stop performing. Start owning. <a href="/books/">About the book</a> · <a href="https://www.amazon.com/dp/B0H962CWC6" rel="noopener">On Amazon</a>',
  terms='Terms of Use', privacy='Privacy Policy'),
 'es': dict(path='es/index.html', url='https://neusicwave.com/es/', other=('/', 'English', 'en'), locale='es_LA',
  title='Neusic Studio: haz un beat en tu navegador | NeusicWave',
  desc='Neusic Studio es un estudio de música que funciona en tu navegador: patrones de batería, 18 géneros para empezar, grabación y exportación en WAV, en teléfono, tableta o computadora. Hacer música es gratis.',
  og_t='Neusic Studio: haz un beat en tu navegador', og_d='Un estudio de música en tu navegador. Sin instalar nada. Hacer música es gratis.',
  skip='Saltar al contenido', nav=('Qué trae', 'Precios', 'Libros'), books='/books/', open='Abrir Neusic Studio', ask='Pide una invitación', see='Ver los precios',
  h1='Haz un beat aquí mismo.', lead='Toca los pads y dale a reproducir. Este tablero es una probadita. Neusic Studio es el estudio completo, en tu navegador, sin instalar nada.',
  nogl='El tablero necesita WebGL, que este navegador tiene apagado.', rows=('Bombo', 'Caja', 'Hi-hat', 'Aro'), play='Reproducir', stop='Parar', clear='Borrar', hint='Ocho pasos, cuatro tambores. Toca cualquier pad.',
  in_h='Qué trae el estudio',
  inside=[('Géneros para empezar', 'Dieciocho. Elige reguetón, bachata, salsa, hip hop, dancehall u otro, y ya suena un beat.'), ('Patrones de batería', 'Cuadrículas de pasos como la de arriba, para cada pista de batería.'),
          ('Arregla y graba', 'Ordena las partes en una línea de tiempo y graba tu voz o un instrumento encima.'), ('Sonidos reales', 'Trae un bajo y un piano vertical sampleados, y puedes cargar tus propios archivos SoundFont.'),
          ('Exporta', 'Tu tema terminado en un archivo WAV. Lo que haces es tuyo.'), ('Cualquier pantalla', 'Teléfono, tableta o computadora. Se abre en el navegador que ya tienes.')],
  pr_h='Hacer es gratis. Guardar se paga.',
  plans=[('Gratis', '$0', '', ['Todos los instrumentos, patrones, géneros y la grabación', 'Nada se guarda al cerrar', 'Sin exportar']),
         ('Pase de sesión', '$5', 'por 24 horas', ['Guarda, reabre y exporta durante un día', 'Al terminar, tus proyectos quedan en tu navegador, bloqueados, hasta que tengas otro pase o Studio']),
         ('Studio', '$50', 'una sola vez', ['Guarda y reabre tus proyectos', 'Exporta cuando quieras', 'Todas las actualizaciones', '$45 si compraste un pase en los últimos 30 días'])],
  fine='Precios en dólares de EE. UU. Pago seguro con Stripe. Reembolsos dentro de 14 días: mira los <a href="https://studio.neusicwave.com/terms">Términos de uso</a> (en inglés).',
  inv_h='Por ahora es solo con invitación.', inv_p='Neusic Studio está en vista previa privada. Deja tu correo y te llega un enlace de invitación cuando haya lugar.',
  inv_ph='tu@correo.com', inv_note='¿Qué música haces? (opcional)',
  inv_fine='Guardamos tu correo, tu nota y tu país hasta 90 días, solo para enviarte la invitación. Pídenos borrarlo cuando quieras. <a href="https://studio.neusicwave.com/privacy">Privacidad</a> (en inglés)',
  m_bad='Ese correo parece incompleto. Revísalo e inténtalo otra vez.', m_off='Parece que no tienes conexión. Conéctate e inténtalo otra vez.', m_send='Enviando…', m_fail='No pudimos enviarlo ahora. Inténtalo en un minuto.', m_ok='Gracias. Cuando haya lugar, tu enlace de invitación llegará por correo.',
  bk_h='También de NeusicWave', bk='<b>Monetize Your Music.</b> Deja de actuar. Empieza a ser dueño. <a href="/books/">Sobre el libro</a> · <a href="https://www.amazon.com/dp/B0H962CWC6" rel="noopener">En Amazon</a> (en inglés)',
  terms='Términos de uso', privacy='Política de privacidad'),
}
def page(lang, t):
    go = f'<a class="btn go" href="{STUDIO}">{t["open"]}</a>' if OPEN else f'<a class="btn go" href="#invite">{t["ask"]}</a>'
    inside = ''.join(f'<li><b>{a}</b><span>{b}</span></li>' for a, b in t['inside'])
    def plan(i, n, p, s, li):
        best = ' class="best"' if i == 2 else ''
        small = f' <small>{s}</small>' if s else ''
        return f'<article{best}><h3>{n}</h3><p class="price">{p}{small}</p><ul>' + ''.join(f'<li>{x}</li>' for x in li) + '</ul></article>'
    plans = ''.join(plan(i, *x) for i, x in enumerate(t['plans']))
    invite = '' if OPEN else f'''
    <section class="invite" id="invite" aria-labelledby="invite-h">
      <h2 id="invite-h">{t["inv_h"]}</h2>
      <p class="lead">{t["inv_p"]}</p>
      <form class="notify" action="{STUDIO}_api/request-invite" method="POST" novalidate data-bad="{t["m_bad"]}" data-off="{t["m_off"]}" data-send="{t["m_send"]}" data-fail="{t["m_fail"]}" data-ok="{t["m_ok"]}">
        <div class="field"><input id="email" name="email" type="email" inputmode="email" autocomplete="email" placeholder="{t["inv_ph"]}" aria-label="Email" required /><button class="btn go" type="submit">{t["ask"]}</button></div>
        <div class="field"><input id="note" name="note" type="text" maxlength="300" autocomplete="off" placeholder="{t["inv_note"]}" aria-label="{t["inv_note"]}" /></div>
        <input class="hp" name="website" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" />
        <p class="fine">{t["inv_fine"]}</p>
        <p class="form-status" role="status" aria-live="polite"></p>
      </form>
    </section>
'''
    inv_js = '' if OPEN else '\n  <script src="/scripts/site/invite.js?v=1" defer></script>'
    home = '/' if lang == 'en' else '/es/'
    return f'''<!doctype html>
<html lang="{lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#e4e7ec" />
  <title>{t["title"]}</title>
  <meta name="description" content="{t["desc"]}" />
  <link rel="canonical" href="{t["url"]}" />
  <link rel="alternate" hreflang="en" href="https://neusicwave.com/" />
  <link rel="alternate" hreflang="es" href="https://neusicwave.com/es/" />
  <link rel="alternate" hreflang="x-default" href="https://neusicwave.com/" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="NeusicWave" />
  <meta property="og:locale" content="{t["locale"]}" />
  <meta property="og:url" content="{t["url"]}" />
  <meta property="og:title" content="{t["og_t"]}" />
  <meta property="og:description" content="{t["og_d"]}" />
  <meta property="og:image" content="https://neusicwave.com/social/neusicwave-share-v6.jpg" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="{t["og_t"]}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{t["og_t"]}" />
  <meta name="twitter:description" content="{t["og_d"]}" />
  <meta name="twitter:image" content="https://neusicwave.com/social/neusicwave-share-v6.jpg" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="icon" href="/favicon.png" type="image/png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="preload" href="/assets/fonts/archivo-latin.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="stylesheet" href="/css/site/launch.css?v=2" />
</head>
<body>
  <a class="skip" href="#main">{t["skip"]}</a>
  <header class="top">
    <a class="brand" href="{home}"><img src="/assets/site/logo.jpg" alt="" width="40" height="40" /><span>NeusicWave</span></a>
    <nav aria-label="Main"><a href="#inside">{t["nav"][0]}</a><a href="#prices">{t["nav"][1]}</a><a href="{t["books"]}">{t["nav"][2]}</a></nav>
    <a class="lang" href="{t["other"][0]}" hreflang="{t["other"][2]}" lang="{t["other"][2]}">{t["other"][1]}</a>
    {go}
  </header>

  <main id="main">
    <section class="hero" aria-labelledby="title">
      <div class="say">
        <p class="kicker">Neusic Studio</p>
        <h1 id="title">{t["h1"]}</h1>
        <p class="lead">{t["lead"]}</p>
        <p class="acts">{go}<a class="btn" href="#prices">{t["see"]}</a></p>
      </div>
      <div class="board">
        <div class="well">
          <canvas id="pads" aria-hidden="true"></canvas>
          <p class="nogl">{t["nogl"]}</p>
          <ol class="rows" aria-hidden="true">{"".join(f"<li>{r}</li>" for r in t["rows"])}</ol>
        </div>
        <p class="keys"><button id="play" class="btn round" type="button" aria-pressed="false" data-play="{t["play"]}" data-stop="{t["stop"]}"><i aria-hidden="true"></i><span>{t["play"]}</span></button><button id="clear" class="btn" type="button">{t["clear"]}</button><span class="hint">{t["hint"]}</span></p>
      </div>
    </section>
{invite}
    <section class="inside" id="inside" aria-labelledby="inside-h">
      <h2 id="inside-h">{t["in_h"]}</h2>
      <ul>{inside}</ul>
    </section>

    <section class="prices" id="prices" aria-labelledby="prices-h">
      <h2 id="prices-h">{t["pr_h"]}</h2>
      <div class="plans">{plans}</div>
      <p class="acts">{go}</p>
      <p class="fine">{t["fine"]}</p>
    </section>

    <section class="book" aria-labelledby="book-h">
      <h2 id="book-h">{t["bk_h"]}</h2>
      <p>{t["bk"]}</p>
    </section>
  </main>

  <footer class="foot">
    <p>NeusicWave · <a href="mailto:hello@neusicwave.com">hello@neusicwave.com</a></p>
    <p><a href="https://studio.neusicwave.com/terms">{t["terms"]}</a><a href="https://studio.neusicwave.com/privacy">{t["privacy"]}</a><a href="https://www.tiktok.com/@neusicwave1" rel="me noopener">TikTok</a><a href="https://www.instagram.com/neusicwave/" rel="me noopener">Instagram</a></p>
  </footer>
  <script type="module" src="/scripts/site/pads.js?v=2"></script>{inv_js}
</body>
</html>
'''
for lang, t in T.items():
    p = os.path.join(ROOT, t['path']); os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w', encoding='utf-8').write(page(lang, t)); print(t['path'], 'written')
