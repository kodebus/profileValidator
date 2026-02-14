import { LightningElement, wire } from 'lwc';
import getTools from '@salesforce/apex/DevToolsRegistryController.getTools';

export default class DevToolsHome extends LightningElement {
    tools = [];
    errorMessage = '';

    @wire(getTools)
    wiredTools({ data, error }) {
        if (data) {
            this.tools = data.map((tool) => ({
                key: tool.developerName,
                label: tool.label,
                description: tool.description,
                navigationUrl: tool.navigationUrl
            }));
            this.errorMessage = '';
            return;
        }

        if (error) {
            this.tools = [];
            this.errorMessage = 'Unable to load tools. Contact your Salesforce admin.';
        }
    }

    get hasTools() {
        return this.tools.length > 0;
    }

    handleOpen(event) {
        const url = event.currentTarget.dataset.url;
        if (!url) {
            return;
        }

        window.open(url, '_self');
    }
}
