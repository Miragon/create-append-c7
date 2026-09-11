import { getBusinessObject } from "bpmn-js/lib/util/ModelUtil";

/**
 * The subset of the C7 element-template schema needed by the adapter.
 * Additional template fields are deliberately retained for the upstream
 * change-template command.
 */
export interface C7ElementTemplate {
    id: string;
    version?: number;
    appliesTo?: string[];
    elementType?: {
        value?: string;
        eventDefinition?: string;
    };
    [key: string]: unknown;
}

export interface CreateElementOptions {
    presetId?: string;
}

/**
 * Creates detached C7 shapes and remembers the template that must be applied
 * once the shape is attached to a diagram.
 */
export class TemplateElementFactory {
    static $inject = ["elementFactory"];

    private readonly elementFactory: any;

    private readonly pendingTemplates = new WeakMap<object, C7ElementTemplate>();

    constructor(elementFactory: any) {
        this.elementFactory = elementFactory;
    }

    /**
     * Create a detached preview. No editing command is executed here because
     * C7 bindings may need the shape's parent and the diagram definitions.
     */
    create(template: C7ElementTemplate, options: CreateElementOptions = {}): any {
        if (!template) {
            throw new Error("template is missing");
        }

        if (options?.presetId !== undefined) {
            throw new Error("C7 element template presets are not supported");
        }

        const selectedTemplate = cloneTemplate(template);
        const type =
            selectedTemplate.elementType?.value ?? selectedTemplate.appliesTo?.[0];

        if (!type) {
            throw new Error("template element type is missing");
        }

        const attrs: Record<string, unknown> = { type };

        if (selectedTemplate.elementType?.eventDefinition) {
            attrs.eventDefinitionType = selectedTemplate.elementType.eventDefinition;
        }

        const element = this.elementFactory.createShape(attrs);
        const businessObject = getBusinessObject(element);

        businessObject.set("camunda:modelerTemplate", selectedTemplate.id);
        businessObject.set("camunda:modelerTemplateVersion", selectedTemplate.version);

        this.pendingTemplates.set(element, selectedTemplate);

        return element;
    }

    getPendingTemplate(element: object): C7ElementTemplate | undefined {
        return this.pendingTemplates.get(element);
    }

    consumePendingTemplate(element: object): void {
        this.pendingTemplates.delete(element);
    }
}

function cloneTemplate<T>(value: T): T {
    if (Array.isArray(value)) {
        return value.map((entry) => cloneTemplate(entry)) as T;
    }

    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value).map(([key, entry]) => [key, cloneTemplate(entry)]),
        ) as T;
    }

    return value;
}
