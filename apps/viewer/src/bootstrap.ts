import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (app === null) {
  throw new Error("viewer root element was not found");
}

const mode = new URLSearchParams(window.location.search).get("mode");

if (mode === "planet") {
  void import("./planetPreview.js").then(({ renderTectonicPreview }) => {
    renderTectonicPreview(app);
  });
} else {
  void import("./main.js");
}
