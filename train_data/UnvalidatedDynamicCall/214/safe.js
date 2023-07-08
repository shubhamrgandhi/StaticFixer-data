/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* exported onLoadLightningItemPanel, onCancel, onCommandSave,
 *          onCommandDeleteItem, editAttendees, editPrivacy, editPriority,
 *          editStatus, editShowTimeAs, updateShowTimeAs, editToDoStatus,
 *          postponeTask, toggleTimezoneLinks, toggleLink, attachURL,
 *          onCommandViewToolbar, onCommandCustomize, attachFileByAccountKey,
 *          onUnloadLightningItemPanel, openNewEvent, openNewTask,
 *          openNewMessage, openNewCardDialog
 */

/* import-globals-from ../../../../toolkit/content/globalOverlay.js */
/* import-globals-from ../../base/content/dialogs/calendar-dialog-utils.js */
/* import-globals-from ../../base/content/calendar-ui-utils.js */

// XXX Need to determine which of these we really need here.
var { cal } = ChromeUtils.import("resource:///modules/calendar/calUtils.jsm");
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { MailServices } = ChromeUtils.import("resource:///modules/MailServices.jsm");

// gTabmail is null if we are in a dialog window and not in a tab.
var gTabmail = document.getElementById("tabmail") || null;

if (!gTabmail) {
  // In a dialog window the following menu item functions need to be
  // defined.  In a tab they are defined elsewhere.  To prevent errors in
  // the log they are defined here (before the onLoad function is called).
  /**
   * Update menu items that rely on focus.
   */
  window.goUpdateGlobalEditMenuItems = () => {
    goUpdateCommand("cmd_undo");
    goUpdateCommand("cmd_redo");
    goUpdateCommand("cmd_cut");
    goUpdateCommand("cmd_copy");
    goUpdateCommand("cmd_paste");
    goUpdateCommand("cmd_selectAll");
  };
  /**
   * Update menu items that rely on the current selection.
   */
  window.goUpdateSelectEditMenuItems = () => {
    goUpdateCommand("cmd_cut");
    goUpdateCommand("cmd_copy");
    goUpdateCommand("cmd_delete");
    goUpdateCommand("cmd_selectAll");
  };
  /**
   * Update menu items that relate to undo/redo.
   */
  window.goUpdateUndoEditMenuItems = () => {
    goUpdateCommand("cmd_undo");
    goUpdateCommand("cmd_redo");
  };
  /**
   * Update menu items that depend on clipboard contents.
   */
  window.goUpdatePasteMenuItems = () => {
    goUpdateCommand("cmd_paste");
  };
}

// Stores the ids of the iframes of currently open event/task tabs, used
// when window is closed to prompt for saving changes.
var gItemTabIds = [];
var gItemTabIdsCopy;

// gConfig is used when switching tabs to restore the state of
// toolbar, statusbar, and menubar for the current tab.
var gConfig = {
  isEvent: null,
  privacy: null,
  hasPrivacy: null,
  calendarType: null,
  privacyValues: null,
  priority: null,
  hasPriority: null,
  status: null,
  percentComplete: null,
  showTimeAs: null,
  // whether commands are enabled or disabled
  attendeesCommand: null, // cmd_attendees
  attachUrlCommand: null, // cmd_attach_url
  timezonesEnabled: false, // cmd_timezone
  // XXX Currently there is no toolbar button or menu item for
  // cmd_toggle_link for event/task tabs
  toggleLinkCommand: null, // cmd_toggle_link
};

/**
 * Receive an asynchronous message from the iframe.
 *
 * @param {MessageEvent} aEvent  Contains the message being received
 */
function receiveMessage(aEvent) {
	if (aEvent.origin !== "chrome://lightning") {
	return ;
}

	switch (aEvent.data.command) {
    case "initializeItemMenu":
      initializeItemMenu(aEvent.data.label, aEvent.data.accessKey);
      break;
    case "disableLinkCommand": {
      let linkCommand = document.getElementById("cmd_toggle_link");
      if (linkCommand) {
        setElementValue(linkCommand, "true", "disabled");
      }
      break;
    }
    case "cancelDialog":
      document.querySelector("dialog").cancelDialog();
      break;
    case "closeWindowOrTab":
      closeWindowOrTab(aEvent.data.iframeId);
      break;
    case "showCmdStatusNone":
      document.getElementById("cmd_status_none").removeAttribute("hidden");
      break;
    case "updateTitle":
      updateTitle(aEvent.data.argument);
      break;
    case "updateConfigState":
      updateItemTabState(aEvent.data.argument);
      Object.assign(gConfig, aEvent.data.argument);
      break;
    case "enableAcceptCommand":
      enableAcceptCommand(aEvent.data.argument);
      break;
    case "replyToClosingWindowWithTabs":
      handleWindowClose(aEvent.data.response);
      break;
    case "removeDisableAndCollapseOnReadonly":
      removeDisableAndCollapseOnReadonly();
      break;
    case "setElementAttribute": {
      let arg = aEvent.data.argument;
      setElementValue(arg.id, arg.value, arg.attribute);
      break;
    }
    case "loadCloudProviders": {
      loadCloudProviders(aEvent.data.items);
      break;
    }
    case "updateSaveControls": {
      updateSaveControls(aEvent.data.argument.sendNotSave);
      break;
    }
  }
}

