import Modeler from "bpmn-js/lib/Modeler";
import { getBusinessObject } from "bpmn-js/lib/util/ModelUtil";
import {
    CloudElementTemplatesCoreModule,
    ElementTemplatesCoreModule,
} from "bpmn-js-element-templates/core";
import { CreateAppendElementTemplatesModule } from "bpmn-js-create-append-anything";
import camundaModdle from "camunda-bpmn-moddle/resources/camunda.json";
import zeebeModdle from "zeebe-bpmn-moddle/resources/zeebe.json";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CreateAppendC7ElementTemplatesModule } from "../src";
import { TemplateElementFactory } from "../src/TemplateElementFactory";

const EMPTY_DIAGRAM = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="true" />
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1" />
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

const modelers: any[] = [];

afterEach(() => {
    modelers.splice(0).forEach((modeler) => modeler.destroy());
    document.body.innerHTML = "";
});

describe("placement-based C7 template adapter", () => {
    it("defers bindings until placement and keeps the resolved shape identity", async () => {
        const modeler = await createModeler();
        const elementTemplates = modeler.get("elementTemplates");
        const commandStack = modeler.get("commandStack");
        const modeling = modeler.get("modeling");
        const canvas = modeler.get("canvas");
        const template = {
            name: "Send task",
            id: "example.send-task",
            version: 0,
            appliesTo: ["bpmn:Task", "bpmn:SendTask"],
            elementType: { value: "bpmn:SendTask" },
            properties: [
                {
                    label: "Name",
                    type: "String",
                    value: "Configured",
                    binding: { type: "property", name: "name" },
                },
            ],
        };

        elementTemplates.set([template]);

        const shape = elementTemplates.createElement(template);
        const businessObject = getBusinessObject(shape);

        expect(businessObject.$type).toBe("bpmn:SendTask");
        expect(businessObject.name).toBeUndefined();
        expect(businessObject.get("camunda:modelerTemplate")).toBe(template.id);
        expect(businessObject.get("camunda:modelerTemplateVersion")).toBe(0);
        expect(commandStack.canUndo()).toBe(false);

        const placed = modeling.createShape(shape, { x: 250, y: 150 }, canvas.getRootElement());

        expect(placed).toBe(shape);
        expect(getBusinessObject(shape).name).toBe("Configured");
        expect(commandStack.canUndo()).toBe(true);

        commandStack.undo();
        expect(modeler.get("elementRegistry").get(shape.id)).toBeUndefined();

        commandStack.redo();
        const redone = modeler.get("elementRegistry").get(shape.id);
        expect(redone).toBe(shape);
        expect(getBusinessObject(redone).name).toBe("Configured");
    });

    it("uses appliesTo fallback and preserves event definitions and optional versions", async () => {
        const modeler = await createModeler();
        const elementTemplates = modeler.get("elementTemplates");
        const modeling = modeler.get("modeling");
        const root = modeler.get("canvas").getRootElement();
        const taskTemplate = deepFreeze({
            name: "Unversioned task",
            id: "example.unversioned",
            appliesTo: ["bpmn:UserTask"],
            properties: [
                {
                    type: "Hidden",
                    value: "candidate-users",
                    binding: { type: "property", name: "camunda:candidateUsers" },
                },
            ],
        });
        const eventTemplate = deepFreeze({
            name: "Signal event",
            id: "example.signal-event",
            appliesTo: ["bpmn:IntermediateThrowEvent"],
            elementType: {
                value: "bpmn:IntermediateThrowEvent",
                eventDefinition: "bpmn:SignalEventDefinition",
            },
            properties: [],
        });

        elementTemplates.set([taskTemplate, eventTemplate]);

        const task = elementTemplates.createElement(taskTemplate, {});
        const event = elementTemplates.createElement(eventTemplate, { presetId: undefined });

        expect(getBusinessObject(task).$type).toBe("bpmn:UserTask");
        expect(getBusinessObject(task).get("camunda:modelerTemplateVersion")).toBeUndefined();
        expect(getBusinessObject(event).eventDefinitions[0].$type).toBe(
            "bpmn:SignalEventDefinition",
        );

        modeling.createShape(task, { x: 200, y: 160 }, root);
        modeling.createShape(event, { x: 400, y: 160 }, root);

        expect(getBusinessObject(task).get("camunda:candidateUsers")).toBe("candidate-users");

        const { xml } = await modeler.saveXML({ format: true });
        expect(xml).toContain('camunda:modelerTemplate="example.unversioned"');
        expect(xml).not.toContain("modelerTemplateVersion");
        expect(xml).toContain("bpmn:signalEventDefinition");
    });

    it("retains the selected template values while a preview is pending", async () => {
        const modeler = await createModeler();
        const elementTemplates = modeler.get("elementTemplates");
        const selected = {
            ...simpleTemplate("example.versioned", "Version one"),
            version: 1,
        };
        const replacement = {
            ...simpleTemplate("example.versioned", "Version two"),
            version: 2,
        };

        elementTemplates.set([selected]);
        const preview = elementTemplates.createElement(selected);

        selected.properties[0].value = "Mutated caller value";
        elementTemplates.set([replacement]);
        modeler
            .get("modeling")
            .createShape(preview, { x: 250, y: 150 }, modeler.get("canvas").getRootElement());

        expect(getBusinessObject(preview).name).toBe("Version one");
        expect(getBusinessObject(preview).get("camunda:modelerTemplateVersion")).toBe(1);
    });

    it("applies C7 property, IO, listener, connector, and error-reference bindings", async () => {
        const modeler = await createModeler();
        const elementTemplates = modeler.get("elementTemplates");
        const template = {
            name: "All bindings",
            id: "example.all-bindings",
            version: 1,
            appliesTo: ["bpmn:ServiceTask"],
            properties: [
                {
                    type: "Hidden",
                    value: "Configured service",
                    binding: { type: "property", name: "name" },
                },
                {
                    type: "Hidden",
                    value: "input-value",
                    binding: { type: "camunda:inputParameter", name: "input-name" },
                },
                {
                    type: "Hidden",
                    value: "output-name",
                    binding: { type: "camunda:outputParameter", source: "output-source" },
                },
                {
                    type: "Hidden",
                    value: "println execution.eventName",
                    binding: {
                        type: "camunda:executionListener",
                        event: "start",
                        scriptFormat: "groovy",
                    },
                },
                {
                    type: "Hidden",
                    value: "error-expression",
                    binding: { type: "camunda:errorEventDefinition", errorRef: "template-error" },
                },
            ],
            scopes: [
                {
                    type: "camunda:Connector",
                    properties: [
                        {
                            type: "Hidden",
                            value: "http-connector",
                            binding: { type: "property", name: "connectorId" },
                        },
                        {
                            type: "Hidden",
                            value: "https://example.test",
                            binding: { type: "camunda:inputParameter", name: "url" },
                        },
                    ],
                },
                {
                    type: "bpmn:Error",
                    id: "template-error",
                    properties: [
                        {
                            type: "Hidden",
                            value: "E_TEST",
                            binding: { type: "property", name: "errorCode" },
                        },
                        {
                            type: "Hidden",
                            value: "Test error",
                            binding: { type: "property", name: "name" },
                        },
                    ],
                },
            ],
        };

        elementTemplates.set([template]);
        const shape = elementTemplates.createElement(template);
        modeler
            .get("modeling")
            .createShape(shape, { x: 300, y: 200 }, modeler.get("canvas").getRootElement());

        const { xml } = await modeler.saveXML({ format: true });

        expect(xml).toContain('name="Configured service"');
        expect(xml).toContain('<camunda:inputParameter name="input-name">input-value');
        expect(xml).toContain('<camunda:outputParameter name="output-name">output-source');
        expect(xml).toContain('<camunda:executionListener event="start">');
        expect(xml).toContain('<camunda:connectorId>http-connector</camunda:connectorId>');
        expect(xml).toContain('<camunda:inputParameter name="url">https://example.test');
        const errorId = xml.match(
            /<bpmn:error id="([^"]+)" name="Test error" errorCode="E_TEST"/,
        )?.[1];
        expect(errorId).toBeDefined();
        expect(xml).toContain(`errorRef="${errorId}"`);

        const beforeUndo = xml;
        modeler.get("commandStack").undo();
        modeler.get("commandStack").redo();

        const { xml: afterRedo } = await modeler.saveXML({ format: true });
        expect(normalizeGeneratedIds(afterRedo)).toBe(normalizeGeneratedIds(beforeUndo));
        expect((afterRedo.match(/<bpmn:error /g) ?? []).length).toBe(1);
        expect((afterRedo.match(/<camunda:connector>/g) ?? []).length).toBe(1);
    });

    it("keeps canceled previews out of the diagram and preserves an existing redo branch", async () => {
        const modeler = await createModeler();
        const elementTemplates = modeler.get("elementTemplates");
        const modeling = modeler.get("modeling");
        const root = modeler.get("canvas").getRootElement();
        const commandStack = modeler.get("commandStack");
        const elementFactory = modeler.get("elementFactory");
        const template = simpleTemplate("example.canceled");

        elementTemplates.set([template]);
        const existing = elementFactory.createShape({ type: "bpmn:Task" });
        modeling.createShape(existing, { x: 200, y: 150 }, root);
        commandStack.undo();

        const { xml: before } = await modeler.saveXML({ format: true });
        const preview = elementTemplates.createElement(template);
        const { xml: after } = await modeler.saveXML({ format: true });

        expect(preview.parent).toBeUndefined();
        expect(commandStack.canUndo()).toBe(false);
        expect(commandStack.canRedo()).toBe(true);
        expect(after).toBe(before);
    });

    it("lets explicit selection win over a registered default", async () => {
        const modeler = await createModeler();
        const elementTemplates = modeler.get("elementTemplates");
        const selected = simpleTemplate("example.selected", "Selected");
        const fallback = {
            ...simpleTemplate("example.default", "Default"),
            isDefault: true,
        };

        elementTemplates.set([fallback, selected]);
        const shape = elementTemplates.createElement(selected);
        modeler
            .get("modeling")
            .createShape(shape, { x: 250, y: 150 }, modeler.get("canvas").getRootElement());

        expect(getBusinessObject(shape).get("camunda:modelerTemplate")).toBe(selected.id);
        expect(getBusinessObject(shape).name).toBe("Selected");

        const unrelated = modeler.get("elementFactory").createShape({ type: "bpmn:Task" });
        modeler
            .get("modeling")
            .createShape(unrelated, { x: 450, y: 150 }, modeler.get("canvas").getRootElement());
        expect(getBusinessObject(unrelated).get("camunda:modelerTemplate")).toBe(fallback.id);
        expect(getBusinessObject(unrelated).name).toBe("Default");
    });

    it("groups automatic append, its connection, and bindings into one undo step", async () => {
        const modeler = await createModeler([CreateAppendElementTemplatesModule]);
        const elementTemplates = modeler.get("elementTemplates");
        const elementFactory = modeler.get("elementFactory");
        const modeling = modeler.get("modeling");
        const commandStack = modeler.get("commandStack");
        const registry = modeler.get("elementRegistry");
        const root = modeler.get("canvas").getRootElement();
        const template = simpleTemplate("example.appended", "Appended");

        elementTemplates.set([template]);
        const source = elementFactory.createShape({ type: "bpmn:StartEvent" });
        modeling.createShape(source, { x: 150, y: 180 }, root);
        commandStack.clear();

        const provider = modeler.get("elementTemplatesAppendProvider");
        const entry = provider.getTemplateEntries(source, [template])[
            `append.template-${template.id}`
        ];
        entry.action.click();

        const createdShape = registry
            .filter((element: any) => element.type === "bpmn:Task")
            .find((element: any) => element !== source);
        expect(createdShape).toBeDefined();
        expect(getBusinessObject(createdShape).name).toBe("Appended");
        expect(registry.filter((element: any) => element.type === "bpmn:SequenceFlow")).toHaveLength(1);

        commandStack.undo();
        expect(registry.get(createdShape.id)).toBeUndefined();
        expect(registry.filter((element: any) => element.type === "bpmn:SequenceFlow")).toHaveLength(0);

        commandStack.redo();
        expect(registry.get(createdShape.id)).toBe(createdShape);
        expect(getBusinessObject(createdShape).name).toBe("Appended");
        expect(registry.filter((element: any) => element.type === "bpmn:SequenceFlow")).toHaveLength(1);
    });

    it("creates adapter previews through palette and manual-append providers", async () => {
        const modeler = await createModeler([CreateAppendElementTemplatesModule]);
        const elementTemplates = modeler.get("elementTemplates");
        const template = simpleTemplate("example.provider", "Provider");
        const create = modeler.get("create");
        const start = vi.spyOn(create, "start").mockImplementation(() => undefined);
        const source = modeler.get("elementFactory").createShape({ type: "bpmn:Task" });

        elementTemplates.set([template]);

        const createEntry = modeler.get("elementTemplatesCreateProvider").getTemplateEntries()[
            `create.template-${template.id}`
        ];
        createEntry.action.dragstart(new MouseEvent("mousedown"));

        const appendEntry = modeler.get("elementTemplatesAppendProvider").getTemplateEntries(
            source,
            [template],
        )[`append.template-${template.id}`];
        appendEntry.action.dragstart(new MouseEvent("mousedown"));

        expect(start).toHaveBeenCalledTimes(2);
        expect(getBusinessObject(start.mock.calls[0][1]).name).toBeUndefined();
        expect(getBusinessObject(start.mock.calls[0][1]).get("camunda:modelerTemplate")).toBe(
            template.id,
        );
        expect(start.mock.calls[1][2]).toMatchObject({ source });
        expect(modeler.get("commandStack").canUndo()).toBe(false);
    });

    it("applies a boundary-event template only after attachment", async () => {
        const modeler = await createModeler();
        const template = {
            name: "Boundary error",
            id: "example.boundary-error",
            appliesTo: ["bpmn:BoundaryEvent"],
            elementType: {
                value: "bpmn:BoundaryEvent",
                eventDefinition: "bpmn:ErrorEventDefinition",
            },
            properties: [
                {
                    type: "Hidden",
                    value: "Boundary name",
                    binding: { type: "property", name: "name" },
                },
            ],
        };
        const elementTemplates = modeler.get("elementTemplates");
        const elementFactory = modeler.get("elementFactory");
        const modeling = modeler.get("modeling");
        const root = modeler.get("canvas").getRootElement();

        elementTemplates.set([template]);
        const host = elementFactory.createShape({ type: "bpmn:Task" });
        modeling.createShape(host, { x: 250, y: 180 }, root);
        modeler.get("commandStack").clear();

        const boundary = elementTemplates.createElement(template);
        expect(getBusinessObject(boundary).name).toBeUndefined();
        modeling.createShape(boundary, { x: 250, y: 220 }, host, { attach: true });

        expect(boundary.host).toBe(host);
        expect(getBusinessObject(boundary).name).toBe("Boundary name");

        modeler.get("commandStack").undo();
        expect(modeler.get("elementRegistry").get(boundary.id)).toBeUndefined();
    });

    it("rejects missing types and C8 presets before allocating a shape", async () => {
        const modeler = await createModeler();
        const elementTemplates = modeler.get("elementTemplates");
        const elementFactory = modeler.get("elementFactory");
        const createShape = vi.spyOn(elementFactory, "createShape");

        expect(() => elementTemplates.createElement()).toThrow("template is missing");
        expect(() =>
            elementTemplates.createElement({ id: "invalid", name: "Invalid", properties: [] }),
        ).toThrow("template element type is missing");
        expect(() =>
            elementTemplates.createElement(simpleTemplate("preset"), { presetId: "advanced" }),
        ).toThrow("C7 element template presets are not supported");

        expect(createShape).not.toHaveBeenCalled();
        expect(modeler.get("commandStack").canUndo()).toBe(false);
    });

    it("propagates upstream template-application failures", async () => {
        const modeler = await createModeler();
        const elementTemplates = modeler.get("elementTemplates");
        const commandStack = modeler.get("commandStack");
        const execute = commandStack.execute.bind(commandStack);
        const template = simpleTemplate("example.failure");

        elementTemplates.set([template]);
        const shape = elementTemplates.createElement(template);
        vi.spyOn(commandStack, "execute").mockImplementation(
            (...args: any[]) => {
                const [command, context] = args;

                if (command === "propertiesPanel.camunda.changeTemplate") {
                    throw new Error("upstream binding failure");
                }

                return execute(command, context);
            },
        );

        expect(() =>
            modeler
                .get("modeling")
                .createShape(
                    shape,
                    { x: 250, y: 150 },
                    modeler.get("canvas").getRootElement(),
                ),
        ).toThrow("upstream binding failure");
    });

    it.each([
        ["adapter first", [CreateAppendC7ElementTemplatesModule, CloudElementTemplatesCoreModule]],
        ["native first", [CloudElementTemplatesCoreModule, CreateAppendC7ElementTemplatesModule]],
    ])("passes through native Cloud creation with %s", async (_name, modules) => {
        const modeler = await createModeler([], {
            modules,
            moddleExtensions: { zeebe: zeebeModdle },
        });
        const elementTemplates = modeler.get("elementTemplates");
        const nativeFactory = modeler.get("templateElementFactory");
        const template = {
            name: "Cloud task",
            id: "example.cloud",
            version: 1,
            appliesTo: ["bpmn:ServiceTask"],
            properties: [
                {
                    type: "Hidden",
                    value: "cloud-job",
                    binding: { type: "zeebe:taskDefinition:type" },
                },
            ],
        };

        expect(nativeFactory).not.toBeInstanceOf(TemplateElementFactory);
        const shape = elementTemplates.createElement(template);
        expect(getBusinessObject(shape).get("zeebe:modelerTemplate")).toBe(template.id);
        expect(getBusinessObject(shape).extensionElements.values[0].type).toBe("cloud-job");
    });
});

