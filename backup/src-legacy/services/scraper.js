const fs = require('node:fs/promises');
const path = require('node:path');
const { load } = require('cheerio');

function normalizeText(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function csvEscape(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function toAbsoluteUrl(value, baseUrl) {
  return new URL(value, baseUrl).href;
}

async function ensureArtifactsDir() {
  const artifactsDir = path.resolve(process.cwd(), 'artifacts');
  await fs.mkdir(artifactsDir, { recursive: true });
  return artifactsDir;
}

function buildCookieHeader(cookies) {
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}

async function fetchHtml(url, requestOptions) {
  const response = await fetch(url, requestOptions);
  if (!response.ok) {
    throw new Error(`Falha ao buscar ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

function parseOptions(html, selector, baseUrl) {
  const $ = load(html);
  const seen = new Set();

  return $(selector)
    .map((_, option) => {
      const value = normalizeText($(option).attr('value'));
      const label = normalizeText($(option).text());

      if (!value || seen.has(value)) {
        return null;
      }

      seen.add(value);

      return {
        value,
        label: label || value,
        sourceUrl: baseUrl,
      };
    })
    .get()
    .filter(Boolean);
}

function parseResultPage(html, baseUrl) {
  const $ = load(html);
  const bodyText = normalizeText($('body').text());
  const totalMatch = bodyText.match(/Resultado da pesquisa\s*-\s*([\d.]+)\s*registro\(s\) localizado\(s\)/i);
  const total = totalMatch ? Number(totalMatch[1].replace(/\./g, '')) : 0;

  const records = $('a[href*="bemvindoconsulta_docs_individual.php"]')
    .map((_, anchor) => {
      const row = $(anchor).closest('tr');
      const cells = row
        .find('td')
        .map((__, cell) => normalizeText($(cell).text()))
        .get();

      if (cells.length < 4) {
        return null;
      }

      return {
        classificacao: cells[0],
        caixa: cells[1],
        descricao: cells[2],
        ano: cells[3],
        detailUrl: toAbsoluteUrl($(anchor).attr('href'), baseUrl),
      };
    })
    .get()
    .filter(Boolean);

  return { total, records };
}

function parsePdfData(html, detailUrl) {
  const $ = load(html);
  const links = $('a')
    .map((_, anchor) => ({
      text: normalizeText($(anchor).text()),
      href: normalizeText($(anchor).attr('href')),
    }))
    .get()
    .filter((link) => link.href);

  const pdfLink = links.find(
    (link) =>
      /\/arquivos\//i.test(link.href) &&
      /\.pdf(?:$|\?)/i.test(link.href),
  );

  const fileName = pdfLink ? decodeURIComponent(pdfLink.href.split('/').pop()) : '';
  const hashText = normalizeText($('body').text()).match(/Hash Verifica(?:ç|c)ão\s*([A-F0-9]{20,})/i);

  return {
    detailUrl,
    pdfUrl: pdfLink ? pdfLink.href : '',
    nomeArquivo: fileName,
    hashVerificacao: hashText ? hashText[1] : '',
  };
}

function createPostBody(payload) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(payload)) {
    params.set(key, value);
  }

  return params.toString();
}

async function submitSearch(baseUrl, cookieHeader, payload) {
  const resultUrl = toAbsoluteUrl('bemvindoconsulta_docs_liberados_geral_geral_resultado.php', baseUrl);

  return fetchHtml(resultUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      cookie: cookieHeader,
      referer: baseUrl,
    },
    body: createPostBody(payload),
  });
}

async function collectResultSet(baseUrl, cookieHeader, payload) {
  const html = await submitSearch(baseUrl, cookieHeader, payload);
  return parseResultPage(html, baseUrl);
}

async function collectQueryRecords(baseUrl, cookieHeader, years, payload, recordsMap, queryLog) {
  const result = await collectResultSet(baseUrl, cookieHeader, payload);

  queryLog.push({
    ...payload,
    total: result.total,
    extracted: result.records.length,
    splitByYear: false,
  });

  if (result.total > result.records.length && !payload.ano) {
    queryLog[queryLog.length - 1].splitByYear = true;

    for (const year of years) {
      const yearPayload = {
        ...payload,
        ano: year.value,
      };

      const yearResult = await collectResultSet(baseUrl, cookieHeader, yearPayload);
      queryLog.push({
        ...yearPayload,
        total: yearResult.total,
        extracted: yearResult.records.length,
        splitByYear: false,
      });

      for (const record of yearResult.records) {
        recordsMap.set(record.detailUrl, record);
      }
    }

    return;
  }

  for (const record of result.records) {
    recordsMap.set(record.detailUrl, record);
  }
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, () => runWorker());
  await Promise.all(runners);

  return results;
}

async function enrichRecordsWithPdfLinks(records, cookieHeader) {
  return mapWithConcurrency(records, 8, async (record, index) => {
    const html = await fetchHtml(record.detailUrl, {
      headers: {
        cookie: cookieHeader,
        referer: record.detailUrl,
      },
    });

    if ((index + 1) % 100 === 0 || index === records.length - 1) {
      console.log(`Detalhes processados: ${index + 1}/${records.length}`);
    }

    return {
      ...record,
      ...parsePdfData(html, record.detailUrl),
    };
  });
}

async function writeOutputs(artifactsDir, records, queryLog) {
  const jsonPath = path.join(artifactsDir, 'pdf-links.json');
  const csvPath = path.join(artifactsDir, 'pdf-links.csv');
  const queryLogPath = path.join(artifactsDir, 'query-log.json');

  await fs.writeFile(jsonPath, JSON.stringify(records, null, 2), 'utf8');
  await fs.writeFile(queryLogPath, JSON.stringify(queryLog, null, 2), 'utf8');

  const csvHeader = [
    'classificacao',
    'caixa',
    'descricao',
    'ano',
    'detailUrl',
    'pdfUrl',
    'nomeArquivo',
    'hashVerificacao',
  ];

  const csvRows = records.map((record) =>
    [
      record.classificacao,
      record.caixa,
      record.descricao,
      record.ano,
      record.detailUrl,
      record.pdfUrl,
      record.nomeArquivo,
      record.hashVerificacao,
    ]
      .map(csvEscape)
      .join(','),
  );

  await fs.writeFile(csvPath, `\uFEFF${[csvHeader.join(','), ...csvRows].join('\n')}`, 'utf8');

  return { jsonPath, csvPath, queryLogPath };
}

async function collectAllPdfLinks(context, config) {
  const artifactsDir = await ensureArtifactsDir();
  const cookies = await context.cookies(config.consultaUrl);
  const cookieHeader = buildCookieHeader(cookies);
  const consultaHtml = await fetchHtml(config.consultaUrl, {
    headers: {
      cookie: cookieHeader,
      referer: config.consultaUrl,
    },
  });

  await fs.writeFile(path.join(artifactsDir, 'consulta-page.html'), consultaHtml, 'utf8');

  const classificacoes = parseOptions(consultaHtml, '#classificacao option', config.consultaUrl);
  const anos = parseOptions(consultaHtml, '#ano option', config.consultaUrl);
  const recordsMap = new Map();
  const queryLog = [];

  for (let index = 0; index < classificacoes.length; index += 1) {
    const classificacao = classificacoes[index];
    console.log(`Consultando classificacao ${index + 1}/${classificacoes.length}: ${classificacao.label}`);

    await collectQueryRecords(
      config.consultaUrl,
      cookieHeader,
      anos,
      {
        classificacao: classificacao.value,
        caixa: '',
        ano: '',
        descricao: '',
      },
      recordsMap,
      queryLog,
    );
  }

  for (const ano of anos) {
    await collectQueryRecords(
      config.consultaUrl,
      cookieHeader,
      [],
      {
        classificacao: '',
        caixa: '',
        ano: ano.value,
        descricao: '',
      },
      recordsMap,
      queryLog,
    );
  }

  const records = Array.from(recordsMap.values());
  console.log(`Links de detalhe unicos encontrados: ${records.length}`);

  const enrichedRecords = await enrichRecordsWithPdfLinks(records, cookieHeader);
  const outputPaths = await writeOutputs(artifactsDir, enrichedRecords, queryLog);

  return {
    artifactsDir,
    totalRecords: enrichedRecords.length,
    outputPaths,
  };
}

module.exports = { collectAllPdfLinks };
