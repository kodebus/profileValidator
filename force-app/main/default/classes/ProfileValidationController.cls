public with sharing class ProfileValidationController {

    public class ProfileOption {
        @AuraEnabled public String label { get; set; }
        @AuraEnabled public String value { get; set; }
    }

    @AuraEnabled
    public static ProfileReviewResponse validateSysAdminFLS() {
        Profile sysAdminProfile = getSysAdminProfile();
        if (sysAdminProfile == null) {
            ProfileReviewResponse ret = new ProfileReviewResponse();
            ret.errorMessage = 'System Administrator profile not found.';
            return ret;
        }

        return validateProfileFLS(sysAdminProfile.Id);
    }

    @AuraEnabled
    public static ProfileReviewResponse validateProfileFLS(Id profileId) {
        ProfileReviewResponse ret = new ProfileReviewResponse();

        try {
            if (!hasRequiredReadAccess()) {
                ret.errorMessage = 'Insufficient access to evaluate profile field permissions.';
                return ret;
            }

            if (profileId == null) {
                ret.errorMessage = 'Please select a profile to validate.';
                return ret;
            }

            Profile selectedProfile = getProfileById(profileId);
            if (selectedProfile == null) {
                ret.errorMessage = 'Selected profile was not found or is not accessible.';
                return ret;
            }

            Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();
            Map<String, FieldPermissions> fieldPermsMap = getFieldPermissionsByField(selectedProfile.Id);
            ret.totalFieldsChecked = collectMissingFieldEditPermissions(globalDescribe, fieldPermsMap, ret);
            ret.profileName = selectedProfile.Name;
            ret.success = true;

        } catch (Exception e) {
            ret.success = false;
            ret.errorMessage = e.getMessage();
        }

        return ret;
    }

    @AuraEnabled(cacheable=true)
    public static List<ProfileOption> getAvailableProfiles() {
        List<ProfileOption> options = new List<ProfileOption>();
        if (!Schema.sObjectType.Profile.isAccessible()) {
            return options;
        }

        for (Profile profileRecord : [
            SELECT Id, Name
            FROM Profile
            ORDER BY Name ASC
        ]) {
            ProfileOption option = new ProfileOption();
            option.label = profileRecord.Name;
            option.value = profileRecord.Id;
            options.add(option);
        }

        return options;
    }

    private static Boolean hasRequiredReadAccess() {
        return Schema.sObjectType.Profile.isAccessible()
            && Schema.sObjectType.FieldPermissions.isAccessible();
    }

    private static Profile getSysAdminProfile() {
        if (!Schema.sObjectType.Profile.isAccessible()) {
            return null;
        }

        List<Profile> profiles = [
            SELECT Id, Name
            FROM Profile
            WHERE Name = 'System Administrator'
            LIMIT 1
        ];
        return profiles.isEmpty() ? null : profiles[0];
    }

    private static Profile getProfileById(Id profileId) {
        if (!Schema.sObjectType.Profile.isAccessible()) {
            return null;
        }

        List<Profile> profiles = [
            SELECT Id, Name
            FROM Profile
            WHERE Id = :profileId
            LIMIT 1
        ];
        return profiles.isEmpty() ? null : profiles[0];
    }

    private static Map<String, FieldPermissions> getFieldPermissionsByField(Id profileId) {
        Map<String, FieldPermissions> result = new Map<String, FieldPermissions>();
        if (!Schema.sObjectType.FieldPermissions.isAccessible()) {
            return result;
        }

        for (FieldPermissions fieldPermission : [
            SELECT SobjectType, Field, PermissionsEdit
            FROM FieldPermissions
            WHERE Parent.ProfileId = :profileId
        ]) {
            result.put(fieldPermission.Field.toLowerCase(), fieldPermission);
        }
        return result;
    }

    private static Integer collectMissingFieldEditPermissions(
        Map<String, Schema.SObjectType> globalDescribe,
        Map<String, FieldPermissions> fieldPermsMap,
        ProfileReviewResponse ret
    ) {
        Integer totalFieldsChecked = 0;
        List<String> objectApiNames = new List<String>(globalDescribe.keySet());
        objectApiNames.sort();

        for (String objectApiName : objectApiNames) {
            if (shouldSkipObject(objectApiName)) {
                continue;
            }

            Schema.SObjectType sObjectType = globalDescribe.get(objectApiName);
            if (sObjectType == null) {
                continue;
            }

            Schema.DescribeSObjectResult objDescribe = sObjectType.getDescribe();
            Map<String, Schema.SObjectField> fieldMap = objDescribe.fields.getMap();
            for (String fieldName : fieldMap.keySet()) {
                if (!fieldName.containsIgnoreCase('__c')) {
                    continue;
                }

                totalFieldsChecked++;
                String key = (objectApiName + '.' + fieldName).toLowerCase();
                FieldPermissions fieldPerm = fieldPermsMap.get(key);
                if (fieldPerm == null || !fieldPerm.PermissionsEdit) {
                    ret.missingPermissions.add('Field Edit Access Missing for: ' + objectApiName + '.' + fieldName);
                    ret.objects.add(objectApiName);
                }
            }
        }

        return totalFieldsChecked;
    }

    private static Boolean shouldSkipObject(String objectApiName) {
        return objectApiName.startsWith('__')
            || objectApiName.endsWithIgnoreCase('history')
            || objectApiName.endsWithIgnoreCase('share')
            || objectApiName.endsWithIgnoreCase('Feed')
            || objectApiName.containsIgnoreCase('changeevent');
    }

    public class ProfileReviewResponse {
        @AuraEnabled public Boolean success { get; set; }
        @AuraEnabled public String errorMessage { get; set; }
        @AuraEnabled public String profileName { get; set; }
        @AuraEnabled public List<String> missingPermissions { get; set; }
        @AuraEnabled public List<String> objects { get; set; }
        @AuraEnabled public Integer totalFieldsChecked { get; set; }

        public ProfileReviewResponse() {
            this.success = false;
            this.missingPermissions = new List<String>();
            this.objects = new List<String>();
            this.totalFieldsChecked = 0;
        }
    }
}