window.addEventListener("message", receiveMessage);

/**
 * Send an asynchronous message to an iframe.  Additional properties of
 * aMessage are generally arguments that will be passed to the function
 * named in aMessage.command.  If aIframeId is omitted, the message will
 * be sent to the iframe of the current tab.
 *
 * @param {Object} aMessage          Contains the message being sent
 * @param {string} aMessage.command  The name of a function to call
 * @param {string} aIframeId         (optional) id of an iframe to send the message to
 */
function sendMessage(aMessage, aIframeId) {
  let iframeId = gTabmail
    ? aIframeId || gTabmail.currentTabInfo.iframe.id
    : "lightning-item-panel-iframe";
  let iframe = document.getElementById(iframeId);
  iframe.contentWindow.postMessage(aMessage, "*");
}

/**
 * When the user closes the window, this function handles prompting them
 * to save any unsaved changes for any open item tabs, before closing the
 * window, or not if 'cancel' was clicked.  Requires sending and receiving
 * async messages from the iframes of all open item tabs.
 *
 * @param {boolean} aResponse  The response from the tab's iframe
 */
function handleWindowClose(aResponse) {
  if (!aResponse) {
    // Cancel was clicked, just leave the window open. We're done.
  } else if (gItemTabIdsCopy.length > 0) {
    // There are more unsaved changes in tabs to prompt the user about.
    let nextId = gItemTabIdsCopy.shift();
    sendMessage({ command: "closingWindowWithTabs", id: nextId }, nextId);
  } else {
    // Close the window, there are no more unsaved changes in tabs.
    window.removeEventListener("close", windowCloseListener);
    window.close();
  }
}

/**
 * Listener function for window close.  We prevent the window from
 * closing, then for each open tab we prompt the user to save any
 * unsaved changes with handleWindowClose.
 *
 * @param {Object} aEvent  The window close event
 */
function windowCloseListener(aEvent) {
  aEvent.preventDefault();
  gItemTabIdsCopy = gItemTabIds.slice();
  handleWindowClose(true);
}

/**
 * Load handler for the outer parent context that contains the iframe.
 *
 * @param {string} aIframeId  (optional) Id of the iframe in this tab
 * @param {string} aUrl       (optional) The url to load in the iframe
 */
function onLoadLightningItemPanel(aIframeId, aUrl) {
  let iframe;
  let iframeSrc;
  let dialog = document.querySelector("dialog");

  if (!gTabmail) {
    gTabmail = document.getElementById("tabmail") || null;
  }
  if (gTabmail) {
    // tab case
    let iframeId = aIframeId || gTabmail.currentTabInfo.iframe.id;
    iframe = document.getElementById(iframeId);
    iframeSrc = aUrl;

    // Add a listener to detect close events, prompt user about saving changes.
    window.addEventListener("close", windowCloseListener);
  } else {
    // window dialog case
    iframe = document.createXULElement("iframe");
    iframeSrc = window.arguments[0].useNewItemUI
      ? "chrome://lightning/content/html-item-editing/lightning-item-iframe.html"
      : "chrome://lightning/content/lightning-item-iframe.xhtml";

    iframe.setAttribute("id", "lightning-item-panel-iframe");
    iframe.setAttribute("flex", "1");

    let statusbar = document.getElementById("status-bar");

    // Note: iframe.contentWindow is undefined before the iframe is inserted here.
    dialog.insertBefore(iframe, statusbar);

    // Move the args so they are positioned relative to the iframe,
    // for the window dialog just as they are for the tab.
    // XXX Should we delete the arguments here in the parent context
    // so they are only accessible in one place?
    iframe.contentWindow.arguments = [window.arguments[0]];

    // hide the ok and cancel dialog buttons
    let accept = dialog.getButton("accept");
    let cancel = dialog.getButton("cancel");
    accept.setAttribute("collapsed", "true");
    cancel.setAttribute("collapsed", "true");
    cancel.parentNode.setAttribute("collapsed", "true");

    document.addEventListener("dialogaccept", event => {
      sendMessage({ command: "onAccept" });
      event.preventDefault();
    });

    document.addEventListener("dialogcancel", event => {
      sendMessage({ command: "onCancel" });
      event.preventDefault();
    });

    // set toolbar icon color for light or dark themes
    if (typeof window.ToolbarIconColor !== "undefined") {
      window.ToolbarIconColor.init();
    }

    // Enlarge the dialog window so the iframe content fits, and prevent it
    // getting smaller. We don't know the minimum size of the content unless
    // it's overflowing, so don't attempt to enforce what we don't know.
    let overflowListener = () => {
      let docEl = document.documentElement;
      let { scrollWidth, scrollHeight } = iframe.contentDocument.documentElement;
      let { clientWidth, clientHeight } = iframe;

      let diffX = scrollWidth - clientWidth;
      let diffY = scrollHeight - clientHeight;
      // If using a scaled screen resolution, rounding might cause
      // scrollWidth/scrollHeight to be 1px larger than
      // clientWidth/clientHeight, so we check for a difference
      // greater than 1 here, not 0.
      if (diffX > 1) {
        window.resizeBy(diffX, 0);
        docEl.setAttribute("minwidth", docEl.getAttribute("width"));
      }
      if (diffY > 1) {
        window.resizeBy(0, diffY);
        docEl.setAttribute("minheight", docEl.getAttribute("height"));
      }
      if (docEl.hasAttribute("minwidth") && docEl.hasAttribute("minheight")) {
        iframe.contentWindow.removeEventListener("resize", overflowListener);
      }
    };
    iframe.contentWindow.addEventListener(
      "load",
      () => {
        // This is the first listener added, but it should run after all the others,
        // so that they can properly set up the layout they might need.
        // Push to the end of the event queue.
        setTimeout(overflowListener, 0);
      },
      { once: true }
    );
    iframe.contentWindow.addEventListener("resize", overflowListener);
  }

  // event or task
  let calendarItem = iframe.contentWindow.arguments[0].calendarEvent;
  gConfig.isEvent = cal.item.isEvent(calendarItem);

  // for tasks in a window dialog, set the dialog id for CSS selection, etc.
  if (!gTabmail) {
    if (gConfig.isEvent) {
      setDialogId(dialog, "calendar-event-dialog");
    } else {
      setDialogId(dialog, "calendar-task-dialog");
    }
  }

  // timezones enabled
  gConfig.timezonesEnabled = getTimezoneCommandState();
  iframe.contentWindow.gTimezonesEnabled = gConfig.timezonesEnabled;

  // toggle link
  let cmdToggleLink = document.getElementById("cmd_toggle_link");
  gConfig.toggleLinkCommand = cmdToggleLink.getAttribute("checked") == "true";
  iframe.contentWindow.gShowLink = gConfig.toggleLinkCommand;

  // set the iframe src, which loads the iframe's contents
  iframe.setAttribute("src", iframeSrc);
}

