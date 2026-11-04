// Carga el video solo cuando el invitado da play: la página abre rápido y el video arranca con sonido.
document.querySelectorAll(".reproductor").forEach((reproductor) => {
  const boton = reproductor.querySelector(".reproducir");
  if (!boton) return;

  boton.addEventListener("click", () => {
    const { tipo, fuente, cliente } = reproductor.dataset;
    let medio;

    if (tipo === "archivo") {
      medio = document.createElement("video");
      medio.src = fuente;
      medio.controls = true;
      medio.autoplay = true;
      medio.playsInline = true;
    } else {
      medio = document.createElement("iframe");
      medio.title = "Video";
      medio.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media";
      medio.allowFullscreen = true;
      medio.src = tipo === "stream"
        ? `https://${cliente}.cloudflarestream.com/${fuente}/iframe?autoplay=true`
        : `https://www.youtube-nocookie.com/embed/${fuente}?autoplay=1&rel=0`;
    }

    reproductor.replaceChildren(medio);
    medio.focus();
  });
});
