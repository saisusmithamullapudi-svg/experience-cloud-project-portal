@IsTest
private class ProjectPortalControllerTest {
    @TestSetup
    static void setup() {
        Account homeowner = new Account(Name = 'Synthetic Homeowner');
        insert homeowner;
        insert new List<Service_Project__c>{
            new Service_Project__c(
                Name = 'PRJ-0001 Rooftop 7.2 kW',
                Account__c = homeowner.Id,
                Stage__c = 'Permitting',
                Target_Install_Date__c = Date.today().addDays(21),
                System_Size_kW__c = 7.2
            ),
            new Service_Project__c(
                Name = 'PRJ-0002 Battery add-on',
                Account__c = homeowner.Id,
                Stage__c = 'Site Survey',
                Target_Install_Date__c = Date.today().addDays(45),
                System_Size_kW__c = 0
            )
        };
    }

    @IsTest
    static void returnsProjectsOrderedByInstallDate() {
        List<ProjectPortalController.ProjectView> projects = ProjectPortalController.getMyProjects();

        Assert.areEqual(2, projects.size());
        Assert.areEqual('Permitting', projects[0].stage, 'Soonest install date first');
        Assert.areEqual(0, projects[0].openCases);
    }

    @IsTest
    static void returnsActiveStagesInOrder() {
        List<String> stages = ProjectPortalController.getProjectStages();

        Assert.isTrue(stages.size() >= 6);
        Assert.areEqual('Contract Signed', stages[0]);
        Assert.areEqual('Activated', stages[stages.size() - 1]);
    }

    @IsTest
    static void createsCaseLinkedToProjectAndAccount() {
        Service_Project__c project = [SELECT Id, Account__c FROM Service_Project__c WHERE Stage__c = 'Permitting'];

        String caseNumber = ProjectPortalController.createSupportCase(
            project.Id,
            '  Permit question  ',
            'When is the city inspection?'
        );

        Case created = [SELECT Subject, Origin, AccountId, Service_Project__c FROM Case WHERE CaseNumber = :caseNumber];
        Assert.areEqual('Permit question', created.Subject, 'Subject should be trimmed');
        Assert.areEqual('Web', created.Origin);
        Assert.areEqual(project.Account__c, created.AccountId);
        Assert.areEqual(project.Id, created.Service_Project__c);
        Assert.areEqual(1, ProjectPortalController.getMyProjects()[0].openCases);
    }

    @IsTest
    static void rejectsInvalidInput() {
        Service_Project__c project = [SELECT Id FROM Service_Project__c LIMIT 1];
        Account acct = [SELECT Id FROM Account LIMIT 1];

        assertRejected(null, 'Subject', 'Please choose one of your projects.');
        assertRejected(acct.Id, 'Subject', 'Please choose one of your projects.'); // wrong object type
        assertRejected(project.Id, '   ', 'Subject is required');
        assertRejected(project.Id, 'x'.repeat(256), 'Subject is required');
    }

    @IsTest
    static void rejectsProjectsTheUserCannotSee() {
        Service_Project__c project = [SELECT Id FROM Service_Project__c LIMIT 1];
        Id deletedId = project.Id;
        delete project;

        assertRejected(deletedId, 'Question', 'Please choose one of your projects.');
    }

    private static void assertRejected(Id projectId, String subject, String expectedMessage) {
        try {
            ProjectPortalController.createSupportCase(projectId, subject, null);
            Assert.fail('Expected AuraHandledException for subject: ' + subject);
        } catch (AuraHandledException e) {
            Assert.isTrue(e.getMessage().startsWith(expectedMessage), 'Unexpected message: ' + e.getMessage());
        }
        Assert.areEqual(0, [SELECT COUNT() FROM Case], 'No case should be created for invalid input');
    }
}