/**
 * Unload handler for the outer parent context that contains the iframe.
 * Currently only called for windows and not tabs.
 */
function onUnloadLightningItemPanel() {
  if (!gTabmail) {
    // window dialog case
    if (typeof window.ToolbarIconColor !== "undefined") {
      window.ToolbarIconColor.uninit();
    }
  }
}

/**
 * Updates the UI.  Called when a user makes a change and when an
 * event/task tab is shown.  When a tab is shown aArg contains the gConfig
 * data for that event/task.  We pass the full tab state object to the
 * update functions and they just use the properties they need from it.
 *
 * @param {Object} aArg  Its properties hold data about the event/task
 */
function updateItemTabState(aArg) {
  const lookup = {
    privacy: updatePrivacy,
    priority: updatePriority,
    status: updateStatus,
    showTimeAs: updateShowTimeAs,
    percentComplete: updateMarkCompletedMenuItem,
    attendeesCommand: updateAttendeesCommand,
    attachUrlCommand: updateAttachment,
    timezonesEnabled: updateTimezoneCommand,
  };
  for (let key of Object.keys(aArg)) {
    let procedure = lookup[key];
    if (procedure) {
      procedure(aArg);
    }
  }
}

/**
 * When in a window, set Item-Menu label to Event or Task.
 *
 * @param {string} aLabel      The new name for the menu
 * @param {string} aAccessKey  The access key for the menu
 */
function initializeItemMenu(aLabel, aAccessKey) {
  let menuItem = document.getElementById("item-menu");
  menuItem.setAttribute("label", aLabel);
  menuItem.setAttribute("accesskey", aAccessKey);
}

/**
 * Handler for when tab is cancelled. (calendar.item.editInTab = true)
 *
 * @param {string} aIframeId  The id of the iframe
 */
function onCancel(aIframeId) {
  sendMessage({ command: "onCancel", iframeId: aIframeId }, aIframeId);
  // We return false to prevent closing of a window until we
  // can ask the user about saving any unsaved changes.
  return false;
}

/**
 * Closes tab or window. Called after prompting to save any unsaved changes.
 *
 * @param {string} aIframeId  The id of the iframe
 */
function closeWindowOrTab(iframeId) {
  if (gTabmail) {
    if (iframeId) {
      // Find the tab associated with this iframeId, and close it.
      let myTabInfo = gTabmail.tabInfo.filter(x => "iframe" in x && x.iframe.id == iframeId)[0];
      myTabInfo.allowTabClose = true;
      gTabmail.closeTab(myTabInfo);
    } else {
      gTabmail.currentTabInfo.allowTabClose = true;
      gTabmail.removeCurrentTab();
    }
  } else {
    window.close();
  }
}

/**
 * Handler for saving the event or task.
 *
 * @param {boolean} aIsClosing  Is the tab or window closing
 */
