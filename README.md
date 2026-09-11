# @miragon/create-append-c7

[![npm version](https://img.shields.io/npm/v/@miragon/create-append-c7.svg)](https://www.npmjs.com/package/@miragon/create-append-c7)
[![Build](https://github.com/Miragon/create-append-c7/actions/workflows/build.yml/badge.svg?branch=main)](https://github.com/Miragon/create-append-c7/actions/workflows/build.yml)
[![MIT License](https://img.shields.io/github/license/Miragon/create-append-c7)](./LICENSE)

A [bpmn-js](https://github.com/bpmn-io/bpmn-js) DI module that polyfills
`elementTemplates.createElement()` for the **Camunda 7** modeler, so the
[`bpmn-js-create-append-anything`](https://github.com/bpmn-io/bpmn-js-create-append-anything)
plugin can create elements that already carry an element template.

> **Renamed package.** This is the continuation of
> [`@miragon/miranum-create-append-c7-element-templates`](https://www.npmjs.com/package/@miragon/miranum-create-append-c7-element-templates).
> npm packages cannot be renamed in place, so the project moved to this
> de-prefixed name starting at `0.1.0`. The legacy package is deprecated and
> receives no further updates — switch your dependency to
> `@miragon/create-append-c7`.

## Why this exists

`bpmn-js-create-append-anything` calls `elementTemplates.createElement(template)`
to instantiate a shape. The Camunda 7 element-templates build does **not** ship
that method, so append-anything cannot create template-preconfigured elements
out of the box. This module patches the missing method onto the C7
element-templates service at modeler startup.

The returned preview already has the resolved BPMN type, event definition, and
template identity. Template bindings are deliberately deferred until the shape
is placed on a diagram. This lets bindings safely access the process definitions
and keeps creation, configuration, and automatic-append connections in one undo
step.

> The Camunda 8 (Cloud) build already ships `createElement`, so this polyfill is
> only needed for the Camunda 7 (Platform) modeler.

## Install

```bash
yarn add @miragon/create-append-c7
```

### Peer dependencies

This module is a thin add-on to your existing bpmn-js stack and declares its
hosts as peer dependencies:

| Peer | Supported range |
|---|---|
| `bpmn-js` | `^18.0.0` |
| `bpmn-js-create-append-anything` | `^1.2.0 \|\| ^2.0.0` |
| `bpmn-js-element-templates` | `^2.27.0` |

The tested host combinations are:

| bpmn-js | Create/append | Element templates |
|---:|---:|---:|
| 18.16.1 | 1.2.0 | 2.27.0 |
| 18.25.1 | 2.0.0 | 2.33.0 |
| 18.28.0 | 1.2.0 | 2.35.0 |
| 18.28.0 | 2.0.0 | 2.35.0 |

Create/append 2.x itself requires bpmn-js 18.22 or newer; its stricter host
requirements still apply.

## Usage

Register the module as an `additionalModule` when you construct the Camunda 7
modeler:

```ts
import { ElementTemplatesCoreModule } from "bpmn-js-element-templates/core";
import { CreateAppendElementTemplatesModule } from "bpmn-js-create-append-anything";
import { CreateAppendC7ElementTemplatesModule } from "@miragon/create-append-c7";
import camundaModdle from "camunda-bpmn-moddle/resources/camunda.json";

const modeler = new BpmnModeler({
    additionalModules: [
        ElementTemplatesCoreModule,
        CreateAppendElementTemplatesModule,
        CreateAppendC7ElementTemplatesModule,
    ],
    moddleExtensions: {
        camunda: camundaModdle,
    },
});
```

Register the C7 element-templates module and create/append module as normal; this
adapter does not install either host module for you. It patches
`elementTemplates.createElement` only when the host service does not already
provide it. Native implementations and their `templateElementFactory` service
are left untouched, regardless of module registration order.

The example uses the headless `ElementTemplatesCoreModule`. Applications that
show template controls in the properties panel can register
`ElementTemplatesPropertiesProviderModule` and its properties-panel dependencies
instead; that module already includes the C7 core.

`createElement(template, options?)` accepts omitted or empty options. C8-style
template presets are not supported and a supplied `presetId` throws before a
shape is allocated.

## Timing and undo behavior

Starting with 0.2.0, `createElement()` returns a detached preview without applied
bindings. Bindings are applied by the upstream C7
`propertiesPanel.camunda.changeTemplate` command during `shape.create`. Direct
callers that previously inspected bindings before placement must move that work
after creation completes.

Canceled previews do not affect the diagram or command history. Once placed,
one undo removes the whole configured creation; redo restores the recorded
bindings without applying them a second time.

## Development

Use Node.js 22 and Corepack. The repository pins Yarn 4.18.0 and uses
`node_modules` for dependency resolution.

```bash
corepack enable
yarn install --immutable
yarn playwright install chromium
yarn check
yarn npm audit --all --recursive --severity high
```

`yarn check` runs the Chromium tests and validates the package contents;
`prepack` builds the JavaScript and declarations. Use `yarn build` to compile
without running tests. Commit `yarn.lock` when changing dependencies.

## Releases

Maintainers use [Conventional Commits](https://www.conventionalcommits.org/) to
drive version bumps and release notes. Merge the release-please PR to create the
matching GitHub release and publish it to npm using Yarn and OIDC Trusted
Publishing. If publishing fails, retry the failed publish job from that original
release workflow run. Already-published
versions are skipped. Manual Publish workflow runs only validate the package;
they never upload it. The supplied release tag must match the package version.

For a local publish preview after installing Chromium, run:

```bash
yarn npm publish --access public --dry-run
```

Publishing runs the browser tests in `prepublish` and builds in `prepack`.

## License

Licensed under the [MIT License](./LICENSE). Copyright © 2026 Miragon GmbH.
