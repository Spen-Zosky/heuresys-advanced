import { describe, expect, it } from "vitest";
import { adatta, altezzaArea, zoomIntorno, SCALA_MAX, SCALA_MIN, SCALA_MIN_LEGGIBILE } from "./navigazione-area";

describe("adatta (fit)", () => {
  it("rimpicciolisce un contenuto più largo dell'area e lo centra", () => {
    const v = adatta(1000, 500, 4000, 400);
    expect(v.s).toBeCloseTo((1000 - 24) / 4000);
    expect(v.x).toBeCloseTo((1000 - 4000 * v.s) / 2);
    expect(v.y).toBeCloseTo((500 - 400 * v.s) / 2);
    // tutto dentro l'area
    expect(v.x).toBeGreaterThanOrEqual(0);
    expect(v.x + 4000 * v.s).toBeLessThanOrEqual(1000);
    expect(v.y + 400 * v.s).toBeLessThanOrEqual(500);
  });
  it("sceglie il lato che vincola di più (qui l'altezza)", () => {
    const v = adatta(1000, 300, 800, 2000);
    expect(v.s).toBeCloseTo((300 - 24) / 2000);
    expect(v.y + 2000 * v.s).toBeLessThanOrEqual(300);
  });
  it("non ingrandisce oltre la scala 1 un contenuto piccolo", () => {
    expect(adatta(1000, 800, 200, 100).s).toBe(1);
  });
  it("con misure assenti resta alla scala 1 invece di produrre NaN", () => {
    expect(adatta(0, 0, 100, 100)).toEqual({ s: 1, x: 0, y: 0 });
  });
});

describe("adatta con scala minima leggibile", () => {
  it("non scende sotto la scala minima e ancora in alto a sinistra il lato che sborda", () => {
    const v = adatta(1600, 700, 3900, 400, SCALA_MIN_LEGGIBILE);
    expect(v.s).toBe(SCALA_MIN_LEGGIBILE);
    expect(v.x).toBe(12);
    expect(v.y).toBeCloseTo((700 - 400 * v.s) / 2);
  });
  it("se il contenuto sta alla scala minima, il fit è quello normale", () => {
    expect(adatta(1000, 800, 1200, 300, SCALA_MIN_LEGGIBILE)).toEqual(adatta(1000, 800, 1200, 300));
  });
  it("l'altezza dell'area segue la scala minima", () => {
    expect(altezzaArea(1600, 3900, 600, 900, 240, SCALA_MIN_LEGGIBILE)).toBe(Math.round(600 * SCALA_MIN_LEGGIBILE + 24));
  });
});

describe("zoomIntorno", () => {
  it("il punto sotto il mouse resta fermo", () => {
    const v0 = { s: 0.5, x: 30, y: 40 };
    const cx = 300, cy = 200;
    const px = (cx - v0.x) / v0.s, py = (cy - v0.y) / v0.s; // punto del contenuto sotto il mouse
    const v1 = zoomIntorno(v0, 1.2, cx, cy);
    expect(v1.s).toBeCloseTo(0.6);
    expect(v1.x + px * v1.s).toBeCloseTo(cx);
    expect(v1.y + py * v1.s).toBeCloseTo(cy);
  });
  it("rispetta i limiti di scala", () => {
    expect(zoomIntorno({ s: SCALA_MAX, x: 0, y: 0 }, 2, 0, 0).s).toBe(SCALA_MAX);
    expect(zoomIntorno({ s: SCALA_MIN, x: 0, y: 0 }, 0.1, 0, 0).s).toBe(SCALA_MIN);
  });
  it("zoom avanti e indietro dello stesso passo torna al punto di partenza", () => {
    const v0 = { s: 0.7, x: 12, y: -40 };
    const v2 = zoomIntorno(zoomIntorno(v0, 1.2, 100, 90), 1 / 1.2, 100, 90);
    expect(v2.s).toBeCloseTo(v0.s);
    expect(v2.x).toBeCloseTo(v0.x);
    expect(v2.y).toBeCloseTo(v0.y);
  });
});

describe("altezzaArea", () => {
  it("si stringe su un contenuto basso e largo", () => {
    expect(altezzaArea(1000, 4000, 400, 700)).toBe(240);
  });
  it("non supera il massimo", () => {
    expect(altezzaArea(1000, 800, 5000, 700)).toBe(700);
  });
  it("altrimenti è l'altezza del contenuto adattato alla larghezza", () => {
    expect(altezzaArea(1000, 500, 400, 700)).toBe(424);
  });
});
