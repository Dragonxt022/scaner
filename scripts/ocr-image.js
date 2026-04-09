const fs = require('fs');
const path = require('path');
const { createWorker } = require('tesseract.js');

async function run() {
  const rawPath = process.argv[2];
  const outArg = process.argv[3];
  if (!rawPath) {
    console.error('Uso: node scripts/ocr-image.js <caminho/para/imagem.png> [saida.txt]');
    process.exit(1);
  }

  const imgPath = path.resolve(rawPath);
  if (!fs.existsSync(imgPath)) {
    console.error('Arquivo não encontrado:', imgPath);
    process.exit(2);
  }

  const worker = createWorker({ logger: m => console.log(m) });

  try {
    await worker.load();
    await worker.loadLanguage('por');
    await worker.initialize('por+eng');
    const { data: { text } } = await worker.recognize(imgPath);

    if (outArg) {
      const outPath = path.resolve(outArg);
      fs.writeFileSync(outPath, text, 'utf8');
      console.log('Texto salvo em', outPath);
    } else {
      console.log('\n--- Texto extraído ---\n');
      console.log(text.trim());
      console.log('\n----------------------\n');
    }
  } catch (err) {
    console.error('Erro durante OCR:', err.message || err);
    process.exitCode = 3;
  } finally {
    await worker.terminate();
  }
}

run();
