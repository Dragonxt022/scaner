# Express.js Routing Guide — Consolidated Markdown Documentation for Agents (Express 5.x)

## Executive summary

This document consolidates the official Express routing guide into a single, agent-friendly Markdown reference, and augments it with version-aware notes (especially Express 5.x), runnable Node.js examples, comparison tables, and operational best practices.

Routing in Express is fundamentally **(HTTP method + path)** → **one or more handlers**, executed in definition order. Those handlers can behave like middleware (calling `next()` to continue) or can end the request by sending a response. Express provides several routing primitives—`app.METHOD()`, `app.all()`, `app.use()`, `app.route()`, and `express.Router()`—that you combine to build modular, maintainable APIs. citeturn4view0turn4view2turn6view0

Because Express 5 is now the actively supported major line (minimum Node.js 18+) and introduced meaningful **path-matching syntax changes**, this document treats Express 5.x as the primary target and explicitly flags Express 4-only behaviors (especially legacy “string patterns” like `?`, `+`, `*`, and `()` in **string** route paths). citeturn26view0turn20search0turn13view1turn16view0

## Scope, target versions, and licensing

This document is based on the Express “Routing” guide and cross-references related official pages (API reference, middleware, error handling, migration, security). Primary source: Express Routing guide. citeturn4view0turn11search8

Assumed target runtime:

- **Express 5.x** (supported major line; minimum **Node.js 18**). citeturn26view0turn20search0turn25view0  
- **Recommended Node.js for production:** use **Active LTS** or **Maintenance LTS** Node releases (per Node.js guidance). As of **2026-03-26**, Node **v24** is Active LTS; **v22** and **v20** are Maintenance LTS. citeturn26view1  
- Latest visible Express 5 release in the official GitHub releases list is **v5.2.1 (2025-12-01)**. citeturn28view0  

Support policy highlights:

- Express officially states: “Only the latest version of any given major release line is supported.” citeturn26view0  
- Express maintains a published support table (v5.x ongoing, v4.x ongoing in “Version Support”), and has discussed an LTS-style phase model (CURRENT/ACTIVE/MAINTENANCE) in the official blog. citeturn26view0turn25view1  

Licensing note (important if you redistribute this doc):

- The Express website content is licensed under **Creative Commons Attribution 4.0 International (CC BY 4.0)** by the Express contributors (attribution required). citeturn24view0  

## Table of contents

