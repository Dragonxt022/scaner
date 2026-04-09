# Scaner

Ferramenta para trabalhar com o inventario de PDFs de um GED legado, sincronizar o catalogo local e estimar o espaco total ocupado pelos arquivos listados.

## Objetivo

Este projeto parte de um inventario ja coletado em `artifacts/pdf-links.json`.

Com ele voce consegue:

- contar quantos registros existem no inventario;
- descobrir quantos PDFs unicos foram encontrados;
- sincronizar esse catalogo para o banco SQLite local;
- estimar o espaco total ocupado pelos PDFs remotos sem baixar todos os arquivos;
- baixar os PDFs por fila concorrente com progresso visual e retomada em varios dias.

## Requisitos

- Node.js 18 ou superior
- `npm install` executado na raiz do projeto

## Estrutura importante

- [artifacts/pdf-links.json](C:/apps/scaner/artifacts/pdf-links.json): inventario principal dos documentos encontrados
- [artifacts/pdf-links.csv](C:/apps/scaner/artifacts/pdf-links.csv): exportacao em CSV do inventario
- [artifacts/query-log.json](C:/apps/scaner/artifacts/query-log.json): log das consultas feitas pelo coletor legado
- [artifacts/pdf-size-report.json](C:/apps/scaner/artifacts/pdf-size-report.json): relatorio gerado pela estimativa de espaco
- [data/download-state.json](C:/apps/scaner/data/download-state.json): estado persistente da fila de downloads
- [data/scaner.sqlite](C:/apps/scaner/data/scaner.sqlite): banco SQLite local

## Instalar dependencias

Na raiz do projeto:

```powershell
npm install
```

## Fluxo de uso

### 1. Validar se o inventario existe

O arquivo principal precisa existir:

```powershell
Get-Item .\artifacts\pdf-links.json
```

Se esse arquivo nao existir, primeiro sera necessario refazer a coleta no sistema legado.

### 2. Iniciar a interface local

```powershell
npm start
```

Por padrao a interface sobe em:

```text
http://localhost:3000
```

Ao iniciar, o sistema sincroniza automaticamente o catalogo do `pdf-links.json` para o banco local, salvo se `SYNC_CATALOG_ON_BOOT=false`.

### 3. Sincronizar o catalogo manualmente

Use quando quiser recarregar o banco local a partir do inventario:

```powershell
npm run sync
```

Saida esperada:

- total de registros lidos do JSON
- total de documentos unicos gravados no banco

### 4. Calcular o espaco total dos PDFs

Esse comando usa o inventario existente, remove duplicidades e consulta o tamanho de cada PDF remoto por cabecalho HTTP.

```powershell
npm run inventory:size
```

O comando gera:

- total de registros do inventario
- total de PDFs unicos
- total de arquivos cujo tamanho foi resolvido
- tamanho total conhecido em bytes e formato legivel
- relatorio em `artifacts/pdf-size-report.json`

Importante:

- o script nao baixa todos os PDFs completos;
- ele tenta descobrir o tamanho com `HEAD` e, se necessario, com requisicao parcial `Range`;
- alguns arquivos podem ficar sem tamanho identificado se o servidor nao informar `Content-Length` ou bloquear a consulta.

### 5. Ajustar a execucao da estimativa

Voce pode controlar concorrencia e timeout:

```powershell
$env:CONCURRENCY=4
$env:TIMEOUT_MS=20000
npm run inventory:size
```

Variaveis suportadas:

- `CONCURRENCY`: quantidade de requisicoes simultaneas. Padrao: `8`
- `TIMEOUT_MS`: tempo maximo por arquivo, em milissegundos. Padrao: `15000`
- `INVENTORY_PATH`: caminho alternativo para outro inventario JSON
- `OUTPUT_PATH`: caminho alternativo para salvar o relatorio final

Exemplo com caminhos personalizados:

```powershell
$env:INVENTORY_PATH="artifacts\\pdf-links.json"
$env:OUTPUT_PATH="artifacts\\meu-relatorio.json"
npm run inventory:size
```

