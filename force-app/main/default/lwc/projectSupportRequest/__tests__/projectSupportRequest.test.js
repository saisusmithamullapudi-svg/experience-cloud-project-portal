import { createElement } from 'lwc';
import ProjectSupportRequest from 'c/projectSupportRequest';
import getMyProjects from '@salesforce/apex/ProjectPortalController.getMyProjects';
import createSupportCase from '@salesforce/apex/ProjectPortalController.createSupportCase';

jest.mock(
    '@salesforce/apex/ProjectPortalController.getMyProjects',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return { default: createApexTestWireAdapter(jest.fn()) };
    },
    { virtual: true }
);
jest.mock('@salesforce/apex/ProjectPortalController.createSupportCase', () => ({ default: jest.fn() }), {
    virtual: true
});
jest.mock('@salesforce/apex', () => ({ refreshApex: jest.fn(() => Promise.resolve()) }), { virtual: true });

const PROJECTS = [{ id: 'a01000000000001', name: 'PRJ-0001 Rooftop 7.2 kW', stage: 'Permitting', openCases: 0 }];
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup() {
    const element = createElement('c-project-support-request', { is: ProjectSupportRequest });
    document.body.appendChild(element);
    return element;
}

function fill(element, subject, description = '') {
    const input = element.shadowRoot.querySelector('lightning-input');
    input.value = subject;
    input.dispatchEvent(new CustomEvent('change'));
    const textarea = element.shadowRoot.querySelector('lightning-textarea');
    textarea.value = description;
    textarea.dispatchEvent(new CustomEvent('change'));
}

function stubValidity(element, isValid) {
    element.shadowRoot.querySelectorAll('lightning-combobox, lightning-input, lightning-textarea').forEach((field) => {
        field.reportValidity = jest.fn(() => isValid);
    });
}

describe('c-project-support-request', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('preselects the project when the user has only one', async () => {
        const element = setup();
        getMyProjects.emit(PROJECTS);
        await flush();

        const combobox = element.shadowRoot.querySelector('lightning-combobox');
        expect(combobox.options).toEqual([{ label: 'PRJ-0001 Rooftop 7.2 kW', value: 'a01000000000001' }]);
        expect(combobox.value).toBe('a01000000000001');
    });

    it('keeps submit disabled until a subject is entered', async () => {
        const element = setup();
        getMyProjects.emit(PROJECTS);
        await flush();

        const button = element.shadowRoot.querySelector('lightning-button.submit');
        expect(button.disabled).toBe(true);

        fill(element, 'Inverter light is red');
        await flush();
        expect(button.disabled).toBe(false);
    });

    it('creates a case, shows a toast and resets the form', async () => {
        createSupportCase.mockResolvedValue('00001042');
        const element = setup();
        getMyProjects.emit(PROJECTS);
        await flush();
        fill(element, 'Inverter light is red', 'Since this morning');
        stubValidity(element, true);

        const toastHandler = jest.fn();
        const createdHandler = jest.fn();
        element.addEventListener('lightning__showtoast', toastHandler);
        element.addEventListener('requestcreated', createdHandler);

        element.shadowRoot.querySelector('lightning-button.submit').click();
        await flush();

        expect(createSupportCase).toHaveBeenCalledWith({
            projectId: 'a01000000000001',
            subject: 'Inverter light is red',
            description: 'Since this morning'
        });
        expect(toastHandler.mock.calls[0][0].detail.variant).toBe('success');
        expect(createdHandler.mock.calls[0][0].detail.caseNumber).toBe('00001042');
        expect(element.shadowRoot.querySelector('.confirmation').textContent).toContain('00001042');
        expect(element.shadowRoot.querySelector('lightning-input').value).toBe('');
    });

    it('shows the server error message in an error toast', async () => {
        createSupportCase.mockRejectedValue({ body: { message: 'Please choose one of your projects.' } });
        const element = setup();
        getMyProjects.emit(PROJECTS);
        await flush();
        fill(element, 'Question');
        stubValidity(element, true);

        const toastHandler = jest.fn();
        element.addEventListener('lightning__showtoast', toastHandler);
        element.shadowRoot.querySelector('lightning-button.submit').click();
        await flush();

        const toast = toastHandler.mock.calls[0][0].detail;
        expect(toast.variant).toBe('error');
        expect(toast.message).toBe('Please choose one of your projects.');
        expect(element.shadowRoot.querySelector('.confirmation')).toBeNull();
    });

    it('does not call Apex when field validation fails', async () => {
        const element = setup();
        getMyProjects.emit(PROJECTS);
        await flush();
        fill(element, 'Question');
        stubValidity(element, false);

        element.shadowRoot.querySelector('lightning-button.submit').click();
        await flush();

        expect(createSupportCase).not.toHaveBeenCalled();
    });
});
