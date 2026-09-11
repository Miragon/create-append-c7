import type { C7ElementTemplate, TemplateElementFactory } from "./TemplateElementFactory";

const APPLY_TEMPLATE_PRIORITY = 1500;

/**
 * Applies templates to adapter-created shapes as part of the surrounding
 * shape.create transaction, after the shape has been attached to the model.
 */
export class ApplyTemplateOnShapeCreateBehavior {
    static $inject = ["eventBus", "commandStack", "c7TemplateElementFactory"];

    constructor(eventBus: any, commandStack: any, templateElementFactory: TemplateElementFactory) {
        eventBus.on(
            "commandStack.shape.create.postExecute",
            APPLY_TEMPLATE_PRIORITY,
            (event: any) => {
                const element = event.context.shape;
                const template = templateElementFactory.getPendingTemplate(element);

                if (!template) {
                    return;
                }

                commandStack.execute("propertiesPanel.camunda.changeTemplate", {
                    element,
                    oldTemplate: null,
                    newTemplate: omitElementType(template),
                });

                templateElementFactory.consumePendingTemplate(element);
            },
        );
    }
}

function omitElementType(template: C7ElementTemplate): C7ElementTemplate {
    const { elementType: _elementType, ...templateWithoutElementType } = template;

    return templateWithoutElementType as C7ElementTemplate;
}
