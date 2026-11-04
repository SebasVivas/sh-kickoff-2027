(() => {
  "use strict";

  const raiz = document.documentElement;
  clearTimeout(window.__seguro);
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const pantallaAncha = matchMedia("(min-width: 480px) and (min-aspect-ratio: 1/1)");
  const sinMovimiento = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const conMouse = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const hayGsap = typeof window.gsap !== "undefined";

  /* ------------------------------------------------------------------ Reproductor ------ */
  const marco = $(".marco-video");
  const reproductor = $(".reproductor");
  const poster = $(".reproducir");
  let medio = null;
  let desbloqueando = false;
  let enCine = false;
  let videoPedido = false;

  const aviso = document.createElement("p");
  aviso.className = "aviso-video";
  aviso.setAttribute("role", "alert");
  aviso.textContent = "The video could not load. Check your connection and press play to try again.";

  function crearMedio() {
    const { tipo, fuente, cliente } = reproductor.dataset;
    if (tipo === "archivo") {
      const video = document.createElement("video");
      video.src = fuente;
      video.controls = true;
      video.playsInline = true;
      video.preload = "auto";
      video.poster = poster.querySelector("img").getAttribute("src");
      video.addEventListener("play", entrarCine);
      video.addEventListener("pause", salirCine);
      video.addEventListener("ended", alTerminarVideo);
      video.addEventListener("error", alFallarVideo);
      return video;
    }
    const marcoExterno = document.createElement("iframe");
    marcoExterno.title = "Video";
    marcoExterno.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media";
    marcoExterno.allowFullscreen = true;
    marcoExterno.dataset.src = tipo === "stream"
      ? `https://${cliente}.cloudflarestream.com/${fuente}/iframe?autoplay=true`
      : `https://www.youtube-nocookie.com/embed/${fuente}?autoplay=1&rel=0`;
    return marcoExterno;
  }

  function mostrarMedio() {
    medio = medio || crearMedio();
    videoPedido = true;
    desbloqueando = false;
    if (medio.dataset.src) {
      medio.src = medio.dataset.src;
      entrarCine();
    }
    reproductor.replaceChildren(medio);
    if (medio.play) {
      const este = medio;
      este.muted = false;
      este.play().catch((e) => {
        // Si el navegador no deja arrancar solo, vuelve el botón grande de play
        if (e.name === "NotAllowedError" && medio === este) {
          salirCine();
          restaurarReproductor();
        }
      });
      if (!este.paused) entrarCine();
    }
    medio.focus({ preventScroll: true });
  }

  /* Dentro del clic del invitado se arranca y se detiene el video: los navegadores quedan
     autorizados para reproducirlo con sonido cuando termine la animación. */
  function desbloquearSonido() {
    medio = crearMedio();
    videoPedido = false;
    if (!medio.play) return;
    const este = medio;
    desbloqueando = true;
    este.muted = true; // la autorización no debe oírse
    reproductor.prepend(este);
    este.play()
      .then(() => {
        // Con red lenta este primer arranque puede resolverse cuando el video ya debía estar corriendo
        if (videoPedido || medio !== este) return;
        este.pause();
        este.currentTime = 0;
      })
      .catch(() => {})
      .finally(() => { if (medio === este && !videoPedido) desbloqueando = false; });
  }

  function restaurarReproductor() {
    if (medio && medio.pause) {
      medio.removeEventListener("play", entrarCine);
      medio.removeEventListener("pause", salirCine);
      medio.removeEventListener("ended", alTerminarVideo);
      medio.removeEventListener("error", alFallarVideo);
      medio.pause();
    }
    medio = null;
    enCine = false;
    videoPedido = false;
    desbloqueando = false;
    reproductor.replaceChildren(poster);
  }

  function alTerminarVideo() {
    salirCine();
    restaurarReproductor();
  }

  function alFallarVideo() {
    desbloqueando = false;
    salirCine();
    restaurarReproductor();
    reproductor.append(aviso);
  }

  function entrarCine() {
    if (desbloqueando || !hayGsap) return;
    enCine = true;
    const aplicar = () => {
      gsap.to(".atenuar", { autoAlpha: .72, duration: .7, ease: "power2.out", overwrite: "auto" });
      gsap.to(marco, { rotationX: 0, rotationY: 0, scale: pantallaAncha.matches ? 1.07 : 1, duration: .9, ease: "expo.out", overwrite: "auto" });
    };
    if (ctx) ctx.add(aplicar); else aplicar();
  }

  function salirCine() {
    if (desbloqueando || !hayGsap) return;
    enCine = false;
    const aplicar = () => {
      gsap.to(".atenuar", { autoAlpha: 0, duration: .6, ease: "power2.out", overwrite: "auto" });
      gsap.to(marco, { scale: 1, duration: .8, ease: "expo.out", overwrite: "auto" });
    };
    if (ctx) ctx.add(aplicar); else aplicar();
  }

  poster.addEventListener("click", mostrarMedio);
  $(".atenuar").addEventListener("click", () => {
    if (medio && medio.pause) medio.pause();
    salirCine();
  });

  if (!hayGsap) {
    raiz.classList.add("listo");
    $(".revision").hidden = true;
    return;
  }

  // Las capas se quedan siempre en la tarjeta gráfica. Con el modo automático de GSAP cada movimiento
  // del mouse las sacaba y las volvía a meter, y el navegador redibujaba todo el fondo: de ahí el parpadeo.
  gsap.config({ force3D: true });

  /* ------------------------------------------------------------------ Estado común ------ */
  let ctx = null;
  let linea = null;
  let introActual = null;
  let limpiezas = [];
  let parallaxActivo = false;

  const horizonte = () => (pantallaAncha.matches ? .5967 : .6765);
  const origenMundo = () => `50% ${horizonte() * 100}%`;

  function estadoBase() {
    gsap.set(".merida", { autoAlpha: 0 });
    gsap.set(marco, { autoAlpha: 0, transformPerspective: 1400 });
    gsap.set(".bloque-riso", { autoAlpha: 0 });
    gsap.set(".identidad > *", { autoAlpha: 0, y: 24 });
    gsap.set(".ave", { autoAlpha: 0 });
    gsap.set(".fronda", { autoAlpha: 0 });
  }

  /* La cámara avanza: todo nace cerca del punto de fuga y lo cercano viaja más. */
  function flujoMundo(tl, t, { fuerza = 1, dur = 2.4, ease = "expo.out" } = {}) {
    const origen = origenMundo();
    [[".capa-sol", .95], [".capa-fondo", .9], [".capa-medio", .76], [".capa-cerca", .6], [".capa-hamaca", .6], [".capa-frente", .4]]
      .forEach(([capa, escala]) => {
        tl.fromTo(capa, { scale: 1 - (1 - escala) * fuerza, transformOrigin: origen }, { scale: 1, duration: dur, ease }, t);
      });
  }

  function entrarFrondas(tl, t) {
    tl.set(".fronda", { autoAlpha: 1 }, t)
      .fromTo(".fronda-izquierda", { xPercent: -48, yPercent: -60, rotation: -18 }, { xPercent: 0, yPercent: 0, rotation: 0, duration: 1.5, ease: "expo.out" }, t)
      .fromTo(".fronda-derecha", { xPercent: 48, yPercent: -60, rotation: 18 }, { xPercent: 0, yPercent: 0, rotation: 0, duration: 1.5, ease: "expo.out" }, t + .07);
  }

  function entrarAves(tl, t, dx, dy) {
    tl.fromTo(".ave",
      { autoAlpha: 0, x: dx, y: dy, scale: .25, rotation: -18 },
      { autoAlpha: 1, x: 0, y: 0, scale: 1, rotation: 0, duration: 1.7, ease: "power3.out", stagger: .09 }, t);
  }

  function entrarLockup(tl, t) {
    const letrasM = $$(".merida .letra-m");
    tl.set(".merida", { autoAlpha: 1 }, t);
    if (!letrasM.length) {
      tl.fromTo(".merida", { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .8, ease: "power3.out" }, t);
      return;
    }
    tl.fromTo(letrasM,
      { autoAlpha: 0, y: 48, rotation: (i) => (i % 2 ? 7 : -7), transformOrigin: "50% 100%" },
      { autoAlpha: 1, y: 0, rotation: 0, duration: .8, ease: "back.out(2.2)", stagger: .06 }, t)
      .fromTo(".merida .letra-y",
        { autoAlpha: 0, scale: .1, transformOrigin: "50% 50%" },
        { autoAlpha: 1, scale: 1, duration: .5, ease: "back.out(3)", stagger: .04 }, t + .34)
      .fromTo(".merida .regla",
        { scaleX: 0, transformOrigin: "50% 50%" },
        { scaleX: 1, duration: .7, ease: "expo.out", stagger: .09 }, t + .55)
      .fromTo(".merida .lema",
        { autoAlpha: 0, y: 9 },
        { autoAlpha: 1, y: 0, duration: .45, ease: "power2.out", stagger: .07 }, t + .72);
  }

  function entrarBloque(tl, t) {
    const borde = parseFloat(getComputedStyle($(".bloque-riso")).top) || 8;
    tl.set(".bloque-riso", { autoAlpha: 1 }, t)
      .fromTo(".bloque-riso", { x: -borde, y: -borde }, { x: 0, y: 0, duration: .65, ease: "back.out(3)" }, t);
  }

  function entrarTextos(tl, t) {
    tl.to(".identidad > *", { autoAlpha: 1, y: 0, duration: .75, ease: "power3.out", stagger: .08 }, t);
  }

  /* ------------------------------------------------- Opción 1: las rejas ---------------- */
  function introRejas() {
    estadoBase();
    gsap.set(".rejas", { display: "block" });
    gsap.set(".capa-frente", { autoAlpha: 0 });

    const tl = gsap.timeline({ paused: true, onComplete: () => finalizar(true) });
    const t0 = .3;

    // El pestillo: la reja vibra antes de ceder
    tl.to(".letrero, .abrir-texto, .abrir-anillo", { autoAlpha: 0, y: -12, duration: .28, ease: "power2.in" }, 0)
      .to(".hoja-reja.izq", { x: -5, duration: .06, ease: "power1.inOut", repeat: 3, yoyo: true }, 0)
      .to(".hoja-reja.der", { x: 5, duration: .06, ease: "power1.inOut", repeat: 3, yoyo: true }, 0)
      .to(".hoja-reja", { backgroundColor: "rgba(2, 80, 71, 0)", duration: .5, ease: "power1.out" }, t0)
      .to(".hoja-reja.izq", { rotationY: 106, duration: 2.1, ease: "power2.inOut" }, t0)
      .to(".hoja-reja.der", { rotationY: -106, duration: 2.1, ease: "power2.inOut" }, t0)
      .to(".rejas-marco", { scale: 1.5, duration: 2.1, ease: "power2.in" }, t0)
      .set(".capa-frente", { autoAlpha: 1 }, t0 + .1)
      .set(".rejas", { display: "none" }, t0 + 2.1);

    flujoMundo(tl, t0 + .1, { dur: 2.5, ease: "power3.inOut" });
    entrarAves(tl, t0 + .75, -innerWidth * .3, innerHeight * .28);
    entrarFrondas(tl, t0 + 1.25);
    entrarLockup(tl, t0 + 1.35);

    tl.set(marco, { autoAlpha: 1 }, t0 + 1.7)
      .fromTo(marco, { y: innerHeight * .34, scale: .82, rotationX: 24 }, { y: 0, scale: 1, rotationX: 0, duration: 1.2, ease: "expo.out" }, t0 + 1.7);
    entrarBloque(tl, t0 + 2.25);
    entrarTextos(tl, t0 + 2.05);

    let abierta = false;
    const abrir = () => {
      if (abierta) return;
      abierta = true;
      desbloquearSonido();
      tl.play();
    };
    $(".abrir").addEventListener("click", abrir);
    limpiezas.push(() => $(".abrir").removeEventListener("click", abrir));
    $(".abrir").focus({ preventScroll: true });

    // Con la reja cerrada ya hay profundidad: al mover el mouse la escena se mueve detrás de los barrotes
    activarParallax(true);
    return tl;
  }

  /* ------------------------------------------------- Opción 2: el amanecer -------------- */
  function crearEstrellas() {
    const cielo = $(".noche-cielo");
    if (cielo.childElementCount) return;
    let semilla = 11;
    const azar = () => { semilla = (semilla * 9301 + 49297) % 233280; return semilla / 233280; };
    for (let i = 0; i < 120; i++) {
      const estrella = document.createElement("i");
      estrella.className = "estrella";
      const lado = 1 + azar() * 1.6;
      estrella.style.cssText = `left:${azar() * 100}%;top:${azar() * 100}%;width:${lado}px;height:${lado}px;opacity:${.35 + azar() * .65}`;
      cielo.append(estrella);
    }
  }

  function introAmanecer() {
    estadoBase();
    crearEstrellas();

    const escena = $(".escena").getBoundingClientRect();
    const mundo = $(".mundo").getBoundingClientRect();
    const sol = $(".capa-sol img").getBoundingClientRect();
    const sx = sol.left + sol.width / 2;
    const sy = sol.top + sol.width / 2; // en el KV el sol asoma cortado: el ancho es su diámetro
    const px = ((sx - mundo.left) / mundo.width) * 100;
    const py = ((sy - mundo.top) / mundo.height) * 100;
    const video = reproductor.getBoundingClientRect();
    const vx = video.left + video.width / 2;
    const vy = video.top + video.height / 2;
    const d = Math.min(sol.width * .7, video.height * .85);

    // Plano cerrado sobre el sol; al amanecer la cámara se abre hasta la composición final.
    const ancha = pantallaAncha.matches;
    const caja = $(".camara-escena").getBoundingClientRect();
    const escalaCss = ancha ? 1.05 : 1.03;
    const zoom = ancha ? 1.7 : 2.6;
    const centroX = caja.left + caja.width / 2;
    const centroY = caja.top + caja.height / 2;
    const metaX = Math.max(innerWidth * .5, innerWidth - zoom * (caja.right - sx));
    const metaY = innerHeight * (ancha ? .46 : .42);
    gsap.set(".camara-escena", {
      x: (metaX - centroX - zoom * (sx - centroX)) / escalaCss,
      y: (metaY - centroY - zoom * (sy - centroY)) / escalaCss,
      scale: zoom,
    });

    gsap.set(".noche-cielo, .noche, .sol-salida, .velo-noche", { autoAlpha: 1 });
    gsap.set(".mundo", { clipPath: `circle(0% at ${px}% ${py}%)` });
    gsap.set(".cielo", { backgroundColor: "#f6a9a0" });
    gsap.set(".orbe", { left: sx - d / 2, top: sy - d / 2, width: d, height: d, autoAlpha: 0 });
    gsap.set(".onda", { left: vx - video.height / 2, top: vy - video.height / 2, width: video.height, height: video.height, autoAlpha: 0 });
    [[".halo-rosa", sol.width * 1.5], [".halo-claro", sol.width * 1.2]].forEach(([halo, lado]) => {
      gsap.set(halo, {
        left: `${((sx - lado / 2 - escena.left) / escena.width) * 100}%`,
        top: `${((sy - lado / 2 - escena.top) / escena.height) * 100}%`,
        width: `${(lado / escena.width) * 100}%`,
        aspectRatio: 1,
        autoAlpha: 0,
      });
    });
    gsap.set(reproductor, { clipPath: "circle(0% at 50% 50%)" });
    gsap.set(".icono-play", { autoAlpha: 0 });
    gsap.set(".icono-play svg", { scale: 0, transformOrigin: "50% 50%" });

    const tl = gsap.timeline({ onComplete: () => finalizar() });

    // Estrellas y sol que sale por detrás de las siluetas
    tl.fromTo(".estrella", { scale: .4 }, { scale: 1, duration: .7, ease: "sine.inOut", stagger: { each: .01, from: "random", repeat: 2, yoyo: true } }, 0)
      .fromTo(".sol-salida", { yPercent: 118 }, { yPercent: 0, duration: 1.9, ease: "power2.out" }, .25)
      .fromTo(".halo-claro", { autoAlpha: 0, scale: .45 }, { autoAlpha: .32, scale: 1, duration: 1.7, ease: "power2.out" }, .55)
      .fromTo(".halo-rosa", { autoAlpha: 0, scale: .45 }, { autoAlpha: .22, scale: 1, duration: 1.9, ease: "power2.out" }, .75)

      // La luz se abre desde el sol y pinta el mundo, mientras la cámara retrocede
      .to(".camara-escena", { x: 0, y: 0, scale: 1, duration: 1.95, ease: "power2.inOut" }, 1.4)
      .to(".mundo", { clipPath: `circle(170% at ${px}% ${py}%)`, duration: 1.45, ease: "power2.in" }, 1.6)
      .to(".cielo", { backgroundColor: "#fbdcb8", duration: 1, ease: "none" }, 1.7)
      .to(".cielo", { backgroundColor: "#cee9f4", duration: .75, ease: "power2.inOut" }, 2.85)
      .to(".velo-noche", { autoAlpha: 0, duration: .9, ease: "power1.in" }, 2.15)
      .set(".noche-cielo, .noche, .sol-salida, .halo", { autoAlpha: 0 }, 3.05)
      .set(".mundo", { clearProps: "clipPath" }, 3.05);

    entrarAves(tl, 2.3, -innerWidth * .2, innerHeight * .2);
    entrarFrondas(tl, 2.55);
    entrarLockup(tl, 2.75);

    // Un pedazo de sol vuela al centro y se abre: adentro está el video
    tl.set(".orbe", { autoAlpha: 1 }, 3.3)
      .fromTo(".orbe", { scale: .1 }, { scale: 1, duration: .32, ease: "back.out(2.6)" }, 3.3)
      .to(".orbe", { x: vx - sx, duration: .95, ease: "power2.inOut" }, 3.55)
      .to(".orbe", { y: vy - sy, duration: .95, ease: "sine.in" }, 3.55)
      .to(".orbe", { scale: (video.height * 1.04) / d, duration: .95, ease: "power2.in" }, 3.55)
      .set(marco, { autoAlpha: 1 }, 4.35)
      .to(reproductor, { clipPath: "circle(72% at 50% 50%)", duration: .85, ease: "expo.inOut" }, 4.35)
      .fromTo(".onda", { autoAlpha: 1, scale: .7 }, { autoAlpha: 0, scale: 2.5, duration: 1, ease: "expo.out", immediateRender: false }, 4.72)
      .to(".orbe", { autoAlpha: 0, duration: .2 }, 5)
      .set(reproductor, { clearProps: "clipPath" }, 5.21)
      .to(".icono-play", { autoAlpha: 1, duration: .3, ease: "power2.out" }, 4.95)
      .to(".icono-play svg", { scale: 1, duration: .55, ease: "back.out(3)" }, 4.95);

    entrarBloque(tl, 4.95);
    entrarTextos(tl, 4.8);
    return tl;
  }

  /* ------------------------------------------------- Opción 3: la selva ----------------- */
  function construirTunel() {
    const camara = $(".camara");
    if (camara.childElementCount) return;
    const mayor = Math.max(innerWidth, innerHeight);
    const tipos = ["monstera", "agave", "hojas", "arbusto", "monstera", "agave", "flor"];
    const total = pantallaAncha.matches ? 52 : 42;
    let semilla = 7;
    const azar = () => { semilla = (semilla * 9301 + 49297) % 233280; return semilla / 233280; };

    const poner = (tipo, x, y, z, ancho, giro) => {
      const hoja = new Image();
      hoja.src = `assets/hoja-${tipo}.webp`;
      hoja.alt = "";
      hoja.className = "hoja-vuelo";
      hoja.style.width = `${ancho}px`;
      hoja.style.transform = `translate3d(${x - ancho / 2}px, ${y - ancho / 2}px, ${z}px) rotate(${giro}deg)`;
      camara.append(hoja);
    };

    // Espiral de hojas con las puntas hacia el centro: mirada de lejos forma un túnel.
    // El radio siempre supera media hoja, para que al pasar pegadas a la cámara se abran hacia los bordes.
    for (let i = 0; i < total; i++) {
      const angulo = i * 2.39996;
      const ancho = mayor * (.34 + azar() * .2);
      const radio = Math.max(mayor * (.36 + azar() * .2), ancho * .66);
      const giro = (angulo * 180) / Math.PI - 90 + (azar() - .5) * 50;
      poner(tipos[i % tipos.length], Math.cos(angulo) * radio, Math.sin(angulo) * radio, -3600 + (i / total) * 3800, ancho, giro);
    }
    // Dos hojas casi en el eje de la cámara: al pasarle por encima dan el golpe de velocidad
    poner("monstera", -mayor * .16, mayor * .08, -1500, mayor * .6, 24);
    poner("flor", mayor * .12, -mayor * .1, -700, mayor * .5, 40);
  }

  function introSelva() {
    estadoBase();
    construirTunel();
    const escena = $(".escena").getBoundingClientRect();
    // En vertical el túnel se centra en la pantalla; en horizontal, en el horizonte de la escena
    const fuga = Math.round(pantallaAncha.matches ? escena.top + escena.height * horizonte() : innerHeight * .46);
    $(".vuelo").style.setProperty("--vy", `${fuga}px`);

    gsap.set(".vuelo", { display: "block" });
    gsap.set(".camara", { z: 0, rotationZ: -16 });
    gsap.set(".tunel", { scale: 1, autoAlpha: 1 });

    const tl = gsap.timeline({ onComplete: () => finalizar() });

    tl.to(".camara", { z: 4400, rotationZ: 8, duration: 2.5, ease: "power2.in" }, .2)
      .to(".tunel", { scale: 44, duration: 2.5, ease: "power3.in" }, .2)
      .to(".tunel", { autoAlpha: 0, duration: .45, ease: "power1.in" }, 1.45)
      .to(".vuelo", { autoAlpha: 0, duration: .22, ease: "power1.in" }, 2.46)
      .set(".vuelo", { display: "none" }, 2.72);

    flujoMundo(tl, 1.9, { dur: 2.3 });
    entrarAves(tl, 2.35, -innerWidth * .32, innerHeight * .3);
    entrarFrondas(tl, 2.2);
    entrarLockup(tl, 2.55);

    // El video se levanta del suelo, como una tarjeta de un libro desplegable
    tl.set(marco, { autoAlpha: 1, transformOrigin: "50% 100%" }, 2.9)
      .fromTo(marco, { rotationX: 78, y: innerHeight * .1 }, { rotationX: 0, y: 0, duration: 1.15, ease: "back.out(1.25)" }, 2.9)
      .set(marco, { transformOrigin: "50% 50%" }, 4.05);
    entrarBloque(tl, 3.6);
    entrarTextos(tl, 3.3);
    return tl;
  }

  /* ------------------------------------------------- La escena sigue viva ---------------- */
  function activarParallax(soloEscena = false) {
    if (sinMovimiento) return;
    if (!conMouse) {
      if (!soloEscena) derivaTactil();
      return;
    }
    if (parallaxActivo) return;
    parallaxActivo = true;

    const holgura = Math.max(0, ($(".escena").getBoundingClientRect().width - innerWidth) / 2);
    const capas = [[".capa-sol", 10], [".capa-fondo", 16], [".capa-medio", 26], [".aves", 30], [".capa-cerca", 40], [".capa-hamaca", 40], [".capa-frente", 62], [".fronda", 74], [".merida", 10], [".identidad", 7], [".rejas-marco", 22]];
    const movedores = capas.map(([sel, cuanto]) => ({
      cuanto: sel === ".merida" || sel === ".identidad" || sel === ".rejas-marco" ? cuanto : Math.min(cuanto, holgura * .92 || cuanto),
      x: gsap.quickTo(sel, "x", { duration: 1, ease: "power3" }),
      y: gsap.quickTo(sel, "y", { duration: 1, ease: "power3" }),
    }));
    const giroY = gsap.quickTo(marco, "rotationY", { duration: .9, ease: "power3" });
    const giroX = gsap.quickTo(marco, "rotationX", { duration: .9, ease: "power3" });
    const bloqueX = gsap.quickTo(".bloque-riso", "x", { duration: .9, ease: "power3" });
    const bloqueY = gsap.quickTo(".bloque-riso", "y", { duration: .9, ease: "power3" });

    const mover = (e) => {
      const nx = (e.clientX / innerWidth) * 2 - 1;
      const ny = (e.clientY / innerHeight) * 2 - 1;
      movedores.forEach((m) => { m.x(-nx * m.cuanto); m.y(-ny * m.cuanto * .55); });
      if ((!linea || linea.progress() === 1) && !enCine) {
        giroY(nx * 3);
        giroX(-ny * 2.2);
        bloqueX(nx * 5);
        bloqueY(ny * 4);
      }
    };
    addEventListener("pointermove", mover, { passive: true });
    limpiezas.push(() => { removeEventListener("pointermove", mover); parallaxActivo = false; });
  }

  function derivaTactil() {
    [[".capa-fondo", 1.5], [".capa-medio", 2.5], [".capa-cerca", 3.5], [".capa-frente", 5]].forEach(([capa, cuanto], i) => {
      gsap.fromTo(capa, { x: -cuanto }, { x: cuanto, duration: 5 + i, ease: "sine.inOut", repeat: -1, yoyo: true });
    });
  }

  function ambiente() {
    if (sinMovimiento) return;

    // Las aves aletean a ratos y la bandada deriva
    $$(".ave").forEach((ave, i) => {
      gsap.timeline({ repeat: -1, repeatDelay: gsap.utils.random(.9, 2.6), delay: i * .3 })
        .to(ave, { scaleY: .66, duration: .15, ease: "sine.inOut", repeat: 7, yoyo: true, transformOrigin: "50% 55%" });
    });
    gsap.to(".aves", { rotation: -2.5, xPercent: -7, yPercent: 5, duration: 6, ease: "sine.inOut", repeat: -1, yoyo: true });

    // La hamaca se mece
    if (pantallaAncha.matches) {
      gsap.to(".capa-hamaca img", { rotation: 1.9, transformOrigin: "8% 4%", duration: 2.9, ease: "sine.inOut", repeat: -1, yoyo: true });
    }

    // De vez en cuando un ave cruza el cielo
    const ancho = innerWidth;
    const alto = innerHeight;
    gsap.set(".ave-viajera", { autoAlpha: 1, x: -110, y: alto * .14 });
    gsap.timeline({ repeat: -1, repeatDelay: 8, delay: 2.5 })
      .fromTo(".ave-viajera", { x: -110 }, { x: ancho + 110, duration: 11, ease: "none" }, 0)
      .fromTo(".ave-viajera", { y: alto * .2 }, { y: alto * .05, duration: 5.5, ease: "sine.inOut", repeat: 1, yoyo: true }, 0)
      .fromTo(".ave-viajera", { scaleY: 1 }, { scaleY: .62, duration: .16, ease: "sine.inOut", repeat: 67, yoyo: true, transformOrigin: "50% 55%" }, 0);
  }

  function finalizar(conSonido = false) {
    raiz.classList.remove("en-intro");
    ctx.add(() => {
      ambiente();
      activarParallax();
    });
    if (conSonido && medio) gsap.delayedCall(.7, mostrarMedio);
  }

  /* ------------------------------------------------- Control de las opciones ------------- */
  const INTROS = { rejas: introRejas, amanecer: introAmanecer, selva: introSelva };

  function iniciar(nombre) {
    limpiezas.forEach((f) => f());
    limpiezas = [];
    if (ctx) ctx.revert();
    restaurarReproductor();
    introActual = nombre;
    $$(".revision button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.intro === nombre)));
    const url = new URL(location.href);
    url.searchParams.set("intro", nombre);
    history.replaceState(null, "", url);
    raiz.classList.add("en-intro");
    scrollTo(0, 0);
    ctx = gsap.context(() => { linea = INTROS[nombre](); });
  }

  $$(".revision button").forEach((boton) => {
    boton.addEventListener("click", () => iniciar(boton.dataset.intro));
  });

  // En cualquier momento se puede saltar la animación con un clic
  addEventListener("pointerdown", (e) => {
    if (e.target.closest(".revision, .abrir")) return;
    if (linea && linea.isActive()) linea.progress(1);
  });
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && linea && linea.isActive()) linea.progress(1);
  });

  /* ------------------------------------------------- Carga ------------------------------- */
  async function incrustarLockup() {
    try {
      const respuesta = await fetch("assets/merida.svg");
      const svg = new DOMParser().parseFromString(await respuesta.text(), "image/svg+xml").documentElement;
      if (svg.nodeName !== "svg") return;
      svg.classList.add("merida");
      svg.setAttribute("aria-label", "Mérida, Yucatán. See you there!");
      $(".merida").replaceWith(document.importNode(svg, true));
    } catch (e) { /* si falla, se queda la imagen y entra completa */ }
  }

  const RECURSOS_INTRO = {
    rejas: ["reja.webp", "baldosa.webp"],
    amanecer: ["sol-disco.webp"],
    selva: ["hoja-monstera.webp", "hoja-agave.webp", "hoja-hojas.webp", "hoja-arbusto.webp", "hoja-flor.webp"],
  };
  const LIMITE_CARGA_MS = 15000;

  const pedirImagen = (nombre) => {
    const im = new Image();
    im.src = `assets/${nombre}`;
    return im;
  };

  // Devuelve true si la escena y la intro alcanzaron a cargar dentro del límite
  function precargar(intro) {
    const frondas = pantallaAncha.matches ? ["fronda.webp"] : ["m-fronda-izq.webp", "m-fronda-der.webp"];
    const extras = [...frondas, "papel.webp", ...RECURSOS_INTRO[intro]].map(pedirImagen);
    const enPagina = $$("img").filter((im) => im.loading !== "lazy" && (intro === "amanecer" || !im.classList.contains("noche")));
    const tareas = [...[...enPagina, ...extras].map((im) => im.decode()), incrustarLockup(), document.fonts.ready];
    let hechas = 0;
    const avance = (p) => Promise.resolve(p).catch(() => {}).finally(() => {
      hechas += 1;
      raiz.style.setProperty("--carga", hechas / tareas.length);
    });
    return Promise.race([
      Promise.all(tareas.map(avance)).then(() => true),
      new Promise((r) => setTimeout(() => r(false), Math.max(2000, LIMITE_CARGA_MS - performance.now()))),
    ]);
  }

  // Con red muy lenta no se anima sobre pantallas vacías: se entra directo a la página
  function entrarSinIntro() {
    raiz.classList.remove("en-intro");
    ctx = gsap.context(() => {
      ambiente();
      activarParallax();
    });
  }

  const pedida = new URLSearchParams(location.search).get("intro");
  const introInicial = INTROS[pedida] ? pedida : "rejas";

  precargar(introInicial).then((completo) => {
    raiz.classList.add("listo");
    Object.keys(RECURSOS_INTRO).filter((n) => n !== introInicial).forEach((n) => RECURSOS_INTRO[n].forEach(pedirImagen));
    // Quien pidió reducir el movimiento ve la página completa, sin intro; los botones siguen disponibles
    if (sinMovimiento) {
      raiz.classList.remove("en-intro");
      return;
    }
    if (completo) iniciar(introInicial);
    else entrarSinIntro();
  });

  window.__landing = { get linea() { return linea; }, iniciar };
})();