function onCommandSave(aIsClosing) {
  sendMessage({ command: "onCommandSave", isClosing: aIsClosing });
}

/**
 * Handler for deleting the event or task.
 */
function onCommandDeleteItem() {
  sendMessage({ command: "onCommandDeleteItem" });
}

/**
 * Update the title of the tab or window.
 *
 * @param {string} aNewTitle  The new title
 */
function updateTitle(aNewTitle) {
  if (gTabmail) {
    gTabmail.currentTabInfo.title = aNewTitle;
    gTabmail.setTabTitle(gTabmail.currentTabInfo);
  } else {
    document.title = aNewTitle;
  }
}

/**
 * Open a new event.
 */
function openNewEvent() {
  sendMessage({ command: "openNewEvent" });
}

/**
 * Open a new task.
 */
function openNewTask() {
  sendMessage({ command: "openNewTask" });
}

/**
 * Open a new Thunderbird compose window.
 */
function openNewMessage() {
  MailServices.compose.OpenComposeWindow(
    null,
    null,
    null,
    Ci.nsIMsgCompType.New,
    Ci.nsIMsgCompFormat.Default,
    null,
    null,
    null
  );
}

/**
 * Open a new addressbook window
 */
function openNewCardDialog() {
  window.openDialog(
    "chrome://messenger/content/addressbook/abNewCardDialog.xhtml",
    "",
    "chrome,modal,resizable=no,centerscreen"
  );
}

/**
 * Handler for edit attendees command.
 */
function editAttendees() {
  sendMessage({ command: "editAttendees" });
}

/**
 * Sends a message to set the gConfig values in the iframe.
 *
 * @param {Object} aArg             Container
 * @param {string} aArg.privacy     (optional) New privacy value
 * @param {short} aArg.priority     (optional) New priority value
 * @param {string} aArg.status      (optional) New status value
 * @param {string} aArg.showTimeAs  (optional) New showTimeAs / transparency value
 */
function editConfigState(aArg) {
  sendMessage({ command: "editConfigState", argument: aArg });
}

/**
 * Handler for changing privacy. aEvent is used for the popup menu
 * event-privacy-menupopup in the Privacy toolbar button.
 *
 * @param {Node}       aTarget      Has the new privacy in its "value" attribute
 * @param {XULCommandEvent} aEvent  (optional) the UI element selection event
 */
function editPrivacy(aTarget, aEvent) {
  if (aEvent) {
    aEvent.stopPropagation();
  }
  // "privacy" is indeed the correct attribute to use here
  let newPrivacy = aTarget.getAttribute("privacy");
  editConfigState({ privacy: newPrivacy });
}

/**
 * Updates the UI according to the privacy setting and the selected
 * calendar. If the selected calendar does not support privacy or only
 * certain values, these are removed from the UI. This function should
 * be called any time that privacy setting is updated.
 *
 * @param {Object}    aArg                Contains privacy properties
 * @param {string}    aArg.privacy        The new privacy value
 * @param {boolean}   aArg.hasPrivacy     Whether privacy is supported
 * @param {string}    aArg.calendarType   The type of calendar
 * @param {string[]}  aArg.privacyValues  The possible privacy values
 */
function updatePrivacy(aArg) {
  if (aArg.hasPrivacy) {
    // Update privacy capabilities (toolbar)
    let menupopup = document.getElementById("event-privacy-menupopup");
    if (menupopup) {
      // Only update the toolbar if the button is actually there
      for (let node of menupopup.children) {
        let currentProvider = node.getAttribute("provider");
        if (node.hasAttribute("privacy")) {
          let currentPrivacyValue = node.getAttribute("privacy");
          // Collapsed state

          // Hide the toolbar if the value is unsupported or is for a
          // specific provider and doesn't belong to the current provider.
          if (
            !aArg.privacyValues.includes(currentPrivacyValue) ||
            (currentProvider && currentProvider != aArg.calendarType)
          ) {
            node.setAttribute("collapsed", "true");
          } else {
            node.removeAttribute("collapsed");
          }

          // Checked state
          if (aArg.privacy == currentPrivacyValue) {
            node.setAttribute("checked", "true");
          } else {
            node.removeAttribute("checked");
          }
        }
      }
    }

    // Update privacy capabilities (menu) but only if we are not in a tab.
    if (!gTabmail) {
      menupopup = document.getElementById("options-privacy-menupopup");
      for (let node of menupopup.children) {
        let currentProvider = node.getAttribute("provider");
        if (node.hasAttribute("privacy")) {
          let currentPrivacyValue = node.getAttribute("privacy");
          // Collapsed state

          // Hide the menu if the value is unsupported or is for a
          // specific provider and doesn't belong to the current provider.
          if (
            !aArg.privacyValues.includes(currentPrivacyValue) ||
            (currentProvider && currentProvider != aArg.calendarType)
          ) {
            node.setAttribute("collapsed", "true");
          } else {
            node.removeAttribute("collapsed");
          }

          // Checked state
          if (aArg.privacy == currentPrivacyValue) {
            node.setAttribute("checked", "true");
          } else {
            node.removeAttribute("checked");
          }
        }
      }
    }

    // Update privacy capabilities (statusbar)
    let privacyPanel = document.getElementById("status-privacy");
    let hasAnyPrivacyValue = false;
    for (let node of privacyPanel.children) {
      let currentProvider = node.getAttribute("provider");
      if (node.hasAttribute("privacy")) {
        let currentPrivacyValue = node.getAttribute("privacy");

        // Hide the panel if the value is unsupported or is for a
        // specific provider and doesn't belong to the current provider,
        // or is not the items privacy value
        if (
          !aArg.privacyValues.includes(currentPrivacyValue) ||
          (currentProvider && currentProvider != aArg.calendarType) ||
          aArg.privacy != currentPrivacyValue
        ) {
          node.setAttribute("collapsed", "true");
        } else {
          node.removeAttribute("collapsed");
          hasAnyPrivacyValue = true;
        }
      }
    }

    // Don't show the status panel if no valid privacy value is selected
    if (hasAnyPrivacyValue) {
      privacyPanel.removeAttribute("collapsed");
    } else {
      privacyPanel.setAttribute("collapsed", "true");
    }
  } else {
    // aArg.hasPrivacy is false
    setElementValue("button-privacy", "true", "disabled");
    setElementValue("status-privacy", "true", "collapsed");
    // in the tab case the menu item does not exist
    let privacyMenuItem = document.getElementById("options-privacy-menu");
    if (privacyMenuItem) {
      setElementValue("options-privacy-menu", "true", "disabled");
    }
  }
}

