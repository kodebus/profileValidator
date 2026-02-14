import { LightningElement, track } from 'lwc';
import validateSysAdminFLS from '@salesforce/apex/ProfileValidationController.validateSysAdminFLS';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class ProfileValidator extends LightningElement {
    @track isLoading = false;
    @track showResults = false;
    @track errorMessage = '';
    @track missingPermissions = [];
    @track objectList = [];
    @track totalFieldsChecked = 0;
    @track hasIssues = false;

    handleValidate() {
        this.isLoading = true;
        this.showResults = false;
        this.errorMessage = '';
        this.missingPermissions = [];
        this.objectList = [];
        this.hasIssues = false;

        validateSysAdminFLS()
            .then(result => {
                this.isLoading = false;
                this.showResults = true;

                if (result.success) {
                    this.totalFieldsChecked = result.totalFieldsChecked;
                    this.missingPermissions = result.missingPermissions || [];
                    this.objectList = result.objects || [];
                    this.hasIssues = this.missingPermissions.length > 0;

                    // Show toast notification
                    const event = new ShowToastEvent({
                        title: this.hasIssues ? 'Issues Found' : 'Success',
                        message: this.hasIssues
                            ? `Found ${this.missingPermissions.length} missing permissions`
                            : 'All permissions are correctly configured',
                        variant: this.hasIssues ? 'warning' : 'success',
                    });
                    this.dispatchEvent(event);
                } else {
                    this.errorMessage = result.errorMessage || 'An unknown error occurred';

                    const event = new ShowToastEvent({
                        title: 'Error',
                        message: this.errorMessage,
                        variant: 'error',
                    });
                    this.dispatchEvent(event);
                }
            })
            .catch(error => {
                this.isLoading = false;
                this.errorMessage = error.body ? error.body.message : error.message;

                const event = new ShowToastEvent({
                    title: 'Error',
                    message: this.errorMessage,
                    variant: 'error',
                });
                this.dispatchEvent(event);
            });
    }

    handleDownloadCsv() {
        const headers = ['Object', 'Field', 'Issue'];
        const rows = this.missingPermissions.map(permission => {
            const match = permission.match(/:\s*(\S+)\.(\S+)$/);
            const objectName = match ? match[1] : '';
            const fieldName = match ? match[2] : '';
            return [objectName, fieldName, 'Edit Access Missing'];
        });

        let csvContent = headers.join(',') + '\n';
        csvContent += rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

        const encodedUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
        const downloadLink = this.template.querySelector('[data-id="csvDownloadLink"]');
        downloadLink.href = encodedUri;
        downloadLink.download = 'SysAdmin_Missing_FLS_Permissions.csv';
        downloadLink.click();

        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Download Started',
                message: `Exported ${this.missingPermissions.length} records to CSV`,
                variant: 'success',
            })
        );
    }

    get missingPermissionCount() {
        return this.missingPermissions.length;
    }

    get objectCount() {
        return this.objectList.length;
    }

    get summaryClass() {
        return this.hasIssues
            ? 'slds-notify slds-notify_alert slds-alert_warning'
            : 'slds-notify slds-notify_alert slds-alert_success';
    }

    get summaryType() {
        return this.hasIssues ? 'warning' : 'success';
    }
}
