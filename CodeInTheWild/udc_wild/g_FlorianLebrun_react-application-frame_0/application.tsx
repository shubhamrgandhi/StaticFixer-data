
export type MenuType = {
  menu: any[],
  callbacks: { [key: string]: Function }
}

export class ApplicationInstance {
  windowMenu: MenuType
  [addonName: string]: any

  installFeatures(features: { [key: string]: any }, onlyFunction?: boolean) {
    Object.keys(features).forEach(key => {
      if (!onlyFunction || (features[key] instanceof Function)) {
        this[key] = features[key]
      }
    })
  }
  injectAsProperty(clazz) {
    Object.defineProperty(clazz.prototype, "application", {
      value: Application,
      writable: false,
      enumerable: false,
      configurable: false,
    })
  }
  absoluteUrl(url: string): string {
    if (url[0] === '/') {
      return window.location.origin + url
    }
    return url
  }
  isHostedWindow(): boolean {
    return window.parent && window.parent !== window
  }
  redirectWindow(url: string) {
    url = this.absoluteUrl(url)
    if (this.isHostedWindow()) {
      window.parent.postMessage(JSON.stringify({ redirect: url, }), '*')
    }
    else {
      (window as any).location = url
    }
  }
  openWindow(url: string) {
    url = this.absoluteUrl(url)
    if (this.isHostedWindow()) {
      window.parent.postMessage(JSON.stringify({ open: url, }), '*')
    }
    else {
      (window as any).open(url)
    }
  }
  reloadWindow() {
    if (this.isHostedWindow()) {
      window.location.reload()
    }
    else {
      (window as any).reload()
    }
  }
  setWindowTitle(title: string, icon: string) {
    if (this.isHostedWindow()) {
      window.parent.postMessage(JSON.stringify({ infos: { title, icon } }), '*')
    }
    else {
      document.title = title
    }
  }
  setWindowMenu(menu: any[], callbacks?: { [key: string]: Function }) {
    this.windowMenu = {
      menu,
      callbacks,
    }
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(JSON.stringify({ menu }), '*')
    }
  }
  receiveHostMessage(msg) {
    if (msg.action && this.windowMenu && this.windowMenu.callbacks) {
      const callback = this.windowMenu.callbacks[msg.action]
      callback && callback(msg.action)
    }
  }
}

window.addEventListener("keydown", (e) => {
  if (Application.isHostedWindow()) {
    if (e.keyCode === 82 && e.ctrlKey) {
      Application.reloadWindow()
      e.preventDefault()
      e.stopPropagation()
    }
  }
})

window.addEventListener("message", (msg) => {
  try {
    const data = JSON.parse(msg.data)
    if (msg.source === window.parent) {
      return Application.receiveHostMessage(data)
    }
  }
  catch (e) { }
})

export function extendApplication(features: { [key: string]: any }) {
  Object.keys(features).forEach(key => {
    Object.defineProperty(ApplicationInstance.prototype, key, {
      value: features[key],
      writable: false,
      enumerable: false,
      configurable: false,
    })
  })
}

export const Application = new ApplicationInstance()