/**
 * Handler to change the priority.
 *
 * @param {Node} aTarget  Has the new priority in its "value" attribute
 */
function editPriority(aTarget) {
  let newPriority = parseInt(aTarget.getAttribute("value"), 10);
  editConfigState({ priority: newPriority });
}

/**
 * Updates the dialog controls related to priority.
 *
 * @param {Object}  aArg              Contains priority properties
 * @param {string}  aArg.priority     The new priority value
 * @param {boolean} aArg.hasPriority  Whether priority is supported
 */
function updatePriority(aArg) {
  // Set up capabilities
  if (document.getElementById("button-priority")) {
    setElementValue("button-priority", !aArg.hasPriority && "true", "disabled");
  }
  if (!gTabmail && document.getElementById("options-priority-menu")) {
    setElementValue("options-priority-menu", !aArg.hasPriority && "true", "disabled");
  }
  setElementValue("status-priority", !aArg.hasPriority && "true", "collapsed");

  if (aArg.hasPriority) {
    let priorityLevel = "none";
    if (aArg.priority >= 1 && aArg.priority <= 4) {
      priorityLevel = "high";
    } else if (aArg.priority == 5) {
      priorityLevel = "normal";
    } else if (aArg.priority >= 6 && aArg.priority <= 9) {
      priorityLevel = "low";
    }

    let priorityNone = document.getElementById("cmd_priority_none");
    let priorityLow = document.getElementById("cmd_priority_low");
    let priorityNormal = document.getElementById("cmd_priority_normal");
    let priorityHigh = document.getElementById("cmd_priority_high");

    priorityNone.setAttribute("checked", priorityLevel == "none" ? "true" : "false");
    priorityLow.setAttribute("checked", priorityLevel == "low" ? "true" : "false");
    priorityNormal.setAttribute("checked", priorityLevel == "normal" ? "true" : "false");
    priorityHigh.setAttribute("checked", priorityLevel == "high" ? "true" : "false");

    // Status bar panel
    let priorityPanel = document.getElementById("status-priority");
    if (priorityLevel == "none") {
      // If the priority is none, don't show the status bar panel
      priorityPanel.setAttribute("collapsed", "true");
    } else {
      priorityPanel.removeAttribute("collapsed");
      let foundPriority = false;
      for (let node of priorityPanel.children) {
        if (foundPriority) {
          node.setAttribute("collapsed", "true");
        } else {
          node.removeAttribute("collapsed");
        }
        if (node.getAttribute("value") == priorityLevel) {
          foundPriority = true;
        }
      }
    }
  }
}

/**
 * Handler for changing the status.
 *
 * @param {Node} aTarget  Has the new status in its "value" attribute
 */
function editStatus(aTarget) {
  let newStatus = aTarget.getAttribute("value");
  editConfigState({ status: newStatus });
}

/**
 * Update the dialog controls related to status.
 *
 * @param {Object} aArg         Contains the new status value
 * @param {string} aArg.status  The new status value
 */
