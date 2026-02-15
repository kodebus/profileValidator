import { LightningElement, track } from 'lwc';
import validateProfileFLS from '@salesforce/apex/ProfileValidationController.validateProfileFLS';
import getAvailableProfiles from '@salesforce/apex/ProfileValidationController.getAvailableProfiles';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class ProfileValidator extends LightningElement {
    @track isLoading = false;
    @track showResults = false;
    @track errorMessage = '';
    @track missingPermissions = [];
    @track objectList = [];
    @track totalFieldsChecked = 0;
    @track hasIssues = false;
    @track profileOptions = [];
    @track selectedProfileId = '';
    @track selectedProfileName = '';

    connectedCallback() {
        this.loadProfiles();
    }

    loadProfiles() {
        getAvailableProfiles()
            .then((options) => {
                this.profileOptions = options || [];
                if (this.profileOptions.length === 0) {
                    this.selectedProfileId = '';
                    this.selectedProfileName = '';
                    return;
                }

                const sysAdminOption = this.profileOptions.find((option) => option.label === 'System Administrator');
                const defaultOption = sysAdminOption || this.profileOptions[0];
                this.selectedProfileId = defaultOption.value;
                this.selectedProfileName = defaultOption.label;
            })
            .catch(() => {
                this.profileOptions = [];
                this.selectedProfileId = '';
                this.selectedProfileName = '';
                this.errorMessage = 'Unable to load profiles. Contact your Salesforce admin.';
            });
    }

    handleProfileChange(event) {
        this.selectedProfileId = event.detail.value;
        const selectedOption = this.profileOptions.find((option) => option.value === this.selectedProfileId);
        this.selectedProfileName = selectedOption ? selectedOption.label : '';
    }

    handleValidate() {
        if (!this.selectedProfileId) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Profile Required',
                    message: 'Please select a profile before running validation.',
                    variant: 'warning',
                })
            );
            return;
        }

        this.isLoading = true;
        this.showResults = false;
        this.errorMessage = '';
        this.missingPermissions = [];
        this.objectList = [];
        this.hasIssues = false;

        validateProfileFLS({ profileId: this.selectedProfileId })
            .then(result => {
                this.isLoading = false;
                this.showResults = true;
                this.selectedProfileName = result.profileName || this.selectedProfileName;

                if (result.success) {
                    this.totalFieldsChecked = result.totalFieldsChecked;
                    this.missingPermissions = result.missingPermissions || [];
                    this.objectList = result.objects || [];
                    this.hasIssues = this.missingPermissions.length > 0;

                    // Show toast notification
                    const event = new ShowToastEvent({
                        title: this.hasIssues ? 'Issues Found' : 'Success',
                        message: this.hasIssues
                            ? `Found ${this.missingPermissions.length} missing permissions for ${this.selectedProfileName}`
                            : `${this.selectedProfileName} permissions are correctly configured`,
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
        const safeProfileName = (this.selectedProfileName || 'Profile').replace(/[^a-zA-Z0-9_-]/g, '_');
        downloadLink.download = `${safeProfileName}_Missing_FLS_Permissions.csv`;
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
            ? 'summary-panel summary-warning'
            : 'summary-panel summary-success';
    }

    get summaryIcon() {
        return this.hasIssues ? 'utility:warning' : 'utility:success';
    }

    get summarySubtitle() {
        return this.hasIssues
            ? 'Issues were found for this profile.'
            : 'No missing field edit permissions were found.';
    }

    get isRunDisabled() {
        return this.isLoading || !this.selectedProfileId;
    }
}