- [Consolidated Routing Guide](#consolidated-routing-guide)  
  - [Routing fundamentals](#routing-fundamentals)  
  - [Route methods](#route-methods)  
  - [Route paths](#route-paths)  
    - [Paths based on strings](#paths-based-on-strings)  
    - [Paths based on legacy string patterns](#paths-based-on-legacy-string-patterns)  
    - [Paths based on regular expressions](#paths-based-on-regular-expressions)  
  - [Route parameters](#route-parameters)  
  - [Route handlers](#route-handlers)  
  - [Response methods](#response-methods)  
  - [approute](#approute)  
  - [expressrouter](#expressrouter)  
- [Express 5 compatibility notes and deprecations relevant to routing](#express-5-compatibility-notes-and-deprecations-relevant-to-routing)  
- [Practical guidance, pitfalls, best practices, and runnable examples](#practical-guidance-pitfalls-best-practices-and-runnable-examples)  
- [Short FAQ and references](#short-faq-and-references)  

## Consolidated Routing Guide

### Routing fundamentals

In Express, **routing** describes how your application endpoints (URIs) respond to client requests. You define routes using methods on the Express `app` instance (and on `Router` instances) that correspond to HTTP methods (`get`, `post`, `put`, etc.). citeturn4view0turn19view4

A standard route shape is:

- **Method-specific:** `app.get(path, handler)` / `app.post(path, handler)` etc. citeturn4view0turn4view1  
- **All methods:** `app.all(path, handler)` citeturn4view2turn19view2  
- **Middleware-style:** `app.use([path], middleware)` citeturn4view0turn12view1  

Routes can have **more than one callback**. If you supply multiple callbacks, include `next` and call `next()` when you want to pass control to the next callback. citeturn4view0turn5view4

Basic route example (from the official guide, runnable):

```js
const express = require('express')
const app = express()

// respond with "hello world" when a GET request is made to the homepage
app.get('/', (req, res) => {
  res.send('hello world')
})
```

Source context: the Express routing guide introduces this as the simplest “basic route.” citeturn4view0

### Route methods

A “route method” is derived from an HTTP method and is attached to an Express application or router instance. Example: `app.get()` handles GET; `app.post()` handles POST. citeturn4view0turn4view1

From the routing guide:

```js
// GET method route
app.get('/', (req, res) => {
  res.send('GET request to the homepage')
})

// POST method route
app.post('/', (req, res) => {
  res.send('POST request to the homepage')
})
```

This illustrates that (method, path) pairs define distinct endpoints. citeturn4view0turn4view1

#### Special method: `app.all()`

`app.all()` is a special routing method that matches **all HTTP methods** at a given path and is commonly used for “global” logic at a prefix (auth checks, logging, etc.) before continuing with `next()`. citeturn4view2turn19view2turn9view4

Example from the routing guide:

```js
app.all('/secret', (req, res, next) => {
  console.log('Accessing the secret section ...')
  next() // pass control to the next handler
})
```

citeturn4view2

Express 5 note: Express API docs show `app.all('{*splat}', ...)` as a catch-all style pattern (see Express 5 path syntax notes later). citeturn9view4turn13view1

#### Routing methods list and edge cases

Express supports routing methods matching many HTTP verbs beyond GET/POST/PUT/DELETE. The API reference enumerates supported method names (including WebDAV-like verbs such as `m-search`). citeturn19view4

If a method name is not a valid JavaScript identifier (e.g., `m-search`), use bracket notation (e.g., `app['m-search'](...)`). citeturn19view0

By default, `app.get()` also handles HTTP `HEAD` requests unless you explicitly define `app.head()` for that path. citeturn19view0

#### Routing method comparison table

The table below is a pragmatic consolidation (guide + API reference). citeturn4view0turn19view0turn6view0turn18view1

| Primitive | Matches | Typical use | Key notes |
|---|---|---|---|
| `app.METHOD(path, ...handlers)` | One HTTP verb | Main routing | Many verbs supported; `GET` can implicitly handle `HEAD` if no explicit `head()` route exists. citeturn19view0 |
| `router.METHOD(path, ...handlers)` | One HTTP verb | Module-level routing in a Router | Same semantics as `app.METHOD`. citeturn19view4turn9view3 |
| `app.all(path, ...handlers)` | All HTTP methods | Pre-conditions for a prefix; “global” logic | Useful for auth/logging; handlers can call `next()` to continue. citeturn4view2turn9view4 |
| `router.all(path, ...handlers)` | All HTTP methods | Same as `app.all` but within a Router | `next('router')` can skip the rest of the router. citeturn9view3 |
| `app.use([path], ...middleware)` | Any method; middleware matching by path prefix | Mount middleware/routers | Mount path is stripped for mounted middleware/routers (important for URL rewriting). citeturn12view1turn18view1 |
| `router.use([path], ...middleware)` | Any method; middleware matching by path prefix | Router-scoped middleware stacks | Order matters; middleware can “spill” across routers mounted on the same path. citeturn18view1turn18view4 |
| `app.route(path)` / `router.route(path)` | Chains handlers for multiple verbs on one path | Avoid duplicating path strings | In `router.route()`, ordering is based on when the route is created, not when handlers are appended. citeturn6view0turn18view0 |

### Route paths

Route paths combined with the request method define the endpoints at which requests can be made. The routing guide states that route paths can be strings, string patterns, or regular expressions, and explicitly flags Express 5 differences. citeturn4view4turn5view0

Key notes from the guide:

- Express uses `path-to-regexp` for matching string route paths. citeturn4view4  
- Query strings are not part of the route path. citeturn4view4turn19view4  
- Express 5 path matching rules differ from Express 4 for several special characters (see migration guide). citeturn4view2turn13view1  

#### Paths based on strings

Examples from the guide:

```js
app.get('/', (req, res) => {
  res.send('root')
})

app.get('/about', (req, res) => {
  res.send('about')
})

app.get('/random.text', (req, res) => {
  res.send('random.text')
})
```

citeturn4view4

Practical note: if you mount a router at `/birds`, and inside the router define `router.get('/about', ...)`, the effective URL becomes `/birds/about`. citeturn6view0

#### Paths based on legacy string patterns

The routing guide includes “string pattern” examples such as `?`, `+`, `*`, and grouped `()` patterns, but also warns that **string patterns no longer work in Express 5** and that special characters are handled differently than in Express 4. citeturn4view4turn5view0turn13view1

Guide examples (Express 4-style):

```js
app.get('/ab?cd', (req, res) => {
  res.send('ab?cd')
})

app.get('/ab+cd', (req, res) => {
  res.send('ab+cd')
})

app.get('/ab*cd', (req, res) => {
  res.send('ab*cd')
})

app.get('/ab(cd)?e', (req, res) => {
  res.send('ab(cd)?e')
})
```

citeturn4view4turn5view0

**Express 5 replacement approach:** Express 5 uses the newer `path-to-regexp` syntax where optional segments use **braces** `{...}` and wildcards must be **named** (e.g., `/*splat`). In addition, several regex-like characters are reserved and must be escaped to match literally. citeturn13view1turn16view0

Concrete Express 5 equivalents you should prefer:

- Optional segments: `/users{/:id}` style (see `path-to-regexp` optional braces examples). citeturn16view0turn13view1  
- Catch-all: `/{*splat}` for “including root,” or `/*splat` for “not including root.” citeturn13view1turn16view0  

Example (Express 5-style):

```js
// Matches /users/delete AND /users/123/delete (optional segment)
app.get('/users{/:id}/delete', (req, res) => {
  res.send(req.params.id ? `delete user ${req.params.id}` : 'delete users (bulk)')
})

// Matches everything INCLUDING the root path '/'
app.all('/{*splat}', (req, res) => {
  res.status(404).send(`No route for ${req.path}`)
})
```

The optional syntax and wildcard constraints are documented both in the Express migration guide and in the `path-to-regexp` README used by Express. citeturn13view1turn16view0

#### Paths based on regular expressions

You can pass a JavaScript `RegExp` as the route path. The routing guide gives examples:

```js
app.get(/a/, (req, res) => {
  res.send('/a/')
})

app.get(/.*fly$/, (req, res) => {
  res.send('/.*fly$/')
})
```

citeturn5view0

In the Express API reference, regex routes are also shown, and captured groups are made available via numeric indices in `req.params` (e.g., `req.params[0]`). citeturn19view4

### Route parameters

Route parameters are named URL segments used to capture values at a position in the URL. Captured values are available on `req.params` using the parameter name as the key. citeturn5view0

Example from the guide:

```js
app.get('/users/:userId/books/:bookId', (req, res) => {
  res.send(req.params)
})
```

With:

- Route path: `/users/:userId/books/:bookId`
- Request URL: `http://localhost:3000/users/34/books/8989`
- `req.params`: `{ "userId": "34", "bookId": "8989" }` citeturn5view0

#### Parameter naming rules: Express 4 vs Express 5

The routing guide states that parameter names must be made of “word characters” (`[A-Za-z0-9_]`). citeturn5view0

However, Express 5’s underlying matcher (`path-to-regexp` v8+) documents broader rules:

- Parameter names can be **any valid JavaScript identifier** (including unicode), or
- Quoted to include characters like hyphens: `:"param-name"`. citeturn16view0turn13view3

For agent implementations, treat this as:

- If you must stay compatible with Express 4-era constraints across ecosystems, prefer conservative names (`userId`, `book_id`). citeturn5view0  
- If you are Express 5-only, the matcher is more flexible, but be cautious with tooling and linters that may assume the older restrictions. citeturn16view0turn13view3  

#### Hyphens and dots around parameters

The routing guide notes that hyphen (`-`) and dot (`.`) are interpreted literally, and can be used with parameters:

- `/flights/:from-:to`  
- `/plantae/:genus.:species` citeturn5view1

#### Parameter constraints with regex in the path: treat as legacy

The routing guide shows an example of appending a regular expression in parentheses to constrain a parameter (e.g., `/user/:userId(\d+)`) and warns about escaping backslashes. citeturn5view3turn30search0

However, Express 5’s migration guidance and `path-to-regexp` explicitly state that many regex characters (including parentheses) are **reserved / not supported** in **string paths**, and `path-to-regexp` v8 removed “regular expression overrides of parameters.” citeturn13view1turn16view0

**Practical guidance (Express 5):** Do not rely on `:id(\\d+)` in string routes. Prefer one of these patterns:

- Validate in middleware/handler, and call `next('route')` or return 400/404 when invalid. (The routing guide documents `next('route')` behavior.) citeturn5view3turn5view4  
- Use a `RegExp` route if you truly need regex-level matching, and read captures from `req.params[n]` as in the API reference. citeturn19view4turn5view0  

Example: numeric `userId` validation in Express 5 without inline regex:

```js
app.get('/user/:userId', (req, res, next) => {
  if (!/^\d+$/.test(req.params.userId)) return res.sendStatus(404)
  res.send({ userId: req.params.userId })
})
```

Route-handler validation, numeric regex route options, and `next('route')` skipping behavior are all consistent with official Express routing/error-handling semantics. citeturn5view3turn12view2turn19view4

#### Parent parameters and `mergeParams`

When you mount a router under a path with parameters, those parent parameters are **not** available by default inside the nested router. The routing guide explicitly says you must pass `{ mergeParams: true }` to `express.Router()` to access parent params from sub-routes. citeturn6view0turn20search0

Example from the guide:

```js
const router = express.Router({ mergeParams: true })
```

citeturn6view0turn20search0

### Route handlers

Route handlers are the callback functions invoked when a route matches. Express allows:

- A single function
- Multiple functions
- Arrays of functions
- Combinations of functions + arrays citeturn5view4

The routing guide documents the key control-flow feature:

- `next('route')` bypasses the remaining callbacks for the current route and continues matching subsequent routes. citeturn5view3turn12view2

Example from the guide:

```js
app.get('/user/:id', (req, res, next) => {
  if (req.params.id === '0') {
    return next('route')
  }
  res.send(`User ${req.params.id}`)
})

app.get('/user/:id', (req, res) => {
  res.send('Special handler for user ID 0')
})
```

citeturn5view3

The Express API reference adds a related primitive for router-level control flow:

- `next('router')` bypasses the rest of the callbacks on the current router and returns control to the parent stack. citeturn19view4turn9view3

#### Mermaid: route matching and handler flow

```mermaid
flowchart TD
  A[Incoming HTTP request] --> B[Match app/router stack in definition order]
  B -->|path+method match| C[Run handler/middleware #1]
  C -->|res.* sends response| D[Response ended]
  C -->|next()| E[Run next handler in same route/stack]
  C -->|next('route')| F[Skip remaining handlers for this route]
  F --> B
  C -->|next(err)| G[Skip to error-handling middleware]
  G --> H[Error handler sends response or delegates]
  H --> D
```

Express’s “multiple callbacks + `next()`” model is described in the routing guide; error skipping semantics (“passing anything to `next()` except `'route'` means treat as error and skip non-error handlers”) are described in the error-handling guide. citeturn4view0turn12view2

### Response methods

A route handler typically completes the request by sending a response. The routing guide lists several response methods commonly used in routes (e.g., `res.send()`, `res.json()`, `res.download()`, etc.). citeturn3view4

Below is a routing-focused consolidation from the Express 5 API reference. citeturn21view1turn21view2turn22view1turn21view4turn23view2

| Response API | Typical usage in routing | Key caveats and notes |
|---|---|---|
| `res.send(body)` | Send text/HTML/buffer/object | Sets `Content-Length` automatically; sends JSON when body is array/object. citeturn21view2 |
| `res.json(body)` | Send JSON with correct content-type | Body is JSON-stringified; supports `null`, objects, arrays, numbers, etc. citeturn23view0 |
| `res.jsonp(body)` | JSONP responses | Callback name defaults to `callback` (configurable). citeturn22view2 |
| `res.sendFile(path, options, fn)` | Serve a specific file from a route | If no `root`, `path` must be absolute; consider `root` containment to reduce traversal risk; callback must handle errors (end response or `next(err)`). citeturn21view3turn21view4 |
| `res.download(path, filename, options, fn)` | Force file download | Callback must handle errors; response may be partially sent → check `res.headersSent`. citeturn22view1 |
| `res.redirect([status], path)` | Redirect to another URL | Express sets `Location` without validating user input; protect against open redirects (see security best practices). citeturn21view0turn29search1 |
| `res.location(path)` | Set `Location` header | URL is passed without validation; browsers resolve relative URLs. citeturn23view3turn21view0 |
| `res.sendStatus(code)` | `status(code).send(text)` shorthand | Node may throw on invalid status codes (outside 100–599). citeturn21view4 |
| `res.end()` | End response quickly (Node core) | Comes from Node’s `http.ServerResponse`; use when you don’t need a body. citeturn22view0 |
| `res.render(view, locals, cb)` | Render template and send HTML | `view` and `locals` should not contain user-controlled input; callback form does not auto-send and must send explicitly. citeturn21view1turn23view4 |

Security note (routing-adjacent): Express’s Security Best Practices page explicitly calls out **open redirects** as a risk when using `res.redirect` with user-controlled URLs and provides an allowlist-based example. citeturn29search1turn21view0

### app.route()

`app.route()` creates **chainable route handlers** for a single route path. The benefit is that the path is defined once, reducing duplication and typos, and improving modularity. citeturn3view4turn6view0

From the routing guide:

```js
app.route('/book')
  .get((req, res) => {
    res.send('Get a random book')
  })
  .post((req, res) => {
    res.send('Add a book')
  })
  .put((req, res) => {
    res.send('Update the book')
  })
```

citeturn3view4turn6view0

### express.Router

`express.Router()` is used to create modular, mountable route handlers (“mini-apps”). A router is a complete middleware and routing system. citeturn3view4turn6view0

From the routing guide (router module example):

`birds.js`:

```js
const express = require('express')
const router = express.Router()

// middleware that is specific to this router
const timeLog = (req, res, next) => {
  console.log('Time: ', Date.now())
  next()
}
router.use(timeLog)

// define the home page route
router.get('/', (req, res) => {
  res.send('Birds home page')
})
// define the about route
router.get('/about', (req, res) => {
  res.send('About birds')
})

module.exports = router
```

Main app mounting:

```js
const birds = require('./birds')

// ...

app.use('/birds', birds)
```

This setup handles `/birds` and `/birds/about` and runs the router-specific middleware (`timeLog`). citeturn6view0

#### Router behavior that commonly surprises teams

Mount path stripping: in the Express 5 API reference, when a router is mounted (e.g., `app.use('/foo', router)`), the mount path is stripped and not visible to the middleware function; this is intended so mounted middleware can operate regardless of prefix. citeturn18view1turn18view3

Middleware order: the order in which you define middleware with `router.use()` is important, invoked sequentially (affects precedence). citeturn18view1turn12view0

Cross-router middleware bleed: the API reference warns that if you mount two routers on the same path, middleware added via one router may run for requests handled by the other router if their paths match—so avoid mounting multiple routers on the same base path unless you intend that behavior. citeturn18view4

#### Mermaid: middleware order and precedence

```mermaid
flowchart TD
  A[Request enters app] --> B[app.use / app.METHOD in registration order]
  B --> C[Router mounted at /api]
  C --> D[router.use middleware #1]
  D -->|next()| E[router.use middleware #2]
  E -->|next()| F[router.METHOD route handler]
  F -->|res.send/res.json/res.end| G[Response ends]
  F -->|next(err)| H[Error-handling middleware (4 args)]
  H --> G
```

This diagram corresponds to Express’s documented “first loaded → first executed” middleware rule and to the “default error handler is added at the end of the stack” rule from the error-handling docs. citeturn12view0turn12view2

## Express 5 compatibility notes and deprecations relevant to routing

Express 5 is a supported major with meaningful breaking changes, especially around routing path syntax and async behavior.

### Node.js minimum and supported versions

Express 5 requires **Node.js 18+** (explicitly stated in the Express 5 API reference and in the Express 5 release announcement). citeturn20search0turn25view0

Because Node 18 is end-of-life on the official Node release page, prefer Node Active/Maintenance LTS lines in production. citeturn26view1

### Path route matching syntax changes

The Express 5 migration guide explicitly documents changes when a **string** is supplied as the path argument to `app.use`, `app.METHOD`, `router.use`, etc. Key changes include:

- Wildcard `*` must have a name: use `/*splat` instead of `/*`. citeturn13view0turn13view1  
- `*splat` does **not** match the root path; to include `/`, use `/{*splat}` (wildcard in braces). citeturn13view0turn13view1  
- Optional `?` is no longer supported; use braces (e.g., `/:file{.:ext}`). citeturn13view1turn16view0  
- Regexp characters are not supported in string paths; instead use arrays of literal paths or regex route paths. citeturn13view1turn16view0  
- Some characters are reserved (`()[]?+!`) and must be escaped to match literally. citeturn13view3turn16view0  
- Parameter name rules changed (valid JS identifiers, or quoted). citeturn13view3turn16view0  

These changes correspond to the move to `path-to-regexp` v8+ syntax used by Express’s router layer. citeturn16view0turn13view1

### Rejected promises and async handlers

Express 5 handles rejected promises from middleware/handlers by forwarding them to error-handling middleware, making `async` middleware easier to use. citeturn13view3turn9view1

## Practical guidance, pitfalls, best practices, and runnable examples

### How to run the examples

All examples below assume Node and npm are installed, and target Express 5.x (Node 18+ required). citeturn20search0turn25view0

```bash
mkdir express-routing-demo
cd express-routing-demo
npm init -y
npm install express
node app.js
```

Express 5 became the default npm install target (`latest` dist-tag) as described in the official Express blog post. citeturn25view1

### Common pitfalls and best practices

Middleware/route ordering:

- Middleware is executed in the order it is loaded; if you register middleware after a route that ends the response, the request may never reach that middleware. citeturn12view0turn18view1  
- Put logging, security headers, authentication gates, and body parsers **before** routes that require them. (Order rationale is explicitly documented.) citeturn12view0turn12view2  

Avoid “route hangs”:

- If you neither end the response (e.g., `res.send`) nor call `next()`, the request/response cycle can stall. Error-handling docs warn that if you don’t call `next` in an error handler, you must end the response; otherwise requests can “hang.” citeturn12view2  

Router mounting surprises:

- Mount path stripping is normal; if you need the original URL, use `req.originalUrl` (API reference lists it) and remember `req.url` may be modified by mounting. citeturn18view1turn19view1  
- If multiple routers are mounted at the same base path, middleware may run for routes you didn’t expect; use distinct mount paths to avoid unintended overlap. citeturn18view4  

Security-sensitive routing operations:

- Treat `res.sendFile`/`res.render` view paths as sensitive: do not build them from user input unless you constrain them (the API docs warn about filesystem/module evaluation risks). citeturn21view1turn21view3  
- Validate and allowlist destinations used with `res.redirect` and `res.location` to prevent open redirects. citeturn29search1turn21view0  

### Example app

Create `app.js`:

```js
const express = require('express')
const app = express()

// Example: application-level middleware
app.use((req, res, next) => {
  console.log('Time:', Date.now())
  next()
})

// Example: basic routes
app.get('/', (req, res) => res.send('hello world'))
app.post('/', (req, res) => res.send('POST to homepage'))

// Example: app.all for all verbs under /secret
app.all('/secret', (req, res, next) => {
  console.log('Accessing the secret section ...')
  next()
})
app.get('/secret', (req, res) => res.send('Secret GET ok'))

// Example: route parameters
app.get('/users/:userId/books/:bookId', (req, res) => {
  res.json(req.params)
})

// Example: Express 5 catch-all (named wildcard; includes root)
app.all('/{*splat}', (req, res) => {
  res.status(404).send(`No route: ${req.method} ${req.path}`)
})

app.listen(3000, () => console.log('Listening on http://localhost:3000'))
```

This example composes the guide’s basics (`app.get`, `app.post`, `app.all`, params) and applies Express 5 wildcard syntax documented in the migration guide and `path-to-regexp`. citeturn4view0turn4view2turn5view0turn13view1turn16view0

### Full minimal modular router app

File structure:

```text
.
├─ app.js
└─ birds.js
```

`birds.js` (from the routing guide):

```js
const express = require('express')
const router = express.Router()

// middleware that is specific to this router
const timeLog = (req, res, next) => {
  console.log('Time: ', Date.now())
  next()
}
router.use(timeLog)

// define the home page route
router.get('/', (req, res) => {
  res.send('Birds home page')
})

// define the about route
router.get('/about', (req, res) => {
  res.send('About birds')
})

module.exports = router
```

`app.js`:

```js
const express = require('express')
const app = express()

const birds = require('./birds')
app.use('/birds', birds)

app.listen(3000, () => console.log('Listening on http://localhost:3000'))
```

This matches the official router example and demonstrates router-local middleware executed for `/birds` routes. citeturn6view0

If you later mount this router with parent params like `/teams/:teamId/birds`, remember you must enable `mergeParams` to see `teamId` within `birds.js`. citeturn6view0turn20search0

### Middleware order comparison table

The following table is a practical recommended ordering for many APIs (not a hard rule), grounded in Express’s documented “first loaded → first executed” behavior and “error handler last” rule. citeturn12view0turn12view2turn18view1

| Order | Layer | Why it’s placed here | Key gotcha |
|---|---|---|---|
| Early | Logging + request IDs | Observability for all requests | If placed after routes that end responses, you miss logs. citeturn12view0 |
| Early | Security middleware / auth gates | Reject unauthorized traffic quickly | Ensure public routes (health checks) are mounted before auth if needed. citeturn18view1 |
| Before routes | Body parsers (`express.json`, `express.urlencoded`) | Populate `req.body` for handlers | Express warns `req.body` is user-controlled: validate before use. citeturn20search0turn12view2 |
| Routes | Routers and route handlers | Main endpoint logic | Always send a response or call `next()`. citeturn4view0 |
| Late | 404 catch-all | Centralize “not found” handling | In Express 5, use named wildcards; do not use `*` unnamed in string paths. citeturn13view1turn16view0 |
| Last | Error-handling middleware | Capture thrown errors / `next(err)` | Must have 4 args `(err, req, res, next)` to be treated as error middleware. citeturn12view1turn12view2 |

## Short FAQ and references

### FAQ

**What is the difference between `app.use()` and `app.get()` (or `app.METHOD()`)?**  
`app.METHOD()` registers handlers for a specific HTTP method and path; `app.use()` registers middleware that runs for any method and matches by path prefix (mount path). citeturn12view1turn19view4

**Why does my middleware not run?**  
Most often because middleware is registered after a route that ends the response. Express middleware runs in registration order; routes that terminate the response prevent later middleware from running unless `next()` is called. citeturn12view0turn12view2

**How do I implement a catch-all route in Express 5?**  
Use a named wildcard like `/{*splat}` (includes root) or `/*splat` (does not include root), per the Express 5 migration guide and `path-to-regexp` syntax. citeturn13view1turn16view0

**Are query strings part of route matching?**  
No. Express matches routes against the path, not the query string; the docs explicitly warn query strings are not part of the route path. citeturn4view4turn19view4

**How should I validate route parameters in Express 5 if inline regex path constraints are unreliable?**  
Prefer validating inside middleware/handlers and returning 400/404 (or calling `next('route')`), or use a regex route (`RegExp`) if you need strict regex-based matching and can accept numeric capture groups. citeturn5view3turn19view4turn16view0

### References

Primary routing sources:

- Express Routing guide: https://expressjs.com/en/guide/routing.html citeturn4view0turn11search8  
- Express 5 Migration guide: https://expressjs.com/en/guide/migrating-5.html citeturn13view1turn9view1  
- Express 5.x API reference: https://expressjs.com/en/5x/api.html citeturn20search0turn19view4turn21view2  
- `path-to-regexp` (syntax used by Express for string paths): https://github.com/pillarjs/path-to-regexp citeturn16view0  

Middleware and error handling:

- Using middleware: https://expressjs.com/en/guide/using-middleware.html citeturn12view1  
- Writing middleware: https://expressjs.com/en/guide/writing-middleware.html citeturn12view0  
- Error handling: https://expressjs.com/en/guide/error-handling.html citeturn12view2  

Support and security:

- Express Version Support: https://expressjs.com/en/support/ citeturn26view0  
- Express blog (Express 5 LTS timeline): https://expressjs.com/2025/03/31/v5-1-latest-release.html citeturn25view1  
- Express Security Best Practices (open redirects): https://expressjs.com/en/advanced/best-practice-security.html citeturn29search1  
- Express website license (CC BY 4.0): https://github.com/expressjs/expressjs.com/blob/gh-pages/LICENSE.md citeturn24view0  

Node runtime reference:

- Node.js releases (LTS/current status): https://nodejs.org/en/about/previous-releases citeturn26view1