function updateStatus(aArg) {
  const statusLabels = [
    "status-status-tentative-label",
    "status-status-confirmed-label",
    "status-status-cancelled-label",
  ];
  const commands = [
    "cmd_status_none",
    "cmd_status_tentative",
    "cmd_status_confirmed",
    "cmd_status_cancelled",
  ];
  let found = false;
  setBooleanAttribute("status-status", "collapsed", true);
  commands.forEach((aElement, aIndex, aArray) => {
    let node = document.getElementById(aElement);
    let matches = node.getAttribute("value") == aArg.status;
    found = found || matches;

    node.setAttribute("checked", matches ? "true" : "false");

    if (aIndex > 0) {
      setBooleanAttribute(statusLabels[aIndex - 1], "hidden", !matches);
      if (matches) {
        setBooleanAttribute("status-status", "collapsed", false);
      }
    }
  });
  if (!found) {
    // The current Status value is invalid. Change the status to
    // "not specified" and update the status again.
    sendMessage({ command: "editStatus", value: "NONE" });
  }
}

/**
 * Handler for changing the transparency.
 *
 * @param {Node} aTarget  Has the new transparency in its "value" attribute
 */
function editShowTimeAs(aTarget) {
  let newValue = aTarget.getAttribute("value");
  editConfigState({ showTimeAs: newValue });
}

/**
 * Update the dialog controls related to transparency.
 *
 * @param {Object} aArg             Contains the new transparency value
 * @param {string} aArg.showTimeAs  The new transparency value
 */
function updateShowTimeAs(aArg) {
  let showAsBusy = document.getElementById("cmd_showtimeas_busy");
  let showAsFree = document.getElementById("cmd_showtimeas_free");

  showAsBusy.setAttribute("checked", aArg.showTimeAs == "OPAQUE" ? "true" : "false");
  showAsFree.setAttribute("checked", aArg.showTimeAs == "TRANSPARENT" ? "true" : "false");

  setBooleanAttribute(
    "status-freebusy",
    "collapsed",
    aArg.showTimeAs != "OPAQUE" && aArg.showTimeAs != "TRANSPARENT"
  );
  setBooleanAttribute("status-freebusy-free-label", "hidden", aArg.showTimeAs == "OPAQUE");
  setBooleanAttribute("status-freebusy-busy-label", "hidden", aArg.showTimeAs == "TRANSPARENT");
}

/**
 * Change the task percent complete (and thus task status).
 *
 * @param {short} aPercentComplete  The new percent complete value
 */
function editToDoStatus(aPercentComplete) {
  sendMessage({ command: "editToDoStatus", value: aPercentComplete });
}

/**
 * Check or uncheck the "Mark updated" menu item in "Events and Tasks"
 * menu based on the percent complete value.
 *
 * @param {Object} aArg                 Container
 * @param {short} aArg.percentComplete  The percent complete value
 */
function updateMarkCompletedMenuItem(aArg) {
  // Command only for tab case, function only to be executed in dialog windows.
  if (gTabmail) {
    let completedCommand = document.getElementById("calendar_toggle_completed_command");
    let isCompleted = aArg.percentComplete == 100;
    completedCommand.setAttribute("checked", isCompleted);
  }
}

/**
 * Postpone the task's start date/time and due date/time. ISO 8601
 * format: "PT1H", "P1D", and "P1W" are 1 hour, 1 day, and 1 week. (We
 * use this format intentionally instead of a calIDuration object because
 * those objects cannot be serialized for message passing with iframes.)
 *
 * @param {string} aDuration  A duration in ISO 8601 format
 */
function postponeTask(aDuration) {
  sendMessage({ command: "postponeTask", value: aDuration });
}

/**
 * Get the timezone button state.
 *
 * @return {boolean}  True is active/checked and false is inactive/unchecked
 */
function getTimezoneCommandState() {
  let cmdTimezone = document.getElementById("cmd_timezone");
  return cmdTimezone.getAttribute("checked") == "true";
}

/**
 * Set the timezone button state.  Used to keep the toolbar button in
 * sync when switching tabs.
 *
 * @param {Object} aArg                    Contains timezones property
 * @param {boolean} aArg.timezonesEnabled  Are timezones enabled?
 */
function updateTimezoneCommand(aArg) {
  let cmdTimezone = document.getElementById("cmd_timezone");
  cmdTimezone.setAttribute("checked", aArg.timezonesEnabled);
  gConfig.timezonesEnabled = aArg.timezonesEnabled;
}

/**
 * Toggles the command that allows enabling the timezone links in the dialog.
 */
function toggleTimezoneLinks() {
  let cmdTimezone = document.getElementById("cmd_timezone");
  let currentState = getTimezoneCommandState();
  cmdTimezone.setAttribute("checked", currentState ? "false" : "true");
  gConfig.timezonesEnabled = !currentState;
  sendMessage({ command: "toggleTimezoneLinks", checked: !currentState });
}

/**
 * Toggles the visibility of the related link (rfc2445 URL property).
 */
function toggleLink() {
  let linkCommand = document.getElementById("cmd_toggle_link");
  let checked = linkCommand.getAttribute("checked") == "true";

  linkCommand.setAttribute("checked", checked ? "false" : "true");
  sendMessage({ command: "toggleLink", checked: !checked });
}

/**
 * Prompts the user to attach an url to this item.
 */
function attachURL() {
  sendMessage({ command: "attachURL" });
}

/**
 * Updates dialog controls related to item attachments.
 *
 * @param {Object}  aArg                   Container
 * @param {boolean} aArg.attachUrlCommand  Enable the attach url command?
 */
