import { LightningElement, wire } from 'lwc';
import getMyProjects from '@salesforce/apex/ProjectPortalController.getMyProjects';
import getProjectStages from '@salesforce/apex/ProjectPortalController.getProjectStages';

/**
 * Shows each of the signed-in user's projects with a stage path,
 * target install date and open support-case count.
 * Designed for Experience Cloud pages (also works on internal record/app pages).
 */
export default class ProjectStatusTracker extends LightningElement {
    stages = [];
    rawProjects;
    error;

    @wire(getProjectStages)
    wiredStages({ data, error }) {
        if (data) {
            this.stages = data;
        } else if (error) {
            this.error = error;
        }
    }

    @wire(getMyProjects)
    wiredProjects({ data, error }) {
        if (data) {
            this.rawProjects = data;
            this.error = undefined;
        } else if (error) {
            this.rawProjects = undefined;
            this.error = error;
        }
    }

    get isLoading() {
        return !this.rawProjects && !this.error;
    }

    get hasProjects() {
        return Array.isArray(this.rawProjects) && this.rawProjects.length > 0;
    }

    get isEmpty() {
        return Array.isArray(this.rawProjects) && this.rawProjects.length === 0;
    }

    get errorMessage() {
        if (!this.error) {
            return undefined;
        }
        return this.error?.body?.message || 'Something went wrong while loading your projects.';
    }

    get projects() {
        if (!this.hasProjects) {
            return [];
        }
        return this.rawProjects.map((project) => {
            const stageIndex = this.stages.indexOf(project.stage);
            const percent =
                this.stages.length > 1 && stageIndex >= 0
                    ? Math.round((stageIndex / (this.stages.length - 1)) * 100)
                    : 0;
            return {
                ...project,
                steps: this.stages.map((label) => ({ label, value: label })),
                percentComplete: percent,
                progressLabel: `${percent}% complete`,
                hasOpenCases: project.openCases > 0,
                openCasesLabel: project.openCases === 1 ? '1 open request' : `${project.openCases} open requests`
            };
        });
    }
}