async function createModeler(
    additionalModules: any[] = [],
    options: { modules?: any[]; moddleExtensions?: Record<string, unknown> } = {},
): Promise<any> {
    const container = document.createElement("div");
    container.style.width = "800px";
    container.style.height = "600px";
    document.body.appendChild(container);

    const modeler = new Modeler({
        container,
        additionalModules: options.modules ?? [
                ElementTemplatesCoreModule,
                CreateAppendC7ElementTemplatesModule,
                ...additionalModules,
            ],
        moddleExtensions: (options.moddleExtensions ?? { camunda: camundaModdle }) as any,
    });

    modelers.push(modeler);
    await modeler.importXML(EMPTY_DIAGRAM);

    return modeler;
}

function simpleTemplate(id: string, name = "Configured") {
    return {
        name,
        id,
        appliesTo: ["bpmn:Task"],
        properties: [
            {
                type: "Hidden",
                value: name,
                binding: { type: "property", name: "name" },
            },
        ],
    };
}

function deepFreeze<T>(value: T): T {
    if (value && typeof value === "object") {
        Object.values(value).forEach((entry) => deepFreeze(entry));
        Object.freeze(value);
    }

    return value;
}

function normalizeGeneratedIds(xml: string): string {
    return xml
        .replace(/id="[^"]+"/g, 'id="generated"')
        .replace(/errorRef="[^"]+"/g, 'errorRef="generated"');
}
