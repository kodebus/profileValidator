public with sharing class DevToolsRegistryController {
    public class ToolItem {
        @AuraEnabled public String developerName { get; set; }
        @AuraEnabled public String label { get; set; }
        @AuraEnabled public String description { get; set; }
        @AuraEnabled public String navigationUrl { get; set; }
    }

    @AuraEnabled(cacheable=true)
    public static List<ToolItem> getTools() {
        List<ToolItem> tools = new List<ToolItem>();
        if (!Schema.sObjectType.DeveloperTool__mdt.isAccessible()) {
            return tools;
        }

        for (DeveloperTool__mdt toolRecord : [
            SELECT DeveloperName, MasterLabel, Description__c, NavigationUrl__c
            FROM DeveloperTool__mdt
            WHERE IsActive__c = true
            ORDER BY SortOrder__c ASC, MasterLabel ASC
        ]) {
            ToolItem tool = new ToolItem();
            tool.developerName = toolRecord.DeveloperName;
            tool.label = toolRecord.MasterLabel;
            tool.description = toolRecord.Description__c;
            tool.navigationUrl = toolRecord.NavigationUrl__c;
            tools.add(tool);
        }

        return tools;
    }
}
