import { LightningElement, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import getMyProjects from '@salesforce/apex/ProjectPortalController.getMyProjects';
import createSupportCase from '@salesforce/apex/ProjectPortalController.createSupportCase';

const SUBJECT_MAX = 255;

/**
 * Lets a portal user raise a support request against one of their projects.
 * Client-side checks give quick feedback; the Apex controller re-validates.
 */
export default class ProjectSupportRequest extends LightningElement {
    projectId;
    subject = '';
    description = '';
    isSubmitting = false;
    lastCaseNumber;
    projectOptions = [];
    wiredProjectsResult;

    @wire(getMyProjects)
    wiredProjects(result) {
        this.wiredProjectsResult = result;
        if (result.data) {
            this.projectOptions = result.data.map((p) => ({ label: p.name, value: p.id }));
            if (this.projectOptions.length === 1) {
                this.projectId = this.projectOptions[0].value;
            }
        }
    }

    get subjectMax() {
        return SUBJECT_MAX;
    }

    get isSubmitDisabled() {
        return this.isSubmitting || !this.projectId || !this.subject.trim();
    }

    handleProjectChange(event) {
        this.projectId = event.detail.value;
    }

    handleSubjectChange(event) {
        this.subject = event.target.value;
    }

    handleDescriptionChange(event) {
        this.description = event.target.value;
    }

    async handleSubmit() {
        const inputs = [...this.template.querySelectorAll('lightning-combobox, lightning-input, lightning-textarea')];
        const allValid = inputs.reduce((valid, input) => input.reportValidity() && valid, true);
        if (!allValid || this.isSubmitDisabled) {
            return;
        }

        this.isSubmitting = true;
        try {
            const caseNumber = await createSupportCase({
                projectId: this.projectId,
                subject: this.subject,
                description: this.description
            });
            this.lastCaseNumber = caseNumber;
            this.subject = '';
            this.description = '';
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Request submitted',
                    message: `Your reference number is ${caseNumber}.`,
                    variant: 'success'
                })
            );
            this.dispatchEvent(new CustomEvent('requestcreated', { detail: { caseNumber } }));
            await refreshApex(this.wiredProjectsResult);
        } catch (error) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Request not submitted',
                    message: error?.body?.message || 'Please try again later.',
                    variant: 'error'
                })
            );
        } finally {
            this.isSubmitting = false;
        }
    }
}
