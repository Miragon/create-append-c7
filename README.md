# @miragon/create-append-c7

> **Renamed package.** This is the continuation of
> [`@miragon/miranum-create-append-c7-element-templates`](https://www.npmjs.com/package/@miragon/miranum-create-append-c7-element-templates).
> npm packages cannot be renamed in place, so the project moved to this
> de-prefixed name starting at `0.1.0`. The legacy package is deprecated and
> receives no further updates — switch your dependency to
> `@miragon/create-append-c7`.

A [bpmn-js](https://github.com/bpmn-io/bpmn-js) DI module that polyfills
`elementTemplates.createElement()` for the **Camunda 7** modeler, so the
[`bpmn-js-create-append-anything`](https://github.com/bpmn-io/bpmn-js-create-append-anything)
plugin can create elements that already carry an element template.

## Why this exists

`bpmn-js-create-append-anything` calls `elementTemplates.createElement(template)`
to instantiate a shape that is preconfigured with a template. The Camunda 7
element-templates build does **not** ship `createElement`, so append-anything
cannot create template-preconfigured elements out of the box. This module patches
the missing method onto the C7 element-templates service at modeler startup.

> The Camunda 8 (Cloud) build already ships `createElement`, so this polyfill is
> only needed for the Camunda 7 (Platform) modeler.

## Install

```bash
npm install @miragon/create-append-c7
```

### Peer dependencies

This module is a thin add-on to your existing bpmn-js stack and declares its
hosts as peer dependencies:

| Peer | Supported range |
|---|---|
| `bpmn-js` | `^18.0.0` |
| `bpmn-js-create-append-anything` | `^1.2.0` |

## Usage

Register the module as an `additionalModule` when you construct the Camunda 7
modeler:

```ts
import { CreateAppendC7ElementTemplatesModule } from "@miragon/create-append-c7";

const modeler = new BpmnModeler({
    additionalModules: [
        CreateAppendC7ElementTemplatesModule,
        // ...your other modules (e.g. CreateAppendElementTemplatesModule)
    ],
});
```

The module installs itself on init: it patches `elementTemplates.createElement`
only when the host service does not already provide it, so it is safe to leave
registered even if a future bpmn-js / Camunda build adds the method natively.

## License

[MIT](./LICENSE)
