/**
 * Apex controller for the Experience Cloud project portal components.
 *
 * Security model:
 * - `with sharing` + `WITH USER_MODE` / `AccessLevel.USER_MODE`: an external
 *   (portal) user only ever sees Service_Project__c records that the org's
 *   sharing sets / sharing rules expose to them, and only fields their
 *   profile or permission set allows.
 * - Inputs are validated server-side; client validation is a convenience only.
 * - Errors are returned as AuraHandledException with a user-safe message.
 */
public with sharing class ProjectPortalController {
    @TestVisible
    private static final Integer MAX_SUBJECT = 255;
    @TestVisible
    private static final Integer MAX_DESCRIPTION = 4000;

    public class ProjectView {
        @AuraEnabled
        public Id id;
        @AuraEnabled
        public String name;
        @AuraEnabled
        public String stage;
        @AuraEnabled
        public Date targetInstallDate;
        @AuraEnabled
        public Decimal systemSizeKw;
        @AuraEnabled
        public Integer openCases;
    }

    @AuraEnabled(cacheable=true)
    public static List<ProjectView> getMyProjects() {
        try {
            List<Service_Project__c> projects = [
                SELECT
                    Id,
                    Name,
                    Stage__c,
                    Target_Install_Date__c,
                    System_Size_kW__c,
                    (SELECT Id FROM Cases__r WHERE IsClosed = FALSE)
                FROM Service_Project__c
                WITH USER_MODE
                ORDER BY Target_Install_Date__c ASC NULLS LAST
                LIMIT 50
            ];

            List<ProjectView> views = new List<ProjectView>();
            for (Service_Project__c project : projects) {
                ProjectView view = new ProjectView();
                view.id = project.Id;
                view.name = project.Name;
                view.stage = project.Stage__c;
                view.targetInstallDate = project.Target_Install_Date__c;
                view.systemSizeKw = project.System_Size_kW__c;
                view.openCases = project.Cases__r.size();
                views.add(view);
            }
            return views;
        } catch (Exception e) {
            throw handled('We could not load your projects. Please try again later.', e);
        }
    }

    /** Stage values in picklist order, so the UI path always matches the org configuration. */
    @AuraEnabled(cacheable=true)
    public static List<String> getProjectStages() {
        List<String> stages = new List<String>();
        for (Schema.PicklistEntry entry : Service_Project__c.Stage__c.getDescribe().getPicklistValues()) {
            if (entry.isActive()) {
                stages.add(entry.getValue());
            }
        }
        return stages;
    }

    @AuraEnabled
    public static String createSupportCase(Id projectId, String subject, String description) {
        if (projectId == null || projectId.getSObjectType() != Service_Project__c.SObjectType) {
            throw handled('Please choose one of your projects.', null);
        }
        if (String.isBlank(subject) || subject.length() > MAX_SUBJECT) {
            throw handled('Subject is required and must be ' + MAX_SUBJECT + ' characters or fewer.', null);
        }
        if (description != null && description.length() > MAX_DESCRIPTION) {
            throw handled('Description must be ' + MAX_DESCRIPTION + ' characters or fewer.', null);
        }

        // Re-query in user mode: confirms the caller can actually see this project.
        List<Service_Project__c> visible = [
            SELECT Id, Account__c
            FROM Service_Project__c
            WHERE Id = :projectId
            WITH USER_MODE
            LIMIT 1
        ];
        if (visible.isEmpty()) {
            throw handled('Please choose one of your projects.', null);
        }

        Case supportCase = new Case(
            Subject = subject.trim(),
            Description = description,
            Origin = 'Web',
            Status = 'New',
            AccountId = visible[0].Account__c,
            Service_Project__c = projectId
        );
        try {
            insert as user supportCase;
        } catch (DmlException e) {
            throw handled('Your request could not be submitted. Please contact support.', e);
        }
        return [SELECT CaseNumber FROM Case WHERE Id = :supportCase.Id WITH USER_MODE].CaseNumber;
    }

    private static AuraHandledException handled(String message, Exception cause) {
        if (cause != null) {
            System.debug(LoggingLevel.ERROR, 'ProjectPortalController: ' + cause.getMessage());
        }
        AuraHandledException ex = new AuraHandledException(message);
        ex.setMessage(message); // makes the message visible in Apex tests
        return ex;
    }
}