function updateAttachment(aArg) {
  setElementValue("cmd_attach_url", !aArg.attachUrlCommand && "true", "disabled");
}

/**
 * Updates attendees command enabled/disabled state.
 *
 * @param {Object}  aArg                   Container
 * @param {boolean} aArg.attendeesCommand  Enable the attendees command?
 */
function updateAttendeesCommand(aArg) {
  setElementValue("cmd_attendees", !aArg.attendeesCommand, "disabled");
}

/**
 * Enables/disables the commands cmd_accept and cmd_save related to the
 * save operation.
 *
 * @param {boolean} aEnable  Enable the commands?
 */
function enableAcceptCommand(aEnable) {
  setElementValue("cmd_accept", !aEnable, "disabled");
  setElementValue("cmd_save", !aEnable, "disabled");
}

/**
 * Enable and un-collapse all elements that are disable-on-readonly and
 * collapse-on-readonly.
 */
function removeDisableAndCollapseOnReadonly() {
  let enableElements = document.getElementsByAttribute("disable-on-readonly", "true");
  for (let element of enableElements) {
    element.removeAttribute("disabled");
  }
  let collapseElements = document.getElementsByAttribute("collapse-on-readonly", "true");
  for (let element of collapseElements) {
    element.removeAttribute("collapsed");
  }
}

/**
 * Handler to toggle toolbar visibility.
 *
 * @param {string} aToolbarId   The id of the toolbar node to toggle
 * @param {string} aMenuitemId  The corresponding menuitem in the view menu
 */
function onCommandViewToolbar(aToolbarId, aMenuItemId) {
  let toolbar = document.getElementById(aToolbarId);
  let menuItem = document.getElementById(aMenuItemId);

  if (!toolbar || !menuItem) {
    return;
  }

  let toolbarCollapsed = toolbar.collapsed;

  // toggle the checkbox
  menuItem.setAttribute("checked", toolbarCollapsed);

  // toggle visibility of the toolbar
  toolbar.collapsed = !toolbarCollapsed;

  Services.xulStore.persist(toolbar, "collapsed");
  Services.xulStore.persist(menuItem, "checked");
}

/**
 * Called after the customize toolbar dialog has been closed by the
 * user. We need to restore the state of all buttons and commands of
 * all customizable toolbars.
 *
 * @param {boolean} aToolboxChanged  When true the toolbox has changed
 */
function dialogToolboxCustomizeDone(aToolboxChanged) {
  // Re-enable menu items (disabled during toolbar customization).
  let menubarId = gTabmail ? "mail-menubar" : "event-menubar";
  let menubar = document.getElementById(menubarId);
  for (let menuitem of menubar.children) {
    menuitem.removeAttribute("disabled");
  }

  // make sure our toolbar buttons have the correct enabled state restored to them...
  document.commandDispatcher.updateCommands("itemCommands");

  // Enable the toolbar context menu items
  document.getElementById("cmd_customize").removeAttribute("disabled");

  // Update privacy items to make sure the toolbarbutton's menupopup is set
  // correctly
  updatePrivacy(gConfig);
}

/**
 * Handler to start the customize toolbar dialog for the event dialog's toolbar.
 */
function onCommandCustomize() {
  // install the callback that handles what needs to be
  // done after a toolbar has been customized.
  let toolboxId = "event-toolbox";

  let toolbox = document.getElementById(toolboxId);
  toolbox.customizeDone = dialogToolboxCustomizeDone;

  // Disable menu items during toolbar customization.
  let menubarId = gTabmail ? "mail-menubar" : "event-menubar";
  let menubar = document.getElementById(menubarId);
  for (let menuitem of menubar.children) {
    menuitem.setAttribute("disabled", true);
  }

  // Disable the toolbar context menu items
  document.getElementById("cmd_customize").setAttribute("disabled", "true");

  let wintype = document.documentElement.getAttribute("windowtype");
  wintype = wintype.replace(/:/g, "");

  window.openDialog(
    "chrome://messenger/content/customizeToolbar.xhtml",
    "CustomizeToolbar" + wintype,
    "chrome,all,dependent",
    document.getElementById(toolboxId), // toolbox dom node
    false, // is mode toolbar yes/no?
    null, // callback function
    "dialog"
  ); // name of this mode
}

/**
 * Add menu items to the UI for attaching files using a cloud provider.
 *
 * @param {Object[]} aItemObjects  Array of objects that each contain
 *                                 data to create a menuitem
 */
