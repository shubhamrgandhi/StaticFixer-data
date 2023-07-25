var upm = (function() {

    var
            loadFn = {
                compatibility: loadCompatibilityTab,
                osgi: loadOsgiTab,
                install: loadInstallTab,
                log: loadLogTab,
                manage: loadManageTab,
                upgrade: loadUpgradeTab
            },
            detailsFn = {
                compatibility: buildCompatibilityDetails,
                osgi : buildOsgiBundleDetails,
                install: buildInstallDetails,
                manage: buildManageDetails,
                upgrade: buildUpgradeDetails
            },
            osgiXrefFn = {
                'DynamicImport-Package': crossReferenceOsgiImportPackageHeaderClause,
                'Import-Package': crossReferenceOsgiImportPackageHeaderClause,
                'Export-Package': crossReferenceOsgiExportPackageHeaderClause
            },
            contentTypes = {
                'bundle': 'application/vnd.atl.plugins.osgi.bundle+json',
                'install': 'application/vnd.atl.plugins.install.uri+json',
                'json': 'application/json',
                'module': 'application/vnd.atl.plugins.plugin.module+json',
                'plugin': 'application/vnd.atl.plugins.plugin+json',
                'purge-after': 'application/vnd.atl.plugins.audit.log.purge.after+json',
                'requires-restart': 'application/vnd.atl.plugins.changes.requiring.restart+json',
                'safe-mode': 'application/vnd.atl.plugins.safe.mode.flag+json',
                'upm': 'application/vnd.atl.plugins+json'
            },
            isLatentThreshold = 100, // don't display progress popup if request is shorter than this
            minProgressDisplay = 1000, // if progress popup is displayed, keep it up for at least this long
            pluginReps = [],
            resources = {},
            permissions,
            progressPopup,
            safeMode,
            messageContainer,
            upmContainer,
            maxIconHeight = 400, // if plugin images are taller than this, they will be scaled down
            maxIconWidth = 500, // if plugin images are wider than this, they will be scaled down
            maxResults = 25, // default number of results to fetch per request when paginating
            minProgressHeight = 220, // to keep the progress popup from being too "jumpy" when resizing to fit content
            tryUploadOrInstallAgain = true,
            defaultTab = 'manage',
            isIE = AJS.$.browser.msie,
            isDevelopmentProductVersion,
            isUnknownProductVersion,
            skipLatentThreshold = isIE && AJS.Confluence && AJS.Confluence.runBinderComponents;

    /**
     * Cross-browser method for getting an XML object from XHR response
     * @method getXml
     * @param {String|Object} data The xml representation as a string if IE, or as an object if another browser
     * @return {Object} XML object
     */
    function getXml(data) {
        if (typeof data == "string") {
            try {
                // We ask IE to return a string to get around it not liking the 'application/atom+xml' MIME type
                var xml = new ActiveXObject("Microsoft.XMLDOM");
                xml.async = false;
                xml.loadXML(data);
                return xml;
            } catch (e) {
                AJS.log('Failed to create an xml object from string: ' + e);
                return data;
            }
        } else {
            // Other browsers will already return an xml object
            return data;
        }
    }

    /**
     * Encodes text, converting invalid HTML characters to escaped values.
     * @method htmlEncode
     * @param {String} text Text to be encoded
     * @return {String} encoded text
     */
    function htmlEncode(text) {
        return AJS.$('<div/>').text(text).html();
    }

    /**
     * Scrolls to a given element
     * @method scrollTo
     * @param {HTMLElement} element The element to scroll to
     */
    function scrollTo(element) {
        var spacingFromWindowTop = 10;
        AJS.$(window).scrollTop(element.offset().top - spacingFromWindowTop);
    }

    /**
     * Expands and scrolls to a specified plugin
     * @method focusPlugin
     * @param {String} key The unique key of the plugin to be focused
     * @param {String} tab The tab to look for the plugin on (same plugin may appear on multiple tabs)
     */
    function focusPlugin(key, tab) {
        var plugin = AJS.$('#upm-plugin-' + createHash(key, tab));
        if (plugin.length > 0) {
            // if it's a system plugin, we need to show the system plugin list first
            if (plugin.is('.upm-system') && AJS.$('#upm-system-plugins').is(':hidden')) {
                toggleSystemPlugins();
            }
            if (plugin.is(':visible')) {
                if (!plugin.is('.expanded')) {
                    plugin.find('div.upm-plugin-row').click();
                }
                scrollTo(plugin);
            }
        }
    }

    /**
     * Takes a string identifying a tab and returns a boolean indicating whether or not the user has permission
     * to view that tab
     * @method hasPermissionFor
     * @param {String} tab The tab to check permissions against
     * @return {Boolean} whether or not the user has permissions
     */
    function hasPermissionFor(tab) {
        return permissions[tab];
    }

    /**
     * Returns the default tab if the user has permissions to see it, or else the first available tab
     * @method getDefaultTab
     * @return {String} The default tab, or the first tab the user has permission for
     */
    function getDefaultTab() {
        var tab;
        if (hasPermissionFor(defaultTab)) {
            return defaultTab;
        } else {
            // if we don't have permission for the default tab, return the leftmost available tab
            tab = AJS.$('#upm-tabs a:first').attr('id');
            tab = tab.substring('upm-tab-'.length, tab.length);
            return tab;
        }
    }

    /**
     * Checks to see if an ansynchronous task is pending on page load
     * @method checkForPendingTasks
     * @param {Boolean} forceSynchronous If true, forces the pending tasks request to be synchronous
     * @param {Function} errorCallback Function to run if there's an error getting pending task info
     */
    function checkForPendingTasks(forceSynchronous, errorCallback) {
        if (resources['pending-tasks']) {
            AJS.$.ajax({
                url: resources['pending-tasks'],
                type: 'get',
                cache: false,
                dataType: 'json',
                async: !forceSynchronous,
                success: function(response) {
                    if (response.tasks.length > 0) {
                        var task = response.tasks[0];
                        if (task.username === AJS.params.upmCurrentUsername) {
                            startProgress(AJS.params.upmTextProgressPendingTasks);
                            pollAsynchronousResource(task.links.self, task.pingAfter, messageContainer, function() {
                                stopProgress();
                            });
                        } else {
                            // task was not initiated by the current user
                            updatePendingTaskDetail(task);
                            upmContainer.addClass('upm-pending-tasks');
                            pollPendingTasks();
                        }
                    }
                },
                error: function(request) {
                    handleAjaxError(messageContainer, request, "");
                    errorCallback && errorCallback();
                }
            });
        }
    }

    /**
     * Sets a class on the upm container that acts as a flag for Safe Mode
     * @method setSafeModeClass
     */
    function setSafeModeClass() {
        upmContainer.toggleClass('upm-safe-mode', safeMode);
    }

    /**
     * Checks to see if any changes require a product restart to complete
     * @method checkForChangesRequiringRestart
     */
    function checkForChangesRequiringRestart() {
        AJS.$.ajax({
            url: resources['changes-requiring-restart'],
            type: 'get',
            cache: false,
            dataType: 'json',
            success: function(response) {
                var list = AJS.$('#upm-requires-restart-list');
                if (response.changes.length) {
                    for (var i = 0, len = response.changes.length; i < len; i++) {
                        addChangeRequiringRestart(response.changes[i], list);
                    }
                } else {
                    upmContainer.removeClass('requires-restart');
                }
            },
            error: function(request) {
                handleAjaxError(messageContainer, request, "");
            }
        });
    }

    /**
     * Adds an item to the list of changes that require a product restart
     * @method addChangeRequiringRestart
     * @param {Object} change Object containing details of the specified change
     * @param {HTMLElement} list (optional) List element to append item to
     */
    function addChangeRequiringRestart(change, list) {
        addChangeRequiringRestart.template = addChangeRequiringRestart.template || AJS.$(AJS.$('#upm-requires-restart-template').html());
        var msg = AJS.format(AJS.params['upm.requiresRestart.' + change.action], change.name),
            li = addChangeRequiringRestart.template.clone(),
            existing;
        list = list || AJS.$('#upm-requires-restart-list');

        // If an element already exists for this plugin, we want to replace it
        existing = AJS.$('#' + escapeSelector('upm-restart-message-' + change.key), list);

        li.find('span').text(msg);
        li.find('input.upm-requires-restart-cancel-uri').val(change.links.self);
        li.attr("id", "upm-restart-message-" + change.key);
        li.find('a.upm-requires-restart-cancel').attr('id', 'upm-cancel-requires-restart-' + change.key);
        if (existing.length) {
            existing.replaceWith(li);
        } else {
            li.appendTo(list);
        }
        li.data('representation', change);
        upmContainer.addClass('requires-restart');
    }

    /**
     * Checks for changes to the state of UPM, including Safe Mode, long-running tasks, and changes requiring restart
     * @method checkForStateChanges
     * @param {Object} response Asynchronous request response object
     */
    function checkForStateChanges(response) {
        var restartLink = response.links['changes-requiring-restart'],
            pendingTasksLink = response.links['pending-tasks'];
        safeMode = response.safeMode;
        if (resources['safe-mode']) {
            setSafeModeClass();
            if (response.links['enter-safe-mode'] || response.links['exit-safe-mode-restore'] || response.links['exit-safe-mode-keep']) {
                AJS.$('#upm-safe-mode-on, #upm-safe-mode-exit-links').removeClass('hidden');
            }
        }
        if (pendingTasksLink && !pollPendingTasks.timeout) {
            resources['pending-tasks'] = pendingTasksLink;
            checkForPendingTasks();
        }
        if (restartLink) {
            resources['changes-requiring-restart'] = restartLink;
            checkForChangesRequiringRestart();
        }
        AJS.$.extend(resources, response.links);
    }

    /**
     * Checks to see if there are pending tasks and if so shows a dialog explaining to the user that the requested action has been cancelled
     * @method hasPendingTasks
     * @param {Function} callbackFn Function to run if there are pending tasks
     * @return {Boolean} Whether or not there are pending tasks
     */
    function hasPendingTasks(callbackFn) {
        checkForPendingTasks(true);
        if (upmContainer.hasClass('upm-pending-tasks')) {
            // There are pending tasks, so we don't want to run the requested action
            callbackFn();
            showInfoDialog(AJS.params.upmTextPendingTaskConflictHeader, '<p>' + AJS.params.upmTextPendingTaskConflict + '</p>');
            return true;
        } else {
            return false;
        }
    }

    /**
     * Loads content for a specified tab
     * @method loadTab
     * @param {String} id Unique id of the tab to load
     * @param {String} pluginKey (optional) Key of a plugin to expand and scroll to once tab has loaded
     * @param {Boolean} updateHash true (or unspecified) if the document location should be updated, false if not 
     * @param {Function} callbackFn Function to run after tab has loaded
     */
    function loadTab(id, pluginKey, callbackFn, updateHash) {
        var panel = AJS.$('#upm-panel-' + id),
                tab = AJS.$('#upm-tab-' + id).closest('li'),
                modifiedCallback,
                currentHash = document.location.hash;
        //assume updateHash is true unless specified otherwise
        updateHash = (updateHash !== false);
        if (hasPermissionFor(id)) {
            if (panel.length === 0) {
                // if bad tab id is specified, use default tab
                id = getDefaultTab();
                panel = AJS.$('#upm-panel-' + id);
            }

            AJS.$('#upm-tabs li').removeClass('upm-selected');
            tab.addClass('upm-selected');
            AJS.$('#upm-content .upm-panel').removeClass('upm-selected');
            panel.addClass('upm-selected');
            AJS.$('#upm-title').text(AJS.params['upm.tabs.' + id]);

            if (tab.hasClass('hidden')) {
                tab.removeClass('hidden');
                AJS.Cookie.save('upm.show.' + id, 'true');
            }

            modifiedCallback = pluginKey ?
                               function(response) {
                                   checkForStateChanges(response);
                                   focusPlugin(pluginKey, id);
                                   callbackFn && callbackFn(response);
                               } :
                               function(response) {
                                   checkForStateChanges(response);
                                   callbackFn && callbackFn(response);
                               };
            loadFn[id](panel, modifiedCallback);

            // give IE some breathing room to update its UI
            setTimeout(function() {
                var hash;
                if (id == 'install' || id == 'upgrade') {
                    getAndStoreAntiXsrfToken();
                }

                hash = pluginKey ? id + '/' + pluginKey : id;
                if (currentHash.indexOf('#') != -1) {
                    hash = '#' + hash;
                }
                // Don't set location.hash until the page has loaded, or in Firefox the default favicon is displayed instead of UPM's.
                // See UPM-798, UPM-1153, and Mozilla bug 408415.
                if (updateHash) {
                    document.location.hash = hash;
                }

                // remove any plugin elements marked for removal
                AJS.$('div.upm-plugin.to-remove', upmContainer).remove();

                AJS.Cookie.save("upm.tab", id);
            }, 25);
        }
    }

    /**
     * Gets a new anti-xsrf token from the server and stores it for use in uploading plugins
     * @method getAndStoreAntiXsrfToken
     * @param {Function} callbackFn Function to run after anti-xsrf token has been retrieved
     */
    function getAndStoreAntiXsrfToken(callbackFn) {
        AJS.$.ajax({
            url: resources['root'],
            type: 'head',
            cache: false,
            complete: function(request, status) {
                if (status == 'success') {
                    AJS.$('#upm-install-token').val(request.getResponseHeader('upm-token'));
                    callbackFn && callbackFn();
                } else {
                    handleAjaxError(messageContainer, request, "");
                }
            }
        });
    }

    /**
     * Loads content for the selected tab on page load
     * @method loadInitialTab
     */
    function loadInitialTab() {
        var hash;
        resources = {
            'root': AJS.params.upmUriRoot,
            'pac-status': AJS.params.upmUriPacStatus,
            'upgrades': AJS.params.upmUriUpgrades,
            'product-upgrades': AJS.params.upmUriProductUpgrades,
            'audit-log': AJS.params.upmUriAuditLog,
            'featured': AJS.params.upmUriFeatured,
            'popular': AJS.params.upmUriPopular,
            'supported': AJS.params.upmUriSupported,
            'available': AJS.params.upmUriAvailable,
            'install': AJS.params.upmUriInstall,
            'safe-mode': AJS.params.upmUriSafeMode,
            'audit-log-purge-after': AJS.params.upmUriPurgeAfter,
            'audit-log-purge-after-manage': AJS.params.upmUriManagePurgeAfter,
            'osgi-bundles' : AJS.params.upmUriOsgiBundles,
            'osgi-services' : AJS.params.upmUriOsgiServices,
            'osgi-packages' : AJS.params.upmUriOsgiPackages,
            'pending-tasks': AJS.params.upmUriPendingTasks,
            'product-version': AJS.params.upmUriProductVersion
        };
        permissions = {
            'manage': !!resources['root'],
            'upgrade': !!resources['upgrades'],
            'install': !!resources['available'],
            'log': !!resources['audit-log'],
            'compatibility': !!resources['product-upgrades'],
            'osgi': !!resources['osgi-bundles']
        };

        if (resources['product-version']) {
            AJS.$.ajax({
                url: resources['product-version'],
                type: 'get',
                cache: false,
                contentType: contentTypes['upm'],
                dataType: 'json',
                success: function(response) {
                    isDevelopmentProductVersion = response.development;
                    isUnknownProductVersion = response.unknown;
                }
            });
        }

        AJS.$.each(permissions, function(id) {
            if (AJS.Cookie.read("upm.show." + id) == "true") {
                AJS.$('#upm-tab-' + id).closest('li').removeClass('hidden');
            }
        });

        hash = getLocationHash(AJS.Cookie.read("upm.tab"));

        if (hash.tab != 'upgrade' && hasPermissionFor('upgrade')) {
            // load the upgrade tab so we get the upgrades count, but wait until the selected tab is done loading
            AJS.$('#upm-panel-' + hash.tab).bind('panelLoaded.upgrade', function() {
                loadUpgradeTab(AJS.$('#upm-panel-upgrade'));
                AJS.$(this).unbind('panelLoaded.upgrade');
            });
        }
        loadTab(hash.tab, hash.key, null, false);
    }

    /**
     * Returns the parsed value of the current hash in an object
     * @method getLocationHash
     * @param {String} defaultHash (optional) Default to return if no hash is present.  If not specified, default tab is used.
     * @return {Object} Object containing a tab value for the current tab and key value if there is a plugin to focus
     */
    function getLocationHash(defaultHash) {
        var hash = document.location.hash || defaultHash || getDefaultTab(),
                arr = hash.split('/'),
                tab = arr[0],
                key = arr.length > 1 ? arr[1] : '';
        if (tab.charAt(0) == '#') {
            tab = tab.substring(1, tab.length);
        }
        if (!hasPermissionFor(tab)) {
            tab = getDefaultTab();
        }
        return {'tab': tab, 'key': key};
    }

    /**
     * Gets a list of plugins from a given location, builds DOM elements and inserts them into a specified container
     * @method loadPlugins
     * @param {String} url Location of the resource to hit to retrieve the list of plugins
     * @param {Object} listOptions Object defining list characteristics
     * @param {HTMLElement} listContainer Container to load plugin list into
     * @param {HTMLElement} parentContainer (optional) Container to mark as "loaded" when finished
     * @param {Function} callbackFn (optional) Function to be called after plugins have been successfully loaded
     */
    function loadPlugins(url, listOptions, listContainer, parentContainer, callbackFn) {
        var
                // check to see if there's existing pagination data
                pagination = listContainer.data('pagination') || {
                    'start-index': 0,
                    'max-results': maxResults
                },
                // so that we can tell if we're starting from scratch or appending to an existing list
                isFreshLoad = (pagination['start-index'] === 0);

        parentContainer = parentContainer || listContainer;
        if (listContainer.hasClass('loading')) {
            // if we're already loading these plugins, don't do anything
            return;
        }
        if (isFreshLoad) {
            listContainer.addClass('loading');
        }
        parentContainer.removeClass('plugin-warning-unknown-version').removeClass('plugin-warning-development-version');
        AJS.$.ajax({
            url: url,
            type: 'get',
            cache: false,
            dataType: 'json',
            data: pagination,
            success: function(response) {
                var plugins = response.plugins,
                        list,
                        button,
                        pagerElement;
                if (isFreshLoad) {
                    // create a whole new plugin list
                    listContainer.removeClass('loading').append(buildPluginList(plugins, listOptions));
                    list = AJS.$('div.upm-plugin-list', listContainer);
                } else {
                    // append to an existing plugin list
                    list = AJS.$('div.upm-plugin-list', listContainer);
                    buildPluginElements(plugins, list, listOptions);
                }
                // set the start index to the number of existing plugin elements
                pagination['start-index'] = AJS.$('div.upm-plugin', list).length;
                callbackFn && callbackFn(response);
                parentContainer.addClass('loaded');

                if (isUnknownProductVersion) {
                    if (isDevelopmentProductVersion) {
                        parentContainer.addClass('plugin-warning-development-version');
                    } else {
                        parentContainer.addClass('plugin-warning-unknown-version');
                        AJS.$('#upm-install-search-form-container').addClass('hidden');
                    }
                }

                pagerElement = AJS.$('div.upm-plugin-list-pager', listContainer);
                if (plugins.length == pagination['max-results']) {
                    pagerElement.removeClass('hidden');
                    button = AJS.$('button', pagerElement);
                    button.bind('click', function(e) {
                        var pagerElement = AJS.$('div.upm-plugin-list-pager', listContainer);
                        button.blur();
                        if (!pagerElement.hasClass('loading')) {
                            pagerElement.addClass('loading');
                            button.unbind('click');
                            loadPlugins(url, listOptions, listContainer, parentContainer, function() {
                                pagerElement.removeClass('loading');
                            });
                        }
                    });
                } else {
                    pagerElement.addClass('hidden');
                }
                // save the pagination data back to the container element
                listContainer.data('pagination', pagination);
            },
            error: function(request) {
                listContainer.removeClass('loading');
                AJS.$('div.upm-plugin-list-pager', listContainer).removeClass('loading');
                handleAjaxError(messageContainer, request,'');
            }
        });
    }

    /**
     * If PAC is available, remove the warning at the top of the screen
     */
    function checkPacAvailable() {
        AJS.$.ajax({
            url: resources['pac-status'],
            type: 'get',
            cache: false,
            dataType: 'json',
            data: null,
            success: function(response) {
                AJS.$("#upm-pac-checking-availability").remove();
                if (response && response.disabled) {
                    // PAC was disabled by the system admin
                    AJS.$("#upm-pac-disabled").show().removeClass("hidden");
                } else if (!response || !response.reached) {
                    // PAC is enabled but couldn't be reached
                    AJS.$("#upm-pac-unavailable").show().removeClass("hidden");
                }
            },
            error: function(request) {
                AJS.$("#upm-pac-checking-availability").remove();
                AJS.$("#upm-pac-unavailable").show().removeClass("hidden");
                handleAjaxError(messageContainer, request, '');
            }
        });

        // The #upm-pac-checking-availability must be displayed after 30s if no answer was
        // returned.
        AJS.$("#upm-pac-checking-availability").hide().removeClass("hidden").delay(10000).fadeIn(0);
    }

    /**
     * Creates and loads a list of installable plugins
     * @method loadInstallTab
     * @param {HTMLElement} container Container to load content into
     * @param {Function} callbackFn (optional) Function to run on success
     */
    function loadInstallTab(container, callbackFn) {
        if (resources['install']) {
            AJS.$('#upm-upload').removeClass('hidden');
        }
        changeDisplayedPlugins(callbackFn);
        container.addClass('loaded').trigger('panelLoaded');
    }

    /**
     * Loads content for upgrade tab
     * @method loadUpgradeTab
     * @param {HTMLElement} container Container to load content into
     * @param {Function} callbackFn Function to run if request is successful
     */
    function loadUpgradeTab(container, callbackFn) {
        var availableUpgrades = AJS.$('#upm-available-upgrades'),
                options = {isExpandable: true, isInstalledList: true, className: 'upgrade'},
                filterBox = AJS.$('#upm-upgrade-filter-box');
        container = container || AJS.$('#upm-panel-upgrade');
        container.removeClass('plugin-warning-unknown-version').removeClass('plugin-warning-development-version').removeClass('no-upgrades');

        if (hasPermissionFor('upgrade')) {
            // if we're already loading the list, don't do anything
            if (availableUpgrades.hasClass('loading')) {
                return;
            }
            filterBox.removeAttr('disabled').val(AJS.params.upmTextFilterPlugins);
            availableUpgrades.empty().addClass('loading');
            AJS.$.ajax({
                url: resources['upgrades'],
                type: 'get',
                cache: false,
                dataType: 'json',
                success: function(response) {
                    var plugins = response.plugins,
                            upgradeAllLink = response.links['upgrade-all'],
                            upgradeAllButton = AJS.$('<button></button>');
                    safeMode = (response.safeMode === true);

                    availableUpgrades.removeClass('loading').append(buildPluginList(plugins, options));

                    upgradeAllButton.attr("id", "upm-upgrade-all")
                            .text(AJS.params.upmTextUpgradeAll)
                            .prependTo(AJS.$('div.upm-plugin-list-container', availableUpgrades));

                    if (isUnknownProductVersion) {
                        if (isDevelopmentProductVersion) {
                            container.addClass('plugin-warning-development-version');
                        } else {
                            container.addClass('plugin-warning-unknown-version');
                            filterBox.attr('disabled', 'disabled').val(AJS.params.upmTextFilterPluginsNoneAvailable);
                        }
                    }
                
                    if (plugins.length) {
                        AJS.$('#upm-upgrade-tab-count-value').text(plugins.length);
                        AJS.$('#upm-upgrade-tab-count').removeClass('hidden');

                        // Disable upgrade button in safe mode
                        if (safeMode) {
                            upgradeAllButton.attr('disabled', 'disabled');         
                        } else {
                            upgradeAllButton.removeAttr('disabled');         
                        }
                    } else {
                        AJS.$('#upm-panel-upgrade').addClass('no-upgrades');
                        AJS.$('#upm-upgrade-tab-count').addClass('hidden');
                        filterBox.attr('disabled', 'disabled').val(AJS.params.upmTextFilterPluginsNoneAvailable);
                    }

                    container.addClass('loaded').trigger('panelLoaded');
                    if (upgradeAllLink) {
                        resources['upgrade-all'] = upgradeAllLink;
                        upgradeAllButton.removeClass('hidden');
                    } else {
                        upgradeAllButton.remove();
                    }
                    callbackFn && callbackFn(response);
                },
                error: function(request) {
                    availableUpgrades.removeClass('loading');
                    handleAjaxError(messageContainer, request, "");
                }
            });
        }
    }

    /**
     * Loads content for manage tab
     * @method loadManageTab
     * @param {HTMLElement} container Container to load content into
     * @param {Function} callbackFn Function to run if request is successful
     */
    function loadManageTab(container, callbackFn) {
        var userContainer = AJS.$('#upm-user-plugins'),
                systemContainer = AJS.$('#upm-system-plugins');
                filterBox = AJS.$('#upm-manage-filter-box');
        if (hasPermissionFor('manage')) {
            // if we're already loading the list, don't do anything
            if (userContainer.hasClass('loading')) {
                return;
            }
            userContainer.empty().addClass('loading');
            systemContainer.empty().addClass('loading');
            container = container || AJS.$('#upm-panel-manage');

            AJS.$.ajax({
                url: resources['root'],
                type: 'get',
                cache: false,
                dataType: 'json',
                success: function(response) {
                    var userPluginsOptions = {isExpandable: true, isInstalledList: true, className: 'manage', isUserPluginList: true},
                            systemPluginsOptions = {isExpandable: true, isInstalledList: true, className: 'manage'},
                            plugins = response.plugins,
                            bundledPlugins = [],
                            userPlugins = [];

                    for (var i = 0, len = plugins.length; i < len; i++) {
                        var plugin = plugins[i];
                        if (plugin.userInstalled) {
                            userPlugins.push(plugin);
                        } else {
                            bundledPlugins.push(plugin);
                        }
                    }
                    userContainer.removeClass('loading').append(buildPluginList(userPlugins, userPluginsOptions));
                    systemContainer.removeClass('loading').append(buildPluginList(bundledPlugins, systemPluginsOptions));

                    container.addClass('loaded').trigger('panelLoaded');
                    callbackFn && callbackFn(response);
                },
                error: function(request) {
                    userContainer.removeClass('loading');
                    systemContainer.removeClass('loading');
                    handleAjaxError(messageContainer, request, "");
                }
            });
        }
    }

    /**
     * Loads content for developer tab
     * @method loadOsgiTab
     * @param {HTMLElement} container Container to load content into
     * @param {Function} callbackFn Function to run if request is successful
     */
    function loadOsgiTab(container, callbackFn) {
        var bundleContainer = AJS.$('#upm-osgi-bundles');
        if (bundleContainer.hasClass('loading')) {
            return;
        }
        bundleContainer.empty().addClass('loading');
        container = container || AJS.$('#upm-panel-osgi');
        AJS.$.ajax({
           url: resources['osgi-bundles'],
           type: 'get',
           cache: false,
           dataType: 'json',
           success: function(response) {
               var bundles = buildPluginList(response.entries, {isExpandable: true, isInstalledList: false, isBundle: true, className: 'osgi'});
               bundleContainer.append(bundles);
               bundleContainer.removeClass('loading');
               container.addClass('loaded').trigger('panelLoaded');
               callbackFn && callbackFn(response);
           },
           error: function(request) {
               bundleContainer.removeClass('loading');
               handleAjaxError(messageContainer, request, "");
           }
        });
    }


    /**
     * Loads content for compatibility tab
     * @method loadCompatibilityTab
     * @param {HTMLElement} container Container to load content into
     * @param {Function} callbackFn Function to run if request is successful
     */
    function loadCompatibilityTab(container, callbackFn) {
        var selectElement = AJS.$('#upm-compatibility-version'),
                select = selectElement.clone(),
                check = AJS.$('input.submit', container);

        AJS.$('div.upm-compatibility-category', container).addClass('hidden');
        AJS.$('#upm-no-userinstalled').addClass('hidden');

        if (!container.hasClass('loaded') && hasPermissionFor('compatibility')) {
            select.removeAttr('disabled');
            check.attr('disabled', 'disabled');
            container.addClass('loading');

            AJS.$.ajax({
                url: resources['product-upgrades'],
                type: 'get',
                cache: false,
                dataType: 'json',
                success: function(response) {
                    var versions = response.versions,
                            len = versions.length,
                            option;
                    if (len == 0) {
                        AJS.$('#upm-compatibility-no-versions').removeClass('hidden');
                    } else {
                        AJS.$('#upm-compatibility-versions-available').removeClass('hidden');
                        for (var i = 0; i < len; i++) {
                            option = AJS.$('<option></option>');
                            option.val(versions[i].links.self)
                                    .text(versions[i].version)
                                    .appendTo(select);
                            if (versions[i].recent) {
                                option.addClass('upm-recent');
                            }
                        }
                        selectElement.replaceWith(select);
                        check.removeAttr('disabled');
                    }
                    container.addClass('loaded').trigger('panelLoaded');
                    callbackFn && callbackFn(response);
                    container.removeClass('loading');
                },
                error: function(request) {
                    container.removeClass('loading');
                    handleAjaxError(messageContainer, request, "");
                }
            });
        }
    }

    /**
     * Loads content for audit log tab
     * @method loadLogTab
     * @param {HTMLElement} container Container to load content into
     * @param {Function} callbackFn Function to run if request is successful
     */
    function loadLogTab(container, callbackFn) {
        var desc = AJS.$('#upm-log-description');

        if (hasPermissionFor('log')) {
            AJS.$('#upm-audit-log-feed').attr('href', resources['audit-log']);
            buildLogEntries(container, null);
            // we can't get safe mode, pending task, or requires restart info from log feed, so make an extra call if we don't have it already
            if (safeMode == undefined) {
                AJS.$.ajax({
                    url: resources['root'],
                    type: 'get',
                    cache: false,
                    dataType: 'json',
                    success: callbackFn
                });
            }
            if (desc.hasClass('hidden')) {
                AJS.$.ajax({
                    url: resources['audit-log-purge-after'],
                    type: 'get',
                    cache: false,
                    dataType: 'json',
                    success: function(response) {
                        var numDays = response.purgeAfter,
                            configDayInput = AJS.$('#upm-log-configuration-days');
                        if (resources['audit-log-purge-after-manage']) {
                            AJS.$('#upm-log-configure').removeClass('hidden');
                        }
                        setPurgePolicyText(numDays);
                        configDayInput.val(numDays).attr('data-lastValid',numDays);
                        desc.removeClass('hidden');
                    },
                    error: function(request) {
                        handleAjaxError(messageContainer, request, "");
                    }
                });
            }
            container.trigger('panelLoaded');
        }
    }

    /**
     * Event handler for audit log page button clicks
     * @method logPagingEventHandler
     * @param {Event} e Event object
     */
    function logPagingEventHandler(e) {
        var target = AJS.$(e.target),
            id = target.attr('id');
        e.preventDefault();
        if (!target.hasClass('disabled')) {
            buildLogEntries(AJS.$('#upm-panel-log'), AJS.$('#' + id + '-url').val());
        }
    }

    /**
     * Creates and returns a list of entries from the audit log
     * @method buildLogEntries
     * @param {HTMLElement} container An array of plugin objects
     * @param {String} logPageUrl the url at which the desired page of audit log results will be found, or null
     */
    function buildLogEntries(container, logPageUrl) {
        buildLogEntries.template = buildLogEntries.template || AJS.$(AJS.$('#upm-log-template').html());
        buildLogEntries.rowTemplate = buildLogEntries.rowTemplate || AJS.$(AJS.$('#upm-log-row-template').html());
        container.addClass('loading');
        AJS.$('#upm-audit-log').remove();
        AJS.$.ajax({
            url: logPageUrl || resources['audit-log'],
            type: 'get',
            cache: false,
            dataType: (isIE) ? 'text' : 'xml',
            success: function(response) {
                var xml = getXml(response),
                        entries = AJS.$('entry', xml),
                        firstPageHref = AJS.$('link[rel=\'first\']', xml).attr('href'),
                        previousPageHref = AJS.$('link[rel=\'previous\']', xml).attr('href'),
                        nextPageHref = AJS.$('link[rel=\'next\']', xml).attr('href'),
                        lastPageHref = AJS.$('link[rel=\'last\']', xml).attr('href'),
                        log = buildLogEntries.template.clone(),
                        table = log.find('table tbody'),
                        totalEntries = AJS.$('totalEntries:first', xml).text(),
                        startIndex = parseInt(AJS.$('startIndex:first', xml).text(), 10),
                        resultsCount = entries.length;
                if (entries.length == 0) {
                    container.removeClass('loading').append(AJS.$('<div id="upm-audit-log"></div>').text(AJS.params.upmTextEmptyLog));
                } else {
                    entries.each(function(i) {
                        var row = buildLogEntries.rowTemplate.clone(),
                            profile = AJS.$('author:first', this),
                            profileUri = AJS.$('uri', profile),
                            username = AJS.$('name', profile).text();
                        AJS.$('td.message', row).text(AJS.$('title:first', this).text());

                        if (profileUri.size()) {
                            AJS.$('td.username', row).append(AJS.$("<a></a>").attr('href', profileUri.text()).text(username));
                        } else {
                            AJS.$('td.username', row).text(username);
                        }

                        AJS.$('td.date', row).text(prettyDate(AJS.$('updated:first', this).text()));
                        if (i % 2 == 1) {
                            row.addClass('zebra');
                        }
                        table.append(row);
                    });
                    container.append(log).removeClass('loading');

                    AJS.$('#upm-audit-log-first-url').val(firstPageHref);
                    AJS.$('#upm-audit-log-next-url').val(nextPageHref);
                    AJS.$('#upm-audit-log-previous-url').val(previousPageHref);
                    AJS.$('#upm-audit-log-last-url').val(lastPageHref);

                    AJS.$('#upm-audit-log-first').toggleClass('disabled', !firstPageHref);
                    AJS.$('#upm-audit-log-previous').toggleClass('disabled', !previousPageHref);
                    AJS.$('#upm-audit-log-next').toggleClass('disabled', !nextPageHref);
                    AJS.$('#upm-audit-log-last').toggleClass('disabled', !lastPageHref);

                    // hide pagination stuff if there's only one page
                    AJS.$('#upm-audit-log-pagination').toggleClass('hidden', !(firstPageHref || previousPageHref || nextPageHref || lastPageHref));

                    AJS.$('#upm-audit-log-count').text(AJS.format(AJS.params.upmTextAuditLogCount, startIndex + 1, startIndex + resultsCount, totalEntries));
                }
            },
            error: function(response) {
                var xml = response.responseXML || getXml(response.responseText),
                    sudoError = false,
                    jsonError;
                // We should reload if it was a webSudo error
                try {
                    jsonError = upm.json.parse(response.responseText);
                } catch (e) {
                    AJS.log('Failed to parse response text: ' + e);
                }
                var status = response.status || jsonError["status-code"];
                sudoError = reloadIfUnauthorizedStatus(status) || reloadIfWebSudoError(jsonError.subCode);
                if (!sudoError) {
                    container.removeClass('loading');
                    displayMessage(messageContainer, AJS.params.upmTextLogError, 'error');
                }
            }
        });
    }

    /**
     * Toggles an html element representing a plugin between an expanded and collapsed state
     * @method togglePluginDetails
     * @param {Event} e The event object
     */
    function togglePluginDetails(e) {
        var container = AJS.$(e.target).closest('div.upm-plugin'),
                hash = getPluginHash(container),
                details;
        if (container.hasClass('expanded')) {
            container.removeClass('expanded');
            // remove any messages when plugin is collapsed
            removeMessage(e);
        } else {
            container.addClass('expanded');
            details = container.find('div.upm-details');
            if (!details.hasClass('loaded') && !details.hasClass('loading')) {
                buildPluginDetails(hash, details);
            }
        }
    }

    /**
     * Collapses all plugin details within target section
     * @param {Event} e The event object
     */
    function collapseAllPluginDetails(e) {
        toggleAllPluginDetails(e, false);
    }

    /**
     * Expands all plugin details within target section
     * @param {Event} e The event object
     */
    function expandAllPluginDetails(e) {
        toggleAllPluginDetails(e, true);
    }

    /**
     * Toggle the expanded state of all plugin details in the target section based on the specified expand flag.
     * @param {Event} e The event object
     * @param {Boolean} expand Set to true if all plugin details will be expanded, otherwise set to false if the
     * plugin details will be collapsed
     */
    function toggleAllPluginDetails(e, expand) {
        var target = AJS.$(e.target).blur(),
                container = target.closest('div.upm-plugin-list-container');

        if (expand) {
            AJS.$('div.upm-plugin:not(.expanded):visible div.upm-plugin-row', container).trigger('click');
        } else {
            AJS.$('div.upm-plugin.expanded:visible div.upm-plugin-row', container).trigger('click');
        }
        e.preventDefault();
    }

    /**
     * Fired when a tab element is clicked on. Swaps out the appropriate content and highlights the appropriate tab
     * @method swapTab
     * @param {Event} e The event object
     */
    function swapTab(e) {
        var el = AJS.$(e.target),
                id = el.attr('id');
        e.preventDefault();
        id = id.substring('upm-tab-'.length, id.length);
        loadTab(id);
        el.blur();
    }

    /**
     * Clears the value of an input element on focus, and restores the default text on blur if the value is an empty string
     * @method clearOnBlur
     * @param {String|HTMLElement} element The input element to set focus and blur events on
     * @param {String} text The default text that appears in the input element
     */
    function clearOnBlur(element, text) {
        element = AJS.$(element);
        element.focus(function() {
            if (element.val() == text) {
                element.val('');
                element.addClass('upm-textbox-active');
            }
        }).blur(function() {
            if (element.val() == '') {
                element.val(text);
                element.removeClass('upm-textbox-active');
            }
        });
    }

    /**
     * Displays a dialog that allows the user to upload a plugin
     * @method showUploadDialog
     * @param {Event} e The event object
     */
    function showUploadDialog(e) {
        // UPM-646 - in the uploadPlugin method we attach a method to handle the popup to the load of the iframe,
        // we need to unbind this everytime we pop the upload dialog up otherwise we will have multiple load
        // handlers and only the last one will be correct.
        AJS.$('#upm-upload-target').unbind('load').unbind('load.upload');
        AJS.$('#upm-upload-url, #upm-upload-file').val('');
        showUploadDialog.dialog = showUploadDialog.dialog || createUploadDialog();
        showUploadDialog.dialog.show();
        focusDialog(showUploadDialog.dialog);
        e.preventDefault();
    }

    /**
     * Creates a dialog for uploading plugins
     * @method createUploadDialog
     */
    function createUploadDialog() {
        var popup = new AJS.Dialog(400, 275, 'upm-upload-dialog');
        popup.addHeader(AJS.params.upmTextUploadPlugin);
        popup.addPanel("All", AJS.$('#upm-upload-form-template').html());
        popup.addButton(AJS.params.upmTextUpload, function (dialog) {
            AJS.$('#upm-upload-form').submit();
        });
        popup.addButton(AJS.params.upmTextCancel, function (dialog) {
            dialog.hide();
        });
        AJS.$('#upm-upload-form').submit(function(e) {
            var uri = AJS.$('#upm-upload-url').val(),
                file = AJS.$('#upm-upload-file').val();
            AJS.$('#upm-upload-form').attr('action', resources['install'] + '?token=' + AJS.$('#upm-install-token').val());
            if (uri) {
                e.preventDefault();
                installPluginFromUri(uri);
            } else if (file) {
                uploadPlugin();
            } else {
                displayErrorMessage(messageContainer, {subCode : 'upm.install.upload.empty.error'}, '');
            }
            popup.hide();
        });
        return popup;
    }

    /**
     * Called on click of the 'Download' button on non-deployable plugins. This shows the download dialog message.
     * @method showDownloadDialog
     * @param {Event} e The event object
     */
    function showDownloadDialog(e) {
        var target = AJS.$(e.target),
                plugin = target.hasClass('upm-plugin') ? target : target.closest('div.upm-plugin'),
                name = AJS.$('.upm-plugin-name', plugin).text(),
                header = AJS.format(AJS.params.upmTextNonDeployableHeader, name),
                version = AJS.$('.upm-plugin-version', plugin).text(),
                binaryUrl = plugin.find('input.upm-plugin-binary').val(),
                template;
        showDownloadDialog.template = showDownloadDialog.template || AJS.$(AJS.$('#upm-download-nondeployable-template').html());
        template = showDownloadDialog.template.clone();

        AJS.$('span.upm-nondeployable-instruction', template).text(AJS.format(AJS.params.upmTextNonDeployableInstruction, name));
        AJS.$('a.upm-nondeployable-homepage-link', template).attr('href', plugin.find('input.upm-plugin-homepage').val())
            .text(AJS.format(AJS.params.upmTextNonDeployableHomepage, name));

        if (binaryUrl) {
            AJS.$('a.upm-nondeployable-download-link', template).attr('href', binaryUrl)
                .html(upm.html_sanitize(AJS.format(AJS.params.upmTextNonDeployableDownload, name, version)));
        } else {
            AJS.$('a.upm-nondeployable-download-link', template).parent().addClass('hidden');
        }

        showInfoDialog(header, template.html());
        e.preventDefault();
    }

    /**
     * Called when trying to uninstall in JIRA, shows a message explaining it won't work
     * @method showJiraUninstallDialog
     * @param {Event} e The event object
     */
    function showJiraUninstallDialog(e) {
        showInfoDialog(AJS.params.upmTextJiraUninstallHeader, AJS.$('#upm-jira-uninstall-template').html());
        e.preventDefault();
    }

    /**
     * Shows an informational dialog with the specified content
     * @method showInfoDialog
     * @param {String} header Text to put in the dialog header
     * @param {String} header Text/html to put in the dialog body
     */
    function showInfoDialog(header, content) {
        showInfoDialog.dialog = (showInfoDialog.dialog && changeDialogContent(showInfoDialog.dialog, header, content))
                                     || createInfoDialog(header, content);
        showInfoDialog.dialog.show();
        focusDialog(showInfoDialog.dialog);

    }
    /**
     * Changes the header and body of the current panel of a specified dialog
     * @method changeDialogContent
     * @param {Object} dialog The dialog object to change
     * @param {String} header Text to put in the dialog header
     * @param {String} header Text/html to put in the dialog body
     */
    function changeDialogContent(dialog, header, content) {
        dialog.addHeader(header);
        dialog.getCurrentPanel().html(upm.html_sanitize(content, htmlSanitizerUrlPolicy));
        return dialog;
    }

    /**
     * Creates a dialog for downloading non-deployable plugins
     * @method createInfoDialog
     * @param {String} header Text to put in the dialog header
     * @param {String} header Text/html to put in the dialog body
     */
    function createInfoDialog(header, content) {
        var popup = new AJS.Dialog(600, 215, 'upm-info-dialog');
        popup.addHeader(header);
        popup.addPanel("All", content);
        popup.addButton(AJS.params.upmTextClose, function (dialog) {
            dialog.hide();
        });
        return popup;
    }

    /**
     * For use when making UI changes before and after a synchronous requests.  Avoids "flickering" UI elements by:
     *  -- only running the the "startFn" if the request takes longer than a specified threshold
     *  -- if startFn is run, stopFn will not be run until a specified delay has passed
     * @method execCallbacksWithThreshold
     * @param {Function} startFn Function to run at the beginning of the request
     * @param {Function} stopFn Function to run once the request has been completed
     * @param {Number} latencyThreshold Amount of time to wait before calling startFn (in ms)
     * @param {Number} minShowTime Minimum amount of time between calling startFn and stopFn (in ms)
     * @return {Function} The function to run when request has completed (stopFn is ready to be executed)
     */
    function execCallbacksWithThreshold(startFn, stopFn, latencyThreshold, minShowTime) {
        latencyThreshold = latencyThreshold || 50;
        minShowTime = minShowTime || 1000;
        var stop,
                // Run a callback after specified delay
                delay;

        if (skipLatentThreshold) {
            // in Confluence/IE just run the callback immediately to lessen UI lag
            delay = function (callback) {
                callback && callback();
            };
        } else {
            delay = function (callback, l) {
                delay.t = setTimeout(function(){
                    clearTimeout(delay.t);
                    delay.t = undefined;
                    callback && callback();
                }, l);
            };
        }

        delay(function() {
            // if stop is already defined, returned fn has been called, so don't even execute startFn
            if (!stop) {
                startFn();
                delay(function() {
                    // if stop is defined here, returned fn was called during the delay, so call stop()
                    if (stop) {
                        stop();
                    }
                }, minShowTime);
            }
        }, latencyThreshold);

        return function() {
            // don't define stop until the returned function is called
            stop = stopFn;

            // only run stop() if no timeout is defined
            if (!delay.t) {
                stop();
            }
        };

    }

    /**
     * Shows a lightbox indicating that an action (installation, upgrade, etc) is being performed
     * @method startProgress
     * @param {String} text The message to be displayed
     */
    function startProgress(text) {
        if (!progressPopup) {
            progressPopup = new AJS.popup({
                width: 400,
                height: 175,
                id: "upm-progress-popup",
                keypressListener: function() {} // don't let users hide progress popup by hitting the escape key
            });
            progressPopup.element.append(AJS.$('#upm-progress-template').html());
        }
        // store stopFn for later use (eg in stopProgress())
        progressPopup.stopFn = execCallbacksWithThreshold(
                function() {
                    updateProgressText(text);
                },
                function() {
                    progressPopup.hide();
                    // make sure the progress bar is hidden for next time
                    progressPopup.element.removeClass('upm-progress-download');
                },
                isLatentThreshold,
                minProgressDisplay);
        return progressPopup;
    }

    /**
     * Hides the 'In Progress' lightbox
     * @method stopProgress
     */
    function stopProgress() {
        progressPopup.stopFn();
    }

    /**
     * Updates the text of the "In Progress" lightbox and changes its size to fit
     * @method updateProgressText
     * @param {String} text Text to be inserted into progress element
     */
    function updateProgressText(text) {
        var buffer = 25,
                height = 0;
        AJS.$('div.upm-progress-text', progressPopup.element).html(upm.html_sanitize(text));
        height = AJS.$('#upm-progress').height() + buffer;
        if (minProgressHeight > height) {
            height = minProgressHeight;
        }
        progressPopup.changeSize(null, height);
        // some versions of dialog.changeSize() in AUI call dialog.show(), others don't
        if (!progressPopup.element.is(':visible')) {
            progressPopup.show();
        }
    }

    /**
     * Given a pending task response's content type, this function parses out the relevent task details and returns it in an object
     * @method parsePendingTaskContentType
     * @param {String} contentType Text to be inserted into progress element
     * @return {Object} Object containing 'type' and 'status' attributes
     */
    function parsePendingTaskContentType(contentType) {
        // content type for pending tasks will be of the form 'application/vnd.atl.plugins.{task}.{status}+json'
        var regex = /application\/vnd\.atl\.plugins\.(upgradeall|install|cancellable)\.(.*)\+json/,
            tmp,
            detail;
        if (contentType && regex.test(contentType)) {
            tmp = contentType.match(regex);
            detail = {type: tmp[1], status: tmp[2]};
        }
        return detail;
    }

    /**
     * Polls a resource to determine if an asynchronous request has finished
     * @method pollAsynchronousResource
     * @param {String} location URI of the asynchronous resource
     * @param {Number} delay Time, in ms, to wait before next poll
     * @param {HTMLElement} container Element to show error/success messages in
     * @param {Function} callbackFn Function to be executed if asynchronous request completes successfully
     */
    function pollAsynchronousResource(location, delay, container, callbackFn) {
        delay = delay || 100;
        try {
            AJS.$.ajax({
                type: 'GET',
                cache: false,
                url: location,
                contentType: contentTypes['json'],
                // can't access the request object from the success fn (before jquery 1.4), so we have to use the
                // 'complete' callback
                complete: function(request) {
                    var statusCode = request.status,
                            contentType = request.getResponseHeader('Content-Type'),
                            taskDetail,
                            response,
                            status,
                            progressPercent = 0,
                            progressContainer = AJS.$('#upm-progress');
                    if (statusCode == '200') {
                        response = upm.json.parse(request.responseText);
                        status = response.status;
                        if (status) {
                            if (status.numberComplete) {
                                pollAsynchronousResource.currentProgress = status.numberComplete + 1;
                            } else if (status.numberComplete == '0') {
                                pollAsynchronousResource.currentProgress = 1;
                            }
                            if (status.totalUpgrades) {
                                pollAsynchronousResource.totalUpgrades = status.totalUpgrades;
                            }
                        }
                        taskDetail = parsePendingTaskContentType(contentType);

                        if (taskDetail && !status.done) {
                            if (response.pingAfter) {
                                // if still working, content type is application/vnd.atl.plugins.pending-task+json
                                // and a pingAfter property was returned in the response
                                setTimeout(function() {
                                    pollAsynchronousResource(location, response.pingAfter, container, callbackFn);
                                }, delay);
                                if (taskDetail.status == 'downloading') {
                                    if (status.totalSize) {
                                        progressPercent = Math.floor((status.amountDownloaded / status.totalSize) * 100);
                                    }
                                    progressPopup.element.addClass('upm-progress-download');
                                    AJS.$('div.upm-progress-amount', progressContainer).width(progressPercent + '%');
                                    AJS.$('span.upm-progress-bar-percent', progressContainer).text(progressPercent);
                                } else {
                                    progressPopup.element.removeClass('upm-progress-download');
                                }

                                if (taskDetail.type == 'upgradeall' && (taskDetail.status == 'upgrading' || taskDetail.status == 'downloading')) {
                                    pollAsynchronousResource.template = AJS.$(AJS.$('#upm-upgradeall-' + taskDetail.status + '-progress-template').html());
                                    var upgradeAllTemplate = pollAsynchronousResource.template.clone();
                                    AJS.$("#upm-upgradeall-current-name", upgradeAllTemplate).text(status.name || status.filename || status.source);
                                    AJS.$("#upm-upgradeall-current-version", upgradeAllTemplate).text(status.version);
                                    AJS.$("#upm-upgradeall-completed", upgradeAllTemplate).text(pollAsynchronousResource.currentProgress);
                                    AJS.$("#upm-upgradeall-total", upgradeAllTemplate).text(pollAsynchronousResource.totalUpgrades);
                                    updateProgressText(upgradeAllTemplate.html());
                                } else {
                                    updateProgressText((AJS.format(
                                            AJS.params['upm.progress.' + taskDetail.type + '.' + taskDetail.status],
                                            status.name || status.filename || status.source,
                                            status.version
                                            )));
                                }

                            } else {
                                // if there was an error during installation, response won't have a pingAfter property
                                stopProgress();
                                handleAjaxError(container, request, response.status.plugin);
                            }
                        } else {
                            if (response.status && (response.status.subCode || response.status.errorMessage)) {
                                stopProgress();
                                handleAjaxError(container, request, response.status.plugin);
                            } else {
                                // if simpler async tasks are completed, 303 will redirect to plugin details resource, but content type will be different
                                // if complex async tasks are completed, 'status' property will be set to 'SUCCEEDED'
                                callbackFn && callbackFn(response);
                            }
                        }
                    } else if (statusCode == '202') {
                        // separate from above `if` to prevent false negative
                        if (callbackFn) {
                            response = upm.json.parse(request.responseText);
                            response.statusCode = statusCode;
                            callbackFn(response);
                        }
                    } else if (statusCode == '0') {
                        // we're offline : something is probably wrong with baseUrl settings
                        stopProgress();
                        displayErrorMessage(container, {'subCode' : 'upm.baseurl.connection.error'}, location);
                    } else {
                        // something went horribly/unexpectedly wrong
                        stopProgress();
                        handleAjaxError(container, request, '');
                    }
                }
            });
        } catch (e) {
            // UPM-842: IE freaks out if you try to do a cross-domain request, which might happen if the base url is set
            // incorrectly, so catch the error and display a relevant error message
            AJS.log('Error doing ajax request: ' + e);
            stopProgress();
            displayErrorMessage(container, {'subCode' : 'upm.baseurl.connection.error'}, location);
        }
    }

    /**
     * Updates (or creates) the pending task detail text
     * @method updatePendingTaskDetail
     * @param {Object} task Task detail object
     */
    function updatePendingTaskDetail(task) {
        var container = AJS.$('#upm-pending-tasks-details'),
            existing = container.find('li'),
            status = task && task.status,
            detail = parsePendingTaskContentType(status && status.contentType),
            text;
        if (detail && status) {
            text = AJS.format(
                AJS.params.upmTextPendingTaskDetail,
                AJS.format(
                    AJS.params['upm.progress.' + detail.type + '.' + detail.status],
                    status.name || status.filename || status.source,
                    status.version
                ),
                task.username,
                prettyDate(task.timestamp)
            );
            if (existing.length) {
                existing.text(text);
            } else {
                container.append(
                    AJS.$('<li></li>').text(text)
                );
            }
        }
    }

    /**
     * Polls the pending tasks collection resource to determine if another user's task is running
     * @method pollPendingTasks
     */
    function pollPendingTasks() {
        clearTimeout(pollPendingTasks.timeout);
        AJS.$.ajax({
            url: resources['pending-tasks'],
            type: 'get',
            cache: false,
            dataType: 'json',
            success: function(response) {
                var task;
                if (response.tasks.length > 0) {
                    task = response.tasks[0];
                    updatePendingTaskDetail(task);
                    pollPendingTasks.timeout = setTimeout(pollPendingTasks, task.pingAfter);
                } else {
                    upmContainer.removeClass('upm-pending-tasks');
                    pollPendingTasks.timeout = undefined;
                }
            },
            error: function(request) {
                handleAjaxError(messageContainer, request, '');
            }
        });
    }

    /**
     * Initiates the uploading of a provided plugin
     * @method uploadPlugin
     */
    function uploadPlugin() {
        var filename = AJS.$('#upm-upload-file').val(),
            tmp = filename.split('\\');

        // only show the actual file name, not the whole path
        filename = tmp[tmp.length-1];
        startProgress(AJS.format(AJS.params.upmTextProgressUpload, filename));
        
        if (!hasPendingTasks(stopProgress)) {
            AJS.$('#upm-upload-target').unbind('load.upload').bind('load.upload', function() {
                var textarea = AJS.$('#upm-upload-target').contents().find('textarea'),
                    response = upm.json.parse(textarea.val());

                if (response.links && response.links.self) {
                    pollAsynchronousResource(response.links.self, response.pingAfter, messageContainer, function(uploadResponse) {
                        // If response is 202, it's UPM plugin upgrading time
                        if (uploadResponse.statusCode == '202') {
                            completeUPMUpgrade(uploadResponse.status.nextTaskPostUri, messageContainer, function(upmResponse) {
                                onPluginInstallComplete(upmResponse);
                            });
                        } else {
                            onPluginInstallComplete(uploadResponse);
                        }
                    });
                    // UPM-977 When there is an error or a success we need to make sure we have an updated XSRF token
                    getAndStoreAntiXsrfToken();
                } else {
                    // try to submit plugin again, with new token, exactly once -- one retry per user request
                    if (response.subCode == 'upm.error.invalid.token' && tryUploadAgain) {
                        getAndStoreAntiXsrfToken(function() {
                            // UPM-782 Executing a second submit to the upload form without calling stopProgress first
                            // will override the progressPopup.stopFn and will end up not calling the stopFn
                            // in the execCallbacksWithThreshold function, causing the throbber to display indefinitely
                            stopProgress();
                            tryUploadAgain = false;
                            AJS.$('#upm-upload-form').submit();
                        });
                    } else {
                        tryUploadAgain = true;
                        displayErrorMessage(messageContainer, textarea.val(), filename);
                        stopProgress();
                    }
                }

            });
        }
    }

    /**
     * Initiates the upgrading of a specified plugin
     * @method upgradePlugin
     * @param {Event} e The event object
     */
    function upgradePlugin(e) {
        var element = AJS.$(e.target),
            pluginElement = element.hasClass('upm-plugin') ? element : element.closest('div.upm-plugin'),
            header = AJS.$('div.upm-plugin-row', pluginElement),
            name = header.find('h4').text(),
            uri = pluginElement.find('input.upm-plugin-binary').val(),
            detailsElement = AJS.$('div.upm-details', pluginElement);
        startProgress(AJS.format(AJS.params.upmTextProgressUpgrade, name));

        if (!hasPendingTasks(stopProgress)) {
            if (uri) {
                AJS.$.ajax({
                    type: 'POST',
                    url: resources['root'] + '?token=' + AJS.$('#upm-install-token').val(),
                    dataType: 'text',
                    contentType: contentTypes['install'],
                    data: upm.json.stringify({ "pluginUri": uri }),
                    // can't access the request object from the success fn (before jquery 1.4), so we have to use the
                    // 'complete' callback
                    complete: function(request, status) {
                            var response = upm.json.parse(request.responseText);
                        if (status == 'success') {
                            var location = request.getResponseHeader('Location');
                            // Start listening for the upgrade task to return. If it's a 202, we have some UPM upgrading to do
                            pollAsynchronousResource(location, response.pingAfter, detailsElement, function(upgradeResponse) {
                                if (upgradeResponse.statusCode == '202') {
                                    completeUPMUpgrade(upgradeResponse.status.nextTaskPostUri, detailsElement, function(upmResponse) {
                                        onPluginUpgradeComplete(pluginElement, detailsElement, upmResponse);
                                    });
                                // Otherwise a normal plugin was upgraded
                                } else {
                                    onPluginUpgradeComplete(pluginElement, detailsElement, upgradeResponse);
                                }
                                tryUploadOrInstallAgain = true;
                                getAndStoreAntiXsrfToken(); // UPM-977 even in success, we need to get a new token for next time
                            });
                        } else {
                            // try to submit plugin again, with new token, exactly once -- one retry per user request
                            if (response.subCode == 'upm.error.invalid.token' && tryUploadOrInstallAgain) {
                                getAndStoreAntiXsrfToken(function() {
                                    // UPM-782 Executing a second stopProgress first
                                    // will override the progressPopup.stopFn and will end up not calling the stopFn
                                    // in the execCallbacksWithThreshold function, causing the throbber to display indefinitely
                                    stopProgress();
                                    tryUploadOrInstallAgain = false;
                                    upgradePlugin(e);
                                });
                            } else {
                                tryUploadOrInstallAgain = true;
                                stopProgress();
                                handleAjaxError(detailsElement, request, 'upgrade error');
                            }
                        }
                    }
                });
            } else {
                stopProgress();
                displayMessage(detailsElement, AJS.params.upmTextUpgradeError, 'upgrade error');
            }
        }
    }

    /**
     * Handle the initial long running task response for a UPM upgrade, and finish the process
     * @method completeUPMUpgrade
     * @param {HTMLElement} uri The URI of the stub plugin
     * @param {HTMLElement} detailsElement The element to show error/success messages in, passed through to pollAsynchronousResource
     * @param {Function} callbackFn The function to call when the upgrade is complete
     */
    function completeUPMUpgrade(uri, detailsElement, callbackFn) {
        // POST to stub plugin uri which starts upgrade of UPM, and returns URI for long running task
        AJS.$.ajax({
            type: 'POST',
            url: uri,
            dataType: 'json',
            contentType: contentTypes['json'],
            complete: function(request, status) {
                var location = request.getResponseHeader('Location'),
                    response = upm.json.parse(request.responseText);

                // When long running task is done we will need to DELETE to a URI, telling UPM to uninstall the stub
                pollAsynchronousResource(location, response.pingAfter, detailsElement, function(longRunningResponse) {
                    AJS.$.ajax({
                        type: 'DELETE',
                        url: longRunningResponse.status.cleanupDeleteUri,
                        dataType: 'json',
                        contentType: contentTypes['json'],
                        complete: function(deleteResponse) {

                            // UPM-1209, long running task returns 'requires refresh' flag, so hack / combine it with the delete response
                            var responseJson = upm.json.parse(deleteResponse.responseText);
                            responseJson.requiresRefresh = longRunningResponse.status.requiresRefresh;

                            callbackFn(responseJson);
                        }, error: function() {
                            displayMessage(detailsElement, AJS.params.upmTextLogError, 'error');
                        }
                    });
                });
            }, error: function() {
                displayMessage(detailsElement, AJS.params.upmTextLogError, 'error');
            }
        });
    }

    /**
     * Handle the completion of a plugin upgrade, after a long running task has completed
     * @method onPluginUpgradeComplete
     * @param {HTMLElement} pluginElement
     * @param {HTMLElement} detailsElement
     * @param {Object} response The response message object
     */
    function onPluginUpgradeComplete(pluginElement, detailsElement, response) {
        var restartState = response.restartState,
            refreshState = response.requiresRefresh,
            header = AJS.$('div.upm-plugin-row', pluginElement);

        stopProgress();
        if (restartState) {
            addChangeRequiringRestart({'action': restartState, 'name': response.name, 'key': response.key, 'links': {'self': response.links['change-requiring-restart']}});
            displayRestartMessage(detailsElement, restartState);
        } else if (refreshState) {
            displayRefreshMessage();
            displayMessage(detailsElement, AJS.params.upmTextUpgradeSuccess, 'upgrade success');
        } else {
            displayMessage(detailsElement, AJS.params.upmTextUpgradeSuccess, 'upgrade success');
        }
        AJS.$('button.upm-upgrade', pluginElement).attr('disabled', 'disabled');
        pluginElement.addClass('to-remove');
        header.click(function(e) {
            var callbackFn;
            if (AJS.$('#upm-available-upgrades div.upm-plugin').length == 1) {
                callbackFn = function() {
                    loadTab('upgrade', '', null);
                };
            }
            removeOnCollapse(e, callbackFn);
        });
        AJS.$('#upm-upgrade-tab-count-value').text(AJS.$('#upm-upgrade-tab-count-value').text() - 1);
    }

    /**
     * Initiates the upgrading of all plugins with available upgrades
     * @method upgradeAllPlugins
     * @param {Event} e The event object
     */
    function upgradeAllPlugins(e) {
        var button = AJS.$('#upm-upgrade-all'),
        errorCallback = function() {
            button.removeAttr('disabled');
            stopProgress();
        };
        button.attr('disabled', 'disabled');

        startProgress(AJS.params.upmTextProgressUpgradeAll);
        if (!hasPendingTasks(errorCallback)) {
            AJS.$.ajax({
                type: 'POST',
                url: resources['upgrade-all'],
                dataType: 'json',
                contentType: contentTypes['json'],
                // can't access the request object from the success fn (before jquery 1.4), so we have to use the
                // 'complete' callback
                complete: function(request, status) {
                    if (status == 'success') {
                        var location = request.getResponseHeader('Location');
                        pollAsynchronousResource(location, upm.json.parse(request.responseText).pingAfter, messageContainer, function(response) {
                            var successes = response.status.successes,
                                numSuccess = successes.length,
                                failures = response.status.failures,
                                numFail = failures.length,
                                total = numSuccess + numFail,
                                messageType = numFail === 0 ? 'success' : numSuccess === 0 ? 'error' : 'info',
                                container = AJS.$('#upm-available-upgrades');
                            stopProgress();
                            displayMessage(messageContainer, AJS.format(AJS.params.upmTextUpgradeAllComplete, numSuccess, total), 'upgrade ' + messageType);

                            if (numFail > 0) {
                                var displayPluginMessages = function(item, callbackFn) {
                                    var h4 = container.find('h4:contains("' + item.name + '")'),
                                        row = h4.closest('div.upm-plugin-row'),
                                        plugin = row.closest('div.upm-plugin'),
                                        details = plugin.find('div.upm-details');
                                    if (!plugin.hasClass('expanded')) {
                                        row.trigger('click');
                                        details.bind('pluginLoaded.message', function(e) {
                                            var el = AJS.$(e.target);
                                            callbackFn && callbackFn({pluginElement: plugin, detailsElement: el, rowElement: row, item: item});
                                            el.unbind('pluginLoaded.message');
                                        });
                                    } else {
                                        callbackFn && callbackFn({pluginElement: plugin, detailsElement: details, rowElement: row, item: item});
                                    }
                                };

                                AJS.$('#upm-upgrade-tab-count-value').text(numFail);

                                for (var i = 0; i < numSuccess; i++) {
                                    displayPluginMessages(successes[i], function(obj) {
                                        displayMessage(obj.detailsElement, AJS.params.upmTextUpgradeSuccess, 'install success');
                                        AJS.$('button.upm-upgrade', container).attr('disabled', 'disabled');
                                        obj.pluginElement.addClass('to-remove');
                                        obj.rowElement.click(removeOnCollapse);
                                    });
                                }
                                for (var i = 0; i < numFail; i++) {
                                    var failure = failures[i];
                                    displayPluginMessages(failure, function(obj) {
                                        var item = obj.item;
                                        if (item.subCode) {
                                            item.subCode = "upm.pluginInstall.error." + item.subCode;
                                        }
                                        displayErrorMessage(obj.detailsElement.removeClass('error'), item, item.source);
                                    });
                                }
                            } else {
                                // if there were no failures, show the happy graphic
                                loadTab('upgrade', '', null);
                            }
                            // UPM-884 - need to get UPM to check for requires restart for the upgraded plugins
                            if (response.status.links['changes-requiring-restart']) {
                                resources['changes-requiring-restart'] = response.status.links['changes-requiring-restart'];
                                checkForChangesRequiringRestart();
                            }
                        });
                    } else {
                        errorCallback();
                        handleAjaxError(messageContainer, request, 'upgrade error');
                    }
                }
            });
        }
    }

    /**
     * Initiates the installation of a specified plugin
     * @method installPlugin
     * @param {Event} e The event object
     */
    function installPlugin(e) {
        var element = AJS.$(e.target),
                plugin = element.hasClass('upm-plugin') ? element : element.closest('div.upm-plugin'),
                header = AJS.$('div.upm-plugin-row', plugin),
                name = header.find('h4').text(),
                uri = plugin.find('input.upm-plugin-binary').val(),
                details = AJS.$('div.upm-details', plugin);

        if (uri) {
            startProgress(AJS.format(AJS.params.upmTextProgressInstall, name));
            if (!hasPendingTasks(stopProgress)) {
                AJS.$.ajax({
                    type: 'POST',
                    url: resources['install'] + '?token=' + AJS.$('#upm-install-token').val(),
                    dataType: 'text',
                    contentType: contentTypes['install'],
                    data: upm.json.stringify({ "pluginUri": uri }),
                    // can't access the request object from the success fn (before jquery 1.4), so we have to use the
                    // 'complete' callback
                    complete: function(request, status) {
                            var response = upm.json.parse(request.responseText);
                        if (status == 'success') {
                            var location = request.getResponseHeader('Location');
                            pollAsynchronousResource(location, response.pingAfter, details, function(response) {
                                var restartState = response.restartState;
                                stopProgress();
                                if (restartState) {
                                    addChangeRequiringRestart({'action': restartState, 'name': response.name, 'key': response.key, 'links': {'self': response.links['change-requiring-restart']}});
                                    displayRestartMessage(details, restartState);
                                } else if (response.enabledByDefault && !response.enabled) {
                                    displayMessage(details, AJS.params.upmTextInstallCannotBeEnabled, 'install error');
                                } else if (response.unrecognisedModuleTypes) {
                                    displayMessage(details, AJS.params.upmTextInstallUnrecognisedModuleTypes, 'install info');
                                } else if (!response.enabledByDefault) {
                                    displayMessage(details, AJS.params.upmTextInstallSuccessNotEnabled, 'install info');
                                } else {
                                    displayMessage(details,AJS.params.upmTextInstallSuccess, 'install success');
                                }
                                AJS.$('button.upm-install', plugin).attr('disabled', 'disabled');
                                plugin.addClass('to-remove');
                                header.click(removeOnCollapse);
                                loadUpgradeTab();
                                tryUploadOrInstallAgain = true;
                                getAndStoreAntiXsrfToken(); // UPM-977 even in success, we need to get a new token for next time
                            });
                        } else {
                            // try to submit plugin again, with new token, exactly once -- one retry per user request
                            if (response.subCode == 'upm.error.invalid.token' && tryUploadOrInstallAgain) {
                                getAndStoreAntiXsrfToken(function() {
                                    // UPM-782 Executing a second stopProgress first
                                    // will override the progressPopup.stopFn and will end up not calling the stopFn
                                    // in the execCallbacksWithThreshold function, causing the throbber to display indefinitely
                                    stopProgress();
                                    tryUploadOrInstallAgain = false;
                                    installPlugin(e);
                                });
                            } else {
                                tryUploadOrInstallAgain = true;
                                stopProgress();
                                handleAjaxError(details, request, 'install error');
                            }
                        }
                    }
                });
            }
        }
    }

    /**
     * Initiates the installation of a specified plugin
     * @method installPlugin
     * @param {String} uri The uri of the plugin to install
     */
    function installPluginFromUri(uri) {
        if (uri) {
            startProgress(AJS.format(AJS.params.upmTextProgressInstall, uri));
            if (!hasPendingTasks(stopProgress)) {
                AJS.$.ajax({
                    type: 'POST',
                    url: resources['install'] + '?token=' + AJS.$('#upm-install-token').val(),
                    dataType: 'text',
                    contentType: contentTypes['install'],
                    data: upm.json.stringify({ "pluginUri": uri }),
                    // can't access the request object from the success fn (before jquery 1.4), so we have to use the
                    // 'complete' callback
                    complete: function(request, status) {
                        var response = upm.json.parse(request.responseText);
                        if (status == 'success') {
                            var location = request.getResponseHeader('Location');
                            pollAsynchronousResource(location, response.pingAfter, messageContainer, function(installResponse) {
                                if (installResponse.statusCode == '202') {
                                    completeUPMUpgrade(installResponse.status.nextTaskPostUri, messageContainer, function(upmResponse) {
                                        onPluginInstallComplete(upmResponse);
                                    });
                                } else {
                                    onPluginInstallComplete(installResponse);
                                }
                            });
                        } else {
                            // try to submit plugin again, with new token, exactly once -- one retry per user request
                            if (response.subCode == 'upm.error.invalid.token' && tryUploadOrInstallAgain) {
                                getAndStoreAntiXsrfToken(function() {
                                    // UPM-782 Executing a second stopProgress first
                                    // will override the progressPopup.stopFn and will end up not calling the stopFn
                                    // in the execCallbacksWithThreshold function, causing the throbber to display indefinitely
                                    stopProgress();
                                    tryUploadOrInstallAgain = false;
                                    installPluginFromUri(uri);
                                });
                            } else {
                                tryUploadOrInstallAgain = true;
                                stopProgress();
                                handleAjaxError(messageContainer, request, uri);
                            }
                        }
                    }
                });
            }
        }
    }

    /**
     * Handle the response from a plugin installation completing, and update messages and dialogs
     * @method onPluginInstallComplete
     * @param {Object} response Asynchronous request response object
     */
    function onPluginInstallComplete(response) {
        var restartState = response.restartState,
            refreshState = response.requiresRefresh;

        stopProgress();
        loadTab('manage', '', null);
        if (!refreshState) {
            loadUpgradeTab();
        }

        AJS.$('#upm-panel-manage').bind('panelLoaded', function() {
            var hash = createHash(response.key, 'manage'),
                plugin = AJS.$('#upm-plugin-' + hash);

            AJS.$('div.upm-plugin-row', plugin).trigger('click');
            if (restartState) {
                addChangeRequiringRestart({'action': restartState, 'name': response.name, 'key': response.key, 'links': {'self': response.links['change-requiring-restart']}});
            } else if (refreshState) {
                displayRefreshMessage();
                displayMessage(AJS.$('div.upm-details', plugin), AJS.params.upmTextInstallSuccess, 'install success');
            } else if (response.enabledByDefault && !response.enabled) {
                displayMessage(AJS.$('div.upm-details', plugin), AJS.params.upmTextInstallCannotBeEnabled, 'install error');
            } else if (response.unrecognisedModuleTypes) {
                displayMessage(AJS.$('div.upm-details', plugin), AJS.params.upmTextInstallUnrecognisedModuleTypes, 'install info');
            } else if (!response.enabledByDefault) {
                displayMessage(AJS.$('div.upm-details', plugin), AJS.params.upmTextInstallSuccessNotEnabled, 'install info');
            } else {
                displayMessage(AJS.$('div.upm-details', plugin), AJS.params.upmTextInstallSuccess, 'install success');
            }
            AJS.$('#upm-panel-manage').unbind('panelLoaded');
        });
        tryUploadOrInstallAgain = true;
        getAndStoreAntiXsrfToken(); // UPM-977 even in success, we need to get a new token for next time
    }

    /**
     * Initiates the uninstallation of a specified plugin
     * @method uninstallPlugin
     * @param {Event} e The event object
     */
    function uninstallPlugin(e) {
        var element = AJS.$(e.target),
                plugin = element.hasClass('upm-plugin') ? element : element.closest('div.upm-plugin'),
                hash = getPluginHash(plugin),
                header = AJS.$('div.upm-plugin-row', plugin),
                name = header.find('h4').text(),
                url = plugin.find('input.upm-plugin-link-delete').val(),
                details = AJS.$('div.upm-details', plugin),
                data;
        if (upmContainer.hasClass("upm-jira") && upmContainer.children('#upm-product-build-number').val() < 555) {
            // don't allow plugins to be uninstalled in JIRA before version 4.2, as it causes the system to lock on restart
            // 555 is the build number for JIRA 4.2-m6. we don't yet know the exact 4.2 build number but this should be ok
            showJiraUninstallDialog(e);
            return;
        }
        startProgress(AJS.format(AJS.params.upmTextProgressUninstall, name));
        if (!hasPendingTasks(stopProgress)) {
            data = pluginReps[hash];
            if (data) {
                data.enabled = false;
                AJS.$.ajax({
                    type: 'DELETE',
                    url: url,
                    dataType: 'json',
                    contentType: contentTypes['json'],
                    data: upm.json.stringify(data),
                    success: function(response) {
                        var restartState = response.restartState;
                        pluginReps[hash] = response;
                        stopProgress();
                        loadUpgradeTab();
                        if (restartState) {
                            addChangeRequiringRestart({'action': restartState, 'name': response.name, 'key': response.key, 'links': {'self': response.links['change-requiring-restart']}});
                            displayRestartMessage(details, restartState);
                        } else {
                            displayMessage(details, AJS.params.upmTextUninstallSuccess, 'uninstall info');
                        }
                        AJS.$('div.upm-plugin-modules', plugin).addClass('hidden');
                        AJS.$('button', plugin).attr('disabled', 'disabled');
                        plugin.addClass('disabled to-remove');
                        header.click(removeOnCollapse);
                    },
                    error: function(request) {
                        stopProgress();
                        handleAjaxError(details, request, '');
                    }
                });
            }
        }
    }

    /**
     * Disables a specified plugin
     * @method disablePlugin
     * @param {Event} e The event object
     */
    function disablePlugin(e) {
        var element = AJS.$(e.target),
                plugin = element.hasClass('upm-plugin') ? element : element.closest('div.upm-plugin'),
                hash = getPluginHash(plugin),
                name = AJS.$('div.upm-plugin-row h4', plugin).text(),
                url = plugin.find('input.upm-plugin-link-modify').val(),
                details = AJS.$('div.upm-details', plugin),
                data = pluginReps[hash];
        startProgress(AJS.format(AJS.params.upmTextProgressDisable, name));
        if (!hasPendingTasks(stopProgress)) {
            if (data) {
                data.enabled = false;
                AJS.$.ajax({
                    type: 'PUT',
                    url: url,
                    dataType: 'json',
                    contentType: contentTypes['plugin'],
                    data: upm.json.stringify(data),
                    success: function(response) {
                        pluginReps[hash] = response;
                        stopProgress();
                        plugin.addClass('disabled');
                        plugin.bind('pluginLoaded.disable', function() {
                            displayMessage(details, AJS.params.upmTextDisableSuccess, 'info');
                            plugin.unbind('pluginLoaded.disable');
                        });
                        refreshPlugin(plugin);
                    },
                    error: function(request) {
                        stopProgress();
                        handleAjaxError(details, request, name);
                    }
                });
            }
        }
    }

    /**
     * Enables a specified plugin
     * @method enablePlugin
     * @param {Event} e The event object
     */
    function enablePlugin(e) {
        var element = AJS.$(e.target),
                plugin = element.hasClass('upm-plugin') ? element : element.closest('div.upm-plugin'),
                hash = getPluginHash(plugin),
                name = AJS.$('div.upm-plugin-row h4', plugin).text(),
                url = plugin.find('input.upm-plugin-link-modify').val(),
                details = AJS.$('div.upm-details', plugin),
                data = pluginReps[hash];
        startProgress(AJS.format(AJS.params.upmTextProgressEnable, name));
        if (!hasPendingTasks(stopProgress)) {
            if (data) {
                data.enabled = true;
                AJS.$.ajax({
                    type: 'PUT',
                    url: url,
                    dataType: 'json',
                    contentType: contentTypes['plugin'],
                    data: upm.json.stringify(data),
                    success: function(response) {
                        pluginReps[hash] = response;
                        stopProgress();
                        plugin.removeClass('disabled');
                        plugin.bind('pluginLoaded.enable', function() {
                            displayMessage(details, AJS.params.upmTextEnableSuccess, 'success');
                            plugin.unbind('pluginLoaded.enable');
                        });
                        refreshPlugin(plugin);
                    },
                    error: function(request) {
                        stopProgress();
                        handleAjaxError(details, request, name);
                    }
                });
            }
        }
    }

    /**
     * Disables a specified plugin module
     * @method disableModule
     * @param {Event} e The event object
     */
    function disableModule(e) {
        var element = AJS.$(e.target),
                module = element.closest('div.upm-module'),
                plugin = module.closest('div.upm-plugin'),
                name = AJS.$('h5', module).text(),
                url = module.find('input.upm-module-link').val(),
                details = AJS.$('div.upm-details', plugin),
                upmModulesContainer = element.closest('div.upm-module-container'),
                upmPluginModules = element.closest('div.upm-plugin-modules'),
                data = {};
        startProgress(AJS.format(AJS.params.upmTextProgressDisable, name));
        if (!hasPendingTasks(stopProgress)) {
            data.name = name;
            data.description = AJS.$('p', module).text();
            data.links = {self: url};
            data.enabled = false;
            AJS.$.ajax({
                type: 'PUT',
                url: url,
                dataType: 'json',
                contentType: contentTypes['module'],
                data: upm.json.stringify(data),
                success: function(response) {
                    stopProgress();
                    module.addClass('upm-module-disabled');
                    totalModules = upmModulesContainer.children(".upm-module").length;
                    disabledModules = upmModulesContainer.children(".upm-module-disabled").length;
                    upmPluginModules.find('.upm-count-enabled').html(AJS.format(AJS.params.upmCountEnabled, totalModules - disabledModules, totalModules));
                    displayMessage(details, AJS.format(AJS.params.upmTextModuleDisableSuccess, htmlEncode(name)), 'info');
                },
                error: function(request) {
                    stopProgress();
                    handleAjaxError(details, request, name);
                }
            });
        }
    }

    /**
     * Enables a specified plugin module
     * @method enableModule
     * @param {Event} e The event object
     */
    function enableModule(e) {
        var element = AJS.$(e.target),
                module = element.closest('div.upm-module'),
                plugin = module.closest('div.upm-plugin'),
                name = AJS.$('h5', module).text(),
                url = module.find('input.upm-module-link').val(),
                details = AJS.$('div.upm-details', plugin),
                upmModulesContainer = element.closest('div.upm-module-container'),
                upmPluginModules = element.closest('div.upm-plugin-modules'),
                data = {};
        startProgress(AJS.format(AJS.params.upmTextProgressEnable, name));
        if (!hasPendingTasks(stopProgress)) {
            data.name = name;
            data.description = AJS.$('p', module).text();
            data.links = {self: url};
            data.enabled = true;
            AJS.$.ajax({
                type: 'PUT',
                url: url,
                dataType: 'json',
                contentType: contentTypes['module'],
                data: upm.json.stringify(data),
                success: function(response) {
                    stopProgress();
                    module.removeClass('upm-module-disabled');
                    totalModules = upmModulesContainer.children(".upm-module").length;
                    disabledModules = upmModulesContainer.children(".upm-module-disabled").length;
                    upmPluginModules.find('.upm-count-enabled').html(AJS.format(AJS.params.upmCountEnabled, totalModules - disabledModules, totalModules));
                    displayMessage(details, AJS.format(AJS.params.upmTextModuleEnableSuccess, htmlEncode(name)), 'success');
                },
                error: function(request) {
                    stopProgress();
                    handleAjaxError(details, request, name);
                }
            });
        }
    }

    /**
     * Removes the "Search" option from the Install tab dropdown and resets the search box
     * @method removeSearchOption
     */
    function removeSearchOption() {
        // remove search option from dropdown
        AJS.$('#upm-search-option').remove();
        // clear search term, if there is one
        AJS.$('#upm-install-search-box').val('').blur();
    }

    /**
     * Changes which plugins are displayed on the "Install" tab.  Fired when the dropdown in "Install" tab is changed
     * @method changeDisplayedPlugins
     * @param {Function} callbackFn (optional) Function to be run on success
     */
    function changeDisplayedPlugins(callbackFn) {
        var dropdown = AJS.$('#upm-install-type'),
                type = dropdown.val(),
                options = {isExpandable: true, isInstalledList: false, className: 'install'},
                container = AJS.$('#upm-install-' + type),
                parentContainer = AJS.$('#upm-install-container-' + type),
                searchTerm = AJS.$('#upm-install-search-box').val();
        // if callbackFn is actually an event object, set it to null
        if (callbackFn && callbackFn.target) {
            callbackFn = null;
        }
        if (type == 'search') {
            // handle case where dropdown is set to search option but there is no search term
            if (!searchTerm || searchTerm == AJS.params.upmTextInstallSearchBox) {
                removeSearchOption();
                // set the dropdown to the first visible option
                type = AJS.$('option:not(.hidden):first', dropdown).val();
                dropdown.val(type);
                container = AJS.$('#upm-install-' + type);
                parentContainer = AJS.$('#upm-install-container-' + type);
            } else {
                AJS.$('#upm-install-search-form').trigger('submit', [callbackFn]);
            }
        } else {
            removeSearchOption();
        }
        AJS.$('#upm-panel-install .upm-install-type').hide();
        parentContainer.show();
        if (resources[type]) {
            container.removeData('pagination').find('div.upm-plugin-list-container').remove();
            container.find('div.upm-development-product-version,div.upm-unknown-product-version').remove();
            AJS.$('p.upm-info', container).remove();
            loadPlugins(resources[type], options, container, parentContainer, callbackFn);
        }
    }

    /**
     * Enables safe mode on installed plugins, for support/debugging purposes
     * @method enableSafeMode
     */
    function enableSafeMode() {
        startProgress(AJS.params.upmTextProgressSafeModeEnable);
        if (!hasPendingTasks(stopProgress)) {
            AJS.$.ajax({
                type: 'PUT',
                url: resources['enter-safe-mode'],
                dataType: 'json',
                contentType: contentTypes['safe-mode'],
                data: upm.json.stringify({enabled: true, links : {} }),
                success: function(response) {
                    loadTab('manage', '', null);
                    stopProgress();
                    safeMode = true;
                    messageContainer.empty();
                    setSafeModeClass();
                    resources['exit-safe-mode-restore'] = resources['exit-safe-mode-restore'] || response.links['exit-safe-mode-restore'];
                    resources['exit-safe-mode-keep'] = resources['exit-safe-mode-keep'] || response.links['exit-safe-mode-keep'];
                },
                error: function(request) {
                    if (request.status == '409') {
                        // if 409 is returned, we're already in safe mode
                        refreshSafeModeState();
                    }
                    stopProgress();
                    handleAjaxError(messageContainer, request, '');
                }
            });
        }
    }

    /**
     * Exits safe mode and restores to the previous (saved) plugin configuration
     * @method restoreFromSafeMode
     */
    function restoreFromSafeMode() {
        startProgress(AJS.params.upmTextProgressSafeModeRestore);
        if (!hasPendingTasks(stopProgress)) {
            AJS.$.ajax({
                type: 'PUT',
                url: resources['exit-safe-mode-restore'],
                dataType: 'json',
                contentType: contentTypes['safe-mode'],
                data: upm.json.stringify({enabled: false, links : {} }),
                success: function(response) {
                    var hash = getLocationHash();
                    stopProgress();
                    displayMessage(messageContainer, AJS.params.upmTextSafeModeRestoreSuccess, 'safeMode success');
                    safeMode = false;
                    setSafeModeClass();
                    loadTab(hash.tab, hash.key, null);
                    resources['enter-safe-mode'] = resources['enter-safe-mode'] || response.links['enter-safe-mode'];
                },
                error: function(request) {
                    if (request.status == '409') {
                        // if 409 is returned, we're not in safe mode
                        refreshSafeModeState();
                    }
                    stopProgress();
                    handleAjaxError(messageContainer, request, '');
                }
            });
        }
    }

    /**
     * Exits safe mode, keeping the current plugin configuration
     * @method exitSafeMode
     */
    function exitSafeMode() {
        startProgress(AJS.params.upmTextProgressSafeModeKeepState);
        if (!hasPendingTasks(stopProgress)) {
            AJS.$.ajax({
                type: 'PUT',
                url: resources['exit-safe-mode-keep'],
                dataType: 'json',
                contentType: contentTypes['safe-mode'],
                data: upm.json.stringify({enabled: false, links : {} }),
                success: function(response) {
                    var hash = getLocationHash();
                    stopProgress();
                    displayMessage(messageContainer, AJS.params.upmTextSafeModeKeepStateSuccess, 'safeMode success');
                    safeMode = false;
                    setSafeModeClass();
                    loadTab(hash.tab, hash.key, null);
                    resources['enter-safe-mode'] = resources['enter-safe-mode'] || response.links['enter-safe-mode'];
                },
                error: function(request) {
                    if (request.status == '409') {
                        // if 409 is returned, we're not in safe mode
                        refreshSafeModeState();
                    }
                    stopProgress();
                    handleAjaxError(messageContainer, request, '');
                }
            });
        }
    }

    /**
     * Gets the current safe mode state and alters the UI accordingly
     * @method refreshSafeModeState
     */
    function refreshSafeModeState() {
        AJS.$.ajax({
            type: 'GET',
            cache: false,
            url: resources['safe-mode'],
            dataType: 'json',
            contentType: contentTypes['safe-mode'],
            success: function(response) {
                safeMode = response.enabled;
                setSafeModeClass();
                loadTab('manage', '', null);
                AJS.$.extend(resources, response.links);
            },
            error: function(request) {
                handleAjaxError(messageContainer, request, '');
            }
        });
    }

    /**
     * Checks the compatibility of installed plugins against a specified product version
     * @method checkCompatibility
     * @param {Event} e The event object
     */
    function checkCompatibility(e) {
        var container = AJS.$('#upm-compatibility-content'),
                recentProductMessage = AJS.$('#upm-recent-product-release-container'),
                compatiblePlugins = AJS.$('#upm-compatible-plugins'),
                needUpgradePlugins = AJS.$('#upm-need-upgrade-plugins'),
                incompatiblePlugins = AJS.$('#upm-incompatible-plugins'),
                productUpgradePlugins = AJS.$('#upm-need-product-upgrade-plugins'),
                unknownPlugins = AJS.$('#upm-unknown-plugins'),
                selected = AJS.$('#upm-compatibility-version option:selected'),
                url = selected.val(),
                options = {isExpandable: true, isInstalledList: true, className: 'compatibility'},
                upgradableOptions = {isExpandable: true, isInstalledList: true, className: 'compatibility', isUpgradable: true};

        e.preventDefault();
        if (url) {
            container.addClass('loading');
            recentProductMessage.toggleClass('hidden', !selected.hasClass('upm-recent'));
            compatiblePlugins.addClass('hidden');
            needUpgradePlugins.addClass('hidden');
            productUpgradePlugins.addClass('hidden');
            incompatiblePlugins.addClass('hidden');
            unknownPlugins.addClass('hidden');
            AJS.$('span.upm-product-version', container).text(selected.text());
            container.show();
            AJS.$.ajax({
                type: 'GET',
                cache: false,
                url: url,
                dataType: 'json',
                contentType: contentTypes['json'],
                success: function(response) {
                    var compatible = response['compatible'],
                            incompatible = response['incompatible'],
                            upgradeRequired = response['upgradeRequired'],
                            productUpgrade = response['upgradeRequiredAfterProductUpgrade'],
                            unknown = response['unknown'],
                            showCompatibilityResults = function(pluginsContainer, plugins, opts) {
                                pluginsContainer.find('div.upm-plugin-list-container').remove();
                                pluginsContainer.find('div.upm-expand-collapse-all').remove();
                                pluginsContainer.removeClass('hidden').append(buildPluginList(plugins, opts));
                            };
                    container.removeClass('loading');
                    if (compatible.length) {
                        showCompatibilityResults(compatiblePlugins, compatible, upgradableOptions);
                    }
                    if (incompatible.length) {
                        showCompatibilityResults(incompatiblePlugins, incompatible, options);
                    }
                    if (upgradeRequired.length) {
                        showCompatibilityResults(needUpgradePlugins, upgradeRequired, upgradableOptions);
                    }
                    if (productUpgrade.length) {
                        showCompatibilityResults(productUpgradePlugins, productUpgrade, options);
                    }
                    if (unknown.length) {
                        showCompatibilityResults(unknownPlugins, unknown, options);
                    }
                    if (compatible.length == 0 && unknown.length == 0 && productUpgrade.length == 0 && upgradeRequired.length == 0 && incompatible.length == 0) {
                        AJS.$('#upm-no-userinstalled').removeClass('hidden');
                    }
                },
                error: function(request) {
                    AJS.$('div.loading', container).removeClass('loading');
                    container.hide();
                    handleAjaxError(messageContainer, request, '');
                }
            });
        }
    }

    function filterPluginsByName(e) {
        filterPlugins(e, function(plugin) {
            var target = AJS.$(e.target),
                    regexp = new RegExp(target.val(), 'i');
            return regexp.test(AJS.$('.upm-plugin-name', plugin).text());
        });
    }

    function filterBundles(e) {
        var form = AJS.$(e.target),
                input = form.find('input'),
                term = input.val();
        if (term && term != AJS.params.upmTextOsgiSearchBox) {
            AJS.$.ajax({
                url: resources['osgi-bundles'] + '?q=' + term,
                type: 'get',
                cache: false,
                dataType: 'json',
                success: function(response) {
                    var bundles = {};
                    AJS.$.each(response.entries, function() {
                        bundles['upm-plugin-' + createHash(this.symbolicName, 'osgi')] = true;
                    });
                    filterPlugins(e, function(plugin) {
                        return bundles[plugin.id];
                    });
                },
                error: function(request) {
                    displayErrorMessage(messageContainer, request.responseText, "");
                }
            });
        }
        e.preventDefault();
    }

    /**
     * Filters the associated list(s) of plugins to match the entered text
     * @method filterPlugins
     * @param {Event} e The event object
     * @param {Function} matchFn The function to determine whether a plugin matches
     */
    function filterPlugins(e, matchFn) {
        var target = AJS.$(e.target);

        if (e.type == 'propertychange' && target.val() == AJS.params.upmTextFilterPlugins) {
            // don't do anything if onpropertychange (IE only) was triggered and the text is the default text
            return;
        }

        // only recalculate the relevant plugins if we need to
        if (!filterPlugins.container || !filterPlugins.container.is(':visible')) {
            filterPlugins.container = target.closest('div.upm-panel');
            filterPlugins.plugins = [];
            AJS.$('div.upm-plugin-list-container', filterPlugins.container).each(function() {
                filterPlugins.plugins[AJS.$(this).parent().attr('id')] = AJS.$('div.upm-plugin', this);
            });
        }

        AJS.$('div.upm-plugin-list-container', filterPlugins.container).each(function() {
            var plugins = filterPlugins.plugins[AJS.$(this).parent().attr('id')],
                    hasMatchedPlugin = false;
            plugins.addClass('hidden');
            plugins.filter(function() {
                var matched = matchFn(this);
                hasMatchedPlugin = hasMatchedPlugin || matched;
                return matched;
            }).removeClass('hidden');

            AJS.$('p.filter-info', this).remove();
            if (hasMatchedPlugin) {
                AJS.$('div.upm-expand-collapse-all', this).removeClass('hidden');
            } else {
                AJS.$('div.upm-expand-collapse-all', this).addClass('hidden');
                AJS.$('div.upm-plugin-list', this).append(AJS.$('<p class="upm-info filter-info"></p>').text(AJS.params.upmTextFilterNoPlugins));
            }
        });
    }

    function clearInstallSearch(e) {
        AJS.$('#upm-install-search-box').val('').blur();
        changeDisplayedPlugins(e);
    }

    function clearBundleSearch(e) {
        AJS.$('#upm-osgi-search-box').val('').blur();
        filterPluginsByName(e);
    }

    /**
     * Searches PAC for plugins that match the entered text
     * @method searchForPlugins
     * @param {Event} e The event object
     * @param {Function} callbackFn (optional) Function to be run after search request has returned
     */
    function searchForPlugins(e, callbackFn) {
        var form = AJS.$(e.target),
                input = form.find('input'),
                term = input.val(),
                options = {isExpandable: true, isInstalledList: false, className: 'install'},
                container = AJS.$('#upm-install-search'),
                parentContainer = AJS.$('#upm-install-container-search'),
                dropdown = AJS.$('#upm-install-type');
        if (term && term != AJS.params.upmTextInstallSearchBox) {
            AJS.$('#upm-panel-install .upm-install-type').hide();
            container
                    .empty()
                    .removeData('pagination')
                    .append(AJS.$('<h3></h3>').text(AJS.format(AJS.params.upmTextSearchResults, term)));
            parentContainer.show();
            // set drop down to search option so that the other options can be selected
            if (dropdown.val() != 'search') {
                AJS.$('<option value="search" id="upm-search-option"></option>').text(AJS.params['upmTextSearchOption']).prependTo(dropdown);
            }
            dropdown.val('search');
            loadPlugins(resources['available'] + '?' +  form.serialize(), options, container, parentContainer, callbackFn);
        }
        e.preventDefault();
    }

    /**
     * Returns the unique hash for a plugin given the dom element corresponding to that plugin
     * @method getPluginHash
     * @param {HTMLElement} plugin The dom element for the plugin in question
     * @return {String} The hash corresponding to the plugin
     */
    function getPluginHash(plugin) {
        var hash = plugin.attr('id');
        return hash.substring('upm-plugin-'.length, hash.length);
    }

    /**
     * Returns the link to the plugin details given the dom element corresponding to that plugin and if plugin type
     * is upgradable
     * @method getPluginLink
     * @param {HTMLElement} plugin The dom element for the plugin in question
     * @param {Boolean} isUpgradable Set to true if plugin will use "available" plugin details link if it exist
     * @return {String} link to the plugin details
     */
    function getPluginLink(plugin, isUpgradable) {
        if (isUpgradable) {
            return plugin.links.available || plugin.links.self;
        } else {
            return plugin.links.self;
        }
    }

    /**
     * Send an Ajax request to get the "details" link from PAC, and puts it instead of the <span> represented by detailsLinkSpan.
     * The method returns immediately after the ajax request is sent.
     * @param detailsLinkSpan a dom element that we would like to add the plugin details link to
     * @param plugin the plugin, with its .key and .version properties
     */
    function fetchPacPluginDetailsLink(detailsLinkSpan, plugin) {
        AJS.$.ajax({
            url: plugin.links['details-link'],
            type: 'get',
            dataType: 'json',
            success: function(response) {
                if (response && response.link) {
                    detailsLinkSpan.removeAttr("title")
                                   .html(AJS.$('<a target="_blank"></a>').attr("href", response.link).text(detailsLinkSpan.text()));
                } else {
                    detailsLinkSpan.attr("title", AJS.params['upm.plugin.action.details.notfound']);
                }
            },
            error: function(request) {
                detailsLinkSpan.attr("title", AJS.params['upm.plugin.action.details.notfound']);
            }
        });
    }

    /**
     * Escapes '.' and '#' characters for use in jQuery selectors
     * @method escapeSelector
     * @param {String} key A plugin key
     * @return {String} The escaped text
     */
    function escapeSelector(key) {
        return key ? key.replace(/\./g, '\\.').replace(/#/, '\\#') : key;
    }

    /**
     * A transform to apply to url attribute values.
     * @method htmlSanitizerUrlPolicy
     * @param url {String} URL to validate
     * @return {String} the url, if it passed the policy check, null otherwise
     */
    function htmlSanitizerUrlPolicy(url) {
        if (/^https?:\/\//.test(url)) {
            return url;
        }
        return null;
    }

    /*
     * Takes a timestamp and returns localize string representation
     * @method prettyDate
     * @param {String|Number} time A timestamp
     * @return {String} A localized representation of the timestamp
     */
    function prettyDate(time){
        var date,
            exp = /([0-9])T([0-9])/;
        if (typeof time == 'string') {
            if ((time).match(exp)) {
                // ISO time.  We need to do some formatting to be able to parse it into a date object
                time = time
                    // for the Date ctor to use UTC time
                    .replace(/Z$/, " -00:00")
                    // remove 'T' separator
                    .replace(exp,"$1 $2");
            }
            // more formatting to make it parseable
            time = time
                // replace dash-separated dates with forward-slash separated
                .replace(/([0-9]{4})-([0-9]{2})-([0-9]{2})/g,"$1/$2/$3")
                // get rid of semicolon and add space in front of timezone offset (for Safari, Chrome, IE6)
                .replace(/\s?([-\+][0-9]{2}):([0-9]{2})/, ' $1$2');
        }
        date = new Date(time || "");
        return date.toLocaleString();
    }

    /**
     * Creates and returns a plugin list element with text stating no matching plugins were found
     * @method buildEmptyPluginList
     * @return {HTMLElement} Element representing empty plugin list
     */
    function buildEmptyUserInstalledPluginListForManaging() {
        return AJS.$('<p class="upm-info"></p>').text(AJS.params.upmTextNotFoundManageUserInstalled);
    }

    /**
     * Creates and returns a plugin list element with text stating no matching plugins were found
     * that the user can install
     * @method buildEmptyPluginList
     * @return {HTMLElement} Element representing empty plugin list
     */
    function buildEmptyPluginListForInstalling() {
        return AJS.$('<p class="upm-info"></p>').text(AJS.params.upmTextNotFoundInstall);
    }

    /**
     * Creates and returns a list of plugins for insertion into the dom
     * @method buildPluginList
     * @param {Array} plugins An array of plugin objects
     * @param {Object} options Whether individual plugins should be expandable to reveal plugin details
     * @return {HTMLElement} Element representing plugin list
     */
    function buildPluginList(plugins, options) {
        buildPluginList.template = buildPluginList.template || AJS.$(AJS.$('#upm-plugin-list-template').html());
        var listContainer = buildPluginList.template.clone(),
                list = AJS.$('.upm-plugin-list', listContainer);
        if (plugins && plugins.length) {
            if (options.isExpandable) {
                list.addClass('expandable');
            }
            if (options.isInstalledList) {
                list.addClass('upm-installed-list');
            }
            if (options.className) {
                list.addClass(options.className);
            }
            buildPluginElements(plugins, list, options);
        } else {
            if (options.className == "manage" && options.isUserPluginList) {
                listContainer = buildEmptyUserInstalledPluginListForManaging();
            } else {
                listContainer = buildEmptyPluginListForInstalling();
            }
        }
        return listContainer;
    }

    /**
     * Appends a group of plugin elements to a specified container
     * @method buildPluginElements
     * @param {Array} plugins An array of plugin objects
     * @param {HTMLElement} container Dom element to append to
     * @param {Object} options Plugin options
     */
    function buildPluginElements(plugins, container, options) {
        var type = getPluginTypeFromContainer(container);
        buildPluginElements.template = buildPluginElements.template || AJS.$(AJS.$('#upm-plugin-template').html());
        for (var i = 0, len = plugins.length; i < len; i++) {
            var plugin = plugins[i],
                    pluginElement = buildPluginElements.template.clone(),
                    hash = createHash(options.isBundle ? plugin.symbolicName : plugin.key, type);
            pluginElement.attr('id', 'upm-plugin-' + hash);
            if (options.isBundle) {
                pluginElement.find('.upm-plugin-name').text(plugin.id + " - " + (plugin.name || plugin.symbolicName));
            } else {
                pluginElement.find('.upm-plugin-name').text(plugin.name);
            }

            if (plugin.summary || plugin.description) {
                pluginElement.find('p.upm-plugin-summary')
                        .html(upm.html_sanitize(plugin.summary || plugin.description, htmlSanitizerUrlPolicy))
                        .find('a').each(function() {
                            var el = AJS.$(this);
                            el.replaceWith(el.text());
                        });
            }
            pluginElement.find('input.upm-plugin-link-self').attr('id', 'upm-plugin-link-self-' + hash).val(getPluginLink(plugin, options.isUpgradable));
            pluginElement.find('input.upm-plugin-link-modify').attr('id', 'upm-plugin-link-modify-' + hash).val(plugin.links['modify']);
            pluginElement.find('input.upm-plugin-link-delete').attr('id', 'upm-plugin-link-delete-' + hash).val(plugin.links['delete']);
            // 'enabled' property isn't returned in all representations
            if (plugin.enabled === false) {
                pluginElement.addClass('disabled');
            }
            if (plugin.userInstalled) {
                pluginElement.addClass('user-installed');
            } else {
                pluginElement.addClass('upm-system');
            }
            if (plugin.restartState) {
                displayRestartMessage(pluginElement, plugin.restartState);
            }
            if (plugin['static']) {
                pluginElement.addClass('upm-static');
            }
            if (options.isBundle && plugin.state) {
                if (plugin.state != 'ACTIVE') {
                    pluginElement.addClass('disabled');
                }
            }
            container.append(pluginElement);
        }
    }

    /**
     * Refreshes the details for a specified plugin
     * @method refreshPlugin
     * @param {HTMLElement} plugin The dom element of the plugin in question
     */
    function refreshPlugin(plugin) {
        var details = AJS.$('div.upm-details', plugin);
        if (AJS.$('div.upm-plugin-modules', details).hasClass('expanded')) {
            plugin.bind('pluginLoaded.refresh', function() {
                AJS.$('div.upm-plugin-modules', details).addClass('expanded');
                plugin.unbind('pluginLoaded.refresh');
            });
        }
        details.empty().removeClass('loaded').addClass('loading');
        buildPluginDetails(getPluginHash(plugin), details);
    }

    /**
     * Returns the tab type for a plugin based on its container
     * @method getPluginTypeFromContainer
     * @param {HTMLElement} container The dom element for the plugin list containing the plugin in question
     * @return {String} Tab type (one of 'upgrade', 'install', 'osgi', 'compatibility')
     */
    function getPluginTypeFromContainer(container) {
        return container.hasClass('upgrade') ? 'upgrade' :
               container.hasClass('install') ? 'install' :
               container.hasClass('osgi') ? 'osgi' :
               container.hasClass('compatibility') ? 'compatibility' : 'manage';
    }

    /**
     * Creates and returns a plugin details element for insertion into the dom
     * @method buildPluginDetails
     * @param {String} pluginHash Unique hash of the plugin in question
     * @param {HTMLElement} container Plugin details container element
     */
    function buildPluginDetails(pluginHash, container) {
        var list = container.closest('div.upm-plugin-list'),
                pluginType = getPluginTypeFromContainer(list);
        container.addClass('loading');
        AJS.$.ajax({
            type: 'get',
            cache: false,
            url: AJS.$('#upm-plugin-link-self-' + escapeSelector(pluginHash)).val(),
            dataType: 'json',
            error: function(response) {
                var subcode,
                        status,
                        msg;
                try {
                    if (response.responseText) {
                        response = upm.json.parse(response.responseText);
                        msg = AJS.params.upmTextPluginDetailsError;
                        status = response["status-code"] || response.status;
                        subcode = response.subCode || (response.status && response.status.subCode) || (response.details && response.details.error.subCode);
                        // We should reload if it was a webSudo error
                        if (reloadIfUnauthorizedStatus(status)) {
                            msg = AJS.params['upm.error.unauthorized'];
                        } else {
                            reloadIfWebSudoError(subcode);
                        }
                    }
                } catch (e) {
                    AJS.log('Error trying to parse response text: ' + e);
                }
                container
                        .removeClass('loading')
                        .addClass('loaded error')
                        .append(AJS.$('<div></div>').text(msg));
                container.trigger('pluginLoaded');
            },
            success: function(plugin) {
                var details = detailsFn[pluginType](plugin),
                        modules = plugin.modules;
                pluginReps[pluginHash] = plugin;
                container
                        .removeClass('loading')
                        .addClass('loaded')
                        .append(details);
                container.trigger('pluginLoaded');

                // Disable upgrade button for this plugin in safe mode
                if (safeMode) {
                    container.find('button.upm-upgrade').attr('disabled', 'disabled');
                }
                if (modules) {
                    buildPluginModules(modules, container);
                }
            }
        });
    }

    /**
     * Creates an element containing a series of plugin module elements and inserts it into the dom
     * @method buildPluginModules
     * @param {Array} modules An array of plugin module objects
     * @param {HTMLElement} container Plugin details container element
     */
    function buildPluginModules(modules, container) {
        buildPluginModules.template = buildPluginModules.template || AJS.$(AJS.$('#upm-plugin-module-template').html());
        var pluginKey = AJS.$('dd.upm-plugin-key', container).text(),
                modulePresent   = AJS.$('.upm-module-present', container),
                moduleNone      = AJS.$('.upm-module-none', container),
                moduleContainer = AJS.$('div.upm-module-container', container),
                clone,
                modulesEnabled = 0;

        if (modules && modules.length) {
            clone = moduleContainer.clone();
            moduleContainer.addClass('loading');
            for (var i = 0, len = modules.length; i < len; i++) {
                var module = modules[i],
                        el = buildPluginModules.template.clone();
                el.attr("id", "upm-plugin-module-" + createHash(module.key));
                if (module.name) {
                    AJS.$('h5', el).text(module.name);
                    AJS.$('p.upm-module-key', el).text("(" + module.key + ")");
                } else {
                    AJS.$('h5', el).text(module.key);
                }
                if (module.description) {
                    AJS.$('p.upm-module-description', el).text(module.description);
                } else {
                    AJS.$('p.upm-module-description', el).remove();
                }
                
                if (module.links.self && module.recognisableType) {
                    AJS.$('input.upm-module-link', el).val(module.links.self);
                    AJS.$('button.upm-module-disable', el).attr('id', 'module-disable-' + module.completeKey);
                    AJS.$('button.upm-module-enable', el).attr('id', 'module-enable-' + module.completeKey);
                } else {
                    AJS.$('div.upm-module-actions', el).addClass('upm-module-cannot-disable');
                }
                if (!module.enabled) {
                    el.addClass('upm-module-disabled');
                } else {
                    modulesEnabled++;
                }
                clone.append(el);
                if (!module.optional) {
                    AJS.$('div.upm-module-actions', el).addClass("upm-module-cannot-disable");
                }
            }
            moduleContainer.replaceWith(clone);
            AJS.$('span.upm-count-enabled', container).html(AJS.format(AJS.params.upmCountEnabled, modulesEnabled , modules.length));
            modulePresent.removeClass('hidden');

            if (isUpm(pluginKey)) {
                AJS.$('div.upm-module-actions', container).addClass("hidden");
            }
        } else {
            moduleNone.removeClass('hidden');
        }
    }

    /**
     * Creates and returns an html element with plugin details for the "Upgrade" tab
     * @method buildUpgradeDetails
     * @param {Object} plugin Object containing the plugin detail information
     * @return {HTMLElement} Plugin details element
     */
    function buildUpgradeDetails(plugin) {
        buildUpgradeDetails.template = buildUpgradeDetails.template || AJS.$(AJS.$('#upm-plugin-details-upgrade').html());
        var details = buildUpgradeDetails.template.clone(),
                releaseNotesLink = AJS.$('a.upm-release-notes-link', details);
        AJS.$('dd.upm-plugin-key', details).text(plugin.key || AJS.params.upmTextUnknown);
        AJS.$('dd.upm-plugin-developer', details).text((plugin.vendor && plugin.vendor.name) || AJS.params.upmTextUnknown);
        AJS.$('dd.upm-plugin-version', details).text(plugin.version || AJS.params.upmTextUnknown);
        AJS.$('dd.upm-plugin-installed-version', details).text(plugin.installedVersion || AJS.params.upmTextUnknown);
        AJS.$('dd.upm-plugin-system-version', details).text(plugin.pluginSystemVersion || AJS.params.upmTextUnknown);
        AJS.$('dd.upm-plugin-license', details).text(plugin.license || AJS.params.upmTextUnknown);
        AJS.$('a.upm-details-link', details).attr('href', plugin.links.details);
        AJS.$('button.upm-upgrade', details).attr('id', 'upm-upgrade-' + plugin.key);

        if (plugin.releaseNotesUrl) {
            releaseNotesLink.attr('href', plugin.releaseNotesUrl);
        } else {
            releaseNotesLink.prev("span.pipe").remove();
            releaseNotesLink.remove();
        }

        if (plugin.links.binary) {
            AJS.$('input.upm-plugin-binary', details).val(plugin.links.binary);
        } else if (plugin.deployable) {
            AJS.$("button.upm-upgrade", details).addClass("hidden").prev("span.pipe").addClass("hidden");
        }
        AJS.$('input.upm-plugin-homepage', details).val(plugin.links.details);

        if (shouldShowDownloadButton(plugin)) {
            AJS.$("button.upm-upgrade", details).remove();
            AJS.$("button.upm-download", details).removeClass("hidden");
        }
        return details;
    }

    /**
     * Determines whether or not the download button should be shown. If not, the install button
     * will be shown
     * @method shouldShowDownloadButton
     * @param {Object} plugin Object containing the plugin information
     * @return {Boolean} Whether the download button should be shown or not
     */
    function shouldShowDownloadButton(plugin) {
        return !plugin.deployable ||
               (plugin.pluginSystemVersion != "TWO" && !upmContainer.hasClass("upm-confluence"));
    }

    /**
     * Determines the appropriate size for the given icon and replaces the placeholder with the icon at that size
     * @method scaleAndReplaceIcon
     * @param {HTMLElement} element Placeholder icon element
     * @param {Object} icon Object containing the icon information
     */
    function scaleAndReplaceIcon(element, icon) {
        var scaleFactor = 1,
                width = icon.width,
                height = icon.height,
                link = icon.link,
                clone = element.clone();

        if (width > maxIconWidth) {
            scaleFactor = maxIconWidth / width ;
        }

        if (height > maxIconHeight) {
            var tmp = maxIconHeight / height;
            scaleFactor = (tmp < scaleFactor) ? tmp : scaleFactor;
        }

        height = height * scaleFactor;
        width = width * scaleFactor;
        // we have to clone the icon and replace it, otherwise the default icon is briefly scaled to the size of the actual icon
        clone.attr('src', link).attr('width', width).attr('height', height);
        element.replaceWith(clone);
    }

    /**
     * Creates and returns an html element with plugin details for the "Install" tab
     * @method buildInstallDetails
     * @param {Object} plugin Object containing the plugin detail information
     * @return {HTMLElement} Plugin details eleemnt
     */
    function buildInstallDetails(plugin) {
        buildInstallDetails.template = buildInstallDetails.template || AJS.$(AJS.$('#upm-plugin-details-install').html());
        var details = buildInstallDetails.template.clone(),
            releaseNotesLink = AJS.$('a.upm-release-notes-link', details),
            showDownloadButton = shouldShowDownloadButton(plugin);
        AJS.$('dd.upm-plugin-key', details).text(plugin.key || AJS.params.upmTextUnknown);
        AJS.$('dd.upm-plugin-developer', details).text((plugin.vendor && plugin.vendor.name) || AJS.params.upmTextUnknown);
        AJS.$('dd.upm-plugin-version', details).text(plugin.version || AJS.params.upmTextUnknown);
        AJS.$('dd.upm-plugin-system-version', details).text(plugin.pluginSystemVersion || AJS.params.upmTextUnknown);
        AJS.$('dd.upm-plugin-license', details).text(plugin.license || AJS.params.upmTextUnknown);
        AJS.$('div.upm-plugin-description', details)
            .html(upm.html_sanitize(plugin.description || AJS.params['upm.plugin.no.description'], htmlSanitizerUrlPolicy))
            .find('a').attr("target", "_blank");
        if (!plugin.description) {
            AJS.$('div.upm-plugin-description', details).addClass("upm-no-description-text");
        }
        AJS.$('a.upm-details-link', details).attr('href', plugin.links.details);
        AJS.$("button.upm-install", details).attr('id', 'upm-install-' + plugin.key);

        if (plugin.releaseNotesUrl) {
            releaseNotesLink.attr('href', plugin.releaseNotesUrl);
        } else {
            releaseNotesLink.prev("span.pipe").remove();
            releaseNotesLink.remove();
        }

        if (plugin.links.binary) {
            AJS.$('input.upm-plugin-binary', details).val(plugin.links.binary);
        } else if (!showDownloadButton) {
            AJS.$("button.upm-install", details).addClass("hidden").prev("span.pipe").addClass("hidden");
        }

        AJS.$('input.upm-plugin-homepage', details).val(plugin.links.details);

        if (plugin.icon) {
            scaleAndReplaceIcon(AJS.$('img.upm-plugin-image', details), plugin.icon);
        }
        if (showDownloadButton) {
            AJS.$("button.upm-install", details).addClass("hidden");
            AJS.$("button.upm-download", details).removeClass("hidden");
        }
        return details;
    }

    function buildOsgiBundleDetails(bundle) {
        buildOsgiBundleDetails.template = buildOsgiBundleDetails.template || AJS.$(AJS.$('#upm-osgi-bundle-details').html());
        var bundleNode = buildOsgiBundleDetails.template.clone(),
                metadataNode = AJS.$('dl.upm-osgi-bundle-metadata', bundleNode),
                unparsedHeadersNode = AJS.$('dl.upm-osgi-bundle-unparsed-headers', bundleNode),
                parsedHeadersNode = AJS.$('div.upm-osgi-bundle-parsed-headers', bundleNode),
                servicesRegisteredNode = AJS.$('div.upm-osgi-services-registered', bundleNode),
                servicesInUseNode = AJS.$('div.upm-osgi-services-in-use', bundleNode);
        metadataNode.append(AJS.$('<dt/>').text(AJS.params.upmTextOsgiBundleLocation));
        metadataNode.append(AJS.$('<dd/>').text(bundle.location || AJS.params.upmTextUnknown));
        AJS.$.each(bundle.unparsedHeaders, function(key, value) {
            unparsedHeadersNode.append(AJS.$('<dt/>').text(key));
            unparsedHeadersNode.append(AJS.$('<dd/>').text(value));
        });
        AJS.$.each(bundle.parsedHeaders, function(key, value) {
            parsedHeadersNode.append(buildOsgiParsedHeader(key, value));
        });
        buildOsgiServices(bundle.registeredServices, servicesRegisteredNode, crossReferenceServiceRegistered);
        buildOsgiServices(bundle.servicesInUse, servicesInUseNode, crossReferenceServiceInUse);
        return bundleNode;
    }

    function buildOsgiParsedHeader(name, clauses) {
        buildOsgiParsedHeader.template = buildOsgiParsedHeader.template || AJS.$(AJS.$('#upm-osgi-parsed-header').html());
        var headerNode = buildOsgiParsedHeader.template.clone(),
                nameNode = AJS.$('span.upm-osgi-parsed-header-name', headerNode),
                countNode = AJS.$('span.upm-count-osgi-parsed-header-entries', headerNode),
                clausesNode = AJS.$('div.upm-module-container', headerNode);
        nameNode.text(name);
        countEntries(clauses, countNode);
        AJS.$.each(clauses, function() {
            clausesNode.append(buildOsgiParsedHeaderClause(name, this));
        });
        return headerNode;
    }

    function buildOsgiParsedHeaderClause(name, clause) {
        buildOsgiParsedHeaderClause.template = buildOsgiParsedHeaderClause.template || AJS.$(AJS.$('#upm-plugin-module-template').html());
        var clauseNode = buildOsgiParsedHeaderClause.template.clone(),
                pathNode = AJS.$('h5.upm-module-name', clauseNode),
                parametersNode = AJS.$('p.upm-module-key', clauseNode),
                parameters = [],
                crossReferenceFn = osgiXrefFn[name];
        pathNode.text(clause.path);
        AJS.$.each(clause.parameters, function(key, value) {
            if (value.length > 64) {
                value = '[...]';
            }
            parameters.push(key + ': ' + value);
        });
        parametersNode.text(parameters.join(', '));
        crossReferenceFn && crossReferenceFn(clause, clauseNode);
        return clauseNode;
    }

    function crossReferenceOsgiImportPackageHeaderClause(clause, clauseNode) {
        if (clause.referencedPackage) {
            var descriptionNode = AJS.$('p.upm-module-description', clauseNode);
                    crossReference = buildOsgiBundleLink(clause.referencedPackage.exportingBundle);
            descriptionNode.html(AJS.format(AJS.params.upmOsgiProvidedBy, crossReference));
            clauseNode.addClass('upm-osgi-header-clause-resolved');
        } else {
            clauseNode.addClass(clause.parameters['resolution'] == 'optional' ? 'upm-osgi-header-clause-optional' : 'upm-osgi-header-clause-unresolved');
        }
    }

    function crossReferenceOsgiExportPackageHeaderClause(clause, clauseNode) {
        if (clause.referencedPackage) {
            var descriptionNode = AJS.$('p.upm-module-description', clauseNode),
                    crossReferences = [];
            AJS.$.each(clause.referencedPackage.importingBundles, function() {
                crossReferences.push(buildOsgiBundleLink(this));
            });
            if (crossReferences.length != 0) {
                descriptionNode.html(AJS.format(AJS.params.upmOsgiUsedBy, crossReferences.join(', ')));
                clauseNode.addClass('upm-osgi-header-clause-resolved');
            } else {
                clauseNode.addClass('upm-osgi-header-clause-optional');
            }
        } else {
            clauseNode.addClass('upm-osgi-header-clause-unresolved');
        }
    }

    function buildOsgiServices(services, container, crossReferenceFn) {
        var countNode = AJS.$('span.upm-count-osgi-services', container),
                servicesNode = AJS.$('div.upm-module-container', container);
        countEntries(services, countNode);
        if (services.length == 0) {
            container.addClass('hidden');
        }
        AJS.$.each(services, function() {
            servicesNode.append(buildOsgiService(this, crossReferenceFn));
        });
    }

    function buildOsgiService(service, crossReferenceFn) {
        buildOsgiService.template = buildOsgiService.template || AJS.$(AJS.$('#upm-plugin-module-template').html());
        var serviceNode = buildOsgiService.template.clone(),
                idNode = AJS.$('h5.upm-module-name', serviceNode),
                propertiesNode = AJS.$('p.upm-module-key', serviceNode);
        idNode.text(AJS.format(AJS.params.upmOsgiService, service.id));
        propertiesNode.text(service.objectClasses.join(', '));
        crossReferenceFn && crossReferenceFn(service, serviceNode);
        return serviceNode;
    }

    function crossReferenceServiceRegistered(service, serviceNode) {
        var descriptionNode = AJS.$('p.upm-module-description', serviceNode),
                usingBundles = service.usingBundles,
                crossReferences = [];
        AJS.$.each(usingBundles, function() {
            crossReferences.push(buildOsgiBundleLink(this));
        });
        if (crossReferences.length != 0) {
            descriptionNode.html(AJS.format(AJS.params.upmOsgiUsedBy, crossReferences.join(', ')));
        }
    }

    function crossReferenceServiceInUse(service, serviceNode) {
        var descriptionNode = AJS.$('p.upm-module-description', serviceNode),
                bundle = service.bundle,
                crossReference = buildOsgiBundleLink(bundle);
        descriptionNode.html(AJS.format(AJS.params.upmOsgiProvidedBy, crossReference));
    }

    function countEntries(entries, countNode) {
        countNode.text(AJS.format(
             entries.length == 1 ?
                 AJS.params.upmOsgiCountEntry :
                 AJS.params.upmOsgiCountEntries,
             entries.length));
     }

    function buildOsgiBundleLink(bundle) {
        buildOsgiBundleLink.template = buildOsgiBundleLink.template || AJS.$(AJS.$('#upm-osgi-bundle-xref-template').html());
        var containerNode = buildOsgiBundleLink.template.clone(),
                linkNode = AJS.$('a.upm-osgi-bundle-xref', containerNode),
                inputNode = AJS.$('input', containerNode);
        linkNode.text(bundle.name || bundle.symbolicName);
        inputNode.attr('value', bundle.symbolicName);
        return containerNode.html();
    }

    /**
     * Creates and returns an html element with plugin details for the "Manage" tab
     * @method buildManageDetails
     * @param {Object} plugin Object containing the plugin detail information
     * @return {HTMLElement} Plugin details element
     */
    function buildManageDetails(plugin) {
        buildManageDetails.template = buildManageDetails.template || AJS.$(AJS.$('#upm-plugin-details-manage').html());
        var details = buildManageDetails.template.clone(),
                pluginIsUpm = isUpm(plugin.key),
                detailsPipe;

        fetchPacPluginDetailsLink(AJS.$('span.upm-details-link', details), plugin);

        if (plugin.configureUrl) {
            AJS.$('a.upm-configure-link', details).attr('href', '../..' + plugin.configureUrl);
        } else {
            AJS.$('span.upm-configure-link-off', details).remove();
            // we have to be careful with the pipe elements so that the css can hide them properly when needed
            detailsPipe = AJS.$('span.upm-details-pipe', details);
            if (detailsPipe.length) {
                detailsPipe.remove();
            } else {
                detailsPipe.addClass('upm-button-pipe');
                AJS.$('span.upm-configure-pipe', details).remove();
            }
            AJS.$('a.upm-configure-link', details).remove();
        }

        if (!plugin.enabled) {
            AJS.$('button.upm-disable', details).attr('id', 'upm-enable-' + plugin.key);
        } else {
            AJS.$('button.upm-disable', details).attr('id', 'upm-disable-' + plugin.key);
        }
        
        if (pluginIsUpm || !plugin.links['modify'] || !plugin.optional) {
            AJS.$("button.upm-disable", details).addClass("hidden").prev("span.pipe").remove();
        } else if (!plugin.enabled) {
            AJS.$('button.upm-disable', details).removeClass('upm-disable').addClass('upm-enable').text(AJS.params.upmTextEnable);
        }

        AJS.$('button.upm-uninstall', details).attr('id', 'upm-uninstall-' + plugin.key);
        if (!plugin.userInstalled || pluginIsUpm || !plugin.links['delete']) {
            AJS.$('button.upm-uninstall', details).remove();
        }
        
        if (plugin.restartState) {
            displayRestartMessage(details, plugin.restartState);
        }

        AJS.$('dd.upm-plugin-key', details).text(plugin.key || AJS.params.upmTextUnknown);
        AJS.$('dd.upm-plugin-developer', details).text((plugin.vendor && plugin.vendor.name) || AJS.params.upmTextUnknown);
        AJS.$('dd.upm-plugin-version', details).text(plugin.version || AJS.params.upmTextUnknown);

        return details;
    }

    /**
     * Returns true if this plugin key represents UPM, false if not.
     * @param {String} pluginKey the plugin key
     * @return {Boolean} true if this plugin represents UPM, false if not.
     */
    function isUpm(pluginKey) {
        return pluginKey == 'com.atlassian.upm.atlassian-universal-plugin-manager-plugin';
    }

    /**
     * Creates and returns an html element with plugin details for the "Compatibility check" tab
     * @method buildCompatibilityDetails
     * @param {Object} plugin Object containing the plugin detail information
     * @return {HTMLElement} Plugin details element
     */
    function buildCompatibilityDetails(plugin) {
        buildCompatibilityDetails.template = buildCompatibilityDetails.template || AJS.$(AJS.$('#upm-plugin-details-compatibility').html());
        var details = buildCompatibilityDetails.template.clone();
        AJS.$('dd.upm-plugin-key', details).text(plugin.key || AJS.params.upmTextUnknown);
        AJS.$('dd.upm-plugin-developer', details).text((plugin.vendor && plugin.vendor.name) || AJS.params.upmTextUnknown);
        if (plugin.installedVersion) {
            AJS.$('div.upm-plugin-upgrade-version', details).removeClass('hidden');
            AJS.$('dd.upm-plugin-installed-version', details).text(plugin.installedVersion || AJS.params.upmTextUnknown);
            AJS.$('dd.upm-plugin-upgrade-version', details).text(plugin.version || AJS.params.upmTextUnknown);
        } else {
            AJS.$('dd.upm-plugin-installed-version', details).text(plugin.version || AJS.params.upmTextUnknown);
        }
        if (plugin.links && plugin.links.binary) {
            AJS.$('input.upm-plugin-binary', details).val(plugin.links.binary);
        } else {
            AJS.$("button.upm-upgrade", details).remove();
        }
        if (plugin.restartState) {
            AJS.$("button.upm-upgrade", details).remove();
            displayRestartMessage(details, plugin.restartState);
        }
        if (!plugin.links['modify']) {
            AJS.$("button.upm-disable", details).remove();
        }
        if (plugin.links && plugin.links.details) {
            AJS.$('input.upm-plugin-homepage', details).val(plugin.links.details);
        }
        if (plugin.deployable === false) {
            AJS.$("button.upm-download", details).removeClass("hidden");
        }
        return details;
    }

    /**
     * Displays a restart message at the top of the given plugin details
     * @method displayRestartMessage
     * @param {HTMLElement} details The element insert the message into
     * @param {String} state The state (remove/install/upgrade) to show the message for
     * @return {String} Message element
     */
    function displayRestartMessage(details, state) {
        var message;
        if (state == 'remove') {
            message = AJS.params.upmTextUninstallNeedsRestart;
        } else if (state == 'install') {
            message = AJS.params.upmTextInstallNeedsRestart;
        } else if (state == 'upgrade') {
            message = AJS.params.upmTextUpgradeNeedsRestart;
        }
        if (message) {
            details.addClass('upm-plugin-requires-restart');
            AJS.$('div.upm-requires-restart-message', details).text(message);
        }
        return message;
    }

    /**
     * Display a modal dialog telling the user to refresh the page
     * @method displayRefreshMessage
     */
    function displayRefreshMessage() {
        var dialogContent = AJS.$('<div></div>'),
                popup = new AJS.Dialog({
                    width: 500,
                    height: 200,
                    id: "upm-refresh-dialog"
                }),
                refresh = function(e) {
                    e && e.preventDefault && e.preventDefault();
                    window.location.href = window.location.pathname;
                };
        
        dialogContent.html(AJS.params.upmTextRequiresRefresh);
        dialogContent.find('a')
                .attr('href', '#')
                .click(refresh);

        popup.addHeader(AJS.params.upmTextRequiresRefreshHeader);
        popup.addPanel("All", dialogContent);
        popup.addButton(AJS.params.upmTextRefresh, refresh);

        popup.show();
    }

    /**
     * Displays an informational message at the top of a given element
     * @method displayMessage
     * @param {HTMLElement} container The element to prepend the message to
     * @param {String} text Message content
     * @param {String} classNames (optional) Will be added to the class attribute of the message element
     * @param {Boolean} unclosable (optional) If true, hide close button in the message element
     * @return {HTMLElement} Message element
     */
    function displayMessage(container, text, classNames, unclosable) {
        displayMessage.template = displayMessage.template || AJS.$(AJS.$('#upm-message-template').html());
        var message = displayMessage.template.clone(),
            existing = AJS.$('div.upm-message.closable', container);
        if (classNames) {
            message.addClass(classNames);
        }
        AJS.$('span.upm-message-text', message).html(upm.html_sanitize(text, htmlSanitizerUrlPolicy));
        if (unclosable) {
            AJS.$("a.upm-message-close", message).hide();
        }
        if (existing.length) {
            existing.replaceWith(message);
        } else {
            message.prependTo(container);
        }
        return message;
    }

    /**
     * Performs any actions needed based on the response eg. reload the page if the status is unauthorized
     * @param container
     * @param {XMLHttpRequest} request
     * @param pluginName
     */
    function handleAjaxError(container, request, pluginName) {
        var msg, response, status, subcode;
        try {
            response = upm.json.parse(request.responseText);
        } catch (e) {
            AJS.log('Failed to parse response text: ' + e);
        }
        status = request.status || response["status-code"];
        if (reloadIfUnauthorizedStatus(status)) {
            msg = AJS.params['upm.error.unauthorized'];
            displayMessage(container, msg, 'error',true);
        }
        else if (!reloadIfWebSudoError(subcode)) {
            displayErrorMessage(container, response, pluginName);
        }
    }

    /**
     * Displays an error message at the top of the specified element
     * @method displayErrorMessage
     * @param {HTMLElement} container The element to prepend the message to
     * @param {String|Object} response Message content
     * @param {String} pluginName Display name of the plugin
     */
    function displayErrorMessage(container, response, pluginName) {
        var msg,
            subcode;
        container = container || messageContainer;
        if (response) {
            if (typeof response == "string") {
                try {
                    response = upm.json.parse(response);
                } catch (e) {
                    AJS.log('Failed to parse response text: ' + e);
                }
            }
            msg = response.errorMessage || response.message || (response.status && response.status.errorMessage);
            subcode = response.subCode || (response.status && response.status.subCode) || (response.details && response.details.error.subCode);
            if (subcode && AJS.params[subcode]) {
                // if a subcode was provided, use it to get an i18n message
                msg = AJS.format(AJS.params[subcode], htmlEncode(pluginName || response.pluginName || (response.status && response.status.source) || AJS.params.upmTextUnknownPlugin),
                                 htmlEncode(response.moduleName || AJS.params.upmTextUnknownPluginModule));
            } else if (!msg || msg.match(/^[0-9][0-9][0-9]$/)) {
                // if there is no msg or the msg is just an error code, return an "unexpected" error
                msg = AJS.params['upm.plugin.error.unexpected.error'];
            }
        } else {
            msg = AJS.params['upm.plugin.error.unexpected.error'];
        }
        displayMessage(container, msg, 'error');
    }

    /**
     * Checks an error message to see if it's caused by lack of websudo authentication, and if so reloads the page to
     * trigger the login challenge
     * @method reloadIfWebSudoError
     * @param {String} msg The returned error message
     * @return {Boolean} whether or not the page is reloaded
     */
    function reloadIfWebSudoError(subcode) {
        // This is a bit crap but I don't think we want to wrap the error just to have a nicer error code
        if (subcode === "upm.websudo.error") {
            // if there is a webSudo error then we need to redirect the UI to the UPM Servlet so the login challenge will occur
            window.location.reload(true);
            return true;
        }
        return false;
    }

    /**
     * Checks if the message from the server was a 401-Unauthorized
     *  if so reload the page because either the logged in user is not allowed to perform this action or their session has timed out
     *  and hence they will be asked to login again first.
     * @param {Number} status - the status code for the message
     * @return {Boolean} wheher or not the page is reloaded
     */
    function reloadIfUnauthorizedStatus(status) {
        if (status === 401) {
            window.location.reload(true);
            return true;
        }
        return false;
    }

    /**
     * Removes an informational message -- triggered by clicking message "close" link
     * @method removeMessage
     * @param {Event} e Event object
     */
    function removeMessage(e) {
        var message = AJS.$(e.target).closest('div.upm-message.closable');
        if (message.length == 0) {
            message = AJS.$(e.target).closest('div.upm-plugin').find('div.upm-message.closable');
        }
        e.preventDefault();
        message.remove();
    }

    /**
     * Cancels a pending action that is waiting for restart to take effect
     * @method cancelActionRequiringRestart
     * @param {Event} e Event object
     */
    function cancelActionRequiringRestart(e) {
        var target = AJS.$(e.target),
                li = target.closest('li'),
                uri = li.find('.upm-requires-restart-cancel-uri').val(),
                data = li.data('representation');
        e.preventDefault();
        target.blur();
        if (!hasPendingTasks()) {
            AJS.$.ajax({
                type: 'DELETE',
                url: uri,
                dataType: 'json',
                contentType: contentTypes['requires-restart'],
                data: upm.json.stringify(data),
                success: function(response) {
                    var hash = getLocationHash();
                    li.remove();
                    displayMessage(messageContainer, AJS.format(AJS.params['upm.messages.requiresRestart.cancel.' + data.action], htmlEncode(data.name)), 'info');
                    if (AJS.$('#upm-requires-restart-list li').length == 0) {
                        upmContainer.removeClass('requires-restart');
                    }
                    if (hash.tab !== 'upgrade') {
                        // reload the current tab (but not if it's the upgrade tab, since we're reloading that anyway)
                        loadTab(hash.tab, null, null);
                    }
                    loadUpgradeTab();
                },
                error: function(request) {
                    // UPM-986 Lets update the changes since there was some error with what was there.
                    checkForChangesRequiringRestart();
                    handleAjaxError(messageContainer, request,  data.name);
                }
            });
        }
    }

    /**
     * Hides or shows the requires restart details and changes the link text accordingly
     * @method toggleRequiresRestartDetails
     */
    function toggleRequiresRestartDetails() {
        var container = AJS.$('#upm-requires-restart-message'),
                link = AJS.$('#upm-requires-restart-show');
        if (container.hasClass('expanded')) {
            container.removeClass('expanded');
            link.text(AJS.params.upmTextRequiresRestartShow);
        } else {
            container.addClass('expanded');
            link.text(AJS.params.upmTextRequiresRestartHide);
        }
    }

    /**
     * Hides or shows the audit log configuration form
     * @method toggleAuditLogConfiguration
     */
    function toggleAuditLogConfiguration() {
        var container = AJS.$('#upm-log-configuration');
        if (container.hasClass('hidden')) {
            container.removeClass('hidden');
            AJS.$('#upm-log-configuration-days').select();
        } else {
            container.addClass('hidden');
        }
    }

    /**
     * Changes the audit log text to reflect the latest purge policy
     * @method setPurgePolicyText
     * @param {Number} days Number of days audit log entries are being kept for
     */
    function setPurgePolicyText(days) {
        var text = days == 1 ? AJS.params.upmTextAuditLogDescriptionSingular : AJS.format(AJS.params.upmTextAuditLogDescription, days);
        AJS.$('#upm-log-policy').text(text);
    }

    /**
     * Sets the number of days that audit log entries are purged after
     * @method changeAuditLogPurgePolicy
     * @param {Event} e Event object
     */
    function changeAuditLogPurgePolicy(e) {
        var configDayInput = AJS.$('#upm-log-configuration-days'),
            numDays = configDayInput.val(),
            maxDays = 100000;
        e.preventDefault();
        // UPM-666 - validate that the input is a valid int and in specified range
        if (!numDays.match(/^\d+$/) || numDays <= 0 || numDays > maxDays) {
            configDayInput.val(configDayInput.attr('data-lastValid'));
            displayMessage(messageContainer, AJS.format(AJS.params.upmAuditLogErrorInvalidPurgeAfter, maxDays), 'error');
        }
        else {
            AJS.$.ajax({
                type: 'PUT',
                url: resources['audit-log-purge-after-manage'],
                dataType: 'json',
                contentType: contentTypes['purge-after'],
                data: upm.json.stringify({'purgeAfter': numDays}),
                success: function(response) {
                    configDayInput.attr('data-lastValid',numDays);
                    setPurgePolicyText(numDays);
                    toggleAuditLogConfiguration();
                },
                error: function(request) {
                    handleAjaxError(messageContainer, request, "");
                }
            });
        }
    }

    /**
     * Removes a plugin once it is collapsed
     * @method removeOnCollapse
     * @param {Event} e Event object
     * @param {Function} callbackFn Function to run after plugin removal
     */
    function removeOnCollapse(e, callbackFn) {
        var plugin = AJS.$(e.target).closest('div.upm-plugin'),
            pluginList = plugin.closest('div.upm-plugin-list'),
            isLastPlugin = pluginList.find('div.upm-plugin').length == 1,
            delay = 500,
            removalCallback = function() {
                plugin.remove();
                if (isLastPlugin) {
                    pluginList.replaceWith(buildEmptyPluginList());
                }
                callbackFn && callbackFn();
            };
        if (plugin.hasClass('to-remove')) {
            if (plugin.animate) {
                plugin.animate({opacity: '0'}, delay, 'linear', function() {
                    removalCallback();
                });
            } else {
                setTimeout(function() {
                    removalCallback();
                }, delay);
            }
        }
    }

    /**
     * Creates a unique hash from a string that is suitable for use in an id attribute
     * @method createHash
     * @param {String} input The text to create a hash from
     * @param {String} type (optional) If input may not be unique, this string can be used to differentiate
     */
    function createHash(input, type) {
        // Jenkins hash function. Updating this requires updating Ids#createHash.
        // Assumes ASCII input.
        var hash = 0;
        if (input) {
            if (type) {
                input += '-' + type;
            }
            for (var i = 0, len = input.length; i < len; i++) {
                hash += input.charCodeAt(i);
                hash += hash << 10;
                hash ^= hash >>> 6;
            }
            hash += hash << 3;
            hash ^= hash >>> 11;
            hash += hash << 15;
            return hash >>> 0;
        } else {
            return '';
        }
    }

    /**
     * Automatically updates height of dialog panels, to contain content without the need for scroll bars
     * NOTE: This is a wholesale ripoff of the AJS.Dialog.prototype.updateHeight function in AJS, but with some
     * additional padding tacked on to the calculated height to fix a problem in JIRA where the button panel was
     * getting cut off
     * @method updateDialogHeight
     * @param {AJS.Dialog} dialog The dialog object in question
     */
    function updateDialogHeight(dialog) {
        var height = 0;
        for (var i=0; dialog.getPanel(i); i++) {
            if (dialog.getPanel(i).body.css({height: "auto", display: "block"}).outerHeight() > height) {
                height = dialog.getPanel(i).body.outerHeight();
            }
            if (i !== dialog.page[dialog.curpage].curtab) {
                dialog.getPanel(i).body.css({display:"none"});
            }
        }
        for (i=0; dialog.getPanel(i); i++) {
            dialog.getPanel(i).body.css({height: height || dialog.height});
        }
        dialog.page[0].menu.height(height);
        dialog.height = height + 102;
        dialog.popup.changeSize(undefined, height + 102);
    }


    /**
     * Ensures that when a confirm dialog is displayed, highlight the first 'tabable' element on the page 
     * @method focusItem
     * @return the dialog element
     */
    function focusItem(item) {
        var hasFocus = false, 
            theChildren = item.children();

        if (item[0].tabIndex >= 0 && item.is(":visible")) {
            item.focus();
            hasFocus = true;
            return hasFocus;
        }

        for(var i=0, ii=theChildren.length; i<ii; i++) {
            hasFocus = focusItem(jQuery(theChildren[i]));
            if (hasFocus) {
                break;
            }
        }

        return hasFocus;
    }

    /**
     * Takes an AJS dialog item, wraps it in jQuery fluffyness and thow it to the lio...err focusItem function 
     * @method focusDialog
     * @return the dialog element
     */
    function focusDialog(dialog) {
        focusItem(AJS.$("#" + dialog.id));
        return dialog;
    }

    /**
     * Creates a confirmation dialog that fires a callback if accepted, does nothing if cancelled
     * @method createConfirmDialog
     * @return {Dialog} The dialog element
     */
    function createConfirmDialog() {
        var dialog = new AJS.Dialog(500, 300, 'upm-confirm-dialog');
        
        dialog.addPanel("", "panel1");
        dialog.addHeader(AJS.params.upmTextConfirmHeader);
            
        dialog.addButton(AJS.params.upmTextConfirmContinue, function(popup) {
            popup.callbackFn && popup.callbackFn.apply(this, popup.callbackFn.params || []);
            popup.hide();
        });

        dialog.addButton(AJS.params.upmTextConfirmCancel, function(popup) {
            popup.hide();
        });

        return dialog;
    }

    /**
     * Prompts the user to confirm an action before proceeding
     * @method showConfirmDialog
     * @param {String} text The text to display to the user
     * @param {Function} callbackFn The function to run if the user accepts
     * @param {Array} params (optional) The parameters to pass through to the callback function
     */
    function showConfirmDialog(text, callbackFn, params) {
        var dialog = showConfirmDialog.dialog = showConfirmDialog.dialog || createConfirmDialog(text);
        dialog.getCurrentPanel().html(text);
        dialog.callbackFn = callbackFn;
        dialog.callbackFn.params = params;
        dialog.show();
        updateDialogHeight(dialog);
        // Show/hide dance required to get dialog and shadow to be the correct size.
        // Fixing AJS-625 should make this unnecessary.
        // @aui-override
        // @see UPM-1091
        // @see AJS-625
        dialog.hide();
        dialog.show();
        // @aui-override-end

        focusDialog(dialog);
    }

    /**
     * Toggles the system plugin list on the "Manage" tab
     * @method toggleSystemPlugins
     */
    function toggleSystemPlugins() {
        AJS.$('#upm-system-plugins').toggle();
        AJS.$('#upm-manage-hide-system').toggle();
        AJS.$('#upm-manage-show-system').toggle();
    }

    /**
     * Checks to see if a button is disabled and stops event handler propogation if it is
     * @method checkButtonDisabledState
     * @param {Event} e Event object
     * @return {Boolean} Returns false if the button is disabled
     */
     function checkButtonDisabledState(e) {
         if (AJS.$(this).attr('disabled')) {
             e.stopImmediatePropagation();
             return false;
         }
         return true;
     }

    AJS.toInit(function() {
        var plugins, modules, originalIsDirtyFn;

        messageContainer = AJS.$('#upm-messages');
        upmContainer = AJS.$('#upm-container');

        // hover and click functions for plugin lists
        plugins = AJS.$('div.upm-plugin-list.expandable div.upm-plugin', '#upm-container');
        if (isIE) {
            plugins.live('mouseover', function() {
                AJS.$(this).addClass('hover');
            });
            plugins.live('mouseout', function() {
                AJS.$(this).removeClass('hover');
            });
        }
        plugins.find('div.upm-plugin-row').live('click', togglePluginDetails);

        // hover and click functions for plugin modules
        modules = AJS.$('div.upm-module', upmContainer);
        if (isIE) {
            modules.live('mouseover', function() {
                AJS.$(this).addClass('hover');
            });
            modules.live('mouseout', function() {
                AJS.$(this).removeClass('hover');
            });
        }
        AJS.$('a.upm-module-toggle', upmContainer).live('click', function(e) {
            var target = AJS.$(e.target).blur();
            e.preventDefault();
            target.closest('div.upm-plugin-modules').toggleClass('expanded');
        });

        // tab-based navigation
        AJS.$('#upm-tabs li a').click(swapTab);

        // UPM-930: IE lets you click on buttons even if they're disabled
        if (isIE) {
            AJS.$('button', upmContainer).live('click', checkButtonDisabledState);
        }

        // search box -- install tab
        clearOnBlur('#upm-install-search-box', AJS.params.upmTextInstallSearchBox);

        // search box -- osgi tab
        clearOnBlur('#upm-osgi-search-box', AJS.params.upmTextOsgiSearchBox);

        // search clear button -- install tab
        AJS.$('#upm-install-search-clear-button').click(clearInstallSearch);

        // search clear button -- osgi tab
        AJS.$('#upm-osgi-search-clear-button').click(clearBundleSearch);

        // filter box -- upgrade tab
        clearOnBlur('#upm-upgrade-filter-box', AJS.params.upmTextFilterPlugins);

        // filter box -- manage tab
        clearOnBlur('#upm-manage-filter-box', AJS.params.upmTextFilterPlugins);

        // filter box -- osgi tab
        clearOnBlur('#upm-osgi-filter-box', AJS.params.upmTextFilterOsgiBundles);

        // plugin type select
        AJS.$('#upm-install-type').change(changeDisplayedPlugins);

        // plugin upgrade button
        AJS.$('button.upm-upgrade', upmContainer).live('click', upgradePlugin);

        // plugin upgrade button
        AJS.$('#upm-upgrade-all').live('click', upgradeAllPlugins);

        // plugin install button
        AJS.$('button.upm-install', upmContainer).live('click', installPlugin);

        // plugin download button
        AJS.$('button.upm-download', upmContainer).live('click', showDownloadDialog);

        // plugin disable button
        AJS.$('button.upm-disable', upmContainer).live('click', disablePlugin);

        // plugin enable button
        AJS.$('button.upm-enable', upmContainer).live('click', enablePlugin);

        // module disable button
        AJS.$('button.upm-module-disable', upmContainer).live('click', disableModule);

        // module enable button
        AJS.$('button.upm-module-enable', upmContainer).live('click', enableModule);

        // plugin uninstall button
        AJS.$('button.upm-uninstall', upmContainer).live('click', function(e) {
            showConfirmDialog(AJS.params.upmTextUninstallConfirm, uninstallPlugin, [e]);
        });

        // expand all plugin details
        AJS.$('a.upm-expand-all', upmContainer).live('click', expandAllPluginDetails);

        // collapse all plugin details
        AJS.$('a.upm-collapse-all', upmContainer).live('click', collapseAllPluginDetails);

        // enable safe mode link
        AJS.$('#upm-safe-mode-enable').click(function(e) {
            e.preventDefault();
            showConfirmDialog(AJS.params.upmTextSafeModeConfirm, enableSafeMode);
        });

        // exit safe mode link
        AJS.$('#upm-safe-mode-restore').click(function(e) {
            e.preventDefault();
            showConfirmDialog(AJS.params.upmTextSafeModeRestoreConfirm, restoreFromSafeMode);
        });

        // exit safe mode link
        AJS.$('#upm-safe-mode-keep-state').click(function(e) {
            e.preventDefault();
            showConfirmDialog(AJS.params.upmTextSafeModeExitConfirm, exitSafeMode);
        });

        // upgrade compatibility form
        AJS.$('#upm-compatibility-form').submit(checkCompatibility);

        // filter boxes
        // oninput catches mouse-based pasting in non-IE browsers, onpropertychange in IE
        AJS.$('input.upm-filterbox', upmContainer).bind("keyup input propertychange", filterPluginsByName);

        // pac search box
        AJS.$('#upm-install-search-form', upmContainer).submit(searchForPlugins);

        // osgi bundle search box
        AJS.$('#upm-osgi-search-form', upmContainer).submit(filterBundles);

        // upload plugin link
        AJS.$('#upm-upload').click(showUploadDialog);

        // close message link
        AJS.$('a.upm-message-close', upmContainer).live('click', removeMessage);

        // audit log refresh
        AJS.$('#upm-audit-log-refresh').live('click', function (e) {
            e.preventDefault();
            buildLogEntries(AJS.$('#upm-panel-log'), null);
        });

        // toggle system plugins into view
        AJS.$('.upm-manage-toggle-system').live('click', function (e) {
            e.preventDefault();
            toggleSystemPlugins();
        });

        // audit log first button
        AJS.$('#upm-audit-log-first').live('click', logPagingEventHandler);

        // audit log previous button
        AJS.$('#upm-audit-log-previous').live('click', logPagingEventHandler);

        // audit log next button
        AJS.$('#upm-audit-log-next').live('click', logPagingEventHandler);

        // audit log last button
        AJS.$('#upm-audit-log-last').live('click', logPagingEventHandler);

        // requires restart details link
        AJS.$('#upm-requires-restart-show').click(function (e) {
            e.preventDefault();
            e.target.blur();
            toggleRequiresRestartDetails();
        });

        // requires restart action cancellation link
        AJS.$('a.upm-requires-restart-cancel', upmContainer).live('click', cancelActionRequiringRestart);

        // audit log configure link
        AJS.$('#upm-log-configure-link').click(function (e) {
            e.preventDefault();
            e.target.blur();
            toggleAuditLogConfiguration();
        });

        // audit log configuration form
        AJS.$('#upm-log-configuration').submit(changeAuditLogPurgePolicy);

        // audit log configuration cancel link
        AJS.$('#upm-log-configuration-cancel').click(function (e) {
            e.preventDefault();
            toggleAuditLogConfiguration();
        });

        // osgi bundle cross-references
        AJS.$('a.upm-osgi-bundle-xref').live('click', function (e) {
            e.preventDefault();
            e.target.blur();
            focusPlugin(AJS.$(e.target).next('input').attr('value'), 'osgi');
        });

        // UPM-999 - This is a hack to get the UPM tests running in feCru
        if (AJS.$('#fecruTestHack').val() == "false") {
            // make back button work in browsers that support 'onhashchange'
            AJS.$(window).bind('hashchange', function() {
                var hash = getLocationHash(),
                        tab = hash.tab;
                if (AJS.$('#upm-panel-' + tab).is(':hidden')) {
                    loadTab(tab, hash.key);
                } else if (hash.key) {
                    focusPlugin(hash.key, tab);
                }
            });
        }

        loadInitialTab();
        checkPacAvailable();

        // UPM-951: JIRA 4.2 runs isDirty() on all forms on page unload, and displays a confirm dialog if the form has changed
        originalIsDirtyFn = AJS.$.fn.isDirty;
        if (originalIsDirtyFn) {
            AJS.$.fn.isDirty = function() {
                if (AJS.$(this).hasClass('skip-dirty-check')) {
                    return false;
                }
                return originalIsDirtyFn.apply(this, arguments);
            };
        }
    });

    return {
        // Exposing createHash function for use in tests
        getPluginHash: function(pluginKey, tab) {
            return createHash(pluginKey, tab);
        }
    };

})();
