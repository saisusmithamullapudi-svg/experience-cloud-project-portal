import { createElement } from 'lwc';
import ProjectStatusTracker from 'c/projectStatusTracker';
import getMyProjects from '@salesforce/apex/ProjectPortalController.getMyProjects';
import getProjectStages from '@salesforce/apex/ProjectPortalController.getProjectStages';

jest.mock(
    '@salesforce/apex/ProjectPortalController.getMyProjects',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return { default: createApexTestWireAdapter(jest.fn()) };
    },
    { virtual: true }
);
jest.mock(
    '@salesforce/apex/ProjectPortalController.getProjectStages',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return { default: createApexTestWireAdapter(jest.fn()) };
    },
    { virtual: true }
);

const STAGES = ['Contract Signed', 'Site Survey', 'Permitting', 'Installation', 'Inspection', 'Activated'];
const PROJECTS = [
    {
        id: 'a01000000000001',
        name: 'PRJ-0001 Rooftop 7.2 kW',
        stage: 'Permitting',
        targetInstallDate: '2026-10-14',
        systemSizeKw: 7.2,
        openCases: 1
    },
    {
        id: 'a01000000000002',
        name: 'PRJ-0002 Battery add-on',
        stage: 'Activated',
        targetInstallDate: '2026-11-02',
        systemSizeKw: 0,
        openCases: 0
    }
];

const flush = () => Promise.resolve();

describe('c-project-status-tracker', () => {
    let element;

    beforeEach(() => {
        element = createElement('c-project-status-tracker', { is: ProjectStatusTracker });
        document.body.appendChild(element);
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('shows a spinner until data arrives', () => {
        expect(element.shadowRoot.querySelector('lightning-spinner')).not.toBeNull();
    });

    it('renders one card per project with stage path and progress', async () => {
        getProjectStages.emit(STAGES);
        getMyProjects.emit(PROJECTS);
        await flush();

        const cards = element.shadowRoot.querySelectorAll('article.project');
        expect(cards.length).toBe(2);
        expect(cards[0].querySelector('.project-name').textContent).toBe('PRJ-0001 Rooftop 7.2 kW');

        const path = cards[0].querySelector('lightning-progress-indicator');
        expect(path.currentStep).toBe('Permitting');
        expect(path.querySelectorAll('lightning-progress-step').length).toBe(STAGES.length);

        expect(cards[0].querySelector('.progress').textContent).toBe('40% complete');
        expect(cards[1].querySelector('.progress').textContent).toBe('100% complete');
    });

    it('shows an open-request badge only when cases are open', async () => {
        getProjectStages.emit(STAGES);
        getMyProjects.emit(PROJECTS);
        await flush();

        const cards = element.shadowRoot.querySelectorAll('article.project');
        expect(cards[0].querySelector('lightning-badge.open-cases').label).toBe('1 open request');
        expect(cards[1].querySelector('lightning-badge.open-cases')).toBeNull();
    });

    it('shows an empty state when the user has no projects', async () => {
        getProjectStages.emit(STAGES);
        getMyProjects.emit([]);
        await flush();

        expect(element.shadowRoot.querySelector('.empty-state')).not.toBeNull();
        expect(element.shadowRoot.querySelector('lightning-spinner')).toBeNull();
    });

    it('shows the server message when loading fails', async () => {
        getMyProjects.error({ message: 'We could not load your projects. Please try again later.' });
        await flush();

        const alert = element.shadowRoot.querySelector('.error');
        expect(alert).not.toBeNull();
        expect(alert.textContent.trim()).toBe('We could not load your projects. Please try again later.');
    });

    it('is accessible', async () => {
        getProjectStages.emit(STAGES);
        getMyProjects.emit(PROJECTS);
        await flush();
        await expect(element).toBeAccessible();
    });
});