function loadCloudProviders(aItemObjects) {
  /**
   * Deletes any existing menu items in aParentNode that have a
   * cloudProviderAccountKey attribute.
   *
   * @param {Node} aParentNode  A menupopup containing menu items
   */
  function deleteAlreadyExisting(aParentNode) {
    for (let node of aParentNode.children) {
      if (node.cloudProviderAccountKey) {
        aParentNode.removeChild(node);
      }
    }
  }

  // Delete any existing menu items with a cloudProviderAccountKey,
  // needed for the tab case to prevent duplicate menu items, and
  // helps keep the menu items current.
  let toolbarPopup = document.getElementById("button-attach-menupopup");
  if (toolbarPopup) {
    deleteAlreadyExisting(toolbarPopup);
  }
  let optionsPopup = document.getElementById("options-attachments-menupopup");
  if (optionsPopup) {
    deleteAlreadyExisting(optionsPopup);
  }

  for (let itemObject of aItemObjects) {
    // Create a menu item.
    let item = document.createXULElement("menuitem");
    item.setAttribute("label", itemObject.label);
    item.setAttribute("observes", "cmd_attach_cloud");
    item.setAttribute(
      "oncommand",
      "attachFileByAccountKey(event.target.cloudProviderAccountKey); event.stopPropagation();"
    );

    if (itemObject.class) {
      item.setAttribute("class", itemObject.class);
      item.setAttribute("image", itemObject.image);
    }

    // Add the menu item to the UI.
    if (toolbarPopup) {
      toolbarPopup.appendChild(item.cloneNode(true)).cloudProviderAccountKey =
        itemObject.cloudProviderAccountKey;
    }
    if (optionsPopup) {
      // This one doesn't need to clone, just use the item itself.
      optionsPopup.appendChild(item).cloudProviderAccountKey = itemObject.cloudProviderAccountKey;
    }
  }
}

/**
 * Send a message to attach a file using a given cloud provider,
 * to be identified by the cloud provider's accountKey.
 *
 * @param {string} aAccountKey  The accountKey for a cloud provider
 */
function attachFileByAccountKey(aAccountKey) {
  sendMessage({ command: "attachFileByAccountKey", accountKey: aAccountKey });
}

/**
 * Updates the save controls depending on whether the event has attendees
 * @param {boolean} aSendNotSave
 */
function updateSaveControls(aSendNotSave) {
  if (window.calItemSaveControls && window.calItemSaveControls.state == aSendNotSave) {
    return;
  }

  let saveBtn = document.getElementById("button-save");
  let saveandcloseBtn = document.getElementById("button-saveandclose");
  let saveMenu =
    document.getElementById("item-save-menuitem") ||
    document.getElementById("calendar-save-menuitem");
  let saveandcloseMenu =
    document.getElementById("item-saveandclose-menuitem") ||
    document.getElementById("calendar-save-and-close-menuitem");

  // we store the initial label and tooltip values to be able to reset later
  if (!window.calItemSaveControls) {
    window.calItemSaveControls = {
      state: false,
      saveMenu: { label: saveMenu.label },
      saveandcloseMenu: { label: saveandcloseMenu.label },
      saveBtn: null,
      saveandcloseBtn: null,
    };
    // we need to check for each button whether it exists since toolbarbuttons
    // can be removed by customizing
    if (saveBtn) {
      window.window.calItemSaveControls.saveBtn = {
        label: saveBtn.label,
        tooltiptext: saveBtn.tooltip,
      };
    }
    if (saveandcloseBtn) {
      window.window.calItemSaveControls.saveandcloseBtn = {
        label: saveandcloseBtn.label,
        tooltiptext: saveandcloseBtn.tooltip,
      };
    }
  }

  // we update labels and tooltips but leave accesskeys as they are
  window.calItemSaveControls.state = aSendNotSave;
  if (aSendNotSave) {
    if (saveBtn) {
      saveBtn.label = cal.l10n.getString("calendar-event-dialog", "saveandsendButtonLabel");
      saveBtn.tooltiptext = cal.l10n.getString("calendar-event-dialog", "saveandsendButtonTooltip");
      saveBtn.setAttribute("mode", "send");
    }
    if (saveandcloseBtn) {
      saveandcloseBtn.label = cal.l10n.getString(
        "calendar-event-dialog",
        "sendandcloseButtonLabel"
      );
      saveandcloseBtn.tooltiptext = cal.l10n.getString(
        "calendar-event-dialog",
        "sendandcloseButtonTooltip"
      );
      saveandcloseBtn.setAttribute("mode", "send");
    }
    saveMenu.label = cal.l10n.getString("calendar-event-dialog", "saveandsendMenuLabel");
    saveandcloseMenu.label = cal.l10n.getString("calendar-event-dialog", "sendandcloseMenuLabel");
  } else {
    if (saveBtn) {
      saveBtn.label = window.calItemSaveControls.saveBtn.label;
      saveBtn.tooltiptext = window.calItemSaveControls.saveBtn.tooltip;
      saveBtn.removeAttribute("mode");
    }
    if (saveandcloseBtn) {
      saveandcloseBtn.label = window.calItemSaveControls.saveandcloseBtn.label;
      saveandcloseBtn.tooltiptext = window.calItemSaveControls.saveandcloseBtn.tooltip;
      saveandcloseBtn.removeAttribute("mode");
    }
    saveMenu.label = window.calItemSaveControls.saveMenu.label;
    saveandcloseMenu.label = window.calItemSaveControls.saveandcloseMenu.label;
  }
}
