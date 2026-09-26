/**
 * Misst den WCAG-Kontrast des Chore-Titels gegen den TATSÄCHLICH
 * gerenderten Pixel — nicht gegen die CSS-background-Property.
 *
 * Warum der Umweg ueber PNG: `getComputedStyle(card).backgroundColor` liefert
 * die reine Dringlichkeitsfarbe. Auf dem Schirm steht dort aber die Karte
 * MIT dem Motiv darueber, und der Titel hat zusaetzlich einen Halo. Die
 * gemessene Property sagt also weder aus, was der Text tatsaechlich sieht,
 * noch ob die WCAG-Schwelle gehalten wird. Nur ein Pixel-Screenshot kann
 * das beantworten.
 *
 * Decodiert PNG ohne externe Bibliothek (zlib ist in Node eingebaut):
 * IHDR -> IDAT (inflate) -> Filter-Rueckbau je Scanline.
 */
import { inflateSync } from "node:zlib";

/** PNG-Pixel aus einem Buffer lesen. Gibt {width,height,get(x,y)->[r,g,b]} zurueck. */
export function decodePng(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error("kein PNG");
  let off = 8;
  let width = 0,
    height = 0,
    bitDepth = 0,
    colorType = 0;
  const idat = [];
  while (off < buffer.length) {
    const len = buffer.readUInt32BE(off);
    const type = buffer.toString("ascii", off + 4, off + 8);
    const data = buffer.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (bitDepth !== 8) throw new Error(`bitDepth ${bitDepth} nicht unterstuetzt`);
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    off += 12 + len;
  }
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`colorType ${colorType} nicht unterstuetzt`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);

  // PNG-Filter je Scanline zurueckrechnen (RFC 2083, Abschnitt 6).
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      // WICHTIG: `a` ist der BEREITS DEKODIERTE linke Nachbar aus `out`,
      // nicht der Rohwert aus `line`. PNG-Filter (Sub/Average/Paeth) bauen
      // auf den rekonstruierten Werten auf, nicht auf den komprimierten
      // Deltas. Mit dem Rohwert kippt die Rekonstruktion nach den ersten
      // Pixeln ins Schwarze.
      const a = x >= channels ? out[y * stride + x - channels] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      switch (filter) {
        case 0: break;
        case 1: v = (v + a) & 0xff; break;
        case 2: v = (v + b) & 0xff; break;
        case 3: v = (v + ((a + b) >> 1)) & 0xff; break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
          break;
        }
        default: throw new Error(`unbekannter Filter ${filter}`);
      }
      out[y * stride + x] = v;
    }
  }

  return {
    width,
    height,
    channels,
    /** Mittlere RGB-Farbe eines Rechtecks — gegen Textrauschen robust. */
    avgRect(x0, y0, w, h) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = y0; y < y0 + h; y++) {
        for (let x = x0; x < x0 + w; x++) {
          const i = (y * width + x) * channels;
          r += out[i]; g += out[i + 1]; b += out[i + 2]; n++;
        }
      }
      return n ? [r / n, g / n, b / n] : [0, 0, 0];
    },
    get(x, y) {
      const i = (y * width + x) * channels;
      return [out[i], out[i + 1], out[i + 2]];
    },
  };
}

/** Relative Luminanz nach WCAG 2.1. */
export function luminance([r, g, b]) {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Kontrastverhaeltnis nach WCAG 2.1. */
export function contrast(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}
