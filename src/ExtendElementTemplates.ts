/**
 * Polyfills `elementTemplates.createElement()` on the C7 element templates
 * service if the method does not already exist.
 *
 * The `bpmn-js-create-append-anything` plugin calls `createElement()` to
 * produce a template-aware detached shape, but the Camunda 7 properties panel
 * does not ship this method. This class bridges the gap by delegating to
 * {@link TemplateElementFactory}.
 */
import type {
    C7ElementTemplate,
    CreateElementOptions,
    TemplateElementFactory,
} from "./TemplateElementFactory";

/**
 * DI initialiser that patches `createElement` onto the C7 element templates
 * service instance at startup.
 */
export class ExtendElementTemplates {
    static $inject = ["elementTemplates", "injector"];

    /**
     * Checks whether `createElement` already exists on the element templates
     * service.  If not, assigns it as an instance method that delegates to
     * the {@link TemplateElementFactory}.
     *
     * @param elementTemplates The bpmn-js element templates service.
     * @param injector The modeler's dependency injector, used only for the C7 fallback.
     */
    constructor(elementTemplates: any, injector: any) {
        if (typeof elementTemplates.createElement === "function") {
            return;
        }

        const templateElementFactory = injector.get(
            "c7TemplateElementFactory",
        ) as TemplateElementFactory;

        // Instantiation registers the shape-create listener.
        injector.get("c7ApplyTemplateOnShapeCreateBehavior");

        elementTemplates.createElement = (
            template: C7ElementTemplate,
            options?: CreateElementOptions,
        ) => templateElementFactory.create(template, options);
    }
}
