import fs from "fs";
import QRCode from "qrcode";

// === Cesty k priečinkom ===
const scenesDir = "./scenes";
const qrDir = "./qrcodes";

// === Vytvor priečinok qrcodes, ak neexistuje ===
if (!fs.existsSync(qrDir)) {
  fs.mkdirSync(qrDir, { recursive: true });
}

// === Načítanie všetkých jpg súborov zo scenes/ ===
const files = fs.readdirSync(scenesDir)
  .filter(f => f.endsWith(".jpg"))
  .sort(); // zoradenie podľa mena: scene1.jpg, scene2.jpg...

// === Generovanie QR kódov ===
files.forEach(file => {
  const qrPath = `${qrDir}/${file}.png`; // napr. qrcodes/scene1.jpg.png
  QRCode.toFile(qrPath, file, {
    color: { dark: "#000000", light: "#FFFFFF" },
  })
    .then(() => console.log(`QR kód pre ${file} vygenerovaný!`))
    .catch(err => console.error(err));
});

// === Generovanie scenes.json ===
const scenesArray = files.map((file, index) => {
  const scene = { id: file };
  if (index > 0) scene.prev = files[index - 1];
  if (index < files.length - 1) scene.next = files[index + 1];
  return scene;
});

const scenesJson = { location1: scenesArray }; // zmeň "location1" podľa potreby

fs.writeFileSync("./scenes.json", JSON.stringify(scenesJson, null, 2));
console.log("scenes.json vygenerovaný!");