### 6. Baixar os PDFs com retomada

O downloader fica na aba `Downloads` da interface web.

Fluxo recomendado:

1. Inicie a interface com `npm start`
2. Abra `http://localhost:3000`

Para acesso pela rede local:
1. Defina `HOST=0.0.0.0` no ambiente se quiser forcar o bind em todas as interfaces.
2. Inicie a aplicacao normalmente.
3. Abra em outro dispositivo da mesma rede usando `http://IP_DA_MAQUINA:3000`.

Autenticacao inicial:
1. O sistema cria um administrador inicial automaticamente quando nao existe nenhum admin no banco.
2. Variaveis usadas: `ADMIN_DEFAULT_CPF`, `ADMIN_DEFAULT_NAME` e `ADMIN_DEFAULT_PASSWORD`.
3. Se nada for configurado, o bootstrap usa os valores padrao do ambiente definidos no codigo e o ideal e alterar a senha imediatamente apos o primeiro acesso.
3. Entre na aba `Downloads`
4. Configure:
   - diretório de destino
   - quantidade de downloads simultaneos
   - tentativas por arquivo
   - timeout por arquivo
   - sobrescrita de arquivos existentes, se necessario
5. Clique em `Iniciar downloads`
6. Para interromper sem perder o que ja foi concluido, clique em `Parar`

Comportamento importante:

- o progresso fica salvo em `data/download-state.json`
- arquivos `completed` e `failed` ficam registrados para a fila nao recomecar do zero
- ao retomar em outro dia, apenas os `pending` voltam para a fila
- os downloads ativos aparecem somente enquanto estao em andamento; quando um termina, ele sai da lista e outro ocupa a vaga

Observacao:

- nesta versao, arquivos marcados como `failed` ficam fora da retomada automatica
- se quiser reprocessar falhas, isso deve ser feito em uma evolucao controlada do fluxo

## Arquivo de saida do relatorio

O arquivo `artifacts/pdf-size-report.json` contem:

- `totalRecords`: quantidade total de registros lidos do inventario
- `uniquePdfCount`: quantidade de PDFs unicos
- `resolvedSizeCount`: quantidade de PDFs com tamanho identificado
- `unresolvedSizeCount`: quantidade de PDFs sem tamanho identificado
- `totalBytes`: soma total em bytes dos arquivos identificados
- `totalHuman`: total em formato legivel
- `failures`: lista dos arquivos que falharam, com status e erro

## Comandos disponiveis

- `npm start`: inicia a interface web e sincroniza o catalogo no boot
- `npm run ui`: alias de inicializacao da interface
- `npm run sync`: sincroniza o catalogo local a partir do inventario
- `npm run inventory:size`: estima o tamanho total dos PDFs do inventario
- `npm run reindex:reset`: limpa dados de indexacao
- `npm run reindex`: executa lote de indexacao textual
- `npm run reindex:loop`: executa indexacao em loop
- `npm run reindex:fast`: indexacao sem OCR, com execucao mais rapida
- `npm run reindex:loop:fast`: loop de indexacao sem OCR

## Solucao de problemas

### O comando `inventory:size` demora muito

Reduza a concorrencia:

```powershell
$env:CONCURRENCY=2
npm run inventory:size
```

### Alguns arquivos aparecem sem tamanho

Isso normalmente acontece quando:

- o servidor remoto nao informa o tamanho no cabecalho;
- a URL responde com erro;
- houve timeout de rede.

Consulte o campo `failures` em `artifacts/pdf-size-report.json`.

### A interface nao sobe

Verifique:

- se o `npm install` foi executado;
- se a porta `3000` esta livre;
- se o `artifacts/pdf-links.json` existe e esta valido.

## Observacao operacional

Hoje o projeto ja possui um inventario com:

- `14.085` registros no JSON
- `13.785` PDFs unicos

Esses numeros podem mudar se a coleta for refeita.
