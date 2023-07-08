window.onmessage = (event) => {
  const htmlTemplate = `<!DOCTYPE html>
<html>
  <head></head>
  <body></body>
</html>
`;
  const panel = event.data.body;
  document.querySelector('html').remove();
  if (typeof panel.content === 'string') {
    document.write(panel.content);
    if (!document.head) {
      document.querySelector('html').remove();
      document.write(htmlTemplate);
      document.write(panel.content);
    }
  } else {
    document.write(htmlTemplate);
  }

  if (Array.isArray(panel.styles)) {
    for (const styleElement of panel.styles) {
      if (typeof styleElement === 'string') {
        const nextStyle = document.createElement('style');
        if (nextStyle.styleSheet) {
          nextStyle.styleSheet.cssText = styleElement;
        } else {
          nextStyle.append(document.createTextNode(styleElement));
        }
        document.head.append(nextStyle);
      }
    }
  }

  if (Array.isArray(panel.scripts)) {
    for (const scriptElement of panel.scripts) {
      if (typeof scriptElement === 'string') {
        const nextScript = document.createElement('script');
        nextScript.innerHTML = scriptElement;
        document.head.append(nextScript);
      }
    }
  }

  window.onmessage = (event) => {
    switch (event.data.method) {
      case 'RUN':
        if (!event.data.function || !event.data.args) {
          return;
        }

        function getIndex(object, property) {
          if (property.includes('.')) {
            const property = property.split('.');
            return getIndex(object[property[0]], property.splice(1).join('.'));
          }

          return object[property];
        }

        const pos = getIndex(window, event.data.function);
        if (typeof pos === 'function') {
          pos(...event.data.args.map((arg) => (arg.type === 'normal' ? arg.value : window[arg.value])));
        }
        break;
      case 'SET':
        window[event.data.var] = event.data.value;
        break;
    }
  };
};
