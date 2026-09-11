/**
 * bpmn-js DI module that polyfills `elementTemplates.createElement()` for
 * the Camunda 7 modeler, enabling the `bpmn-js-create-append-anything`
 * plugin to create template-preconfigured elements.
 *
 * Register as an `additionalModule` when creating the C7 bpmn-js modeler:
 * ```ts
 * import { CreateAppendC7ElementTemplatesModule } from "@miragon/create-append-c7";
 *
 * new BpmnModeler({ additionalModules: [CreateAppendC7ElementTemplatesModule] });
 * ```
 */
import { ApplyTemplateOnShapeCreateBehavior } from "./ApplyTemplateOnShapeCreateBehavior";
import { ExtendElementTemplates } from "./ExtendElementTemplates";
import { TemplateElementFactory } from "./TemplateElementFactory";

export const CreateAppendC7ElementTemplatesModule = {
    __init__: ["c7ExtendedElementTemplates"],
    c7ExtendedElementTemplates: ["type", ExtendElementTemplates],
    c7TemplateElementFactory: ["type", TemplateElementFactory],
    c7ApplyTemplateOnShapeCreateBehavior: ["type", ApplyTemplateOnShapeCreateBehavior],
};
