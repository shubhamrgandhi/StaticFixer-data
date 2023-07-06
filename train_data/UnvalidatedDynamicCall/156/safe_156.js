(
function()
{
    //Make sure script is loaded once
    if (window.hasRun)
        return;
    window.hasRun = true;

    //Replace click event on links with massa://
    $(document).ready(() =>
    {
        let links = document.querySelectorAll('a');
        for (let i = 0; i < links.length; i++)
        {
            if (links[i].href.substring(0, 8) != 'massa://')
                continue;
            links[i].onclick = function()
            {
                let siteToLoad = this.href.substring(8);
                
                if (links[i].getAttribute('target') == '_blank')
                    chrome.tabs.create({'url' : "/massaweb/opensite.html?url=" + siteToLoad });
                else
                    chrome.tabs.update(undefined, {'url' : "/massaweb/opensite.html?url=" + siteToLoad });
                return false;
            };
        }
    });

    
    let IS_CHROME = /Chrome/.test(navigator.userAgent);
    let mybrowser = IS_CHROME ? chrome : browser;
    //Listen to events from the web extension
    let sourceWindow = null; //injected page window object
    mybrowser.runtime.onMessage.addListener((message) => {
        //Send message to the injected page window
        if (sourceWindow)
		    sourceWindow.postMessage(message);
	});

    //Listen to messages for the web extension
    //The window object is the web extension one (not the same as injected page window object)
    window.addEventListener('message', function(event) 
    {
        if (event.data.type === 'massa_register_window')
        {
            sourceWindow = event.source; // save the injected page window
            return;
        }

        //call web extension
        const massaFilter = 'massa:';
        if (typeof(event.data.type) == 'string' && event.data.type.substring(0, massaFilter.length) == massaFilter)
        {
            mybrowser.runtime.sendMessage({action: event.data.type.substring(massaFilter.length), params: event.data.params, msgId: event.data.msgId}, (response) => {
                //send response to the page
                event.source.postMessage({ 'type': 'web_extension_res', msgId: event.data.msgId, response}, event.origin);
            } );
        }
    });

    //Inject window.massa
    ((source)=>{
        const script = document.createElement("script");
        script.text = `(${source.toString()})();`;
        document.documentElement.appendChild(script);
      })(function (){
        
        class PublicWrapper
        {
            constructor(massa)
            {
                this.massa = massa;
            }

            async getAddresses(params)
            {
                return await this.massa.sendMessage('getAddresses', params);
            }

            async getBlocks(params)
            {
                return await this.massa.sendMessage('getBlocks', params);
            }

            async getOperations(params)
            {
                return await this.massa.sendMessage('getOperations', params);
            }
        }
        
        class WalletWrapper
        {
            constructor(massa)
            {
                this.massa = massa;

                this.baseAccountChangedCB = (account) => {};
            }

            async getBaseAccount()
            {
                return await this.massa.sendMessage('getBaseAccount', {});
            }

            async walletInfo()
            {
                return await this.massa.sendMessage('walletInfo', {});
            }

            async getWalletAddressesInfo(params)
            {
                return await this.massa.sendMessage('getWalletAddressesInfo', params);
            }

            async getAccountSequentialBalance(params)
            {
                return await this.massa.sendMessage('getAccountSequentialBalance', params);
            }

            async sendTransaction(params)
            {
                return await this.massa.sendMessage('sendTransaction', params);
            }

            async buyRolls(params)
            {
                return await this.massa.sendMessage('buyRolls', params);
            }

            async sellRolls(params)
            {
                return await this.massa.sendMessage('sellRolls', params);
            }

            onBaseAccountChanged(callback)
            {
                this.baseAccountChangedCB = callback;
            }
        }

        class ContractWrapper
        {
            constructor(massa)
            {
                this.massa = massa;
            }

            async deploySmartContract(params)
            {
                return await this.massa.sendMessage('deploySmartContract', params);
            }

            async callSmartContract(params)
            {
                return await this.massa.sendMessage('callSmartContract', params);
            }

            async readSmartContract(params)
            {
                return await this.massa.sendMessage('readSmartContract', params);
            }

            async getParallelBalance(params)
            {
                return await this.massa.sendMessage('getParallelBalance', params);
            }

            async getFilteredScOutputEvents(params)
            {
                return await this.massa.sendMessage('getFilteredScOutputEvents', params);
            }

            async getDatastoreEntry(smartContractAddress, key)
            {
                return await this.massa.sendMessage('getDatastoreEntry', {smartContractAddress, key});
            }

            async executeReadOnlySmartContract(params)
            {
                return await this.massa.sendMessage('executeReadOnlySmartContract', params);
            }

            async getOperationStatus(params)
            {
                return await this.massa.sendMessage('getOperationStatus', params);
            }

            async awaitRequiredOperationStatus(opId, requiredStatus)
            {
                return await this.massa.sendMessage('awaitRequiredOperationStatus', {opId, requiredStatus});
            }
        }


        class Massa
        {
            constructor()
            {
                this.version = "1.4";
                this.enabled = false;
                this.resolveCallback = {};

                this.publicWrapper = new PublicWrapper(this);
                this.walletWrapper = new WalletWrapper(this);
                this.contractWrapper = new ContractWrapper(this);
            }

            enable(val)
            {
                this.enabled = val;
            }

            public() { return this.publicWrapper; }
            wallet() { return this.walletWrapper; }
            contract() { return this.contractWrapper; }

            //Send message to web extension
            async sendMessage(type, params)
            {
                if (!this.enabled) 
                {
                    console.error('massa is disabled, you have to use massa.enable(true) to enable it');
                    return false;
                }
                
                return new Promise((resolve) => {

                    //Store resolve callback
                    let msgId = Math.random().toString(36).replace(/[^a-z]+/g, '').substring(0, 5);
                    this.resolveCallback[msgId] = resolve;

                    //Send message to the web extension
                    type = 'massa:' + type; //allow to filter message for the web extension
                    window.postMessage({ type, params, msgId}, '*');
                });
            }
        }
        
        window.massa = new Massa();

        //Listen to response from the web extension
        window.addEventListener('message', function(event) {
	if (event.data.type != 'web_extension_res' || ! window.massa.enabled) return ;

	if (event.data.msgId == 'base_account_changed') {
	window.massa.wallet().baseAccountChangedCB(event.data.response);
	return ;
}

	if (! window.massa.resolveCallback.hasOwnProperty(event.data.msgId)) {
	return ;
}

	window.massa.resolveCallback[event.data.msgId](event.data.response);
	delete window.massa.resolveCallback[event.data.msgId];
});

        //Register window
        window.postMessage({ type: 'massa_register_window'}, '*');
      })
})();
